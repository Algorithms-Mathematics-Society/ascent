// Shared by server routes and client components: no server-only imports here.

export const CERTIFICATE_COOKIE = "ascent_certificate_session";
export const CERTIFICATE_ISSUED_ON = "11 November 2026";
export const CERTIFICATE_CODE_ACCEPTED =
  "If this email belongs to a Round 1 qualifier, a 6-digit code is on its way. Check spam too.";

export type CertificateSummary = {
  name: string;
  rank: number;
  verificationCode: string;
  verifyUrl: string;
  filename: string;
  issuedOn: typeof CERTIFICATE_ISSUED_ON;
};
