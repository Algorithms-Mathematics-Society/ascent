import { signStatusToken, statusSecret, verifyStatusToken } from "../candidate/tokens";
import { sha256 } from "../rateLimit";
import { EDITION } from "../constants";
import { REGISTRATION_OPENS_AT } from "../registrationLaunch";
import "server-only";
import { randomUUID } from "node:crypto";
import { adminDb } from "../firebaseAdmin";
import { normalizeEmail } from "../validators";
import { buildEmailMessage, EMAIL_OUTBOX, type EmailJob } from "./messages";
import { getEmailConfig, sendResendEmail, ResendRejectedError, safeEmailErrorCode, type EmailPayload } from "./resend";

const LEASE_MS = 120_000;
const NEVER = Number.MAX_SAFE_INTEGER;
// Resend keeps idempotency keys for 24h. Leave a margin and require review
// rather than risk duplicating a message with an ambiguous old provider outcome.
const SAFE_RETRY_MS = 23 * 60 * 60 * 1000;

type StoredJob = EmailJob & { payload?: EmailPayload; first_attempt_at?: number; lease?: string; uncertain?: boolean; generation?: number };

export async function deliverEmail(id: string): Promise<string> {
  const config = getEmailConfig();
  if (!config) return "DISABLED";
  const ref = adminDb.collection(EMAIL_OUTBOX).doc(id);
  const lease = randomUUID();
  const claimed = await adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return null;
    const job = snapshot.data() as StoredJob;
    const now = Date.now();
    if (!["PENDING", "RETRY", "SENDING"].includes(job.status) || job.due_at > now) return null;
    function stop(status: "SKIPPED" | "REVIEW", reason: string) {
      tx.update(ref, { status, due_at: NEVER, payload: null, request_email: null, lease: null, last_error: reason });
      return { outcome: status };
    }
    function suppress(reason: string) {
      // An earlier timeout may already have reached the provider. Stop further
      // attempts but keep that uncertainty visible for operator reconciliation.
      return stop(job.uncertain ? "REVIEW" : "SKIPPED", reason +
        (job.uncertain ? " An earlier attempt may have been accepted; check Resend." : ""));
    }
    let subjectId = job.source_id;
    if (job.kind === "STATUS_ACCESS") {
      if (!statusSecret()) return stop("REVIEW", "Status access configuration is missing.");
      if (job.request_expires_at === undefined || job.request_expires_at <= now) return suppress("Status-link request expired. The candidate can request another link.");
      const index = await tx.get(adminDb.collection("emails").doc(`${EDITION}_${job.source_id}`));
      const subject = index.data()?.subject_id;
      if (typeof subject !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(subject)) return suppress("No available entry for this request.");
      subjectId = subject;
    }
    let email: unknown;
    let reference: string | undefined;
    let qualificationPath: string | undefined;
    // Recheck the source on EVERY attempt, including retries with a frozen
    // payload. Freezing an idempotent payload does not authorize stale sends.
    if (job.kind === "REGISTRATION_REMINDER") {
      const reminder = await tx.get(adminDb.collection("registration_reminders").doc(job.source_id));
      if (!reminder.exists) return suppress("Reminder request removed.");
      email = reminder.data()?.email;
    } else {
      const [application, pii] = await tx.getAll(
        adminDb.collection("applications").doc(subjectId),
        adminDb.collection("pii").doc(subjectId),
      );
      if (!application.exists || !pii.exists || (application.data()?.state === "DELETED" || (job.kind !== "STATUS_ACCESS" && application.data()?.state === "WITHDRAWN"))) {
        return suppress("Application or recipient unavailable.");
      }
      if (job.kind === "DECISION") {
        const latest = await tx.get(adminDb.collection("admin_registration_decisions").doc(job.source_id));
        if (latest.data()?.revision !== job.revision || latest.data()?.decision !== job.decision) {
          return suppress("Superseded by a newer decision.");
        }
      }
      email = pii.data()?.email;
      reference = application.data()?.reference;
      qualificationPath = application.data()?.qualification_path;
    }
    const normalized = normalizeEmail(typeof email === "string" ? email : "");
    if (!normalized.valid || !normalized.normalized) {
      return stop("REVIEW", "Recipient is missing or invalid. Check any earlier attempt in Resend.");
    }
    if (job.kind === "STATUS_ACCESS" && (sha256(normalized.normalized) !== job.source_id || normalized.normalized !== job.request_email)) {
      return suppress("Recipient no longer matches the status request.");
    }
    if (job.payload && job.payload.to !== normalized.normalized) {
      return stop("REVIEW", "Recipient changed after an attempt. Check Resend before sending to the corrected address.");
    }
    if (job.first_attempt_at && now - job.first_attempt_at >= SAFE_RETRY_MS) {
      return stop("REVIEW", "Idempotency window expired. Check Resend before any manual resend.");
    }
    const opensAt = Date.parse(REGISTRATION_OPENS_AT);
    // Existing scheduled payloads must remain byte-identical on retries.
    if (!job.payload && job.kind === "REGISTRATION_REMINDER" && opensAt > now && opensAt - now < 60000) {
      tx.update(ref, { due_at: opensAt + 1000 });
      return null;
    }
    let payload = job.payload;
    let statusUrl: string | undefined;
    if (payload && job.kind === "STATUS_ACCESS") {
      const token = payload.text.match(/#token=([A-Za-z0-9_.-]+)/)?.[1];
      if (!verifyStatusToken(token, "link")) return stop("REVIEW", "Status link expired. The candidate can request a fresh link.");
    }
    if (!payload) {
      if (job.kind === "STATUS_ACCESS") {
        const access = signStatusToken("link", subjectId, job.source_id, now);
        statusUrl = `${config.siteUrl}/register/status#token=${access.token}`;
        tx.create(adminDb.collection("candidate_access_tokens").doc(sha256(access.token)), {
          subject_id: subjectId, expires_at: access.claims.expires, used_at: null,
          expiresAt: new Date(access.claims.expires + 86400000),
        });
      }
      payload = { from: config.from, replyTo: config.replyTo, to: normalized.normalized,
        ...buildEmailMessage(job, { reference, qualificationPath, statusUrl }, config.siteUrl),
        ...(job.kind === "REGISTRATION_REMINDER" && opensAt > now ? { scheduledAt: new Date(opensAt).toISOString() } : {}) };
    }
    tx.update(ref, { status: "SENDING", lease, due_at: now + LEASE_MS,
      first_attempt_at: job.first_attempt_at || now, attempts: job.attempts + 1, payload, uncertain: true });
    return { payload, attempts: job.attempts + 1, priorUncertain: job.uncertain === true, generation: job.generation || 0 };
  });
  if (!claimed) return "SKIPPED";
  if ("outcome" in claimed) return claimed.outcome;

  async function finish(fields: Record<string, unknown>) {
    await adminDb.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (current.data()?.lease === lease) tx.update(ref, fields);
    });
  }
  try {
    const providerId = await sendResendEmail(config.apiKey, claimed.payload, `ascent-2026/${id}/${claimed.generation}`);
    const status = claimed.payload.scheduledAt ? "SCHEDULED" : "SENT";
    await finish({ status, due_at: NEVER, provider_id: providerId, accepted_at: Date.now(), request_email: null, uncertain: false, last_error: null });
    return status;
  } catch (error) {
    const code = safeEmailErrorCode(error);
    // A malformed message will not heal by retrying, and must not stop every
    // daily batch ahead of otherwise valid mail. Account/rate failures can heal.
    const permanent = error instanceof ResendRejectedError && [400, 404, 422].includes(error.statusCode);
    const status = permanent ? "REVIEW" : "RETRY";
    await finish({ status, due_at: permanent ? NEVER : Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(claimed.attempts - 1, 6)), last_error: code.slice(0, 120),
      ...(error instanceof ResendRejectedError && !claimed.priorUncertain
        ? { first_attempt_at: null, payload: null, uncertain: false, generation: claimed.generation + 1 }
        : {}),
    });
    return status;
  }
}

/** Never turn a committed application or decision into an HTTP failure because of email. */
export async function tryDeliverEmail(id: string) {
  try { return await deliverEmail(id); }
  catch { return "RETRY"; }
}
