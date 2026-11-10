import { NextRequest, NextResponse } from "next/server";
import { requestHasSameOrigin } from "@/lib/adminSecurity";
import { readBoundedJson, RequestBodyTooLarge } from "@/lib/requestBody";
import { adminDb } from "@/lib/firebaseAdmin";
import { consumeSlidingWindows, sha256 } from "@/lib/rateLimit";
import logger, { genReqId } from "@/lib/logger";
import { clientIp } from "@/lib/botProtection";
import { normalizeEmail } from "@/lib/validators";
import { certificateVerifyIpWindow, redeemCertificateCode } from "@/lib/certificates/codes";
import { buildCertificateSummary, rememberCertificateRecipient } from "@/lib/certificates/data";
import {
  CERTIFICATE_COOKIE, CERTIFICATE_SESSION_TTL_SECONDS, certificateKey, normalizeCertificateCode, signCertificateSession,
} from "@/lib/certificates/tokens";

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
const INVALID_CODE = "That code is incorrect or has expired. Request a new one.";

export const maxDuration = 30;
const TOO_MANY_ATTEMPTS = "Too many attempts. Please try again later.";

export async function POST(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return reply({ error: "Request not accepted." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ error: "Invalid request." }, 415);
  if (!certificateKey()) return reply({ error: "Certificate downloads are not available yet. Contact team@amshq.in for help." }, 503);
  let actorId: string | undefined;
  try {
    // Parse before any round trip (the body is capped at 2KB). A malformed
    // request still spends an IP slot and still sees 429 first when over it.
    let rejection: NextResponse | null = null;
    let parsed: { email?: unknown; code?: unknown } | undefined;
    try { parsed = await readBoundedJson(request, 2048) as { email?: unknown; code?: unknown }; } catch (error) {
      if (error instanceof RequestBodyTooLarge) rejection = reply({ error: "The request is too large." }, 413);
      else if (error instanceof SyntaxError) rejection = reply({ error: "Invalid request." }, 400);
      else throw error;
    }
    const email = normalizeEmail(typeof parsed?.email === "string" ? parsed.email : "");
    const code = normalizeCertificateCode(parsed?.code);
    if (!rejection && (!email.valid || !email.normalized)) rejection = reply({ error: "Enter a valid email address." }, 400);
    if (!rejection && !code) rejection = reply({ error: "Enter the 6-digit code from your email." }, 400);
    const emailHash = email.normalized ? sha256(email.normalized) : undefined;
    actorId = emailHash?.slice(0, 16);
    // The IP slot is its own small transaction on one random shard (re-picked
    // on every retry), so a campus behind one NAT spreads over 20 documents
    // and never holds those locks while the per-user redemption runs.
    const ip = await consumeSlidingWindows(adminDb, [certificateVerifyIpWindow(sha256(clientIp(request)))]);
    if (ip.overLimitIndex >= 0) return reply({ error: TOO_MANY_ATTEMPTS }, 429);
    if (rejection || !emailHash || !code) return rejection ?? reply({ error: "Invalid request." }, 400);
    // One per-user transaction: failure cap (across codes), code check and
    // consume, failure record, and the recipient for the summary.
    const result = await redeemCertificateCode(emailHash, code);
    if (result.status === "email_limited") return reply({ error: "Too many incorrect codes for this email. Try again in an hour, or contact team@amshq.in." }, 429);
    if (result.status === "invalid" || !result.recipient) return reply({ error: INVALID_CODE }, 401);
    rememberCertificateRecipient(emailHash, result.recipient);
    const session = signCertificateSession(emailHash);
    const response = reply({ ok: true, certificate: buildCertificateSummary(result.recipient) });
    response.cookies.set(CERTIFICATE_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: CERTIFICATE_SESSION_TTL_SECONDS });
    return response;
  } catch (error) {
    // Never the email, the code or the IP: a truncated email hash at most.
    logger.error("certificates", "verify_failed", { reqId: genReqId(), actorId, status: "failed" }, error);
    return reply({ error: "Could not check this code. Please try again." }, 503);
  }
}
