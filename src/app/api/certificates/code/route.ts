import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { requestHasSameOrigin } from "@/lib/adminSecurity";
import { readBoundedJson } from "@/lib/requestBody";
import { verifyBot } from "@/lib/botProtection";
import { normalizeEmail } from "@/lib/validators";
import { adminDb } from "@/lib/firebaseAdmin";
import { consumeSlidingWindow, sha256 } from "@/lib/rateLimit";
import { getEmailConfig } from "@/lib/email/resend";
import { statusSecret } from "@/lib/candidate/tokens";
import { issueCertificateCode } from "@/lib/certificates/codes";
import { CERTIFICATE_CODE_ACCEPTED } from "@/lib/certificates/shared";

export const maxDuration = 30;
function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
const accepted = () => reply({ ok: true, message: CERTIFICATE_CODE_ACCEPTED }, 202);

export async function POST(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return reply({ error: "Request not accepted." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ error: "Invalid request." }, 415);
  if (!getEmailConfig() || !statusSecret()) return reply({ error: "Certificate downloads are not available yet. Contact team@amshq.in for help." }, 503);
  let body: Record<string, unknown>;
  try { body = await readBoundedJson(request, 4096) as Record<string, unknown>; } catch { return reply({ error: "Invalid request." }, 400); }
  const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
  if (!email.valid || !email.normalized) return reply({ error: "Enter a valid email address." }, 400);
  const bot = await verifyBot(request, body.botToken, "certificate_code");
  if (!bot.ok) return reply({ error: bot.error }, bot.status);
  try {
    const hash = sha256(email.normalized);
    const limit = await consumeSlidingWindow(adminDb, "_rate_limits_certificate_email", hash, 5, 3600000);
    if (limit.overLimit) return accepted();
    const daily = await consumeSlidingWindow(adminDb, "_rate_limits_certificate_daily", "all", 2000, 86400000);
    if (daily.overLimit) return reply({ error: "Certificate code requests are busy today. Contact team@amshq.in for help." }, 429);
    // Lookup, code storage and delivery run after the response for known and
    // unknown emails alike, so neither the body nor the timing reveals a match.
    const address = email.normalized;
    waitUntil((async () => { try { await issueCertificateCode(hash, address); } catch { /* never surfaces */ } })());
    return accepted();
  } catch { return reply({ error: "Could not process this request. Please try again later." }, 503); }
}
