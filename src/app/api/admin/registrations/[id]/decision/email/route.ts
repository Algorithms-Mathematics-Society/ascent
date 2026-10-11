import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import { isSafeApplicationId } from "@/lib/adminDecision";
import { summarizeDecisionEmail } from "@/lib/adminDecisionEmail";
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE, requestHasSameOrigin, secureTokenEqual } from "@/lib/adminSecurity";
import { adminDb } from "@/lib/firebaseAdmin";
import { readBoundedJson } from "@/lib/requestBody";
import { EMAIL_OUTBOX, decisionEmailId } from "@/lib/email/messages";
import { getEmailConfig } from "@/lib/email/resend";
import { tryDeliverEmail } from "@/lib/email/delivery";

export const maxDuration = 30;
const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Retry only the existing, due job. Delivery rechecks eligibility and takes its own lease. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await verifyAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "");
  if (!session || session.role !== "OWNER") return reply({ error: "Owner access required." }, 403);
  const csrf = request.headers.get("x-csrf-token");
  if (!requestHasSameOrigin(request) || !csrf || !secureTokenEqual(csrf, request.cookies.get(ADMIN_CSRF_COOKIE)?.value || "")) {
    return reply({ error: "Request not accepted." }, 403);
  }
  if (!isSafeApplicationId(params.id)) return reply({ error: "Registration not found." }, 404);
  let expectedRevision: unknown;
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) throw new Error();
    const body = await readBoundedJson(request, 1024);
    expectedRevision = body && typeof body === "object" && "expectedRevision" in body ? body.expectedRevision : undefined;
  } catch { return reply({ error: "Refresh this registration before retrying email." }, 422); }
  if (typeof expectedRevision !== "number" || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    return reply({ error: "Refresh this registration before retrying email." }, 422);
  }
  try {
    const mailId = decisionEmailId(params.id, expectedRevision);
    const [application, decision, email] = await adminDb.getAll(
      adminDb.collection("applications").doc(params.id),
      adminDb.collection("admin_registration_decisions").doc(params.id),
      adminDb.collection(EMAIL_OUTBOX).doc(mailId),
    );
    if (!application.exists) return reply({ error: "Registration not found." }, 404);
    const app = application.data();
    const latest = decision.data();
    const job = email.data();
    if (app?.state === "WITHDRAWN" || app?.state === "DELETED" ||
        latest?.revision !== expectedRevision || latest?.decision !== app?.admin_decision ||
        job?.kind !== "DECISION" || job.source_id !== params.id ||
        job.revision !== expectedRevision || job.decision !== latest?.decision) {
      return reply({ error: "This decision email is no longer current. Refresh the registration." }, 409);
    }
    const configured = Boolean(getEmailConfig());
    if (!configured) return reply({ error: "Email delivery is disabled. The queued message is retained." }, 503);
    if (!summarizeDecisionEmail(job, configured, true).canRetry) {
      return reply({ error: "This message is not due for retry. Refresh its status; messages needing review must be checked in Resend." }, 409);
    }
    await tryDeliverEmail(mailId);
    // Read persisted state: a competing worker may already have handled this job.
    const updated = await adminDb.collection(EMAIL_OUTBOX).doc(mailId).get();
    return reply({ success: true, decisionEmail: summarizeDecisionEmail(updated.data(), configured, true) });
  } catch {
    return reply({ error: "Email processing could not be confirmed. Refresh its status before retrying; the decision is unchanged." }, 503);
  }
}
