"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@/components/ui";
import type { RegistrationSettings } from "@/lib/registrationSettings";

function localDateTimeValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminRegistrationSettingsForm({
  settings,
}: {
  settings: RegistrationSettings;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(settings.isOpen);
  const [deadline, setDeadline] = useState(localDateTimeValue(settings.deadline));
  const [capacity, setCapacity] = useState(
    settings.capacity === null ? "" : String(settings.capacity),
  );
  const [retentionDays, setRetentionDays] = useState(String(settings.retentionDays));
  const [reason, setReason] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [revision, setRevision] = useState(settings.revision);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    setIsOpen(settings.isOpen);
    setDeadline(localDateTimeValue(settings.deadline));
    setCapacity(settings.capacity === null ? "" : String(settings.capacity));
    setRetentionDays(String(settings.retentionDays));
    setRevision(settings.revision);
    setConfirmClose(false);
  }, [settings]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
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
        throw new Error("Could not prepare this settings change. Try again.");
      }
      const response = await fetch("/api/admin/settings/registration", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isOpen,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          capacity: capacity ? Number(capacity) : null,
          retentionDays: Number(retentionDays),
          reason,
          confirmation: !isOpen && confirmClose ? "CLOSE_REGISTRATION" : null,
          expectedRevision: revision,
          csrfToken: csrfPayload.csrfToken,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        revision?: number;
      };
      if (response.status === 401) {
        window.location.replace("/admin-page-login");
        return;
      }
      if (response.status === 409) {
        setError(result.error || "Settings changed in another tab.");
        router.refresh();
        return;
      }
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Registration settings could not be saved.");
      }
      setRevision(result.revision ?? revision);
      setReason("");
      setConfirmClose(false);
      setNotice(result.message || "Registration controls saved.");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Registration settings could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={save} className="border border-ascent-border bg-ascent-surface">
      <header className="border-b border-ascent-border p-5 sm:p-6">
        <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
          Public intake
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Registration controls</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ascent-muted">
          These controls are enforced on the public page and again inside the final
          submission transaction. Every change is recorded in the activity ledger.
        </p>
      </header>

      <fieldset disabled={submitting} className="grid gap-6 p-5 sm:p-6">
        <div>
          <p className="text-sm font-semibold text-ascent-ink">Intake status</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              { value: true, title: "Open", detail: "Accept new competition entries." },
              { value: false, title: "Closed", detail: "Block every new submission immediately." },
            ].map((option) => (
              <label
                key={option.title}
                className={`cursor-pointer border p-4 ${
                  isOpen === option.value
                    ? "border-ascent-brand bg-ascent-brand-tint"
                    : "border-ascent-border hover:border-ascent-brand"
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="registration_status"
                    checked={isOpen === option.value}
                    onChange={() => {
                      setIsOpen(option.value);
                      setConfirmClose(false);
                      setError(undefined);
                      setNotice(undefined);
                    }}
                    className="mt-1 h-4 w-4 accent-ascent-brand"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ascent-ink">{option.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-ascent-muted">{option.detail}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
            Registration deadline
            <input
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="ascent-field-control ascent-input"
            />
            <span className="font-normal leading-5 text-ascent-muted">Optional · interpreted in your local time.</span>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
            Entry capacity
            <input
              type="number"
              min={settings.acceptedCount || 1}
              max={100000}
              step={1}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder="No capacity limit"
              className="ascent-field-control ascent-input"
            />
            <span className="font-normal leading-5 text-ascent-muted">Optional · {settings.acceptedCount} already received.</span>
          </label>
        </div>

        <label className="flex max-w-sm flex-col gap-2 text-xs font-semibold text-ascent-ink">
          Retention review window
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={30}
              max={3650}
              step={1}
              value={retentionDays}
              onChange={(event) => setRetentionDays(event.target.value)}
              className="ascent-field-control ascent-input"
            />
            <span className="text-sm font-normal text-ascent-muted">days</span>
          </span>
          <span className="font-normal leading-5 text-ascent-muted">Policy marker only. It does not automatically delete records.</span>
        </label>

        {!isOpen ? (
          <label className="flex items-start gap-3 border border-ascent-danger bg-ascent-danger-tint p-4 text-xs leading-5 text-ascent-ink">
            <input
              type="checkbox"
              checked={confirmClose}
              onChange={(event) => setConfirmClose(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-ascent-danger"
            />
            I understand that saving will immediately block all new registrations.
            Existing idempotent submission receipts remain recoverable.
          </label>
        ) : null}

        <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
          Reason for this change
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Record why the intake settings are changing."
            className="ascent-field-control min-h-24 resize-y px-3 py-3"
          />
          <span className="font-normal leading-5 text-ascent-muted">Private, mandatory and stored in the immutable audit ledger.</span>
        </label>
      </fieldset>

      <footer className="flex flex-col gap-3 border-t border-ascent-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div aria-live="polite">
          {error ? <p role="alert" className="text-xs font-medium text-ascent-danger">{error}</p> : null}
          {notice ? <p className="text-xs font-medium text-ascent-success">{notice}</p> : null}
          {!error && !notice ? <p className="text-xs text-ascent-muted">Revision {revision} · stale tabs cannot overwrite newer settings.</p> : null}
        </div>
        <Button type="submit" disabled={submitting || (!isOpen && !confirmClose)}>
          {submitting ? <span className="inline-flex items-center gap-2"><Spinner /> Saving controls…</span> : "Review and save controls"}
        </Button>
      </footer>
    </form>
  );
}
