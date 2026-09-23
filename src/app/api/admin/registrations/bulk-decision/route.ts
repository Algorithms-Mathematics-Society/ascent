import { EMAIL_OUTBOX, decisionEmailId, emailJob } from "@/lib/email/messages";
import { tryDeliverEmail } from "@/lib/email/delivery";
import { readBoundedJson } from "@/lib/requestBody";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import { parseAdminBulkDecisionInput } from "@/lib/adminBulkDecision";
import { isAdminDecision } from "@/lib/adminDecision";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  requestHasSameOrigin,
  secureTokenEqual,
} from "@/lib/adminSecurity";
import { adminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";

const MAX_REQUEST_BYTES = 24 * 1024;

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

function revisionValue(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

export async function PATCH(request: NextRequest) {
  if (!requestHasSameOrigin(request)) {
    return noStoreJson({ success: false, error: "Batch decision could not be saved." }, 403);
  }
  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  const session = await verifyAdminSessionValue(sessionValue);
  if (!session) {
    return noStoreJson({ success: false, error: "Your admin session has expired." }, 401);
  }
  const body = await readJson(request);
  if (!body || !csrfMatches(request, body.csrfToken)) {
    return noStoreJson({ success: false, error: "Batch decision could not be saved." }, 403);
  }
  const parsed = parseAdminBulkDecisionInput(body);
  if (!parsed.ok) {
    return noStoreJson({ success: false, error: parsed.error }, 422);
  }

  const batchId = randomUUID();
  const applicationRefs = parsed.value.applicationIds.map((id) =>
    adminDb.collection("applications").doc(id),
  );
  const decisionRefs = parsed.value.applicationIds.map((id) =>
    adminDb.collection("admin_registration_decisions").doc(id),
  );
  const auditRefs = parsed.value.applicationIds.map((id) =>
    adminDb
      .collection("audit_log")
      .doc(`admin_bulk_decision_${id}_${randomUUID()}`),
  );
  const batchRef = adminDb.collection("admin_bulk_operations").doc(batchId);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const documents = await transaction.getAll(
        ...applicationRefs,
        ...decisionRefs,
      );
      const applications = documents.slice(0, applicationRefs.length);
      const decisions = documents.slice(applicationRefs.length);
      const missing = applications
        .filter((document) => !document.exists)
        .map((document) => document.id);
      if (missing.length) return { kind: "not_found" as const, ids: missing };

      const changed = applications
        .filter((document) => {
          const value = document.data()?.admin_decision;
          return isAdminDecision(value) ? value !== "PENDING" : false;
        })
        .map((document) => document.id);
      if (changed.length) return { kind: "conflict" as const, ids: changed };

      const timestamp = adminServerTimestamp();
      const mailIds: string[] = [];
      applications.forEach((application, index) => {
        const decisionRef = decisionRefs[index];
        const previousDecision = decisions[index];
        const auditRef = auditRefs[index];
        transaction.update(application.ref, {
          admin_decision: parsed.value.decision,
          admin_decided_at: timestamp,
          updated_at: timestamp,
        });
        transaction.set(decisionRef, {
          subject_id: application.id,
          decision: parsed.value.decision,
          reason: parsed.value.reason,
          actor_uid: session.uid,
          actor_email: session.email,
          previous_decision: "PENDING",
          revision: revisionValue(previousDecision.data()?.revision) + 1,
          bulk_operation_id: batchId,
          decided_at: timestamp,
        });
        const revision = revisionValue(previousDecision.data()?.revision) + 1;
        const mailId = decisionEmailId(application.id, revision);
        mailIds.push(mailId);
        transaction.create(adminDb.collection(EMAIL_OUTBOX).doc(mailId), {
          ...emailJob("DECISION", application.id), decision: parsed.value.decision, revision,
        });
        transaction.create(auditRef, {
          subject_id: application.id,
          event:
            parsed.value.decision === "APPROVED"
              ? "REGISTRATION_APPROVED"
              : "REGISTRATION_WAITLISTED",
          actor: `admin:${session.uid}`,
          actor_email: session.email,
          previous_decision: "PENDING",
          decision: parsed.value.decision,
          reason: parsed.value.reason,
          bulk_operation_id: batchId,
          timestamp,
        });
      });
      transaction.create(batchRef, {
        operation: "REGISTRATION_DECISION",
        application_ids: parsed.value.applicationIds,
        count: parsed.value.applicationIds.length,
        decision: parsed.value.decision,
        reason: parsed.value.reason,
        actor_uid: session.uid,
        actor_email: session.email,
        created_at: timestamp,
      });
      return { kind: "updated" as const, mailIds };
    });

    if (result.kind === "not_found") {
      return noStoreJson(
        {
          success: false,
          error: "One or more registrations no longer exist. Refresh the queue.",
        },
        404,
      );
    }
    if (result.kind === "conflict") {
      return noStoreJson(
        {
          success: false,
          error: "At least one selected registration was already decided. Refresh the queue.",
          changedCount: result.ids.length,
        },
        409,
      );
    }

    const deliveryDeadline = Date.now() + 8000;
    for (const id of result.mailIds) {
      if (Date.now() >= deliveryDeadline) break;
      const outcome = await tryDeliverEmail(id);
      if (outcome === "DISABLED" || outcome === "RETRY") break;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    revalidatePath("/admin");
    for (const applicationId of parsed.value.applicationIds) {
      revalidatePath(`/admin/registrations/${applicationId}`);
    }
    return noStoreJson({
      success: true,
      batchId,
      processed: parsed.value.applicationIds.length,
      decision: parsed.value.decision,
      message: `${parsed.value.applicationIds.length} registrations updated.`,
    });
  } catch (error) {
    console.error("admin_bulk_registration_decision_failed", {
      batchId,
      count: parsed.value.applicationIds.length,
      adminUid: session.uid,
      error,
    });
    return noStoreJson(
      { success: false, error: "Batch decision could not be saved. Nothing was changed." },
      500,
    );
  }
}

export const maxDuration = 30;
