import { verifyBot } from "@/lib/botProtection";
import { PRIVACY_VERSION, PRIVACY_URL, REMINDER_NOTICE } from "@/content/legal";
import { EMAIL_OUTBOX, reminderEmailId, emailJob } from "@/lib/email/messages";
import { tryDeliverEmail } from "@/lib/email/delivery";
import { readBoundedJson, RequestBodyTooLarge } from "@/lib/requestBody";
import { NextRequest, NextResponse } from "next/server";
import { requestHasSameOrigin } from "@/lib/adminSecurity";
import { adminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import logger, { genReqId } from "@/lib/logger";
import { consumeSlidingWindow, sha256 } from "@/lib/rateLimit";
import { normalizeEmail } from "@/lib/validators";

export const runtime = "nodejs";
const WINDOW_MS = 60 * 60 * 1000;
// Allow shared campus networks while bounding abuse per IP.
const MAX_REQUESTS = 120;

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...(status === 429 ? { "Retry-After": "3600" } : {}),
    },
  });
}

export async function POST(request: NextRequest) {
  if (!requestHasSameOrigin(request)) {
    return reply({ error: "Please submit the reminder form from this site." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return reply({ error: "Send your email as JSON." }, 415);
  }
  if (Number(request.headers.get("content-length")) > 4096) {
    return reply({ error: "The request is too large." }, 413);
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request, 4096);
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) return reply({ error: "The request is too large." }, 413);
    return reply({ error: "Enter a valid email address." }, 400);
  }
  const email = normalizeEmail(
    body && typeof body === "object" && "email" in body && typeof body.email === "string"
      ? body.email
      : "",
  );
  if (!email.valid || !email.normalized) {
    return reply({ error: "Enter a valid email address." }, 400);
  }

  const input = body as Record<string, unknown>;
  if (input.consent !== true || input.policyVersion !== PRIVACY_VERSION) {
    return reply({ error: "Read the current privacy notice and submit the reminder form again." }, 400);
  }
  const bot = await verifyBot(request, input.botToken, "reminder");
  if (!bot.ok) return reply({ error: bot.error }, bot.status);
  const normalizedEmail = email.normalized;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const reminderRef = adminDb.collection("registration_reminders").doc(sha256(normalizedEmail));
  try {
    // Keep the shared-IP admission transaction short. Saving independent
    // reminder/email records must not extend the lock held by a campus network.
    const limit = await consumeSlidingWindow(adminDb, "_rate_limits_reminders", sha256(ip), MAX_REQUESTS, WINDOW_MS);
    if (limit.overLimit) return reply({ error: "Too many requests. Please try again in an hour." }, 429);
    await adminDb.runTransaction(async (transaction) => {
      const reminder = await transaction.get(reminderRef);
      if (!reminder.exists) {
        transaction.create(adminDb.collection(EMAIL_OUTBOX).doc(reminderEmailId(sha256(normalizedEmail))), emailJob("REGISTRATION_REMINDER", sha256(normalizedEmail)));
        transaction.create(reminderRef, {
          email: normalizedEmail,
          created_at: adminServerTimestamp(),
          purpose: "ASCENT_2026_REGISTRATION_REMINDER",
          consent: { granted: true, policy_version: PRIVACY_VERSION, policy_url: PRIVACY_URL, notice: REMINDER_NOTICE, granted_at: adminServerTimestamp() },
        });
      }
    });
    // Identical responses for existing and new addresses do not reveal list membership.
    await tryDeliverEmail(reminderEmailId(sha256(normalizedEmail)));
    return reply({ ok: true });
  } catch {
    logger.error("registration_reminders", "save_failed", { reqId: genReqId(), status: "failed" });
    return reply({ error: "Could not save your reminder. Please try again." }, 503);
  }
}

export const maxDuration = 30;
