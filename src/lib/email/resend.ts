import "server-only";
import { Resend } from "resend";
import { normalizeEmail } from "../validators";

export function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !/^re_[A-Za-z0-9_-]+$/.test(apiKey) || !from) return null;
  const address = from.match(/<([^>]+)>$/)?.[1] || from;
  if (!normalizeEmail(address).valid) return null;
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || "team@amshq.in";
  if (!normalizeEmail(replyTo).valid) return null;
  const siteUrl = (process.env.SITE_URL?.trim() || "https://ascent.amshq.in").replace(/\/$/, "");
  try {
    const url = new URL(siteUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
  } catch { return null; }
  return { apiKey, from, replyTo, siteUrl };
}

export type EmailPayload = { from: string; to: string; replyTo: string; subject: string; text: string; scheduledAt?: string };

const SAFE_PROVIDER_CODES = new Set([
  "validation_error", "missing_required_field", "invalid_access", "invalid_api_key",
  "missing_api_key", "restricted_api_key", "rate_limit_exceeded", "daily_quota_exceeded",
  "monthly_quota_exceeded", "application_error", "internal_server_error", "not_found",
  "invalid_idempotent_request", "concurrent_idempotent_requests", "provider_error",
  "provider_timeout", "provider_transport_error", "invalid_email_configuration",
]);

/** Diagnostics must never contain arbitrary SDK messages, headers or recipient data. */
export function safeEmailErrorCode(error: unknown): string {
  return error instanceof Error && SAFE_PROVIDER_CODES.has(error.message)
    ? error.message : "provider_transport_error";
}

export class ResendRejectedError extends Error {
  constructor(code: string, readonly statusCode: number) {
    super(SAFE_PROVIDER_CODES.has(code) ? code : "provider_error");
  }
}

export async function sendResendEmail(apiKey: string, payload: EmailPayload, idempotencyKey: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Fail before constructing headers, whose exceptions can echo their values.
    if (!/^re_[A-Za-z0-9_-]+$/.test(apiKey)) throw new Error("invalid_email_configuration");
    const resend = new Resend(apiKey);
    const result = await Promise.race([
      resend.emails.send(payload, { idempotencyKey }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("provider_timeout")), 8000); }),
    ]);
    if (result.error || !result.data?.id) {
      // Do not copy provider error messages (which may include recipient PII) into logs.
      const name = result.error?.name;
      const code = name && SAFE_PROVIDER_CODES.has(name) ? name : "provider_error";
      if (result.error && [400, 401, 403, 404, 422, 429].includes(result.error.statusCode || 0)) {
        throw new ResendRejectedError(code, result.error.statusCode!);
      }
      throw new Error(code);
    }
    return result.data.id;
  } catch (error) {
    if (error instanceof ResendRejectedError) throw error;
    throw new Error(safeEmailErrorCode(error));
  } finally { if (timer) clearTimeout(timer); }
}
