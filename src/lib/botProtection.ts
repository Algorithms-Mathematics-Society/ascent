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

// Two five-second attempts leave room for the entry transaction within the
// registration form's 20-second request budget. Retry only this provider call:
// reserving the rate-limit slot again could count one submission twice.
const VERIFY_ATTEMPTS = 2;
const VERIFY_TIMEOUT_MS = 5000;
const PROVIDER_ERROR_CODES = new Set([
  "missing-input-secret", "invalid-input-secret", "missing-input-response",
  "invalid-input-response", "bad-request", "timeout-or-duplicate", "internal-error",
]);

export async function verifyBot(request: Request, token: unknown, action: BotAction): Promise<BotResult> {
  const reqId = genReqId();
  const actorId = sha256(clientIp(request));
  function failed(stage: string, error: unknown, detail: Record<string, unknown> = {}) {
    logger.error("bot_protection", "verification_unavailable", {
      reqId, actorId, detail: { action, stage, ...detail }, status: "failed",
    }, error);
    return unavailable();
  }

  const config = turnstileConfig();
  if (!config) return failed("configuration", new Error("Turnstile configuration is missing or invalid."));
  if (typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, status: 400, error: "Complete the verification check and try again." };
  }

  try {
    // A whole campus can share one IP. Preserve the existing ceilings and
    // fail closed if the limiter cannot reserve a slot.
    const limit = await consumeSlidingWindow(adminDb, "_rate_limits_bot", `${action}_${actorId}`, action === "status_link" ? 20 : 1000, 3600000);
    if (limit.overLimit) return { ok: false, status: 429, error: "Too many requests. Please try again later." };
  } catch (error) {
    return failed("rate_limit", error);
  }

  // Cloudflare tokens are single-use. Reuse this key only inside this one
  // verification attempt, so a lost response can be retried safely. A new
  // incoming request always gets a new key and must pass verification again.
  // https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
  const body = JSON.stringify({ secret: config.secret, response: token, idempotency_key: randomUUID() });
  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
    let retryable = true;
    let httpStatus: number | undefined;
    let errorCodes: string[] = [];
    try {
      const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body, signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      httpStatus = response.status;
      if (!response.ok) {
        retryable = response.status >= 500 || response.status === 408 || response.status === 429;
        throw new Error(`Turnstile returned HTTP ${response.status}.`);
      }
      const result = await response.json();
      // Log only known provider codes, never the response body or tokens.
      errorCodes = Array.isArray(result?.["error-codes"])
        ? result["error-codes"].filter((code: unknown): code is string => typeof code === "string" && PROVIDER_ERROR_CODES.has(code))
        : [];
      if (errorCodes.some(code => code === "missing-input-secret" || code === "invalid-input-secret" || code === "bad-request")) {
        retryable = false;
        throw new Error("Turnstile rejected the server configuration.");
      }
      if (result?.success !== true && errorCodes.includes("internal-error")) {
        throw new Error("Turnstile reported a temporary internal error.");
      }
      if (result?.success !== true || result.action !== action || typeof result.hostname !== "string" || !config.hostnames.includes(result.hostname.toLowerCase())) {
        return { ok: false, status: 400, error: "Verification failed or expired. Complete a new check and try again." };
      }
      return { ok: true };
    } catch (error) {
      const detail = { attempts: attempt, httpStatus, errorCodes };
      if (!retryable || attempt === VERIFY_ATTEMPTS) return failed("provider", error, detail);
      logger.warn("bot_protection", "verification_retry", {
        reqId, actorId, detail: { action, stage: "provider", ...detail }, status: "degraded",
      });
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  return unavailable();
}
