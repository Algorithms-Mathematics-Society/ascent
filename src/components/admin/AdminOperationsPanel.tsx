"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@/components/ui";
import {
  ADMIN_NOTE_MAX_LENGTH,
  ADMIN_NOTE_MIN_LENGTH,
  ADMIN_REGISTRATION_TAG_LABEL,
  ADMIN_REGISTRATION_TAGS,
  type AdminRegistrationTag,
} from "@/lib/adminOperations";
import type { AdminRegistrationNote } from "@/lib/adminRegistrations";

interface AdminOperationsPanelProps {
  applicationId: string;
  initialTags: AdminRegistrationTag[];
  initialRevision: number;
  notes: AdminRegistrationNote[];
}

function canonicalTags(tags: AdminRegistrationTag[]) {
  return [...tags].sort().join("|");
}

function formatDate(value: string | null) {
  if (!value) return "Time unavailable";
  return `${new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value))} IST`;
}

export default function AdminOperationsPanel({
  applicationId,
  initialTags,
  initialRevision,
  notes,
}: AdminOperationsPanelProps) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [savedTags, setSavedTags] = useState(initialTags);
  const [revision, setRevision] = useState(initialRevision);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"tags" | "note" | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  useEffect(() => {
    setTags(initialTags);
    setSavedTags(initialTags);
    setRevision(initialRevision);
  }, [initialRevision, initialTags]);
  const tagsChanged = useMemo(
    () => canonicalTags(tags) !== canonicalTags(savedTags),
    [savedTags, tags],
  );

  async function csrfToken() {
    const response = await fetch("/api/admin/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const payload = (await response.json()) as { csrfToken?: string };
    if (!response.ok || !payload.csrfToken) {
      throw new Error("Could not prepare this operation. Try again.");
    }
    return payload.csrfToken;
  }

  async function mutate(
    method: "POST" | "PATCH",
    payload: Record<string, unknown>,
  ) {
    const token = await csrfToken();
    const response = await fetch(
      `/api/admin/registrations/${encodeURIComponent(applicationId)}/operations`,
      {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          csrfToken: token,
          expectedRevision: revision,
        }),
      },
    );
    const result = (await response.json()) as {
      success?: boolean;
      error?: string;
      message?: string;
      revision?: number;
    };
    if (response.status === 401) {
      window.location.replace("/admin-page-login");
      return null;
    }
    if (response.status === 409) {
      setError(result.error || "Operations changed in another tab.");
      router.refresh();
      return null;
    }
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Operation could not be saved.");
    }
    return result;
  }

  async function saveTags() {
    if (!tagsChanged || submitting) return;
    setSubmitting("tags");
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await mutate("PATCH", { tags });
      if (!result) return;
      setRevision(result.revision ?? revision);
      setSavedTags(tags);
      setNotice(result.message || "Operational tags saved.");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Operational tags could not be saved.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  async function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedNote = note.replace(/\r\n?/g, "\n").trim();
    if (normalizedNote.length < ADMIN_NOTE_MIN_LENGTH) {
      setError(`Write at least ${ADMIN_NOTE_MIN_LENGTH} characters before saving.`);
      return;
    }
    setSubmitting("note");
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await mutate("POST", { note: normalizedNote });
      if (!result) return;
      setRevision(result.revision ?? revision);
      setNote("");
      setNotice(result.message || "Private note added.");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Private note could not be saved.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <section
      className="border border-ascent-border bg-ascent-surface"
      aria-labelledby="operations-panel-title"
    >
      <header className="border-b border-ascent-border p-5">
        <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
          Internal workspace
        </p>
        <h2 id="operations-panel-title" className="mt-2 text-xl font-semibold">
          Notes and routing
        </h2>
        <p className="mt-2 text-xs leading-5 text-ascent-muted">
          Private to administrators. Nothing here is sent to the applicant.
        </p>
      </header>

      <div className="p-5">
        <fieldset disabled={Boolean(submitting)}>
          <legend className="text-xs font-semibold text-ascent-ink">
            Operational tags
          </legend>
          <div className="mt-3 grid gap-2">
            {ADMIN_REGISTRATION_TAGS.map((tag) => {
              const checked = tags.includes(tag);
              return (
                <label
                  key={tag}
                  className={`flex cursor-pointer items-center gap-3 border px-3 py-2.5 text-xs font-medium transition-colors ${
                    checked
                      ? "border-ascent-brand bg-ascent-canvas text-ascent-ink"
                      : "border-ascent-border text-ascent-muted hover:border-ascent-brand"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setTags((current) =>
                        event.target.checked
                          ? [...current, tag]
                          : current.filter((value) => value !== tag),
                      );
                      setError(undefined);
                      setNotice(undefined);
                    }}
                    className="h-4 w-4 accent-ascent-brand"
                  />
                  {ADMIN_REGISTRATION_TAG_LABEL[tag]}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Button
          type="button"
          variant="secondary"
          className="mt-3 w-full"
          disabled={!tagsChanged || Boolean(submitting)}
          onClick={saveTags}
        >
          {submitting === "tags" ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Saving…
            </span>
          ) : tagsChanged ? (
            "Save tags"
          ) : (
            "Tags up to date"
          )}
        </Button>

        <form onSubmit={addNote} className="mt-6 border-t border-ascent-border pt-5">
          <label htmlFor="private-admin-note" className="text-xs font-semibold text-ascent-ink">
            Add private note
          </label>
          <textarea
            id="private-admin-note"
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setError(undefined);
              setNotice(undefined);
            }}
            rows={4}
            maxLength={ADMIN_NOTE_MAX_LENGTH}
            disabled={Boolean(submitting)}
            className="ascent-field-control mt-2 resize-y px-3 py-2 text-sm"
            placeholder="Record evidence checked, a follow-up, or operational context"
          />
          <div className="mt-1 flex justify-between gap-3 text-[0.68rem] text-ascent-muted">
            <span>Append-only after saving</span>
            <span className="tabular-nums">
              {note.length}/{ADMIN_NOTE_MAX_LENGTH}
            </span>
          </div>
          <Button
            type="submit"
            className="mt-3 w-full"
            disabled={Boolean(submitting) || note.trim().length < ADMIN_NOTE_MIN_LENGTH}
          >
            {submitting === "note" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Adding…
              </span>
            ) : (
              "Add private note"
            )}
          </Button>
        </form>

        {error ? (
          <p className="mt-3 text-xs leading-5 text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 text-xs leading-5 text-ascent-success" role="status">
            {notice}
          </p>
        ) : null}

        <div className="mt-6 border-t border-ascent-border pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-xs font-semibold text-ascent-ink">Recent notes</h3>
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-ascent-muted">
              {notes.length} total
            </span>
          </div>
          {notes.length ? (
            <ol className="mt-3 space-y-3">
              {notes.map((entry) => (
                <li key={entry.id} className="border-l-2 border-ascent-border pl-3">
                  <p className="whitespace-pre-wrap text-xs leading-5 text-ascent-ink">
                    {entry.body}
                  </p>
                  <p className="mt-2 font-mono text-[0.6rem] leading-4 text-ascent-muted">
                    {entry.actorEmail} · {formatDate(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-xs leading-5 text-ascent-muted">
              No private notes yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
