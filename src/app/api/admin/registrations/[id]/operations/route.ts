import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import { isSafeApplicationId } from "@/lib/adminDecision";
import {
  normalizeAdminTags,
  parseAdminNoteInput,
  parseAdminTagsInput,
} from "@/lib/adminOperations";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  requestHasSameOrigin,
  secureTokenEqual,
} from "@/lib/adminSecurity";
import { adminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";

const MAX_REQUEST_BYTES = 16 * 1024;

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readJson(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_REQUEST_BYTES) return null;
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return null;
  }
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function csrfMatches(request: NextRequest, submittedToken: unknown) {
  const cookieToken = request.cookies.get(ADMIN_CSRF_COOKIE)?.value;
  return (
    typeof submittedToken === "string" &&
    typeof cookieToken === "string" &&
    secureTokenEqual(submittedToken, cookieToken)
  );
}

function revisionValue(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

async function authorize(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return null;
  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  return verifyAdminSessionValue(sessionValue);
}

function refreshAdminViews(applicationId: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/registrations/${applicationId}`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await authorize(request);
  if (!session) {
    return noStoreJson({ success: false, error: "Your admin session has expired." }, 401);
  }
  if (!isSafeApplicationId(params.id)) {
    return noStoreJson({ success: false, error: "Registration not found." }, 404);
  }
  const body = await readJson(request);
  if (!body || !csrfMatches(request, body.csrfToken)) {
    return noStoreJson({ success: false, error: "Private note could not be saved." }, 403);
  }
  const parsed = parseAdminNoteInput(body);
  if (!parsed.ok) {
    return noStoreJson({ success: false, error: parsed.error }, 422);
  }

  const applicationRef = adminDb.collection("applications").doc(params.id);
  const operationsRef = adminDb
    .collection("admin_registration_operations")
    .doc(params.id);
  const noteRef = operationsRef.collection("notes").doc(randomUUID());
  const auditRef = adminDb
    .collection("audit_log")
    .doc(`admin_note_${params.id}_${randomUUID()}`);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const [application, operations] = await transaction.getAll(
        applicationRef,
        operationsRef,
      );
      if (!application.exists) return { kind: "not_found" as const };
      const currentRevision = revisionValue(operations.data()?.revision);
      if (currentRevision !== parsed.value.expectedRevision) {
        return { kind: "conflict" as const };
      }
      const nextRevision = currentRevision + 1;
      const timestamp = adminServerTimestamp();
      transaction.set(
        operationsRef,
        {
          subject_id: params.id,
          tags: normalizeAdminTags(operations.data()?.tags),
          note_count: revisionValue(operations.data()?.note_count) + 1,
          revision: nextRevision,
          updated_at: timestamp,
          updated_by: session.uid,
          updated_by_email: session.email,
        },
        { merge: true },
      );
      transaction.create(noteRef, {
        subject_id: params.id,
        body: parsed.value.note,
        actor_uid: session.uid,
        actor_email: session.email,
        created_at: timestamp,
      });
      transaction.create(auditRef, {
        subject_id: params.id,
        event: "ADMIN_NOTE_ADDED",
        actor: `admin:${session.uid}`,
        actor_email: session.email,
        reason: parsed.value.note,
        timestamp,
      });
      return { kind: "updated" as const, revision: nextRevision };
    });
    if (result.kind === "not_found") {
      return noStoreJson({ success: false, error: "Registration not found." }, 404);
    }
    if (result.kind === "conflict") {
      return noStoreJson(
        { success: false, error: "Operations changed in another tab. Refresh and try again." },
        409,
      );
    }
    refreshAdminViews(params.id);
    return noStoreJson({
      success: true,
      revision: result.revision,
      message: "Private note added.",
    });
  } catch (error) {
    console.error("admin_registration_note_failed", {
      applicationId: params.id,
      adminUid: session.uid,
      error,
    });
    return noStoreJson(
      { success: false, error: "Private note could not be saved. Nothing was changed." },
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await authorize(request);
  if (!session) {
    return noStoreJson({ success: false, error: "Your admin session has expired." }, 401);
  }
  if (!isSafeApplicationId(params.id)) {
    return noStoreJson({ success: false, error: "Registration not found." }, 404);
  }
  const body = await readJson(request);
  if (!body || !csrfMatches(request, body.csrfToken)) {
    return noStoreJson({ success: false, error: "Operational tags could not be saved." }, 403);
  }
  const parsed = parseAdminTagsInput(body);
  if (!parsed.ok) {
    return noStoreJson({ success: false, error: parsed.error }, 422);
  }

  const applicationRef = adminDb.collection("applications").doc(params.id);
  const operationsRef = adminDb
    .collection("admin_registration_operations")
    .doc(params.id);
  const auditRef = adminDb
    .collection("audit_log")
    .doc(`admin_tags_${params.id}_${randomUUID()}`);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const [application, operations] = await transaction.getAll(
        applicationRef,
        operationsRef,
      );
      if (!application.exists) return { kind: "not_found" as const };
      const currentRevision = revisionValue(operations.data()?.revision);
      if (currentRevision !== parsed.value.expectedRevision) {
        return { kind: "conflict" as const };
      }
      const currentTags = normalizeAdminTags(operations.data()?.tags);
      if (currentTags.join("|") === parsed.value.tags.join("|")) {
        return { kind: "unchanged" as const, revision: currentRevision };
      }
      const added = parsed.value.tags.filter((tag) => !currentTags.includes(tag));
      const removed = currentTags.filter((tag) => !parsed.value.tags.includes(tag));
      const nextRevision = currentRevision + 1;
      const timestamp = adminServerTimestamp();
      transaction.set(
        operationsRef,
        {
          subject_id: params.id,
          tags: parsed.value.tags,
          revision: nextRevision,
          updated_at: timestamp,
          updated_by: session.uid,
          updated_by_email: session.email,
        },
        { merge: true },
      );
      transaction.create(auditRef, {
        subject_id: params.id,
        event: "ADMIN_TAGS_UPDATED",
        actor: `admin:${session.uid}`,
        actor_email: session.email,
        tags_added: added,
        tags_removed: removed,
        reason: [
          added.length ? `Added ${added.join(", ")}` : null,
          removed.length ? `Removed ${removed.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        timestamp,
      });
      return { kind: "updated" as const, revision: nextRevision };
    });
    if (result.kind === "not_found") {
      return noStoreJson({ success: false, error: "Registration not found." }, 404);
    }
    if (result.kind === "conflict") {
      return noStoreJson(
        { success: false, error: "Operations changed in another tab. Refresh and try again." },
        409,
      );
    }
    refreshAdminViews(params.id);
    return noStoreJson({
      success: true,
      revision: result.revision,
      message:
        result.kind === "unchanged" ? "Tags are already current." : "Operational tags saved.",
    });
  } catch (error) {
    console.error("admin_registration_tags_failed", {
      applicationId: params.id,
      adminUid: session.uid,
      error,
    });
    return noStoreJson(
      { success: false, error: "Operational tags could not be saved. Nothing was changed." },
      500,
    );
  }
}
