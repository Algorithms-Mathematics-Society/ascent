import type { Metadata } from "next";
import { cookies } from "next/headers";
import RegistrationShell from "@/components/register/RegistrationShell";
import CandidateStatus from "@/components/register/CandidateStatus";
import { getCandidateStatus } from "@/lib/candidate/status";
import { STATUS_COOKIE, statusSecret } from "@/lib/candidate/tokens";
import { getEmailConfig } from "@/lib/email/resend";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your entry status | Ascent", referrer: "no-referrer", robots: { index: false, follow: false } };
export default async function StatusPage() {
  let entry = null;
  try { entry = await getCandidateStatus(cookies().get(STATUS_COOKIE)?.value); } catch { /* The form and support contact remain available during an outage. */ }
  return <RegistrationShell title="Your entry status" description="Check your registration decision and qualification path using a private email link."><CandidateStatus initialEntry={entry} emailEnabled={Boolean(statusSecret() && getEmailConfig())} /></RegistrationShell>;
}
