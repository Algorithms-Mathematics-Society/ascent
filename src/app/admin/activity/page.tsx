import type { Metadata } from "next";
import AdminMetric from "@/components/admin/AdminMetric";
import { Button } from "@/components/ui";
import {
  adminActivityLabel,
  filterAdminActivity,
  summarizeAdminActivity,
  type AdminActivityCategory,
  type AdminActivityEntry,
  type AdminActivityFilters,
  type AdminActivityRange,
} from "@/lib/adminActivity";
import { getLatestAdminActivity } from "@/lib/adminActivityData";
import { isSafeApplicationId } from "@/lib/adminDecision";

export const metadata: Metadata = {
  title: "Activity · Ascent admin",
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseCategory(value: string): AdminActivityCategory {
  return value === "DECISIONS" || value === "OPERATIONS" || value === "SYSTEM"
    ? value
    : "ALL";
}

function parseRange(value: string): AdminActivityRange {
  return value === "24H" || value === "7D" || value === "30D"
    ? value
    : "ALL";
}

function formatActivityTime(value: string | null) {
  if (!value) return { date: "Time unavailable", time: "" };
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeZone: "Asia/Kolkata",
    }).format(date),
    time: new Intl.DateTimeFormat("en-IN", {
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(date),
  };
}

function CategoryBadge({ category }: { category: AdminActivityEntry["category"] }) {
  const label =
    category === "DECISIONS"
      ? "Decision"
      : category === "OPERATIONS"
        ? "Operation"
        : "System";
  const color =
    category === "DECISIONS"
      ? "border-ascent-brand bg-ascent-brand text-ascent-on-brand"
      : category === "OPERATIONS"
        ? "border-ascent-border bg-ascent-surface-subtle text-ascent-ink"
        : "border-ascent-border bg-ascent-canvas text-ascent-muted";
  return (
    <span
      className={`inline-flex border px-2 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${color}`}
    >
      {label}
    </span>
  );
}

function ApplicantLink({ entry }: { entry: AdminActivityEntry }) {
  if (!entry.subjectId) {
    return (
      <div>
        <span className="block font-semibold text-ascent-ink">Competition-wide</span>
        <span className="mt-1 block font-mono text-[0.64rem] uppercase tracking-[0.08em] text-ascent-muted">
          No applicant record
        </span>
      </div>
    );
  }
  const content = (
    <>
      <span className="block font-semibold text-ascent-ink">{entry.applicantName}</span>
      <span className="mt-1 block font-mono text-[0.64rem] uppercase tracking-[0.08em] text-ascent-muted">
        {entry.reference}
      </span>
    </>
  );
  return isSafeApplicationId(entry.subjectId) ? (
    <a
      href={`/admin/registrations/${entry.subjectId}`}
      className="group hover:text-ascent-brand"
    >
      {content}
      <span className="mt-2 inline-block text-xs font-semibold text-ascent-brand underline underline-offset-4">
        Open review →
      </span>
    </a>
  ) : (
    <div>{content}</div>
  );
}

function EventContext({ entry }: { entry: AdminActivityEntry }) {
  const transition = entry.decision
    ? `${entry.previousDecision ?? "—"} → ${entry.decision}`
    : null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={entry.category} />
        <p className="font-semibold text-ascent-ink">{adminActivityLabel(entry.event)}</p>
      </div>
      {transition ? (
        <p className="mt-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ascent-brand">
          {transition}
        </p>
      ) : null}
      {entry.reason ? (
        <p className="mt-2 max-w-xl text-xs leading-5 text-ascent-muted">{entry.reason}</p>
      ) : null}
      {entry.bulkOperationId ? (
        <p className="mt-2 font-mono text-[0.62rem] text-ascent-muted">
          Batch · {entry.bulkOperationId}
        </p>
      ) : null}
    </div>
  );
}

