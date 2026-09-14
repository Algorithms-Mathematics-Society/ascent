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
import { EMAIL_OUTBOX, emailJob } from "@/lib/email/messages";
import { tryDeliverEmail } from "@/lib/email/delivery";

export const maxDuration = 30;
function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
const accepted = () => reply({ ok: true, message: "If this email matches an entry, a secure link will arrive shortly. Check spam too. If you recently requested a link, use that email or wait before trying again." }, 202);

export async function POST(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return reply({ error: "Request not accepted." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ error: "Invalid request." }, 415);
  if (!getEmailConfig() || !statusSecret()) return reply({ error: "Email status access is not available yet. Contact team@amshq.in for help." }, 503);
  let body: Record<string, unknown>;
  try { body = await readBoundedJson(request, 4096) as Record<string, unknown>; } catch { return reply({ error: "Invalid request." }, 400); }
  const email = normalizeEmail(typeof body?.email === "string" ? body.email : "");
  if (!email.valid || !email.normalized) return reply({ error: "Enter a valid email address." }, 400);
  const bot = await verifyBot(request, body.botToken, "status_link");
  if (!bot.ok) return reply({ error: bot.error }, bot.status);
  try {
    const hash = sha256(email.normalized);
    const limit = await consumeSlidingWindow(adminDb, "_rate_limits_status_email", hash, 3, 3600000);
    if (limit.overLimit) return accepted();
    // Bound aggregate email-triggering requests as well as each IP and mailbox.
    const daily = await consumeSlidingWindow(adminDb, "_rate_limits_status_daily", "all", 1000, 86400000);
    if (daily.overLimit) return reply({ error: "Status-link requests are busy today. Contact team@amshq.in for help." }, 429);
    const now = Date.now();
    const id = `status_${hash}_${Math.floor(now / 300000)}`;
    const ref = adminDb.collection(EMAIL_OUTBOX).doc(id);
    // The same queue operation runs for known and unknown emails. Lookup and
    // delivery happen after the response, avoiding an email-enumeration timing signal.
    await adminDb.runTransaction(async tx => {
      if ((await tx.get(ref)).exists) return;
      tx.create(ref, { ...emailJob("STATUS_ACCESS", hash, now), request_email: email.normalized, request_expires_at: now + 15 * 60000 });
    });
    waitUntil(tryDeliverEmail(id));
    return accepted();
  } catch { return reply({ error: "Could not process this request. Please try again later." }, 503); }
}
