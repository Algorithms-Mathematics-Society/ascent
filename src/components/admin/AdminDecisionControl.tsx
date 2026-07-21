"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ADMIN_DECISION_REASON_MAX_LENGTH,
  ADMIN_REJECTION_REASON_MIN_LENGTH,
  type ActionableAdminDecision,
} from "@/lib/adminDecision";
import type { AdminDecision } from "@/lib/adminRegistrationView";
import { Button, Spinner } from "@/components/ui";
import AdminRegistrationStatus from "@/components/admin/AdminRegistrationStatus";

interface AdminDecisionControlProps {
  applicationId: string;
  applicantName: string;
  reference: string;
  decision: AdminDecision;
  decisionReason: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
}

function formatDecisionTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export default function AdminDecisionControl({
  applicationId,
  applicantName,
  reference,
  decision,
  decisionReason,
  decidedAt,
  decidedBy,
}: AdminDecisionControlProps) {
  const router = useRouter();
  const panelId = useId();
  const [selected, setSelected] = useState<ActionableAdminDecision | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const decidedTime = formatDecisionTime(decidedAt);

  function begin(nextDecision: ActionableAdminDecision) {
    setSelected(nextDecision);
    setReason("");
    setError(undefined);
    setNotice(undefined);
  }

  function cancel() {
    if (submitting) return;
    setSelected(null);
    setReason("");
    setError(undefined);
  }

  async function submitDecision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || submitting) return;

    const normalizedReason = reason.trim().replace(/\s+/g, " ");
    if (
      selected === "REJECTED" &&
      normalizedReason.length < ADMIN_REJECTION_REASON_MIN_LENGTH
    ) {
      setError(
        `Add a clear reason of at least ${ADMIN_REJECTION_REASON_MIN_LENGTH} characters.`,
      );
      return;
    }

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
            expectedDecision: "PENDING",
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
        setNotice(payload.error || "This registration was already decided.");
        setSelected(null);
        router.refresh();
        return;
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Decision could not be saved.");
      }

      setNotice(payload.message || "Decision saved.");
      setSelected(null);
      setReason("");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Decision could not be saved. Nothing was changed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (decision !== "PENDING") {
    return (
      <div className="min-w-[13rem]">
        <AdminRegistrationStatus decision={decision} />
        {decidedTime || decidedBy ? (
          <p className="mt-2 text-xs leading-5 text-ascent-muted">
            {decidedTime ? `${decidedTime} IST` : "Decision recorded"}
            {decidedBy ? (
              <>
                <br />
                by {decidedBy}
              </>
            ) : null}
          </p>
        ) : null}
        {decisionReason ? (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer font-semibold text-ascent-brand underline underline-offset-4">
              View internal note
            </summary>
            <p className="mt-2 max-w-xs leading-5 text-ascent-muted">
              {decisionReason}
            </p>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-[15rem]">
      <AdminRegistrationStatus decision={decision} />
      {!selected ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => begin("APPROVED")}
            aria-label={`Approve ${applicantName}`}
            aria-expanded={false}
          >
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => begin("REJECTED")}
            aria-label={`Reject ${applicantName}`}
            aria-expanded={false}
            className="border-red-300 text-red-800 hover:border-red-700 hover:bg-red-50 hover:text-red-900"
          >
            Reject
          </Button>
        </div>
      ) : (
        <form
          id={panelId}
          onSubmit={submitDecision}
          className="mt-3 border border-ascent-border bg-ascent-canvas/70 p-3"
        >
          <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ascent-brand">
            {selected === "APPROVED" ? "Confirm approval" : "Confirm rejection"}
          </p>
          <p className="mt-2 text-xs leading-5 text-ascent-muted">
            {selected === "APPROVED"
              ? `Approve ${applicantName}. This decision is recorded permanently.`
              : `Explain why ${applicantName} is not being approved.`}
          </p>

          <label
            htmlFor={`${panelId}-reason`}
            className="mt-3 block text-xs font-semibold text-ascent-ink"
          >
            {selected === "APPROVED"
              ? "Internal note (optional)"
              : "Rejection reason"}
          </label>
          <textarea
            id={`${panelId}-reason`}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(undefined);
            }}
            required={selected === "REJECTED"}
            minLength={
              selected === "REJECTED"
                ? ADMIN_REJECTION_REASON_MIN_LENGTH
                : undefined
            }
            maxLength={ADMIN_DECISION_REASON_MAX_LENGTH}
            rows={3}
            disabled={submitting}
            aria-invalid={Boolean(error)}
            className="ascent-field-control mt-2 resize-y px-3 py-2 text-sm"
            placeholder={
              selected === "APPROVED"
                ? "Add context for the operations team"
                : "State the eligibility or review reason clearly"
            }
          />
          <div className="mt-1 flex items-center justify-between gap-3 text-[0.68rem] text-ascent-muted">
            <span>
              {selected === "REJECTED"
                ? `Minimum ${ADMIN_REJECTION_REASON_MIN_LENGTH} characters`
                : "Visible to administrators only"}
            </span>
            <span className="tabular-nums">
              {reason.length}/{ADMIN_DECISION_REASON_MAX_LENGTH}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner /> Saving…
                </span>
              ) : selected === "APPROVED" ? (
                "Confirm approval"
              ) : (
                "Confirm rejection"
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={cancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
          <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ascent-muted">
            {reference}
          </p>
        </form>
      )}

      {error ? (
        <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          className="mt-2 text-xs leading-5 text-ascent-success"
          role="status"
          aria-live="polite"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
