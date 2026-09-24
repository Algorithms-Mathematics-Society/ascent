import { REGISTRATION_OPENS_AT, registrationHasOpened, registrationOpensAtLabel } from "../registrationLaunch";

export const EMAIL_OUTBOX = "email_outbox";
export type EmailKind = "REGISTRATION_CONFIRMATION" | "DECISION" | "REGISTRATION_REMINDER" | "STATUS_ACCESS";
export type EmailDecision = "APPROVED" | "WAITLISTED" | "REJECTED";
export type EmailJob = {
  kind: EmailKind;
  source_id: string;
  decision?: EmailDecision;
  revision?: number;
  status: string;
  queued_at: number;
  due_at: number;
  attempts: number;
  request_email?: string;
  request_expires_at?: number;
};

export function confirmationEmailId(id: string) { return `confirmation_${id}`; }
export function decisionEmailId(id: string, revision: number) { return `decision_${id}_${revision}`; }
export function reminderEmailId(id: string) { return `reminder_${id}`; }

export function emailJob(kind: EmailKind, sourceId: string, now = Date.now()): EmailJob {
  return { kind, source_id: sourceId, status: "PENDING", queued_at: now,
    due_at: kind === "REGISTRATION_REMINDER" ? Math.max(now, Date.parse(REGISTRATION_OPENS_AT) - 29 * 86400000) : now,
    attempts: 0 };
}

export function buildEmailMessage(job: EmailJob, data: {
  reference?: string;
  qualificationPath?: string;
  statusUrl?: string;
  adminDecision?: string;
}, siteUrl: string): { subject: string; text: string } {
  const footer = "Regards,\nAlgorithms & Mathematics Society (AMS)";
  if (job.kind === "STATUS_ACCESS") {
    if (!data.statusUrl) throw new Error("Status link missing.");
    return { subject: "Your Ascent ’26 entry status link", text: `Use this private link to view your entry status:\n${data.statusUrl}\n\nIt expires in 20 minutes and can be used once. Open it only on a device you trust. If you did not request this email, you can ignore it.\n\n${footer}` };
  }
  if (job.kind === "REGISTRATION_REMINDER") {
    return {
      subject: "Ascent ’26 registration is open",
      text: `You asked for an Ascent ’26 registration reminder.\n\n${registrationHasOpened() ? `Registration opened on ${registrationOpensAtLabel()}. The entry form is live now:` : `Registration opens on ${registrationOpensAtLabel()}. Visit the registration page for its current status and to submit your entry:`}\n${siteUrl}/register\n\n${footer}`,
    };
  }
  const reference = data.reference || "Reference unavailable";
  if (job.kind === "REGISTRATION_CONFIRMATION") {
    // An entry from a listed institution is accepted on submission. Everyone
    // else is reviewed, so the receipt must not imply a decision either way.
    const accepted = data.adminDecision === "APPROVED";
    const outcome = accepted
      ? `Status: Accepted\n\nYour entry is confirmed and you go through to Round 1 on 24 October 2026 at 2:00 pm IST. Joining instructions follow closer to the date.`
      : `Status: Under review\n\nYour entry is with the Ascent team. We will email a decision to this address.`;
    return {
      subject: `Ascent ’26 registration received: ${reference}`,
      text: `We received your Ascent ’26 registration.\n\nYour reference: ${reference}\n${outcome}\n\nKeep this email so you can find your reference later.\n\nCheck your current entry status: ${siteUrl}/register/status\nEvent details: ${siteUrl}\n\n${footer}`,
    };
  }
  const decision = job.decision;
  const detail = decision === "APPROVED"
    ? "Your registration has been approved. Keep this reference. Competition instructions will be shared separately."
    : decision === "WAITLISTED"
      ? "Your registration is on the waitlist. A place is not confirmed. We will email you if the decision changes."
      : "Your registration has not been approved. Reply with your reference if you have a question about this decision.";
  const label = decision === "APPROVED" ? "Approved" : decision === "WAITLISTED" ? "Waitlisted" : "Not approved";
  return { subject: `Ascent ’26 registration update: ${reference}`,
    text: `Your reference: ${reference}\nStatus: ${label}\n\n${detail}\n\nCheck your current entry status: ${siteUrl}/register/status\n\n${footer}` };
}
