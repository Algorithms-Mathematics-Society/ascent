import { EMAIL_OUTBOX, decisionEmailId, emailJob } from "@/lib/email/messages";
import { tryDeliverEmail } from "@/lib/email/delivery";
import { waitUntil } from "@vercel/functions";
import { readBoundedJson } from "@/lib/requestBody";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import {
  isAdminDecision,
  isSafeApplicationId,
  parseAdminDecisionInput,
} from "@/lib/adminDecision";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  requestHasSameOrigin,
  secureTokenEqual,
} from "@/lib/adminSecurity";
import { adminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";

const MAX_REQUEST_BYTES = 8 * 1024;

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
    const body = (await readBoundedJson(request, MAX_REQUEST_BYTES)) as unknown;
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

function currentDecision(value: unknown) {
  return isAdminDecision(value) ? value : "PENDING";
}

function decisionEvent(decision: "APPROVED" | "WAITLISTED" | "REJECTED") {
  if (decision === "APPROVED") return "REGISTRATION_APPROVED";
  if (decision === "WAITLISTED") return "REGISTRATION_WAITLISTED";
  return "REGISTRATION_REJECTED";
}

function decisionMessage(decision: "APPROVED" | "WAITLISTED" | "REJECTED") {
  if (decision === "APPROVED") return "Registration approved.";
  if (decision === "WAITLISTED") return "Registration moved to the waitlist.";
  return "Registration rejected.";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!requestHasSameOrigin(request)) {
    return noStoreJson({ success: false, error: "Decision could not be saved." }, 403);
  }

  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  const session = await verifyAdminSessionValue(sessionValue);
  if (!session) {
    return noStoreJson({ success: false, error: "Your admin session has expired." }, 401);
  }
  if (!isSafeApplicationId(params.id)) {
    return noStoreJson({ success: false, error: "Registration not found." }, 404);
  }

  const body = await readJson(request);
  if (!body || !csrfMatches(request, body.csrfToken)) {
    return noStoreJson({ success: false, error: "Decision could not be saved." }, 403);
  }

  const parsed = parseAdminDecisionInput(body);
  if (!parsed.ok) {
    return noStoreJson({ success: false, error: parsed.error }, 422);
  }

  const applicationRef = adminDb.collection("applications").doc(params.id);
  const decisionRef = adminDb
    .collection("admin_registration_decisions")
    .doc(params.id);
  const auditRef = adminDb
    .collection("audit_log")
    .doc(`admin_decision_${params.id}_${randomUUID()}`);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const [application, previousRecord] = await transaction.getAll(
        applicationRef,
        decisionRef,
      );
      if (!application.exists) return { kind: "not_found" as const };
      if (["WITHDRAWN", "DELETED"].includes(application.data()?.state)) {
        return { kind: "inactive" as const };
      }

      const previousDecision = currentDecision(
        application.data()?.admin_decision,
      );
      const storedRevision = previousRecord.data()?.revision;
      const previousRevision =
        typeof storedRevision === "number" && Number.isSafeInteger(storedRevision) && storedRevision >= 0
          ? storedRevision
          : 0;
      if (
        previousDecision !== parsed.value.expectedDecision ||
        (parsed.value.expectedRevision !== undefined && parsed.value.expectedRevision !== previousRevision)
      ) {
        return {
          kind: "conflict" as const,
          currentDecision: previousDecision,
          currentRevision: previousRevision,
        };
      }

      const decisionData = {
        subject_id: params.id,
        decision: parsed.value.decision,
        reason: parsed.value.reason,
        actor_uid: session.uid,
        actor_email: session.email,
        previous_decision: previousDecision,
        revision: previousRevision + 1,
        decided_at: adminServerTimestamp(),
      };

      transaction.update(applicationRef, {
        admin_decision: parsed.value.decision,
        admin_decided_at: adminServerTimestamp(),
        updated_at: adminServerTimestamp(),
      });
      transaction.set(decisionRef, decisionData);
      const mailId = decisionEmailId(params.id, decisionData.revision);
      transaction.create(adminDb.collection(EMAIL_OUTBOX).doc(mailId), {
        ...emailJob("DECISION", params.id),
        decision: parsed.value.decision,
        ...(previousDecision !== "PENDING" ? { previous_decision: previousDecision } : {}),
        revision: decisionData.revision,
      });

      transaction.create(auditRef, {
        subject_id: params.id,
        event: decisionEvent(parsed.value.decision),
        actor: `admin:${session.uid}`,
        actor_email: session.email,
        previous_decision: previousDecision,
        decision: parsed.value.decision,
        reason: parsed.value.reason,
        revision: decisionData.revision,
        timestamp: adminServerTimestamp(),
      });

      return { kind: "updated" as const, mailId, revision: decisionData.revision };
    });

    if (result.kind === "not_found") {
      return noStoreJson({ success: false, error: "Registration not found." }, 404);
    }
    if (result.kind === "inactive") {
      return noStoreJson({ success: false, error: "Withdrawn or deleted registrations cannot be decided." }, 409);
    }
    if (result.kind === "conflict") {
      return noStoreJson(
        {
          success: false,
          error: "This registration's decision changed. Refresh before trying again.",
          currentDecision: result.currentDecision,
          currentRevision: result.currentRevision,
        },
        409,
      );
    }

    // The decision and durable email job are committed. Keep delivery alive
    // after the response without making the administrator wait for the provider.
    try {
      waitUntil(tryDeliverEmail(result.mailId).catch((error) => {
        console.error("admin_decision_email_delivery_failed", { applicationId: params.id, error });
      }));
    } catch (error) {
      console.error("admin_decision_email_background_failed", { applicationId: params.id, error });
    }
    try {
      revalidatePath("/admin");
      revalidatePath(`/admin/registrations/${params.id}`);
    } catch (error) {
      console.error("admin_decision_revalidation_failed", { applicationId: params.id, error });
    }
    return noStoreJson({
      success: true,
      decision: parsed.value.decision,
      decisionRevision: result.revision,
      emailStatus: "QUEUED",
      message: decisionMessage(parsed.value.decision),
    });
  } catch (error) {
    console.error("admin_registration_decision_failed", {
      applicationId: params.id,
      adminUid: session.uid,
      error,
    });
    return noStoreJson(
      {
        success: false,
        error: "Decision could not be saved. Nothing was changed.",
      },
      500,
    );
  }
}

export const maxDuration = 30;
