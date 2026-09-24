"use client";
import { useEffect, useState } from "react";
import type { CandidateStatus as EntryStatus } from "@/lib/candidate/status";
import BotCheck from "@/components/security/BotCheck";
import { Button, Input } from "@/components/ui";
import { PRIVACY_URL } from "@/content/legal";

const LABELS: Record<EntryStatus["state"], string> = { RECEIVED: "Received", UNDER_REVIEW: "Under review", APPROVED: "Approved", WAITLISTED: "Waitlisted", REJECTED: "Not approved", WITHDRAWN: "Withdrawn" };
const NEXT: Record<EntryStatus["state"], string> = {
  RECEIVED: "Your entry has been received. The team will review it and email you when a decision is recorded.",
  UNDER_REVIEW: "The team has started reviewing your entry. Check your email in case we need more information.",
  APPROVED: "Your registration is approved. Review the syllabus and watch your email for competition instructions and access details.",
  WAITLISTED: "A place is not confirmed. We will email you if your decision changes. You do not need to submit another entry.",
  REJECTED: "Your registration has not been approved. Contact the support team with your reference if you want to question the decision or request an appeal.",
  WITHDRAWN: "Your entry is withdrawn. Contact the support team if you need help with your data or this decision.",
};
export default function CandidateStatus({ initialEntry, emailEnabled }: { initialEntry: EntryStatus | null; emailEnabled: boolean }) {
  const [entry, setEntry] = useState(initialEntry);
  const [ready, setReady] = useState(false);
  const [linkToken, setLinkToken] = useState("");
  const [email, setEmail] = useState("");
  const [botToken, setBotToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    function readLink() {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      // Remove credentials before mounting any third-party verification widget.
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
      if (token && token.length <= 1500) setLinkToken(token);
      setReady(true);
    }
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);
  async function refresh() {
    const response = await fetch("/api/register/status", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { if (response.status === 401) setEntry(null); throw new Error(data.error || "Could not load your entry."); }
    setEntry(data.entry);
  }
  async function openLink() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/register/status/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: linkToken }) });
      const data = await response.json();
      setLinkToken("");
      if (!response.ok) throw new Error(data.error || "Could not open this link.");
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open your status."); }
    finally { setBusy(false); }
  }
  async function requestLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !botToken) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/register/status/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, botToken }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not request a link.");
      setMessage(data.message); setEmail("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not request a link."); }
    finally { setBusy(false); setBotToken(""); setReset(value => value + 1); }
  }
  async function closeSession() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/register/status/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not close your session. Please try again.");
      setEntry(null); setMessage("Your status session is closed.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not close the session."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto min-h-[28rem] max-w-3xl">
    {error ? <p role="alert" className="mb-5 rounded-control border border-ascent-danger p-4 text-sm">{error}</p> : null}
    {message ? <p role="status" className="mb-5 rounded-control border border-ascent-border p-4 text-sm leading-6">{message}</p> : null}
    {!ready ? <p role="status">Opening status access…</p> : linkToken ? <section className="rounded-panel border border-ascent-border bg-ascent-surface p-6 sm:p-8">
      <h2 className="text-2xl font-semibold">Open your entry</h2><p className="mt-3 text-sm leading-6 text-ascent-muted">This private link can be used once. Continue to open a temporary status session on this device.</p>
      <Button onClick={openLink} disabled={busy} className="mt-5">{busy ? "Opening…" : "View my status"}</Button>
    </section> : entry ? <section className="rounded-panel border border-ascent-border bg-ascent-surface p-6 sm:p-8">
      <p className="font-mono text-sm">{entry.reference}</p><h2 className="mt-3 text-3xl font-semibold">{LABELS[entry.state]}</h2>
      <ol aria-label="Review progress" className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-y border-ascent-border py-4 text-sm">
        <li>1. Received</li><li>2. Under review</li><li>3. Decision{["APPROVED", "WAITLISTED", "REJECTED"].includes(entry.state) ? `: ${LABELS[entry.state]}` : ""}</li>
      </ol>
      <dl className="mt-6 grid gap-5 sm:grid-cols-2">
        <div><dt className="text-sm text-ascent-muted">Qualification path</dt><dd className="mt-1 font-semibold">{entry.qualificationPath === "AUTO" ? "Direct path" : "Qualifier path"}</dd></div>
        {entry.qualificationPath === "QUALIFIER" ? <div><dt className="text-sm text-ascent-muted">Published Round 1 date</dt><dd className="mt-1 font-semibold">{entry.roundOneDate}</dd></div> : null}
      </dl>
      <h3 className="mt-7 font-semibold">What to do next</h3><p className="mt-2 text-sm leading-7">{NEXT[entry.state]}</p>
      <p className="mt-3 text-sm leading-6 text-ascent-muted">The published date is not a personal slot booking. Your exam time, access credentials and any later-round instructions will be shared separately.</p>
      <div className="mt-6 flex flex-wrap gap-3"><Button href="/syllabus" variant="secondary">View syllabus</Button><Button disabled={busy} variant="secondary" onClick={async () => { setBusy(true); setError(""); try { await refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not refresh."); } finally { setBusy(false); } }}>Refresh status</Button><Button disabled={busy} variant="secondary" onClick={closeSession}>Close session</Button></div>
      <p className="mt-5 text-xs leading-5 text-ascent-muted">This session lasts 20 minutes. Close it when using a shared device.</p>
      <p className="mt-5 text-sm leading-6">For corrections, appeals, withdrawal or deletion, <a className="underline" href={`mailto:team@amshq.in?subject=${encodeURIComponent(`Ascent entry ${entry.reference}`)}`}>contact team@amshq.in</a> from your registered email. See your <a href="/privacy" className="underline">privacy choices</a>.</p>
    </section> : <section className="rounded-panel border border-ascent-border bg-ascent-surface p-6 sm:p-8">
      <h2 className="text-2xl font-semibold">Email me a secure link</h2><p className="mt-3 text-sm leading-6 text-ascent-muted">Use the email you registered with. You do not need a password or an account.</p>
      {!emailEnabled ? <p className="mt-5 text-sm leading-6" role="status">Email status access is being set up. Contact <a className="underline" href="mailto:team@amshq.in">team@amshq.in</a> with your reference for help.</p> : <form onSubmit={requestLink} className="mt-5" aria-busy={busy}>
        <label htmlFor="status-email" className="text-sm font-semibold">Registered email</label><Input id="status-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} className="mt-2" />
        <BotCheck action="status_link" onToken={setBotToken} resetKey={reset} />
        <Button type="submit" disabled={busy || !botToken}>{busy ? "Requesting…" : "Email my status link"}</Button>
        <p className="mt-3 text-xs leading-5 text-ascent-muted">We use this address only to provide access and prevent abuse. <a href={PRIVACY_URL} className="underline">Privacy policy</a>.</p>
      </form>}
    </section>}
  </main>;
}
