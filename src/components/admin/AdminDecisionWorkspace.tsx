"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_DECISION_REASON_MAX_LENGTH,
  ADMIN_REQUIRED_REASON_MIN_LENGTH,
  type ActionableAdminDecision,
} from "@/lib/adminDecision";
import { buildEmailMessage, emailJob } from "@/lib/email/messages";
import type { AdminDecisionEmail } from "@/lib/adminDecisionEmail";
import type { AdminDecision } from "@/lib/adminRegistrationView";
import { Button, Spinner } from "@/components/ui";
import AdminRegistrationStatus from "@/components/admin/AdminRegistrationStatus";

interface AdminDecisionWorkspaceProps {
  applicationId: string;
  applicantName: string;
  email: string;
  emailSiteUrl: string;
  decisionChangesAllowed: boolean;
  canRetryEmail: boolean;
  decisionEmail: AdminDecisionEmail;
  reference: string;
  currentDecision: AdminDecision;
  currentReason: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  revision: number;
}

const DECISION_LABEL: Record<ActionableAdminDecision, string> = {
  APPROVED: "Approve",
  WAITLISTED: "Waitlist",
  REJECTED: "Reject",
};

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default function AdminDecisionWorkspace({
  applicationId,
  applicantName,
  email,
  emailSiteUrl,
  decisionChangesAllowed,
  canRetryEmail,
  decisionEmail,
  reference,
  currentDecision,
  currentReason,
  decidedAt,
  decidedBy,
  revision,
}: AdminDecisionWorkspaceProps) {
  const router = useRouter();
  const saving = useRef(false);
  const retrying = useRef(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [selected, setSelected] = useState<ActionableAdminDecision | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  // A refreshed record requires a fresh review, even when the outcome matches
  // an older revision after several corrections.
  useEffect(() => {
    setSelected(null);
    setCorrectionOpen(false);
    setReason("");
  }, [applicationId, currentDecision, revision]);
  const isCorrection = currentDecision !== "PENDING";
  const reasonRequired =
    Boolean(selected) && (isCorrection || selected !== "APPROVED");
  const availableDecisions: ActionableAdminDecision[] = [
    "APPROVED",
    "WAITLISTED",
    "REJECTED",
  ];

  const preview = selected ? buildEmailMessage({
    ...emailJob("DECISION", applicationId),
    decision: selected,
    ...(currentDecision !== "PENDING" ? { previous_decision: currentDecision } : {}),
  }, { reference }, emailSiteUrl) : null;
  const notificationLabel = decisionEmail.status === "SENT"
    ? "Accepted by email provider"
    : decisionEmail.status === "PENDING" && decisionEmail.configured
      ? "Email queued"
      : decisionEmail.status === "SENDING"
        ? "Email processing"
        : "Email needs attention";

  async function retryEmail() {
    if (retrying.current || saving.current || !canRetryEmail || !decisionEmail.canRetry) return;
    retrying.current = true;
    setRetryBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const csrfResponse = await fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" });
      const csrfPayload = await csrfResponse.json() as { csrfToken?: string };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) throw new Error("Could not prepare email retry. Try again.");
      const response = await fetch(`/api/admin/registrations/${encodeURIComponent(applicationId)}/decision/email`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfPayload.csrfToken },
        body: JSON.stringify({ expectedRevision: revision }),
      });
      const payload = await response.json() as { error?: string; message?: string };
      if (response.status === 401) { window.location.replace("/admin-page-login"); return; }
      if (!response.ok) throw new Error(payload.error || "Email retry could not be started.");
      setNotice(payload.message || "Email processing requested. Refresh the email status for the result.");
      router.refresh();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Email retry could not be started.");
      router.refresh();
    } finally {
      retrying.current = false;
      setRetryBusy(false);
    }
  }

  function selectDecision(decision: ActionableAdminDecision) {
    setSelected(decision);
    setReason("");
    setError(undefined);
    setNotice(undefined);
  }

  function cancel() {
    if (submitting) return;
    setSelected(null);
    setReason("");
    setError(undefined);
    if (isCorrection) setCorrectionOpen(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving.current || retrying.current || !decisionChangesAllowed) return;

    const normalizedReason = reason.trim().replace(/\s+/g, " ");
    if (
      reasonRequired &&
      normalizedReason.length < ADMIN_REQUIRED_REASON_MIN_LENGTH
    ) {
      setError(
        `Add a clear reason of at least ${ADMIN_REQUIRED_REASON_MIN_LENGTH} characters.`,
      );
      return;
    }

    saving.current = true;
    setSubmitting(true);
    setError(undefined);
    setNotice(undefined);

    try {
      const csrfResponse = await fetch("/api/admin/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const csrfPayload = (await csrfResponse.json()) as {
        csrfToken?: string;
      };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) {
        throw new Error("Could not prepare this decision. Try again.");
      }

      const response = await fetch(
        `/api/admin/registrations/${encodeURIComponent(applicationId)}/decision`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            csrfToken: csrfPayload.csrfToken,
            decision: selected,
            expectedDecision: currentDecision,
            expectedRevision: revision,
            reason: normalizedReason || null,
          }),
        },
      );
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (response.status === 401) {
        window.location.replace("/admin-page-login");
        return;
      }
      if (response.status === 409) {
        setNotice(payload.error || "Another administrator changed this decision.");
        setSelected(null);
        setCorrectionOpen(false);
        router.refresh();
        return;
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Decision could not be saved.");
      }

      setNotice("Decision saved. Applicant email queued; check the email status below.");
      setSelected(null);
      setCorrectionOpen(false);
      setReason("");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Decision could not be saved. Nothing was changed.",
      );
    } finally {
      saving.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section
      className="border border-ascent-border bg-ascent-surface"
      aria-labelledby="decision-panel-title"
    >
      <div className="border-b border-ascent-border p-5">
        <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
          Review outcome
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="decision-panel-title" className="text-xl font-semibold">
            Decision
          </h2>
          <AdminRegistrationStatus decision={currentDecision} />
        </div>

        {isCorrection ? (
          <div className="mt-4 border-l-2 border-ascent-brand pl-3 text-xs leading-5 text-ascent-muted">
            <p>
              {decidedAt ? `${formatDate(decidedAt)} IST` : "Decision recorded"}
              {decidedBy ? ` by ${decidedBy}` : null}
            </p>
            <p className="mt-1">Revision {Math.max(1, revision)}</p>
            {currentReason ? (
              <p className="mt-2 text-ascent-ink">{currentReason}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-ascent-muted">
            Review the complete application before recording an outcome.
          </p>
        )}
      </div>

      <div className="p-5">
        {!decisionChangesAllowed ? (
          <p className="text-xs leading-5 text-ascent-muted">
            Decisions cannot be changed for withdrawn or deleted registrations.
          </p>
        ) : null}
        {decisionChangesAllowed && isCorrection && !correctionOpen && !selected ? (
          <>
            <p className="text-xs leading-5 text-ascent-muted">
              Change this only when new evidence or an administrative error
              warrants a correction. The previous decision remains in the audit
              history.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => {
                setCorrectionOpen(true);
                setNotice(undefined);
              }}
            >
              Change decision
            </Button>
          </>
        ) : null}

        {decisionChangesAllowed && (!isCorrection || correctionOpen) && !selected ? (
          <div>
            <p className="text-xs font-semibold text-ascent-ink">
              {isCorrection ? "Choose the corrected outcome" : "Choose an outcome"}
            </p>
            <div className="mt-3 grid gap-2">
              {availableDecisions
                .filter((decision) => decision !== currentDecision)
                .map((decision) => (
                  <Button
                    key={decision}
                    type="button"
                    variant={decision === "APPROVED" ? "primary" : "secondary"}
                    onClick={() => selectDecision(decision)}
                    className={
                      decision === "REJECTED"
                        ? "border-red-300 text-red-800 hover:border-red-700 hover:bg-red-50 hover:text-red-900"
                        : decision === "WAITLISTED"
                          ? "border-amber-300 text-amber-900 hover:border-amber-700 hover:bg-amber-50"
                          : undefined
                    }
                  >
                    {DECISION_LABEL[decision]}
                  </Button>
                ))}
            </div>
            {isCorrection ? (
              <button
                type="button"
                className="mt-3 w-full text-center text-xs font-semibold text-ascent-muted underline underline-offset-4 hover:text-ascent-brand"
                onClick={() => setCorrectionOpen(false)}
              >
                Keep current decision
              </button>
            ) : null}
          </div>
        ) : null}

        {decisionChangesAllowed && selected ? (
          <form onSubmit={submit}>
            <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ascent-brand">
              {isCorrection ? "Confirm correction" : "Confirm decision"}
            </p>
            <h3 className="mt-2 text-lg font-semibold">
              {DECISION_LABEL[selected]} {applicantName}
            </h3>
            <p className="mt-2 text-xs leading-5 text-ascent-muted">
              {isCorrection
                ? `This changes ${currentDecision.toLowerCase()} to ${selected.toLowerCase()} and appends a permanent audit event.`
                : selected === "APPROVED"
                  ? "Approval is recorded immediately. An internal note is optional."
                  : "This outcome requires a clear internal reason."}
            </p>

            <label
              htmlFor="workspace-decision-reason"
              className="mt-4 block text-xs font-semibold text-ascent-ink"
            >
              {reasonRequired ? "Internal reason (required)" : "Internal note (optional)"}
            </label>
            <textarea
              id="workspace-decision-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError(undefined);
              }}
              required={reasonRequired}
              minLength={
                reasonRequired ? ADMIN_REQUIRED_REASON_MIN_LENGTH : undefined
              }
              maxLength={ADMIN_DECISION_REASON_MAX_LENGTH}
              rows={4}
              disabled={submitting}
              aria-invalid={Boolean(error)}
              className="ascent-field-control mt-2 resize-y px-3 py-2 text-sm"
              placeholder={
                reasonRequired
                  ? "State the evidence or administrative reason clearly"
                  : "Add context for the operations team"
              }
            />
            <div className="mt-1 flex justify-between gap-3 text-[0.68rem] text-ascent-muted">
              <span>
                {reasonRequired
                  ? `Minimum ${ADMIN_REQUIRED_REASON_MIN_LENGTH} characters`
                  : "Administrators only"}
              </span>
              <span className="tabular-nums">
                {reason.length}/{ADMIN_DECISION_REASON_MAX_LENGTH}
              </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-ascent-muted">
              Private to administrators. This reason is never included in the applicant email.
            </p>
            {preview ? (
              <div className="mt-4 border border-ascent-border bg-ascent-canvas/60 p-3">
                <p className="text-xs font-semibold">{isCorrection ? "Correction email preview" : "Decision email preview"}</p>
                <p className="mt-2 break-words text-xs leading-5">To: {email}</p>
                <p className="mt-2 text-xs font-semibold leading-5">Subject: {preview.subject}</p>
                <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-ascent-muted">{preview.text}</pre>
                {isCorrection ? <p className="mt-3 text-xs leading-5 text-ascent-muted">Already-sent emails cannot be recalled. This correction tells the applicant which decision now applies.</p> : null}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2">
              <Button type="submit" disabled={submitting || retryBusy}>
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> Saving…
                  </span>
                ) : (
                  `Confirm ${DECISION_LABEL[selected].toLowerCase()}`
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={cancel}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        <div className="mt-5 border-t border-ascent-border pt-4">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ascent-muted">
            {reference}
          </p>
          <p className="mt-2 text-xs leading-5 text-ascent-muted">
            Saving a decision queues an email to {email}. Delivery is tracked separately.
          </p>
        </div>

        {isCorrection ? (
          <div className="mt-4 border-t border-ascent-border pt-4" aria-label="Decision email status">
            <p className="text-xs font-semibold">{notificationLabel}</p>
            <p className="mt-1 text-xs text-ascent-muted">For decision revision {revision}</p>
            <p className="mt-2 text-xs leading-5 text-ascent-muted">
              {decisionEmail.status === "SENT"
                ? "The provider accepted the email. Inbox delivery is not confirmed."
                : !decisionEmail.configured
                  ? "Email sending is not configured. An owner must check email settings."
                  : decisionEmail.status === "REVIEW"
                    ? "Delivery needs review. An owner must check the provider record before any resend."
                    : decisionEmail.status === "RETRY"
                      ? "A sending attempt failed. An automatic retry is queued."
                      : decisionEmail.status === "PENDING" || decisionEmail.status === "SENDING"
                        ? "The saved decision is active while email sending completes."
                        : "No active notification is confirmed for this revision. An owner must review it."}
            </p>
            {decisionEmail.lastError ? <p className="mt-2 text-xs text-ascent-muted">Sending issue: {decisionEmail.lastError}</p> : null}
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" disabled={submitting || retryBusy} onClick={() => router.refresh()} className="text-xs font-semibold text-ascent-brand underline underline-offset-4 disabled:opacity-50">Refresh email status</button>
              {notificationLabel === "Email needs attention" ? <a href="/admin/email" className="text-xs font-semibold text-ascent-brand underline underline-offset-4">Review email queue</a> : null}
              {canRetryEmail && decisionEmail.canRetry ? <button type="button" disabled={submitting || retryBusy} onClick={retryEmail} className="text-xs font-semibold text-ascent-brand underline underline-offset-4 disabled:opacity-50">{retryBusy ? "Processing email…" : "Retry due email"}</button> : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-xs leading-5 text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            className="mt-3 text-xs leading-5 text-ascent-success"
            role="status"
            aria-live="polite"
          >
            {notice}
          </p>
        ) : null}
      </div>
    </section>
  );
}
