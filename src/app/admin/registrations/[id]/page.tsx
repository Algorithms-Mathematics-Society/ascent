import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import AdminDecisionWorkspace from "@/components/admin/AdminDecisionWorkspace";
import AdminOperationsPanel from "@/components/admin/AdminOperationsPanel";
import AdminRegistrationStatus from "@/components/admin/AdminRegistrationStatus";
import { isSafeApplicationId } from "@/lib/adminDecision";
import {
  getAdminRegistrationDetail,
  type AdminRegistrationAuditEvent,
} from "@/lib/adminRegistrations";

function humanize(value: string) {
  if (!value || value === "—") return "—";
  return value
    .toLocaleLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  return `${new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value))} IST`;
}

function DetailField({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.11em] text-ascent-muted">
        {label}
      </dt>
      <dd
        className={`mt-1.5 break-words text-sm leading-6 text-ascent-ink ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function ReviewSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-ascent-border bg-ascent-surface">
      <header className="border-b border-ascent-border px-5 py-4 sm:px-6">
        <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight">{title}</h2>
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  if (!href) return <span className="text-ascent-muted">Not provided</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-ascent-brand underline underline-offset-4 hover:text-ascent-ink"
    >
      {children}
    </a>
  );
}

function auditLabel(event: AdminRegistrationAuditEvent) {
  if (event.event === "QUALIFICATION_DETERMINED") {
    return "Qualification route determined";
  }
  if (event.event === "REGISTRATION_APPROVED") return "Registration approved";
  if (event.event === "REGISTRATION_WAITLISTED") return "Registration waitlisted";
  if (event.event === "REGISTRATION_REJECTED") return "Registration rejected";
  return humanize(event.event);
}

export default async function AdminRegistrationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!isSafeApplicationId(params.id)) notFound();
  const registration = await getAdminRegistrationDetail(params.id);
  if (!registration) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <a
        href="/admin"
        className="inline-flex min-h-10 items-center text-sm font-semibold text-ascent-brand underline underline-offset-4 hover:text-ascent-ink"
      >
        ← Registration queue
      </a>

      <header className="mt-4 border-b border-ascent-border pb-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">
              Applicant review · {registration.reference}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ascent-ink sm:text-4xl">
              {registration.legalName}
            </h1>
            <p className="mt-3 text-sm leading-6 text-ascent-muted">
              Submitted {formatDateTime(registration.submittedAt)}
            </p>
          </div>
          <AdminRegistrationStatus decision={registration.decision} />
        </div>
      </header>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          <ReviewSection eyebrow="01 · Identity" title="Contact and profile">
            <dl className="grid gap-5 sm:grid-cols-2">
              <DetailField label="Full name">{registration.legalName}</DetailField>
              <DetailField label="Email">
                <a
                  href={`mailto:${registration.email}`}
                  className="font-semibold text-ascent-brand underline underline-offset-4"
                >
                  {registration.email}
                </a>
              </DetailField>
              <DetailField label="Mobile number">
                <a
                  href={`tel:${registration.phone}`}
                  className="font-semibold text-ascent-brand underline underline-offset-4"
                >
                  {registration.phone}
                </a>
              </DetailField>
              <DetailField label="Email verification">
                {registration.emailVerified ? "Verified" : "Not verified"}
              </DetailField>
              <DetailField label="LinkedIn">
                <ExternalLink href={registration.linkedInUrl}>
                  Open LinkedIn profile ↗
                </ExternalLink>
              </DetailField>
              <DetailField label="GitHub">
                <ExternalLink href={registration.githubUrl}>
                  Open GitHub profile ↗
                </ExternalLink>
              </DetailField>
            </dl>
          </ReviewSection>

          <ReviewSection eyebrow="02 · Eligibility" title="Education and institution">
            <dl className="grid gap-5 sm:grid-cols-2">
              <DetailField label="Institution">{registration.institution}</DetailField>
              <DetailField label="Institution ID" mono>
                {registration.collegeId ?? "Unlisted institution"}
              </DetailField>
              <DetailField label="Institution tier">
                {humanize(registration.collegeTier)}
              </DetailField>
              <DetailField label="Verification status">
                {humanize(registration.collegeVerificationStatus)}
              </DetailField>
              <DetailField label="Education stage">
                {humanize(registration.educationStage)}
              </DetailField>
              <DetailField label="Current level">
                {registration.studyLevel}
              </DetailField>
              <DetailField label="Graduation year">
                {registration.graduationYear ?? "Not applicable"}
              </DetailField>
              <DetailField label="College email">
                {registration.collegeEmail ?? "Not provided"}
              </DetailField>
            </dl>
          </ReviewSection>

          <ReviewSection eyebrow="03 · Routing" title="Competition context">
            <div className="border-l-2 border-ascent-brand bg-ascent-canvas/60 px-4 py-3">
              <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.11em] text-ascent-brand">
                {registration.qualificationPath === "AUTO"
                  ? "Direct path"
                  : registration.qualificationPath === "QUALIFIER"
                    ? "Qualifier path"
                    : "Path pending"}
              </p>
              <p className="mt-2 text-sm leading-6 text-ascent-ink">
                {registration.qualificationReason}
              </p>
            </div>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <DetailField label="Codeforces handle">
                {registration.codeforcesHandle ? (
                  <a
                    href={`https://codeforces.com/profile/${encodeURIComponent(
                      registration.codeforcesHandle,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-ascent-brand underline underline-offset-4"
                  >
                    @{registration.codeforcesHandle} ↗
                  </a>
                ) : (
                  "Not provided"
                )}
              </DetailField>
              <DetailField label="Applicant category">
                {humanize(registration.applicantStatus)}
              </DetailField>
            </dl>
          </ReviewSection>

          <ReviewSection eyebrow="04 · Evidence" title="Submitted documents">
            <div className="grid gap-px border border-ascent-border bg-ascent-border sm:grid-cols-2">
              <a
                href={registration.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-ascent-surface p-5 hover:bg-ascent-canvas"
              >
                <span className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.11em] text-ascent-muted">
                  Required
                </span>
                <span className="mt-2 block font-semibold text-ascent-brand underline underline-offset-4">
                  Open resume ↗
                </span>
              </a>
              {registration.transcriptUrl ? (
                <a
                  href={registration.transcriptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-ascent-surface p-5 hover:bg-ascent-canvas"
                >
                  <span className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.11em] text-ascent-muted">
                    Optional
                  </span>
                  <span className="mt-2 block font-semibold text-ascent-brand underline underline-offset-4">
                    Open transcript ↗
                  </span>
                </a>
              ) : (
                <div className="bg-ascent-surface p-5">
                  <span className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.11em] text-ascent-muted">
                    Optional
                  </span>
                  <span className="mt-2 block text-sm text-ascent-muted">
                    No transcript provided
                  </span>
                </div>
              )}
            </div>
          </ReviewSection>

          <ReviewSection eyebrow="05 · Record" title="Consent and system metadata">
            <dl className="grid gap-5 sm:grid-cols-2">
              <DetailField label="Competition consent">
                {registration.consentGranted ? "Granted" : "Not recorded"}
              </DetailField>
              <DetailField label="Consent policy">
                {registration.consentPolicyVersion ?? "Not recorded"}
              </DetailField>
              <DetailField label="Consent timestamp">
                {formatDateTime(registration.consentGrantedAt)}
              </DetailField>
              <DetailField label="Application state">
                {humanize(registration.applicationState)}
              </DetailField>
              <DetailField label="Edition">{registration.edition}</DetailField>
              <DetailField label="Last updated">
                {formatDateTime(registration.updatedAt)}
              </DetailField>
              <DetailField label="Document ID" mono>
                {registration.id}
              </DetailField>
            </dl>
          </ReviewSection>

          <ReviewSection eyebrow="06 · Accountability" title="Audit timeline">
            {registration.auditEvents.length ? (
              <ol className="space-y-0">
                {registration.auditEvents.map((event, index) => (
                  <li
                    key={event.id}
                    className="relative border-l border-ascent-border pb-6 pl-5 last:pb-0"
                  >
                    <span
                      className="absolute -left-1 top-1.5 h-2 w-2 bg-ascent-brand"
                      aria-hidden="true"
                    />
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                      <p className="font-semibold text-ascent-ink">
                        {auditLabel(event)}
                      </p>
                      <time className="shrink-0 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-ascent-muted">
                        {formatDateTime(event.timestamp)}
                      </time>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-ascent-muted">
                      {event.actorEmail ?? humanize(event.actor)}
                      {event.previousDecision && event.decision
                        ? ` · ${humanize(event.previousDecision)} → ${humanize(
                            event.decision,
                          )}`
                        : null}
                    </p>
                    {event.reason ? (
                      <p className="mt-2 text-sm leading-6 text-ascent-ink">
                        {event.reason}
                      </p>
                    ) : null}
                    <span className="sr-only">Audit event {index + 1}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ascent-muted">
                No audit events were found for this registration.
              </p>
            )}
          </ReviewSection>
        </div>

        <aside className="grid gap-6 lg:sticky lg:top-6">
          <AdminDecisionWorkspace
            applicationId={registration.id}
            applicantName={registration.legalName}
            reference={registration.reference}
            currentDecision={registration.decision}
            currentReason={registration.decisionReason}
            decidedAt={registration.decidedAt}
            decidedBy={registration.decidedBy}
            revision={registration.decisionRevision}
          />
          <AdminOperationsPanel
            applicationId={registration.id}
            initialTags={registration.tags}
            initialRevision={registration.operationsRevision}
            notes={registration.notes}
          />
        </aside>
      </div>
    </div>
  );
}
