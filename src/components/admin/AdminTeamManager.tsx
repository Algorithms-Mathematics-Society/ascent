"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@/components/ui";
import type { AdminRole } from "@/lib/adminSecurity";
import type { AdminTeamAction, AdminTeamMember } from "@/lib/adminTeam";

interface ApiResult {
  success?: boolean;
  message?: string;
  error?: string;
}

async function submitTeamMutation(payload: Record<string, unknown>) {
  const csrfResponse = await fetch("/api/admin/session", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
  if (!csrfResponse.ok || !csrfPayload.csrfToken) {
    throw new Error("Could not prepare this access change. Try again.");
  }
  const response = await fetch("/api/admin/team", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, csrfToken: csrfPayload.csrfToken }),
  });
  const result = (await response.json()) as ApiResult;
  if (response.status === 401) {
    window.location.replace("/admin-page-login");
    throw new Error("Your admin session expired.");
  }
  if (!response.ok || !result.success) {
    throw new Error(result.error || "The administrator change could not be completed.");
  }
  return result.message || "Administrator access updated.";
}

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span
      className={`inline-flex border px-2 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] ${
        role === "OWNER"
          ? "border-ascent-brand bg-ascent-brand text-ascent-on-brand"
          : "border-ascent-border bg-ascent-surface-subtle text-ascent-ink"
      }`}
    >
      {role === "OWNER" ? "Owner" : "Reviewer"}
    </span>
  );
}

function GrantAccessForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("REVIEWER");
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const message = await submitTeamMutation({
        action: "GRANT_ACCESS",
        email,
        role,
        confirmation,
        reason,
      });
      setEmail("");
      setRole("REVIEWER");
      setConfirmation("");
      setReason("");
      setNotice(message);
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Administrator access could not be granted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-ascent-border bg-ascent-surface">
      <header className="border-b border-ascent-border p-5 sm:p-6">
        <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
          Deliberate access grant
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Add an administrator</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ascent-muted">
          The person must already have a verified email/password account in Firebase Authentication.
          Start with reviewer unless they must control access and competition settings.
        </p>
      </header>
      <fieldset disabled={busy} className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
          Firebase account email
          <input
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="reviewer@example.com"
            className="ascent-field-control ascent-input"
          />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
          Access role
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as AdminRole)}
            className="ascent-field-control ascent-select"
          >
            <option value="REVIEWER">Reviewer · application operations</option>
            <option value="OWNER">Owner · full administration</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink lg:col-span-2">
          Reason for access
          <textarea
            required
            minLength={10}
            maxLength={500}
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Record why this person needs access and for which responsibility."
            className="ascent-field-control min-h-24 resize-y px-3 py-3"
          />
        </label>
        <label className="flex flex-col gap-2 border border-ascent-border bg-ascent-surface-subtle p-4 text-xs font-semibold text-ascent-ink lg:col-span-2">
          Type the account email again to confirm
          <input
            type="email"
            required
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={email || "reviewer@example.com"}
            className="ascent-field-control ascent-input bg-ascent-surface"
          />
          <span className="font-normal leading-5 text-ascent-muted">
            The grant, selected role, owner identity and reason are written to the activity ledger.
          </span>
        </label>
      </fieldset>
      <footer className="flex flex-col gap-3 border-t border-ascent-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div aria-live="polite">
          {error ? <p role="alert" className="text-xs font-medium text-ascent-danger">{error}</p> : null}
          {notice ? <p className="text-xs font-medium text-ascent-success">{notice}</p> : null}
          {!error && !notice ? <p className="text-xs text-ascent-muted">No invitation email is sent automatically.</p> : null}
        </div>
        <Button type="submit" disabled={busy || confirmation.trim().toLocaleLowerCase() !== email.trim().toLocaleLowerCase()}>
          {busy ? <span className="inline-flex items-center gap-2"><Spinner /> Granting access…</span> : `Grant ${role === "OWNER" ? "owner" : "reviewer"} access`}
        </Button>
      </footer>
    </form>
  );
}

