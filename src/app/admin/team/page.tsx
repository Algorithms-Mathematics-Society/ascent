import type { Metadata } from "next";
import AdminMetric from "@/components/admin/AdminMetric";
import AdminTeamManager from "@/components/admin/AdminTeamManager";
import { requireOwnerSession } from "@/lib/adminAuth";
import { getAdminTeamMembers } from "@/lib/adminTeamData";

export const metadata: Metadata = {
  title: "Team · Ascent admin",
};

export default async function AdminTeamPage() {
  const session = await requireOwnerSession();
  const members = await getAdminTeamMembers();
  const ownerCount = members.filter((member) => member.role === "OWNER" && !member.disabled).length;
  const reviewerCount = members.filter((member) => member.role === "REVIEWER" && !member.disabled).length;
  const mfaCount = members.filter((member) => member.factorCount > 0 && !member.disabled).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-4 border-b border-ascent-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">Access governance</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ascent-ink sm:text-4xl">Administrator team</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ascent-muted">Grant the least access each person needs, inspect authentication posture, and contain compromised sessions without touching applicant records.</p>
        </div>
        <a href="/admin/activity" className="text-sm font-semibold text-ascent-brand underline underline-offset-4 hover:text-ascent-ink">Review access activity →</a>
      </div>

      <dl className="mt-6 grid gap-px border border-ascent-border bg-ascent-border sm:grid-cols-3">
        <AdminMetric label="Enabled owners" value={ownerCount} detail="Team and settings control" emphasis />
        <AdminMetric label="Enabled reviewers" value={reviewerCount} detail="Applicant operations only" />
        <AdminMetric label="MFA enrolled" value={mfaCount} detail={`Of ${members.filter((member) => !member.disabled).length} enabled admins · not enforced`} />
      </dl>

      <section className="mt-6 grid gap-px border border-ascent-border bg-ascent-border lg:grid-cols-2" aria-label="Role capabilities">
        <div className="bg-ascent-surface p-5 sm:p-6">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ascent-muted">Reviewer</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">Run the application workflow</h2>
          <p className="mt-2 text-sm leading-6 text-ascent-muted">View private entries, inspect documents, add notes and tags, approve or reject, use bulk review, export records and inspect activity.</p>
        </div>
        <div className="bg-ascent-surface p-5 sm:p-6">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ascent-brand">Owner</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">Govern the competition</h2>
          <p className="mt-2 text-sm leading-6 text-ascent-muted">Everything a reviewer can do, plus registration controls, retention settings, administrator roles, session revocation and access removal.</p>
        </div>
      </section>

      <div className="mt-6"><AdminTeamManager members={members} currentUid={session.uid} /></div>

      <section className="mt-6 border border-ascent-border bg-ascent-surface-subtle p-5 sm:p-6" aria-labelledby="mfa-posture-title">
        <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">Authentication posture</p>
        <h2 id="mfa-posture-title" className="mt-2 text-lg font-semibold tracking-tight">MFA is observed, not automatically enforced</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ascent-muted">This roster reports enrolled Firebase multi-factor methods so gaps are visible. Enforcement remains deliberately off in this block: turning it on before every owner enrolls can lock the competition out. Enrol owners first, verify recovery access, then make enforcement a separate deployment decision.</p>
      </section>
    </div>
  );
}
