import { REGISTRATION_OPENS_AT, registrationOpensAtLabel } from "../registrationLaunch";

export const EMAIL_OUTBOX = "email_outbox";
export type EmailKind = "REGISTRATION_CONFIRMATION" | "DECISION" | "REGISTRATION_REMINDER";
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
}, siteUrl: string): { subject: string; text: string } {
  const footer = "Algorithms & Mathematics Society (AMS)\nQuestions? Reply to this email.";
  if (job.kind === "REGISTRATION_REMINDER") {
    return {
      subject: "Ascent ’26 registration is open",
      text: `You asked for an Ascent ’26 registration reminder.\n\nRegistration opens on ${registrationOpensAtLabel()}. Visit the registration page for its current status and to submit your entry:\n${siteUrl}/register\n\n${footer}`,
    };
  }
  const reference = data.reference || "Reference unavailable";
  if (job.kind === "REGISTRATION_CONFIRMATION") {
    const path = data.qualificationPath === "AUTO" ? "Direct path" : "Qualifier path";
    return {
      subject: `Ascent ’26 registration received — ${reference}`,
      text: `We received your Ascent ’26 registration.\n\nYour reference: ${reference}\nStatus at submission: Received\nQualification path: ${path}\n\nKeep this email so you can find your reference later. Registration receipt does not confirm selection. Decision updates are sent separately. This receipt records your submission and does not replace a later decision.\n\nEvent details: ${siteUrl}\n\n${footer}`,
    };
  }
  const decision = job.decision;
  const detail = decision === "APPROVED"
    ? "Your registration has been approved. Keep this reference. Competition instructions will be shared separately."
    : decision === "WAITLISTED"
      ? "Your registration is on the waitlist. A place is not confirmed. We will email you if the decision changes."
      : "Your registration has not been approved. Reply with your reference if you have a question about this decision.";
  const label = decision === "APPROVED" ? "Approved" : decision === "WAITLISTED" ? "Waitlisted" : "Not approved";
  return { subject: `Ascent ’26 registration update — ${reference}`,
    text: `Your reference: ${reference}\nStatus: ${label}\n\n${detail}\n\n${footer}` };
}
