import "server-only";
import { randomUUID } from "node:crypto";
import { adminDb } from "../firebaseAdmin";
import {
  getEmailConfig,
  ResendRejectedError,
  sendResendEmail,
  safeEmailErrorCode,
  type EmailPayload,
} from "../email/resend";
import logger, { genReqId } from "../logger";
import { recentTimestamps, type SlidingWindowSpec } from "../rateLimit";
import {
  CERTIFICATE_CODES,
  CERTIFICATE_RECIPIENTS,
  getCertificateRecipient,
  parseRecipient,
  type CertificateRecipient,
} from "./data";
import {
  CERTIFICATE_CODE_TTL_MS,
  CERTIFICATE_MAX_CODE_ATTEMPTS,
  certificateCodeMatches,
  generateCertificateCode,
  hashCertificateCode,
} from "./tokens";

type EmailConfig = NonNullable<ReturnType<typeof getEmailConfig>>;

export function certificateCodeEmail(
  config: EmailConfig,
  to: string,
  name: string,
  code: string,
): EmailPayload {
  return {
    from: config.from,
    to,
    replyTo: config.replyTo,
    subject: `Your Ascent ’26 certificate code: ${code}`,
    text: [
      `Hello ${name},`,
      "",
      `Your Ascent ’26 Round 1 certificate code is: ${code}`,
      "",
      "It expires in 10 minutes.",
      "",
      `Enter it at ${config.siteUrl}/certificate to preview and download your certificate.`,
      "",
      "If you did not request this code, you can ignore this email. Nobody can open your certificate without it.",
      "",
      "Regards,\nAlgorithms & Mathematics Society (AMS)",
    ].join("\n"),
  };
}

/**
 * Runs after the 202 response. Unknown emails do nothing. Never throws, and
 * never logs the email address or the code.
 */
