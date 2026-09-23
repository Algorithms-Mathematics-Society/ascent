import "server-only";
import { randomUUID } from "node:crypto";
import { adminDb } from "./firebaseAdmin";
import { consumeSlidingWindow, sha256 } from "./rateLimit";
import logger, { genReqId } from "./logger";

export type BotAction = "registration" | "reminder" | "status_link";
export type BotResult = { ok: true } | { ok: false; status: number; error: string };
const unavailable = (): BotResult => ({ ok: false, status: 503, error: "Verification is temporarily unavailable. Please try again later or contact team@amshq.in." });

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
export function turnstileConfig() {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const hostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!secret || !siteKey || !hostnames.length) return null;
  // Cloudflare's documented testing keys must never enable a production bypass.
  if (process.env.NODE_ENV === "production" && (/^[123]x0{5}/.test(secret) || /^[123]x0{5}/.test(siteKey))) return null;
  return { secret, siteKey, hostnames };
}

export async function verifyBot(request: Request, token: unknown, action: BotAction): Promise<BotResult> {
  const config = turnstileConfig();
  if (!config) return unavailable();
  if (typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, status: 400, error: "Complete the verification check and try again." };
  }
  try {
    // Bound requests before calling the external verifier, including bad tokens.
    // The non-status ceiling is high because a whole campus can share one NAT egress IP. This counter only guards
    // calls to Cloudflare's free verifier: Turnstile plus the register route's per-email and per-phone limits are the real abuse control.
    const limit = await consumeSlidingWindow(adminDb, "_rate_limits_bot", `${action}_${sha256(clientIp(request))}`, action === "status_link" ? 20 : 1000, 3600000);
    if (limit.overLimit) return { ok: false, status: 429, error: "Too many requests. Please try again later." };
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ secret: config.secret, response: token, idempotency_key: randomUUID() }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return unavailable();
    const result = await response.json();
    if (result.success !== true || result.action !== action || typeof result.hostname !== "string" || !config.hostnames.includes(result.hostname.toLowerCase())) {
      return { ok: false, status: 400, error: "Verification failed or expired. Complete a new check and try again." };
    }
    // Cloudflare tokens are single-use. No local cache can turn a replay into success.
    return { ok: true };
  } catch (error) {
    // Returning 503 with no trace is undiagnosable during a launch burst. The
    // likely cause is Firestore contention on the shared per-IP counter rather
    // than abuse, and that is worth being able to tell apart at 6am.
    logger.error(
      "bot_protection",
      "verification_unavailable",
      { reqId: genReqId(), actorId: sha256(clientIp(request)), detail: { action }, status: "failed" },
      error,
    );
    return unavailable();
  }
}
