import "server-only";
import { Resend } from "resend";
import { normalizeEmail } from "../validators";

export function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return null;
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

export class ResendRejectedError extends Error {
  constructor(code: string, readonly statusCode: number) { super(code); }
}

export async function sendResendEmail(apiKey: string, payload: EmailPayload, idempotencyKey: string) {
  const resend = new Resend(apiKey);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      resend.emails.send(payload, { idempotencyKey }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("provider_timeout")), 8000); }),
    ]);
    if (result.error || !result.data?.id) {
      // Do not copy provider error messages (which may include recipient PII) into logs.
      const code = result.error?.name || "provider_error";
      if (result.error && [400, 401, 403, 404, 422, 429].includes(result.error.statusCode || 0)) {
        throw new ResendRejectedError(code, result.error.statusCode!);
      }
      throw new Error(code);
    }
    return result.data.id;
  } finally { if (timer) clearTimeout(timer); }
}
