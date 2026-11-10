import type { Metadata } from "next";
import CertificateVerificationExperience from "@/components/verification/CertificateVerification";
import { CERTIFICATE_VERIFICATIONS } from "@/content/certificateVerifications";

export const metadata: Metadata = {
  title: "Certificate verification | Ascent 2026",
  description: "Official AMS verification for an Ascent 2026 certificate.",
};

export function generateStaticParams() {
  return CERTIFICATE_VERIFICATIONS.map(({ code }) => ({ code }));
}

export default function VerificationCodePage({ params }: { params: { code: string } }) {
  return <CertificateVerificationExperience code={params.code} />;
}
