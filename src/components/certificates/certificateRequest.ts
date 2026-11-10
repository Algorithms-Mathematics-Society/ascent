export const CERTIFICATE_REQUEST_TIMEOUT_MS = 20_000;

export type CertificateSummary = {
  name: string;
  rank: number;
  verificationCode: string;
  verifyUrl: string;
  filename: string;
  issuedOn: string;
};

export type CertificateResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  certificate?: CertificateSummary;
};

const TIMEOUT_MESSAGE = "This is taking longer than expected. Check your connection and try again.";
const OFFLINE_MESSAGE = "We couldn’t connect. Check your connection and try again.";

export function isCertificateSummary(value: unknown): value is CertificateSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Record<string, unknown>;
  return typeof summary.name === "string" && typeof summary.rank === "number"
    && typeof summary.verificationCode === "string" && typeof summary.verifyUrl === "string"
    && typeof summary.filename === "string" && typeof summary.issuedOn === "string";
}

/** Keeps the timer running while the body is read too, since either part can stall. */
export async function requestCertificate(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CERTIFICATE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({})) as CertificateResponse;
    if (controller.signal.aborted) throw new Error(TIMEOUT_MESSAGE);
    return { response, data };
  } catch (caught) {
    if (controller.signal.aborted) throw new Error(TIMEOUT_MESSAGE);
    if (caught instanceof TypeError) throw new Error(OFFLINE_MESSAGE);
    throw caught;
  } finally {
    clearTimeout(timeout);
  }
}

export function postJson(url: string, body: unknown) {
  return requestCertificate(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}
