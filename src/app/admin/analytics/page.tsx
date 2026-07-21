import type { Metadata } from "next";
import AdminMetric from "@/components/admin/AdminMetric";
import { Button } from "@/components/ui";
import {
  buildAdminAnalytics,
  parseAdminAnalyticsRange,
  type AdminAnalyticsCount,
  type AdminAnalyticsRange,
  type AdminAnalyticsSnapshot,
} from "@/lib/adminAnalytics";
import { getAdminAnalyticsDataset } from "@/lib/adminAnalyticsData";

export const metadata: Metadata = {
  title: "Analytics · Ascent admin",
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function percentageLabel(value: number) {
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

function durationLabel(hours: number | null) {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${hours.toLocaleString("en-IN", { maximumFractionDigits: 1 })}h`;
  return `${(hours / 24).toLocaleString("en-IN", { maximumFractionDigits: 1 })}d`;
}

function volumeDetail(snapshot: AdminAnalyticsSnapshot) {
  if (snapshot.previousPeriodTotal === null) return "Complete loaded cohort";
  if (snapshot.previousPeriodTotal === 0) {
    return `${snapshot.previousPeriodTotal} in the previous equal period`;
  }
  const change = snapshot.volumeChangePercent ?? 0;
  return `${change >= 0 ? "+" : ""}${change}% vs previous equal period`;
}

function RangeSelector({ active }: { active: AdminAnalyticsRange }) {
  const options: { value: AdminAnalyticsRange; label: string }[] = [
    { value: "7D", label: "Past 7 days" },
    { value: "30D", label: "Past 30 days" },
    { value: "ALL", label: "All loaded" },
  ];
  return (
    <nav aria-label="Analytics cohort" className="inline-flex max-w-full overflow-x-auto border border-ascent-border bg-ascent-surface p-1">
      {options.map((option) => (
        <a
          key={option.value}
          href={option.value === "ALL" ? "/admin/analytics" : `/admin/analytics?range=${option.value}`}
          aria-current={active === option.value ? "page" : undefined}
          className={`shrink-0 px-3 py-2 text-xs font-semibold transition-colors sm:px-4 ${
            active === option.value
              ? "bg-ascent-ink text-ascent-on-brand"
              : "text-ascent-muted hover:bg-ascent-surface-subtle hover:text-ascent-ink"
          }`}
        >
          {option.label}
        </a>
      ))}
    </nav>
  );
}

function IntakeTrend({ snapshot }: { snapshot: AdminAnalyticsSnapshot }) {
  const max = Math.max(0, ...snapshot.trend.map((point) => point.count));
  if (!snapshot.trend.length) {
    return (
      <div className="flex min-h-64 items-center justify-center p-8 text-center">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ascent-brand">No dated registrations</p>
          <p className="mt-2 text-sm text-ascent-muted">The intake trend will appear after the first timestamped submission.</p>
        </div>
      </div>
    );
  }
  const dense = snapshot.trend.length > 14;
  const sparse = snapshot.trend.length < 7;
  return (
    <div className="overflow-x-auto px-5 pb-5 pt-7 sm:px-6 sm:pb-6" role="img" aria-label={`Registration intake trend for ${snapshot.cohortLabel.toLocaleLowerCase()}`}>
      <ol className={`flex h-64 items-stretch gap-1 border-b border-ascent-border ${dense ? "min-w-[760px]" : sparse ? "min-w-full" : "min-w-[520px]"}`}>
        {snapshot.trend.map((point, index) => {
          const height = max ? Math.max(point.count ? 6 : 0, (point.count / max) * 100) : 0;
          const showLabel = !dense || index % 5 === 0 || index === snapshot.trend.length - 1;
          return (
            <li key={point.key} className={`group flex min-w-0 flex-col justify-end ${sparse ? "w-16 flex-none" : "flex-1"}`} title={`${point.label}: ${point.count} registrations`}>
              <span className="mb-2 h-3 text-center font-mono text-[0.58rem] font-semibold tabular-nums text-ascent-muted">
                {point.count || ""}
              </span>
              <div className="flex h-48 items-end bg-ascent-surface-subtle">
                <div
                  className="w-full bg-ascent-brand transition-[height]"
                  style={{ height: `${height}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className="mt-2 h-4 truncate text-center font-mono text-[0.56rem] uppercase tracking-[0.04em] text-ascent-muted">
                {showLabel ? point.label : ""}
              </span>
              <span className="sr-only">{point.label}: {point.count} registrations</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function BarList({
  items,
  empty,
  color = "brand",
}: {
  items: AdminAnalyticsCount[];
  empty: string;
  color?: "brand" | "decision";
}) {
  if (!items.length) return <p className="p-5 text-sm leading-6 text-ascent-muted sm:p-6">{empty}</p>;
  return (
    <ol className="divide-y divide-ascent-border">
      {items.map((item) => {
        const decisionColor =
          item.key === "APPROVED"
            ? "bg-ascent-success"
            : item.key === "REJECTED"
              ? "bg-ascent-danger"
              : item.key === "WAITLISTED"
                ? "bg-ascent-brand"
                : "bg-ascent-muted";
        return (
          <li key={item.key} className="p-4 sm:px-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 truncate text-sm font-medium text-ascent-ink" title={item.label}>{item.label}</span>
              <span className="shrink-0 font-mono text-[0.66rem] font-semibold tabular-nums text-ascent-muted">{item.count} · {percentageLabel(item.percentage)}</span>
            </div>
            <div className="mt-2 h-1.5 bg-ascent-surface-subtle" aria-hidden="true">
              <div className={`h-full ${color === "decision" ? decisionColor : "bg-ascent-brand"}`} style={{ width: `${item.percentage}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PanelHeader({
  id,
  eyebrow,
  title,
  detail,
}: {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <header className="border-b border-ascent-border p-5 sm:p-6">
      <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-ascent-brand">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-xl font-semibold tracking-tight text-ascent-ink">{title}</h2>
      <p className="mt-2 text-xs leading-5 text-ascent-muted">{detail}</p>
    </header>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const range = parseAdminAnalyticsRange(firstParam(searchParams.range));
  const dataset = await getAdminAnalyticsDataset();
  const snapshot = buildAdminAnalytics(dataset.rows, range);
  const generatedAt = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-5 border-b border-ascent-border pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">Decision intelligence</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ascent-ink sm:text-4xl">Competition analytics</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ascent-muted">Understand intake pressure, review health and applicant composition using live registration records. No third-party tracking and no inferred applicant scoring.</p>
        </div>
        <RangeSelector active={range} />
      </div>

      <div className="mt-5 flex flex-col gap-2 border border-ascent-border bg-ascent-surface-subtle p-4 text-xs leading-5 text-ascent-muted sm:flex-row sm:items-center sm:justify-between">
        <p><strong className="text-ascent-ink">Cohort:</strong> {snapshot.cohortLabel}. Decisions and reviewer activity below describe those registrations, regardless of when the decision was made.</p>
        <p className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.08em]">Live · {generatedAt} IST</p>
      </div>

      {dataset.truncated ? (
        <div className="mt-4 border border-ascent-danger bg-ascent-danger-tint p-4 text-xs leading-5 text-ascent-danger" role="status">
          The safety limit was reached. Analytics use the latest 2,000 registrations and should not be treated as a complete historical report.
        </div>
      ) : null}

      <dl className="mt-6 grid gap-px border border-ascent-border bg-ascent-border sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Registrations" value={snapshot.total} detail={volumeDetail(snapshot)} emphasis />
        <AdminMetric label="Review complete" value={percentageLabel(snapshot.reviewRate)} detail={`${snapshot.reviewed} reviewed · ${snapshot.pending} pending`} />
        <AdminMetric label="Approval among reviewed" value={percentageLabel(snapshot.approvalRate)} detail={`${snapshot.approved} approved · pending excluded`} />
        <AdminMetric label="Median review time" value={durationLabel(snapshot.medianReviewHours)} detail={snapshot.medianReviewHours === null ? "No timestamped decisions in cohort" : "Submission to recorded decision"} />
      </dl>

      <section className="mt-6 border border-ascent-border bg-ascent-surface" aria-labelledby="intake-title">
        <div className="flex flex-col gap-3 border-b border-ascent-border p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-ascent-brand">Intake pressure</p>
            <h2 id="intake-title" className="mt-2 text-xl font-semibold tracking-tight">Registration volume</h2>
            <p className="mt-2 text-xs leading-5 text-ascent-muted">{snapshot.trendGranularity === "DAY" ? "Daily submission counts in IST." : "Monthly submission counts for the complete loaded cohort."}</p>
          </div>
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.1em] text-ascent-muted">Peak · {Math.max(0, ...snapshot.trend.map((point) => point.count))}</p>
        </div>
        <IntakeTrend snapshot={snapshot} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="border border-ascent-border bg-ascent-surface" aria-labelledby="decisions-title">
          <PanelHeader id="decisions-title" eyebrow="Pipeline" title="Decision distribution" detail="Share of the selected registration cohort in each current decision state." />
          <BarList items={snapshot.decisions} empty="No registrations in this cohort." color="decision" />
        </section>
        <section className="border border-ascent-border bg-ascent-surface" aria-labelledby="queue-title">
          <PanelHeader id="queue-title" eyebrow="Queue health" title="Pending review age" detail="Age starts at submission and ends when a decision is recorded." />
          <div className="grid gap-px bg-ascent-border sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div className="bg-ascent-surface p-5">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ascent-muted">Oldest pending</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{snapshot.oldestPendingDays === null ? "—" : `${snapshot.oldestPendingDays}d`}</p>
            </div>
            <div className="bg-ascent-surface p-5">
              <p className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-ascent-muted">Pending 7+ days</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{snapshot.pendingOlderThan7Days}</p>
            </div>
          </div>
          <div className="border-t border-ascent-border p-5 sm:p-6">
            <Button href="/admin?decision=PENDING&sort=OLDEST" variant="secondary" className="w-full justify-center">Open oldest-first review queue</Button>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="border border-ascent-border bg-ascent-surface" aria-labelledby="institutions-title">
          <PanelHeader id="institutions-title" eyebrow="Reach" title="Institution concentration" detail={`${snapshot.uniqueInstitutions} unique institutions represented. Leading eight shown.`} />
          <BarList items={snapshot.institutions} empty="Institution distribution will appear after registrations arrive." />
          {snapshot.otherInstitutionCount ? <p className="border-t border-ascent-border p-4 text-xs text-ascent-muted sm:px-5">Other institutions account for {snapshot.otherInstitutionCount} registrations.</p> : null}
        </section>
        <section className="border border-ascent-border bg-ascent-surface" aria-labelledby="reviewers-title">
          <PanelHeader id="reviewers-title" eyebrow="Team throughput" title="Decisions by reviewer" detail="Current decision ownership for the selected submission cohort; not a productivity score." />
          <div>
            {snapshot.reviewers.length ? (
              <ol className="divide-y divide-ascent-border">
                {snapshot.reviewers.map((reviewer) => (
                  <li key={reviewer.reviewer} className="p-4 sm:px-5">
                    <div className="flex items-baseline justify-between gap-4">
                      <a href={`/admin/activity?q=${encodeURIComponent(reviewer.reviewer)}`} className="min-w-0 truncate text-sm font-medium text-ascent-ink underline decoration-ascent-border underline-offset-4 hover:text-ascent-brand">{reviewer.reviewer}</a>
                      <span className="shrink-0 font-mono text-[0.66rem] font-semibold text-ascent-muted">{reviewer.count} · {percentageLabel(reviewer.percentage)}</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-ascent-surface-subtle"><div className="h-full bg-ascent-ink" style={{ width: `${reviewer.percentage}%` }} /></div>
                  </li>
                ))}
              </ol>
            ) : <p className="p-5 text-sm leading-6 text-ascent-muted sm:p-6">No decisions have been recorded for this cohort.</p>}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="border border-ascent-border bg-ascent-surface" aria-labelledby="path-title">
          <PanelHeader id="path-title" eyebrow="Eligibility" title="Qualification route" detail="Direct and qualifier paths generated by the eligibility rules." />
          <BarList items={snapshot.qualificationPaths} empty="No qualification routes in this cohort." />
        </section>
        <section className="border border-ascent-border bg-ascent-surface" aria-labelledby="education-title">
          <PanelHeader id="education-title" eyebrow="Applicant mix" title="Education stage" detail="Self-reported stage at the time of registration." />
          <BarList items={snapshot.educationStages} empty="No education-stage data in this cohort." />
        </section>
        <section className="border border-ascent-border bg-ascent-surface" aria-labelledby="evidence-title">
          <PanelHeader id="evidence-title" eyebrow="Optional signals" title="Provided links" detail="Presence only. Optional fields are not a completeness score and do not indicate applicant quality." />
          <BarList items={snapshot.evidence} empty="No registration evidence in this cohort." />
        </section>
      </div>

      <footer className="mt-6 flex flex-col gap-3 border border-ascent-border bg-ascent-surface-subtle p-5 text-xs leading-5 text-ascent-muted sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p>Analytics are recomputed from first-party registration records on every request. No pixels, cookies or third-party behavioral analytics are added.{snapshot.undated ? ` ${snapshot.undated} loaded records have no usable submission timestamp.` : ""}</p>
        <a href="/admin/activity" className="shrink-0 font-semibold text-ascent-brand underline underline-offset-4 hover:text-ascent-ink">Audit the underlying actions →</a>
      </footer>
    </div>
  );
}
