import type { Metadata } from "next";
import CertificateVerificationExperience from "@/components/verification/CertificateVerification";

export const metadata: Metadata = {
  title: "Verify a certificate | Ascent 2026",
  description: "Verify an Ascent 2026 certificate using its unique AMS verification code.",
};

export default function VerifyPage({ searchParams }: { searchParams?: { code?: string | string[] } }) {
  const code = typeof searchParams?.code === "string" ? searchParams.code : undefined;
  return <CertificateVerificationExperience code={code} />;
}