function MemberControls({ member }: { member: AdminTeamMember }) {
  const router = useRouter();
  const [role, setRole] = useState<AdminRole>(member.role === "OWNER" ? "REVIEWER" : "OWNER");
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [busyAction, setBusyAction] = useState<AdminTeamAction>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const confirmed = confirmation.trim().toLocaleLowerCase() === member.email;

  async function run(action: Exclude<AdminTeamAction, "GRANT_ACCESS">) {
    if (busyAction || !confirmed) return;
    setBusyAction(action);
    setError(undefined);
    setNotice(undefined);
    try {
      const message = await submitTeamMutation({
        action,
        targetUid: member.uid,
        targetEmail: member.email,
        expectedRole: member.role,
        role,
        confirmation,
        reason,
      });
      setConfirmation("");
      setReason("");
      setNotice(message);
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Administrator access could not be changed.",
      );
    } finally {
      setBusyAction(undefined);
    }
  }

  return (
    <details className="border-t border-ascent-border bg-ascent-surface-subtle">
      <summary className="cursor-pointer list-none px-5 py-4 text-xs font-semibold text-ascent-brand marker:hidden sm:px-6">
        Manage access <span aria-hidden="true">↓</span>
      </summary>
      <div className="grid gap-4 border-t border-ascent-border p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
            New role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AdminRole)}
              disabled={Boolean(busyAction)}
              className="ascent-field-control ascent-select bg-ascent-surface"
            >
              <option value="REVIEWER">Reviewer</option>
              <option value="OWNER">Owner</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
            Type {member.email} to confirm
            <input
              type="email"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={Boolean(busyAction)}
              className="ascent-field-control ascent-input bg-ascent-surface"
            />
          </label>
        </div>
        <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
          Reason for this operation
          <textarea
            minLength={10}
            maxLength={500}
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={Boolean(busyAction)}
            placeholder="Required for every access or session change."
            className="ascent-field-control min-h-20 resize-y bg-ascent-surface px-3 py-3"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!confirmed || reason.trim().length < 10 || Boolean(busyAction)}
            onClick={() => run("CHANGE_ROLE")}
          >
            {busyAction === "CHANGE_ROLE" ? <span className="inline-flex items-center gap-2"><Spinner /> Saving…</span> : `Change to ${role === "OWNER" ? "owner" : "reviewer"}`}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!confirmed || reason.trim().length < 10 || Boolean(busyAction)}
            onClick={() => run("REVOKE_SESSIONS")}
          >
            {busyAction === "REVOKE_SESSIONS" ? <span className="inline-flex items-center gap-2"><Spinner /> Revoking…</span> : "Revoke every session"}
          </Button>
          <button
            type="button"
            disabled={!confirmed || reason.trim().length < 10 || Boolean(busyAction)}
            onClick={() => run("REVOKE_ACCESS")}
            className="min-h-11 border border-ascent-danger bg-ascent-danger-tint px-4 py-2 text-sm font-semibold text-ascent-danger transition-colors hover:bg-ascent-danger hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busyAction === "REVOKE_ACCESS" ? <span className="inline-flex items-center gap-2"><Spinner /> Revoking…</span> : "Remove administrator access"}
          </button>
        </div>
        <div aria-live="polite">
          {error ? <p role="alert" className="text-xs font-medium text-ascent-danger">{error}</p> : null}
          {notice ? <p className="text-xs font-medium text-ascent-success">{notice}</p> : null}
          {!error && !notice ? <p className="text-xs leading-5 text-ascent-muted">Role and access changes revoke existing sessions. The person must sign in again with fresh permissions.</p> : null}
        </div>
      </div>
    </details>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export default function AdminTeamManager({
  members,
  currentUid,
}: {
  members: AdminTeamMember[];
  currentUid: string;
}) {
  return (
    <div className="grid gap-6">
      <GrantAccessForm />
      <section className="border border-ascent-border bg-ascent-surface" aria-labelledby="team-members-title">
        <header className="border-b border-ascent-border p-5 sm:p-6">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">Current access</p>
          <h2 id="team-members-title" className="mt-2 text-xl font-semibold tracking-tight">Administrator roster</h2>
          <p className="mt-2 text-sm leading-6 text-ascent-muted">{members.length} active access {members.length === 1 ? "record" : "records"}. Disabled Firebase accounts remain visible for diagnosis.</p>
        </header>
        <div className="grid gap-px bg-ascent-border lg:grid-cols-2">
          {members.map((member) => {
            const isSelf = member.uid === currentUid;
            return (
              <article key={member.uid} className="flex flex-col bg-ascent-surface">
                <div className="flex-1 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold text-ascent-ink">{member.email}</p>
                      <p className="mt-1 font-mono text-[0.6rem] text-ascent-muted">{member.uid}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleBadge role={member.role} />
                      {isSelf ? <span className="border border-ascent-border px-2 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-ascent-muted">You</span> : null}
                    </div>
                  </div>
                  <dl className="mt-5 grid gap-px border border-ascent-border bg-ascent-border sm:grid-cols-2">
                    <div className="bg-ascent-surface-subtle p-3">
                      <dt className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-ascent-muted">Account</dt>
                      <dd className={`mt-1 text-xs font-semibold ${member.disabled || !member.emailVerified ? "text-ascent-danger" : "text-ascent-success"}`}>{member.disabled ? "Disabled" : member.emailVerified ? "Enabled · email verified" : "Enabled · email unverified"}</dd>
                    </div>
                    <div className="bg-ascent-surface-subtle p-3">
                      <dt className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-ascent-muted">MFA posture</dt>
                      <dd className={`mt-1 text-xs font-semibold ${member.factorCount ? "text-ascent-success" : "text-ascent-muted"}`}>{member.factorCount ? `${member.factorCount} TOTP factor${member.factorCount === 1 ? "" : "s"}` : "TOTP not enrolled"}</dd>
                    </div>
                    <div className="bg-ascent-surface-subtle p-3 sm:col-span-2">
                      <dt className="font-mono text-[0.58rem] uppercase tracking-[0.08em] text-ascent-muted">Last sign-in</dt>
                      <dd className="mt-1 text-xs font-medium tabular-nums text-ascent-ink">{formatDate(member.lastSignInAt)}{member.lastSignInAt ? " IST" : ""}</dd>
                    </div>
                  </dl>
                  {isSelf ? <p className="mt-4 border-l-2 border-ascent-brand pl-3 text-xs leading-5 text-ascent-muted">Self-service role and revocation controls are locked to prevent accidental owner lockout. Another owner must change this account.</p> : null}
                </div>
                {!isSelf ? <MemberControls member={member} /> : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
