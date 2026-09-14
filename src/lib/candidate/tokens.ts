import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { secureTokenEqual } from "../adminSecurity";

export const STATUS_COOKIE = "ascent_candidate_status";
export const STATUS_TTL_SECONDS = 20 * 60;
export type StatusClaims = { purpose: "link" | "session"; subject: string; emailHash: string; expires: number; nonce: string };
export function statusSecret() {
  const secret = process.env.CANDIDATE_STATUS_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}
export function signStatusToken(purpose: StatusClaims["purpose"], subject: string, emailHash: string, now = Date.now()) {
  const secret = statusSecret();
  if (!secret) throw new Error("Status access is not configured.");
  const claims: StatusClaims = { purpose, subject, emailHash, expires: now + STATUS_TTL_SECONDS * 1000, nonce: randomBytes(24).toString("base64url") };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return { token: `${body}.${signature}`, claims };
}
export function verifyStatusToken(token: unknown, purpose: StatusClaims["purpose"], now = Date.now()): StatusClaims | null {
  const secret = statusSecret();
  if (!secret || typeof token !== "string" || token.length > 1500) return null;
  const pieces = token.split(".");
  if (pieces.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(pieces[0]) || !/^[A-Za-z0-9_-]{43}$/.test(pieces[1])) return null;
  const expected = createHmac("sha256", secret).update(pieces[0]).digest("base64url");
  if (!secureTokenEqual(expected, pieces[1])) return null;
  try {
    const value = JSON.parse(Buffer.from(pieces[0], "base64url").toString()) as StatusClaims;
    if (value.purpose !== purpose || typeof value.subject !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value.subject) ||
      typeof value.emailHash !== "string" || !/^[a-f0-9]{64}$/.test(value.emailHash) || typeof value.nonce !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(value.nonce) ||
      !Number.isSafeInteger(value.expires) || value.expires <= now || value.expires > now + STATUS_TTL_SECONDS * 1000) return null;
    return value;
  } catch { return null; }
}
