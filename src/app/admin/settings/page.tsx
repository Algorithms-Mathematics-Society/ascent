import type { Metadata } from "next";
import AdminRegistrationSettingsForm from "@/components/admin/AdminRegistrationSettingsForm";
import {
  getRegistrationAvailability,
  getRegistrationRetentionInventory,
} from "@/lib/registrationSettingsData";

export const metadata: Metadata = {
  title: "Settings · Ascent admin",
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return `${new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value))} IST`;
}

export default async function AdminSettingsPage() {
  const [{ settings, availability }, inventory] = await Promise.all([
    getRegistrationAvailability(),
    getRegistrationRetentionInventory(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="border-b border-ascent-border pb-7">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">Competition configuration</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ascent-ink sm:text-4xl">Data operations</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ascent-muted">Control the public intake window, understand the private data footprint and keep consequential changes deliberate and auditable.</p>
      </div>

      <section className="mt-6 grid gap-px border border-ascent-border bg-ascent-border md:grid-cols-4" aria-label="Current registration state">
        <div className="bg-ascent-surface p-5 sm:p-6 md:col-span-2">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-muted">Effective status</p>
          <div className="mt-3 flex items-center gap-3">
            <span className={`h-3 w-3 ${availability.acceptsRegistrations ? "bg-ascent-success" : "bg-ascent-danger"}`} aria-hidden="true" />
            <p className="text-2xl font-semibold tracking-tight">{availability.acceptsRegistrations ? "Accepting entries" : "Not accepting entries"}</p>
          </div>
          <p className="mt-2 text-sm text-ascent-muted">{availability.message}</p>
        </div>
        <div className="bg-ascent-surface p-5 sm:p-6">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-muted">Deadline</p>
          <p className="mt-3 text-sm font-semibold text-ascent-ink">{formatDate(settings.deadline)}</p>
        </div>
        <div className="bg-ascent-surface p-5 sm:p-6">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-muted">Capacity</p>
          <p className="mt-3 text-sm font-semibold text-ascent-ink">{settings.acceptedCount} / {settings.capacity ?? "Unlimited"}</p>
        </div>
      </section>

      <div className="mt-6"><AdminRegistrationSettingsForm settings={settings} /></div>

      <section className="mt-6 border border-ascent-border bg-ascent-surface" aria-labelledby="retention-title">
        <header className="border-b border-ascent-border p-5 sm:p-6">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">Privacy inventory</p>
          <h2 id="retention-title" className="mt-2 text-xl font-semibold tracking-tight">Retention preview</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ascent-muted">Read-only inventory for planning a future deletion run. This screen never deletes applicant data automatically.</p>
        </header>
        <dl className="grid gap-px bg-ascent-border sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Applications", inventory.applications],
            ["PII records", inventory.piiRecords],
            ["Consent records", inventory.consentRecords],
            ["Decision records", inventory.decisionRecords],
            ["Audit events", inventory.auditEvents],
            ["Dedupe records", inventory.dedupeRecords],
            ["Submission receipts", inventory.submissionReceipts],
            ["Review window", `${settings.retentionDays} days`],
          ].map(([label, value]) => (
            <div key={label} className="bg-ascent-surface p-5">
              <dt className="font-mono text-[0.64rem] uppercase tracking-[0.1em] text-ascent-muted">{label}</dt>
              <dd className="mt-2 text-xl font-semibold tabular-nums text-ascent-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-ascent-border bg-ascent-surface-subtle p-5 text-xs leading-5 text-ascent-muted sm:p-6">
          Oldest registration: <strong className="text-ascent-ink">{formatDate(inventory.oldestRegistration)}</strong>. A future deletion tool must first enumerate exact applicant IDs and dependent records, then require a separate typed confirmation.
        </div>
      </section>
    </div>
  );
}
