import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/adminAuth";
import { adminDb } from "@/lib/firebaseAdmin";
import { EMAIL_OUTBOX } from "@/lib/email/messages";
import { getEmailConfig } from "@/lib/email/resend";
import AdminEmailControls from "@/components/admin/AdminEmailControls";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Email · Ascent admin" };
const STATUSES = ["PENDING", "SENDING", "RETRY", "SCHEDULED", "SENT", "REVIEW", "SKIPPED"];
const LABELS: Record<string, string> = { PENDING: "Queued", SENDING: "Processing", RETRY: "Retry pending", SCHEDULED: "Scheduled with Resend", SENT: "Accepted by Resend", REVIEW: "Needs review", SKIPPED: "Skipped" };

export default async function AdminEmailPage({ searchParams }: { searchParams: { after?: string } }) {
  const session = await requireAdminSession();
  const config = getEmailConfig();
  const collection = adminDb.collection(EMAIL_OUTBOX);
  let query = collection.orderBy("queued_at", "desc").limit(51);
  const after = typeof searchParams.after === "string" ? searchParams.after : "";
  if (/^[A-Za-z0-9_-]{1,220}$/.test(after)) {
    const cursor = await collection.doc(after).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const [snapshot, ...counts] = await Promise.all([query.get(), ...STATUSES.map(status => collection.where("status", "==", status).count().get())]);
  const rows = snapshot.docs.slice(0, 50);
  const format = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <h1 className="text-3xl font-semibold">Email delivery</h1>
    <p className="mt-3 text-sm leading-6 text-ascent-muted">{config ? `Resend is configured. Sender: ${config.from}.` : "Delivery is disabled. Set RESEND_API_KEY and RESEND_FROM_EMAIL on the server to enable it. Messages remain queued."}</p>
    <p className="mt-2 text-sm leading-6 text-ascent-muted">Accepted and scheduled messages are in Resend; check its dashboard for delivery, bounces, or cancellation. Hobby runs the retry worker once daily. Use this page to process a backlog sooner.</p>
    {session.role === "OWNER" ? <AdminEmailControls enabled={Boolean(config)} /> : null}
    <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STATUSES.map((status, index) => <div key={status} className="rounded-control border border-ascent-border bg-ascent-surface p-4"><dt className="text-xs text-ascent-muted">{LABELS[status]}</dt><dd className="mt-2 text-xl font-semibold">{counts[index].data().count}</dd></div>)}
    </dl>
    <div className="mt-6 overflow-x-auto border border-ascent-border bg-ascent-surface">
      <table className="w-full text-left text-sm"><caption className="sr-only">Queued emails and provider status</caption>
        <thead><tr className="border-b border-ascent-border"><th className="p-4">Message</th><th className="p-4">Status</th><th className="p-4">Queued · IST</th><th className="p-4">Details</th></tr></thead>
        <tbody>{rows.map(row => { const job = row.data(); return <tr key={row.id} className="border-b border-ascent-border align-top">
          <td className="p-4">{job.kind === "REGISTRATION_CONFIRMATION" ? "Registration confirmation" : job.kind === "DECISION" ? "Decision update" : job.kind === "STATUS_ACCESS" ? "Status access link" : "Registration reminder"}<span className="mt-1 block max-w-xs break-all font-mono text-xs text-ascent-muted">{job.source_id}</span></td>
          <td className="p-4">{LABELS[job.status] || job.status}</td><td className="whitespace-nowrap p-4">{format.format(job.queued_at)}</td>
          <td className="max-w-sm break-words p-4 text-xs leading-5 text-ascent-muted">Attempts: {job.attempts}{job.last_error ? <p className="mt-1">{job.last_error}</p> : null}{job.provider_id ? <p className="mt-1 break-all">Resend ID: {job.provider_id}</p> : null}</td>
        </tr>; })}{!rows.length ? <tr><td colSpan={4} className="p-8 text-center text-ascent-muted">No email jobs yet.</td></tr> : null}</tbody>
      </table>
    </div>
    <nav aria-label="Email pages" className="mt-4 flex justify-between gap-3"><Button href="/admin/email" variant="secondary" size="sm">Refresh latest</Button>{snapshot.size > 50 ? <Button href={`/admin/email?after=${rows[49].id}`} variant="secondary" size="sm">Older messages →</Button> : null}</nav>
  </div>;
}
