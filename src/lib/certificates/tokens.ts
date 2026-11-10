import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { secureTokenEqual } from "../adminSecurity";
import { statusSecret } from "../candidate/tokens";

export { CERTIFICATE_COOKIE } from "./shared";
export const CERTIFICATE_SESSION_TTL_SECONDS = 30 * 60;
export const CERTIFICATE_CODE_TTL_MS = 10 * 60 * 1000;
export const CERTIFICATE_MAX_CODE_ATTEMPTS = 5;
const KEY_LABEL = "ascent-certificate-portal-v1";

export type CertificateSessionClaims = {
  purpose: "certificate";
  emailHash: string;
  expires: number;
  nonce: string;
};

/** Dedicated key, so certificate codes and sessions never share a MAC key with status links. */
export function certificateKey(): Buffer | null {
  const secret = statusSecret();
  return secret
    ? createHmac("sha256", secret).update(KEY_LABEL).digest()
    : null;
}

function requireKey() {
  const key = certificateKey();
  if (!key) throw new Error("Certificate access is not configured.");
  return key;
}

export function generateCertificateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Strip spaces and return the code only when it is exactly six digits. */
export function normalizeCertificateCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 32) return null;
  const code = value.replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

export function hashCertificateCode(emailHash: string, code: string) {
  return createHmac("sha256", requireKey())
    .update(`${emailHash}:${code}`)
    .digest("hex");
}

export function certificateCodeMatches(
  storedHash: unknown,
  emailHash: string,
  code: string,
) {
  if (typeof storedHash !== "string" || !/^[a-f0-9]{64}$/.test(storedHash))
    return false;
  return secureTokenEqual(hashCertificateCode(emailHash, code), storedHash);
}

export function signCertificateSession(emailHash: string, now = Date.now()) {
  const key = requireKey();
  const claims: CertificateSessionClaims = {
    purpose: "certificate",
    emailHash,
    expires: now + CERTIFICATE_SESSION_TTL_SECONDS * 1000,
    nonce: randomBytes(24).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", key).update(body).digest("base64url");
  return { token: `${body}.${signature}`, claims };
}

export function verifyCertificateSession(
  token: unknown,
  now = Date.now(),
): CertificateSessionClaims | null {
  const key = certificateKey();
  if (!key || typeof token !== "string" || token.length > 1000) return null;
  const pieces = token.split(".");
  if (
    pieces.length !== 2 ||
    !/^[A-Za-z0-9_-]+$/.test(pieces[0]) ||
    !/^[A-Za-z0-9_-]{43}$/.test(pieces[1])
  )
    return null;
  const expected = createHmac("sha256", key)
    .update(pieces[0])
    .digest("base64url");
  if (!secureTokenEqual(expected, pieces[1])) return null;
  try {
    const value = JSON.parse(
      Buffer.from(pieces[0], "base64url").toString(),
    ) as CertificateSessionClaims;
    if (
      value?.purpose !== "certificate" ||
      typeof value.emailHash !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.emailHash) ||
      typeof value.nonce !== "string" ||
      !/^[A-Za-z0-9_-]{32}$/.test(value.nonce) ||
      !Number.isSafeInteger(value.expires) ||
      value.expires <= now ||
      value.expires > now + CERTIFICATE_SESSION_TTL_SECONDS * 1000
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
