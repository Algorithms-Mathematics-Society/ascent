import "server-only";
import { randomUUID } from "node:crypto";
import { adminDb } from "../firebaseAdmin";
import {
  getEmailConfig,
  sendResendEmail,
  safeEmailErrorCode,
  type EmailPayload,
} from "../email/resend";
import logger, { genReqId } from "../logger";
import { CERTIFICATE_CODES, getCertificateRecipient } from "./data";
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
    await sendResendEmail(
      config.apiKey,
      certificateCodeEmail(config, email, recipient.name, code),
      `ascent-2026/certificate-code/${emailHash}/${randomUUID()}`,
    );
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

/** Consume a code atomically. Wrong codes count an attempt; the fifth failure locks the code. */
export async function consumeCertificateCode(
  emailHash: string,
  code: string,
  now = Date.now(),
): Promise<boolean> {
  const ref = adminDb.collection(CERTIFICATE_CODES).doc(emailHash);
  return adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.exists ? snapshot.data() : undefined;
    if (!data) return false;
    const attempts =
      typeof data.attempts === "number" && Number.isSafeInteger(data.attempts)
        ? data.attempts
        : CERTIFICATE_MAX_CODE_ATTEMPTS;
    if (
      typeof data.expires_at !== "number" ||
      data.expires_at <= now ||
      attempts >= CERTIFICATE_MAX_CODE_ATTEMPTS
    )
      return false;
    if (!certificateCodeMatches(data.code_hash, emailHash, code)) {
      tx.update(ref, { attempts: attempts + 1 });
      return false;
    }
    tx.delete(ref);
    return true;
  });
}
