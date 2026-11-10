import { NextRequest, NextResponse } from "next/server";
import { requestHasSameOrigin } from "@/lib/adminSecurity";
import { readBoundedJson, RequestBodyTooLarge } from "@/lib/requestBody";
import { adminDb } from "@/lib/firebaseAdmin";
import { consumeSlidingWindow, sha256 } from "@/lib/rateLimit";
import { clientIp } from "@/lib/botProtection";
import { normalizeEmail } from "@/lib/validators";
import { consumeCertificateCode } from "@/lib/certificates/codes";
import { buildCertificateSummary, getCertificateRecipient } from "@/lib/certificates/data";
import {
  CERTIFICATE_COOKIE, CERTIFICATE_SESSION_TTL_SECONDS, certificateKey, normalizeCertificateCode, signCertificateSession,
} from "@/lib/certificates/tokens";

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
const INVALID_CODE = "That code is incorrect or has expired. Request a new one.";

export async function POST(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return reply({ error: "Request not accepted." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ error: "Invalid request." }, 415);
  if (!certificateKey()) return reply({ error: "Certificate downloads are not available yet. Contact team@amshq.in for help." }, 503);
  try {
    const limit = await consumeSlidingWindow(adminDb, "_rate_limits_certificate_verify", sha256(clientIp(request)), 30, 3600000);
    if (limit.overLimit) return reply({ error: "Too many attempts. Please try again later." }, 429);
    const body = await readBoundedJson(request, 2048) as { email?: unknown; code?: unknown };
    const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
    if (!email.valid || !email.normalized) return reply({ error: "Enter a valid email address." }, 400);
    const code = normalizeCertificateCode(body?.code);
    if (!code) return reply({ error: "Enter the 6-digit code from your email." }, 400);
    const emailHash = sha256(email.normalized);
    if (!(await consumeCertificateCode(emailHash, code))) return reply({ error: INVALID_CODE }, 401);
    const recipient = await getCertificateRecipient(emailHash);
    if (!recipient) return reply({ error: INVALID_CODE }, 401);
    const session = signCertificateSession(emailHash);
    const response = reply({ ok: true, certificate: buildCertificateSummary(recipient) });
    response.cookies.set(CERTIFICATE_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: CERTIFICATE_SESSION_TTL_SECONDS });
    return response;
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) return reply({ error: "The request is too large." }, 413);
    if (error instanceof SyntaxError) return reply({ error: "Invalid request." }, 400);
    return reply({ error: "Could not check this code. Please try again." }, 503);
  }
}
