import type { Metadata } from "next";
import AdminMetric from "@/components/admin/AdminMetric";
import AdminTeamManager from "@/components/admin/AdminTeamManager";
import { requireOwnerSession } from "@/lib/adminAuth";
import { ownerRecoveryReadiness } from "@/lib/adminTeam";
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
  const recovery = ownerRecoveryReadiness(members);
  const recoveryCopy = {
    SECOND_OWNER_REQUIRED: {
      eyebrow: "Action required",
      title: "Create a second recovery owner",
      detail: "One account is still a single point of failure. Create and verify a separate Firebase email/password account, then grant it owner access below.",
    },
    EMAIL_VERIFICATION_REQUIRED: {
      eyebrow: "Verification required",
      title: "Verify the second owner's email",
      detail: "Two enabled owner records exist, but at least one email is unverified. Verification is required before this recovery path is trusted.",
    },
    SIGN_IN_DRILL_REQUIRED: {
      eyebrow: "Recovery drill required",
      title: "Test the second owner independently",
      detail: "Both owner emails are verified. Sign in to the second account from a separate browser before relying on it for recovery.",
    },
    READY: {
      eyebrow: "Recovery ready",
      title: "Owner redundancy is established",
      detail: "At least two enabled, verified owners have successfully signed in. Keep their credentials and devices independent.",
    },
  }[recovery.state];

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
        <AdminMetric label="MFA enrolled" value={mfaCount} detail={`Of ${members.filter((member) => !member.disabled).length} enabled admins · staged rollout`} />
      </dl>

      <section className={`mt-6 border p-5 sm:p-6 ${recovery.state === "READY" ? "border-ascent-success bg-ascent-success-tint" : "border-ascent-danger bg-ascent-danger-tint"}`} aria-labelledby="recovery-readiness-title">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className={`font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] ${recovery.state === "READY" ? "text-ascent-success" : "text-ascent-danger"}`}>{recoveryCopy.eyebrow}</p>
            <h2 id="recovery-readiness-title" className="mt-2 text-xl font-semibold tracking-tight text-ascent-ink">{recoveryCopy.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ascent-muted">{recoveryCopy.detail}</p>
          </div>
          <dl className="grid shrink-0 grid-cols-3 gap-px border border-ascent-border bg-ascent-border text-center">
            {[
              ["Enabled", recovery.enabledOwners],
              ["Verified", recovery.verifiedOwners],
              ["Sign-in tested", recovery.testedOwners],
            ].map(([label, value]) => (
              <div key={label} className="min-w-20 bg-ascent-surface p-3">
                <dt className="font-mono text-[0.55rem] uppercase tracking-[0.06em] text-ascent-muted">{label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-ascent-ink">{value}/2</dd>
              </div>
            ))}
          </dl>
        </div>
        <ol className="mt-5 grid gap-px border border-ascent-border bg-ascent-border md:grid-cols-3">
          {[
            ["01", "Create + verify", "Use a separate Firebase email/password account owned by the recovery administrator."],
            ["02", "Grant owner", "Add the verified email below and confirm the grant with a recorded reason."],
            ["03", "Test separately", "Sign in from another browser and confirm Team and Settings access."],
          ].map(([number, title, detail]) => (
            <li key={number} className="bg-ascent-surface p-4">
              <p className="font-mono text-[0.6rem] font-semibold text-ascent-brand">{number}</p>
              <p className="mt-2 text-sm font-semibold text-ascent-ink">{title}</p>
              <p className="mt-1 text-xs leading-5 text-ascent-muted">{detail}</p>
            </li>
          ))}
        </ol>
      </section>

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">Authentication posture</p>
            <h2 id="mfa-posture-title" className="mt-2 text-lg font-semibold tracking-tight">TOTP enrollment is open; enforcement is staged</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ascent-muted">Each administrator can now pair an authenticator from the Security page. Enrolled accounts receive a six-digit challenge on fresh login. Server-wide enforcement remains off until every owner enrolls and Block 3 completes the recovery drill.</p>
          </div>
          <a href="/admin/security" className="inline-flex min-h-11 shrink-0 items-center justify-center border border-ascent-brand bg-ascent-brand px-4 py-2 text-sm font-semibold text-ascent-on-brand hover:bg-ascent-ink">Open my security setup</a>
        </div>
      </section>
    </div>
  );
}