function DesktopTable({ entries }: { entries: AdminActivityEntry[] }) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-ascent-border bg-ascent-canvas/60 font-mono text-[0.67rem] uppercase tracking-[0.12em] text-ascent-muted">
            <th className="px-5 py-4 font-semibold">Event</th>
            <th className="px-5 py-4 font-semibold">Applicant</th>
            <th className="px-5 py-4 font-semibold">Actor</th>
            <th className="px-5 py-4 font-semibold">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ascent-border">
          {entries.map((entry) => {
            const time = formatActivityTime(entry.timestamp);
            return (
              <tr key={entry.id} className="align-top hover:bg-ascent-canvas/45">
                <td className="max-w-[430px] px-5 py-5"><EventContext entry={entry} /></td>
                <td className="max-w-[240px] px-5 py-5"><ApplicantLink entry={entry} /></td>
                <td className="max-w-[230px] px-5 py-5">
                  <p className="font-medium text-ascent-ink">{entry.actorEmail ?? entry.actor}</p>
                  {entry.actorEmail && entry.actor !== entry.actorEmail ? (
                    <p className="mt-1 font-mono text-[0.64rem] text-ascent-muted">{entry.actor}</p>
                  ) : null}
                </td>
                <td className="px-5 py-5 tabular-nums">
                  <p className="font-medium">{time.date}</p>
                  <p className="mt-1 text-xs text-ascent-muted">{time.time}{time.time ? " IST" : ""}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MobileCards({ entries }: { entries: AdminActivityEntry[] }) {
  return (
    <div className="divide-y divide-ascent-border lg:hidden">
      {entries.map((entry) => {
        const time = formatActivityTime(entry.timestamp);
        return (
          <article key={entry.id} className="p-5 sm:p-6">
            <EventContext entry={entry} />
            <div className="mt-5 grid gap-4 border-t border-ascent-border pt-4 sm:grid-cols-3">
              <div><p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ascent-muted">Applicant</p><div className="mt-2"><ApplicantLink entry={entry} /></div></div>
              <div><p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ascent-muted">Actor</p><p className="mt-2 text-sm font-medium">{entry.actorEmail ?? entry.actor}</p></div>
              <div><p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ascent-muted">Time</p><p className="mt-2 text-sm tabular-nums">{time.date}{time.time ? ` · ${time.time} IST` : ""}</p></div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters: AdminActivityFilters = {
    query: firstParam(searchParams.q),
    category: parseCategory(firstParam(searchParams.category)),
    range: parseRange(firstParam(searchParams.range)),
  };
  const latestActivity = await getLatestAdminActivity();
  const entries = filterAdminActivity(latestActivity, filters);
  const summary = summarizeAdminActivity(latestActivity);
  const exportParams = new URLSearchParams();
  if (filters.query) exportParams.set("q", filters.query);
  if (filters.category !== "ALL") exportParams.set("category", filters.category);
  if (filters.range !== "ALL") exportParams.set("range", filters.range);
  const exportHref = `/api/admin/activity/export${exportParams.size ? `?${exportParams.toString()}` : ""}`;
  const filtering = Boolean(filters.query) || filters.category !== "ALL" || filters.range !== "ALL";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-4 border-b border-ascent-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">Operations oversight</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ascent-ink sm:text-4xl">Activity ledger</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ascent-muted">Trace registration decisions, private operational changes and system actions with their actor and applicant context.</p>
        </div>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ascent-muted">Latest 250 events · IST</p>
      </div>

      <dl className="mt-6 grid gap-px border border-ascent-border bg-ascent-border sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Activity · 24h" value={summary.last24Hours} detail="All recent audit events" emphasis />
        <AdminMetric label="Decisions · 7d" value={summary.decisions7Days} detail="Registration outcomes recorded" />
        <AdminMetric label="Operations · 7d" value={summary.operations7Days} detail="Notes and tag changes" />
        <AdminMetric label="Bulk batches · 30d" value={summary.bulkBatches30Days} detail="Distinct batch operations" />
      </dl>

      <section className="mt-6 border border-ascent-border bg-ascent-surface" aria-labelledby="activity-title">
        <div className="border-b border-ascent-border p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="activity-title" className="text-xl font-semibold tracking-tight">Audit events</h2>
              <p className="mt-1 text-xs text-ascent-muted" aria-live="polite">{entries.length} {entries.length === 1 ? "event" : "events"} shown</p>
            </div>
            <Button href={exportHref} variant="secondary" className="min-h-9 px-3 py-2 text-xs">Export current view · CSV</Button>
          </div>

          <form className="mt-5 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_170px_auto]" method="get">
            <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">Search this ledger<input className="ascent-field-control ascent-input" type="search" name="q" defaultValue={filters.query} placeholder="Applicant, reference, actor, event" /></label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">Event category<select className="ascent-field-control ascent-select" name="category" defaultValue={filters.category}><option value="ALL">All events</option><option value="DECISIONS">Decisions</option><option value="OPERATIONS">Operations</option><option value="SYSTEM">System</option></select></label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">Time range<select className="ascent-field-control ascent-select" name="range" defaultValue={filters.range}><option value="24H">Past 24 hours</option><option value="7D">Past 7 days</option><option value="30D">Past 30 days</option><option value="ALL">All loaded events</option></select></label>
            <div className="flex items-end gap-2"><Button type="submit" className="min-h-11 flex-1 lg:flex-none">Apply filters</Button>{filtering ? <Button href="/admin/activity" variant="secondary" className="min-h-11">Clear</Button> : null}</div>
          </form>
        </div>

        {entries.length ? <><DesktopTable entries={entries} /><MobileCards entries={entries} /></> : (
          <div className="px-5 py-14 text-center sm:px-8 sm:py-20">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-brand">{filtering ? "No matching activity" : "No activity recorded"}</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ascent-ink">{filtering ? "Try a broader filter." : "The ledger is empty."}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ascent-muted">{filtering ? "Clear one or more filters to return to the complete loaded ledger." : "Registration and admin events will appear here as they are recorded."}</p>
            {filtering ? <Button href="/admin/activity" variant="secondary" className="mt-6">Clear filters</Button> : null}
          </div>
        )}
      </section>
    </div>
  );
}