export async function issueCertificateCode(
  emailHash: string,
  email: string,
): Promise<void> {
  const reqId = genReqId();
  const actorId = emailHash.slice(0, 16);
  try {
    const config = getEmailConfig();
    if (!config) return;
    const recipient = await getCertificateRecipient(emailHash);
    if (!recipient) return;
    const code = generateCertificateCode();
    const now = Date.now();
    await adminDb
      .collection(CERTIFICATE_CODES)
      .doc(emailHash)
      .set({
        code_hash: hashCertificateCode(emailHash, code),
        expires_at: now + CERTIFICATE_CODE_TTL_MS,
        attempts: 0,
        created_at: now,
        expiresAt: new Date(now + CERTIFICATE_CODE_TTL_MS),
      });
    const payload = certificateCodeEmail(config, email, recipient.name, code);
    // One key for both attempts: Resend deduplicates, so a retry after an
    // ambiguous timeout can never deliver two different codes.
    const idempotencyKey = `ascent-2026/certificate-code/${emailHash}/${randomUUID()}`;
    for (let attempt = 1; ; attempt++) {
      try {
        await sendResendEmail(config.apiKey, payload, idempotencyKey);
        break;
      } catch (error) {
        const permanent =
          error instanceof ResendRejectedError && error.statusCode !== 429;
        if (permanent || attempt >= 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
    logger.info("certificates", "code_sent", { reqId, actorId, status: "ok" });
  } catch (error) {
    logger.error("certificates", "code_send_failed", {
      reqId,
      actorId,
      detail: { code: safeEmailErrorCode(error) },
      status: "failed",
    });
  }
}

// Wrong guesses are capped per email across codes, because requesting a new
// code resets the per-code attempt counter.
export const CERTIFICATE_FAILURES = "_rate_limits_certificate_failures";
export const CERTIFICATE_MAX_FAILURES = 10;
export const CERTIFICATE_FAILURE_WINDOW_MS = 3600000;

// Window shapes for the two certificate routes. Shard counts divide each
// ceiling exactly, so the totals stay 200 per IP-hour and 2000 per day.
/** 200 verify attempts per IP and hour: 20 shards of 10, so one campus NAT does not queue on one document. */
export function certificateVerifyIpWindow(ipHash: string): SlidingWindowSpec {
  return { collection: "_rate_limits_certificate_verify", key: ipHash, maxCount: 200, windowMs: 3600000, shards: 20 };
}
/** 5 code requests per email and hour. */
export function certificateEmailWindow(emailHash: string): SlidingWindowSpec {
  return { collection: "_rate_limits_certificate_email", key: emailHash, maxCount: 5, windowMs: 3600000 };
}
/** About 2000 code requests a day in total: 20 shards of 100. */
export const CERTIFICATE_DAILY_WINDOW: SlidingWindowSpec = {
  collection: "_rate_limits_certificate_daily", key: "all", maxCount: 2000, windowMs: 86400000, shards: 20,
};

type CodeCheck = { matched: false; attemptsUsed?: number } | { matched: true };

function checkStoredCode(
  data: Record<string, unknown> | undefined,
  emailHash: string,
  code: string,
  now: number,
): CodeCheck {
  if (!data) return { matched: false };
  const attempts =
    typeof data.attempts === "number" && Number.isSafeInteger(data.attempts)
      ? data.attempts
      : CERTIFICATE_MAX_CODE_ATTEMPTS;
  if (
    typeof data.expires_at !== "number" ||
    data.expires_at <= now ||
    attempts >= CERTIFICATE_MAX_CODE_ATTEMPTS
  )
    return { matched: false };
  if (!certificateCodeMatches(data.code_hash, emailHash, code))
    return { matched: false, attemptsUsed: attempts + 1 };
  return { matched: true };
}

/** Consume a code atomically. Wrong codes count an attempt; the fifth failure locks the code. */
export async function consumeCertificateCode(
  emailHash: string,
  code: string,
  now = Date.now(),
): Promise<boolean> {
  const ref = adminDb.collection(CERTIFICATE_CODES).doc(emailHash);
  return adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const result = checkStoredCode(
      snapshot.exists ? snapshot.data() : undefined,
      emailHash,
      code,
      now,
    );
    if (result.matched) tx.delete(ref);
    else if (result.attemptsUsed !== undefined)
      tx.update(ref, { attempts: result.attemptsUsed });
    return result.matched;
  });
}

export type CertificateRedemption =
  | { status: "email_limited" }
  | { status: "invalid" }
  | { status: "ok"; recipient: CertificateRecipient | null };

/**
 * The per-user part of verify in one transaction, with every read in one
 * getAll: enforce the per-email failure cap, check and consume the code,
 * record a failure on any miss, and return the recipient read in the same
 * snapshot. It touches only this email's documents, so users never contend
 * with each other here. The caller reserves the IP slot first, separately.
 */
export async function redeemCertificateCode(
  emailHash: string,
  code: string,
): Promise<CertificateRedemption> {
  const failuresRef = adminDb.collection(CERTIFICATE_FAILURES).doc(emailHash);
  const codeRef = adminDb.collection(CERTIFICATE_CODES).doc(emailHash);
  const recipientRef = adminDb
    .collection(CERTIFICATE_RECIPIENTS)
    .doc(emailHash);
  return adminDb.runTransaction(async (tx) => {
    const [failuresSnap, codeSnap, recipientSnap] = await tx.getAll(
      failuresRef,
      codeRef,
      recipientRef,
    );
    const now = Date.now();
    const failures = recentTimestamps(
      failuresSnap.data(),
      CERTIFICATE_FAILURE_WINDOW_MS,
      now,
    );
    if (failures.length >= CERTIFICATE_MAX_FAILURES)
      return { status: "email_limited" };
    const result = checkStoredCode(
      codeSnap.exists ? codeSnap.data() : undefined,
      emailHash,
      code,
      now,
    );
    if (!result.matched) {
      if (result.attemptsUsed !== undefined)
        tx.update(codeRef, { attempts: result.attemptsUsed });
      tx.set(failuresRef, {
        timestamps: [...failures, now].slice(-CERTIFICATE_MAX_FAILURES),
        expiresAt: new Date(
          now + CERTIFICATE_FAILURE_WINDOW_MS + 60 * 60 * 1000,
        ),
      });
      return { status: "invalid" };
    }
    tx.delete(codeRef);
    const recipient = recipientSnap.exists
      ? parseRecipient(recipientSnap.data())
      : null;
    return { status: "ok", recipient };
  });
}
