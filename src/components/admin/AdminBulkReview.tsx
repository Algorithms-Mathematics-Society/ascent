"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@/components/ui";
import {
  ADMIN_BULK_MAX_APPLICATIONS,
  ADMIN_BULK_REASON_MAX_LENGTH,
  ADMIN_BULK_REASON_MIN_LENGTH,
  type AdminBulkDecision,
} from "@/lib/adminBulkDecision";

export interface AdminBulkReviewRow {
  id: string;
  reference: string;
  legalName: string;
  institution: string;
}
export default function AdminBulkReview({
  rows,
}: {
  rows: AdminBulkReviewRow[];
}) {
  const router = useRouter();
  const availableRows = rows.slice(0, ADMIN_BULK_MAX_APPLICATIONS);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [decision, setDecision] = useState<AdminBulkDecision>("APPROVED");
  const [reason, setReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const selectedRows = availableRows.filter((row) => selected.includes(row.id));

  function resetReview() {
    setReviewing(false);
    setConfirmed(false);
    setError(undefined);
  }

  async function submitBatch() {
    if (!confirmed || submitting || !selected.length) return;
    setSubmitting(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const csrfResponse = await fetch("/api/admin/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) {
        throw new Error("Could not prepare this batch. Try again.");
      }
      const response = await fetch("/api/admin/registrations/bulk-decision", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csrfToken: csrfPayload.csrfToken,
          applicationIds: selected,
          decision,
          reason,
        }),
      });
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
        setError(payload.error || "The queue changed. Refresh and review again.");
        setReviewing(false);
        setConfirmed(false);
        router.refresh();
        return;
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Batch decision could not be saved.");
      }
      setNotice(payload.message || `${selected.length} registrations updated.`);
      setSelected([]);
      setReason("");
      setReviewing(false);
      setConfirmed(false);
      setOpen(false);
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Batch decision could not be saved. Nothing was changed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!rows.length && !notice) return null;

  return (
    <section className="border-b border-ascent-border bg-ascent-canvas/45">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-ascent-brand">
              Guarded operation · Pending only
            </p>
            <h3 className="mt-1.5 text-base font-semibold text-ascent-ink">
              Batch review
            </h3>
            <p className="mt-1 text-xs leading-5 text-ascent-muted">
              Approve or waitlist up to {ADMIN_BULK_MAX_APPLICATIONS} reviewed entries. Rejections stay individual.
            </p>
          </div>
          {rows.length ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen((current) => !current);
                resetReview();
                setNotice(undefined);
              }}
            >
              {open ? "Close batch review" : `Review ${rows.length} pending`}
            </Button>
          ) : null}
        </div>

        {notice ? (
          <p className="mt-4 border-l-2 border-ascent-success pl-3 text-sm text-ascent-success" role="status">
            {notice}
          </p>
        ) : null}

        {open ? (
          <div className="mt-5 border border-ascent-border bg-ascent-surface">
            {!reviewing ? (
              <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="border-b border-ascent-border p-4 lg:border-b-0 lg:border-r">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ascent-border pb-3">
                    <p className="text-xs font-semibold text-ascent-ink">
                      Select entries · {selected.length}/{availableRows.length}
                    </p>
                    <button
                      type="button"
                      className="text-xs font-semibold text-ascent-brand underline underline-offset-4"
                      onClick={() => {
                        setSelected(
                          selected.length === availableRows.length
                            ? []
                            : availableRows.map((row) => row.id),
                        );
                        setError(undefined);
                      }}
                    >
                      {selected.length === availableRows.length ? "Clear all" : "Select visible pending"}
                    </button>
                  </div>
                  <div className="max-h-80 divide-y divide-ascent-border overflow-y-auto">
                    {availableRows.map((row) => (
                      <label key={row.id} className="flex cursor-pointer gap-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(row.id)}
                          onChange={(event) => {
                            setSelected((current) =>
                              event.target.checked
                                ? [...current, row.id]
                                : current.filter((id) => id !== row.id),
                            );
                            setError(undefined);
                          }}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-ascent-brand"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ascent-ink">
                            {row.legalName}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-ascent-muted">
                            {row.institution} · {row.reference}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {rows.length > ADMIN_BULK_MAX_APPLICATIONS ? (
                    <p className="mt-3 text-xs text-ascent-muted">
                      Showing the first {ADMIN_BULK_MAX_APPLICATIONS} pending entries in this view.
                    </p>
                  ) : null}
                </div>

                <div className="p-4">
                  <fieldset>
                    <legend className="text-xs font-semibold text-ascent-ink">Outcome</legend>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {(["APPROVED", "WAITLISTED"] as const).map((value) => (
                        <label
                          key={value}
                          className={`cursor-pointer border px-3 py-3 text-center text-xs font-semibold ${
                            decision === value
                              ? "border-ascent-brand bg-ascent-canvas text-ascent-ink"
                              : "border-ascent-border text-ascent-muted"
                          }`}
                        >
                          <input
                            type="radio"
                            name="bulk-decision"
                            value={value}
                            checked={decision === value}
                            onChange={() => {
                              setDecision(value);
                              setError(undefined);
                            }}
                            className="sr-only"
                          />
                          {value === "APPROVED" ? "Approve" : "Waitlist"}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="mt-4 block text-xs font-semibold text-ascent-ink" htmlFor="batch-reason">
                    Batch reason
                  </label>
                  <textarea
                    id="batch-reason"
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setError(undefined);
                    }}
                    rows={4}
                    minLength={ADMIN_BULK_REASON_MIN_LENGTH}
                    maxLength={ADMIN_BULK_REASON_MAX_LENGTH}
                    className="ascent-field-control mt-2 resize-y px-3 py-2 text-sm"
                    placeholder="State what was reviewed and why this shared outcome applies"
                  />
                  <div className="mt-1 flex justify-between text-[0.68rem] text-ascent-muted">
                    <span>Required · audit-visible</span>
                    <span>{reason.length}/{ADMIN_BULK_REASON_MAX_LENGTH}</span>
                  </div>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    disabled={
                      !selected.length ||
                      reason.trim().length < ADMIN_BULK_REASON_MIN_LENGTH
                    }
                    onClick={() => {
                      setReviewing(true);
                      setConfirmed(false);
                      setError(undefined);
                    }}
                  >
                    Review batch before saving
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.13em] text-ascent-brand">
                  Final confirmation
                </p>
                <h4 className="mt-2 text-xl font-semibold text-ascent-ink">
                  {decision === "APPROVED" ? "Approve" : "Waitlist"} {selectedRows.length} registrations
                </h4>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ascent-muted">
                  This is one atomic operation: every selected entry changes, or none do. Each applicant receives an individual audit event. No email is sent.
                </p>
                <div className="mt-5 grid gap-4 border border-ascent-border bg-ascent-canvas/50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ascent-muted">Selected</p>
                    <ul className="mt-2 space-y-1 text-sm text-ascent-ink">
                      {selectedRows.slice(0, 6).map((row) => (
                        <li key={row.id}>{row.legalName}</li>
                      ))}
                      {selectedRows.length > 6 ? <li>+ {selectedRows.length - 6} more</li> : null}
                    </ul>
                  </div>
                  <div>
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ascent-muted">Recorded reason</p>
                    <p className="mt-2 text-sm leading-6 text-ascent-ink">{reason.trim()}</p>
                  </div>
                </div>
                <label className="mt-5 flex cursor-pointer items-start gap-3 border border-ascent-border p-4 text-sm leading-6 text-ascent-ink">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-ascent-brand"
                  />
                  I reviewed every selected registration and confirm the same outcome and reason apply to each one.
                </label>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="secondary" disabled={submitting} onClick={resetReview}>
                    Back to selection
                  </Button>
                  <Button type="button" disabled={!confirmed || submitting} onClick={submitBatch}>
                    {submitting ? (
                      <span className="inline-flex items-center gap-2"><Spinner /> Saving batch…</span>
                    ) : (
                      `Confirm ${decision === "APPROVED" ? "approval" : "waitlist"}`
                    )}
                  </Button>
                </div>
              </div>
            )}

            {error ? (
              <p className="border-t border-ascent-border px-4 py-3 text-xs leading-5 text-red-700" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
