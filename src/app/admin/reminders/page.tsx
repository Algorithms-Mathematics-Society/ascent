import type { Metadata } from "next";
import { Button } from "@/components/ui";
import { requireAdminSession } from "@/lib/adminAuth";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reminders · Ascent admin" };
const PAGE_SIZE = 50;

export default async function AdminRemindersPage({
  searchParams,
}: {
  searchParams: { after?: string | string[] };
}) {
  await requireAdminSession();
  const collection = adminDb.collection("registration_reminders");
  let query = collection.orderBy("created_at", "desc").limit(PAGE_SIZE + 1);
  const after = typeof searchParams.after === "string" ? searchParams.after : "";
  if (/^[a-f0-9]{64}$/.test(after)) {
    const cursor = await collection.doc(after).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const [snapshot, count] = await Promise.all([query.get(), collection.count().get()]);
  const rows = snapshot.docs.slice(0, PAGE_SIZE);
  const hasNextPage = snapshot.size > PAGE_SIZE;
  const dateFormat = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ascent-border pb-7">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ascent-brand">Registration interest</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Reminders</h1>
          <p className="mt-3 text-sm leading-6 text-ascent-muted">
            {count.data().count} email addresses requested an Ascent ’26 registration reminder.
            Delivery and scheduling status are available in the Email tab.
          </p>
        </div>
        <div className="flex gap-2"><Button href="/admin/email" variant="secondary" size="sm">Email delivery</Button><Button href="/admin/reminders" variant="secondary" size="sm">Refresh list</Button></div>
      </div>
      <div className="mt-6 overflow-x-auto border border-ascent-border bg-ascent-surface">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Registration reminder emails, newest first</caption>
          <thead className="border-b border-ascent-border bg-ascent-canvas text-ascent-muted">
            <tr>
              <th scope="col" className="px-5 py-4 font-semibold">Email address</th>
              <th scope="col" className="px-5 py-4 font-semibold">Requested · IST</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ascent-border">
            {rows.map((row) => {
              const data = row.data();
              const createdAt = data.created_at?.toDate();
              return (
                <tr key={row.id}>
                  <td className="break-all px-5 py-4">{data.email}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-ascent-muted">
                    {createdAt ? dateFormat.format(createdAt) : "Time unavailable"}
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr><td colSpan={2} className="px-5 py-12 text-center text-ascent-muted">No reminder requests yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <nav aria-label="Reminder pages" className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-ascent-muted">Newest first · Up to 50 per page</span>
        <div className="flex gap-2">
          {after ? <Button href="/admin/reminders" variant="secondary" size="sm">Back to latest</Button> : null}
          {hasNextPage ? (
            <Button href={`/admin/reminders?after=${rows[rows.length - 1].id}`} variant="secondary" size="sm">Older requests →</Button>
          ) : null}
        </div>
      </nav>
    </div>
  );
}
