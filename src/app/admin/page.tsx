import type { Metadata } from "next";
import AdminDecisionControl from "@/components/admin/AdminDecisionControl";
import AdminMetric from "@/components/admin/AdminMetric";
import { Button } from "@/components/ui";
import {
  filterAdminRegistrations,
  type AdminDecision,
  type AdminRegistrationFilters,
  type AdminRegistrationRow,
} from "@/lib/adminRegistrationView";
import {
  getAdminRegistrationStats,
  getLatestAdminRegistrations,
} from "@/lib/adminRegistrations";

export const metadata: Metadata = {
  title: "Registrations · Ascent admin",
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseDecision(value: string): AdminRegistrationFilters["decision"] {
  return value === "PENDING" ||
    value === "APPROVED" ||
    value === "WAITLISTED" ||
    value === "REJECTED"
    ? value
    : "ALL";
}

function parsePath(value: string): AdminRegistrationFilters["path"] {
  return value === "AUTO" || value === "QUALIFIER" || value === "UNDETERMINED"
    ? value
    : "ALL";
}

function formatSubmittedAt(value: string | null) {
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

function educationSummary(row: AdminRegistrationRow) {
  const parts = [row.educationStage.replaceAll("_", " ")];
  if (row.studyLevel !== "—") parts.push(row.studyLevel);
  if (row.graduationYear) parts.push(String(row.graduationYear));
  return parts.join(" · ");
}

function pathLabel(path: AdminRegistrationRow["qualificationPath"]) {
  if (path === "AUTO") return "Direct path";
  if (path === "QUALIFIER") return "Qualifier path";
  return "Path pending";
}

function DocumentLinks({ row }: { row: AdminRegistrationRow }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2">
      {row.resumeUrl ? (
        <a
          href={row.resumeUrl}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-ascent-brand underline underline-offset-4 hover:text-ascent-ink"
        >
          Resume
        </a>
      ) : (
        <span className="text-ascent-muted">No resume</span>
      )}
      {row.transcriptUrl ? (
        <a
          href={row.transcriptUrl}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-ascent-brand underline underline-offset-4 hover:text-ascent-ink"
        >
          Transcript
        </a>
      ) : null}
    </div>
  );
}

function DesktopTable({ rows }: { rows: AdminRegistrationRow[] }) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[1060px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-ascent-border bg-ascent-canvas/60 font-mono text-[0.67rem] uppercase tracking-[0.12em] text-ascent-muted">
            <th className="px-5 py-4 font-semibold">Applicant</th>
            <th className="px-5 py-4 font-semibold">Institution</th>
            <th className="px-5 py-4 font-semibold">Path</th>
            <th className="px-5 py-4 font-semibold">Submitted</th>
            <th className="px-5 py-4 font-semibold">Documents</th>
            <th className="px-5 py-4 font-semibold">Review</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ascent-border">
          {rows.map((row) => {
            const submitted = formatSubmittedAt(row.submittedAt);
            return (
              <tr key={row.id} className="align-top hover:bg-ascent-canvas/45">
                <td className="px-5 py-5">
                  <a
                    href={`/admin/registrations/${row.id}`}
                    className="font-semibold text-ascent-ink underline decoration-ascent-border underline-offset-4 hover:text-ascent-brand hover:decoration-ascent-brand"
                  >
                    {row.legalName}
                  </a>
                  <a
                    href={`mailto:${row.email}`}
                    className="mt-1 block text-xs text-ascent-muted hover:text-ascent-brand"
                  >
                    {row.email}
                  </a>
                  <p className="mt-2 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-ascent-muted">
                    {row.reference}
                  </p>
                  <a
                    href={`/admin/registrations/${row.id}`}
                    className="mt-2 inline-flex text-xs font-semibold text-ascent-brand underline underline-offset-4"
                  >
                    Open full review →
                  </a>
                </td>
                <td className="max-w-[280px] px-5 py-5">
                  <p className="font-medium leading-5 text-ascent-ink">
                    {row.institution}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-ascent-muted">
                    {educationSummary(row)}
                  </p>
                </td>
                <td className="px-5 py-5">
                  <p className="font-medium">{pathLabel(row.qualificationPath)}</p>
                  <p className="mt-1 text-xs text-ascent-muted">
                    {row.codeforcesHandle ? `@${row.codeforcesHandle}` : "No Codeforces handle"}
                  </p>
                </td>
                <td className="px-5 py-5 tabular-nums">
                  <p className="font-medium">{submitted.date}</p>
                  <p className="mt-1 text-xs text-ascent-muted">{submitted.time} IST</p>
                </td>
                <td className="px-5 py-5 text-xs">
                  <DocumentLinks row={row} />
                </td>
                <td className="min-w-[290px] px-5 py-5">
                  <AdminDecisionControl
                    applicationId={row.id}
                    applicantName={row.legalName}
                    reference={row.reference}
                    decision={row.decision}
                    decisionReason={row.decisionReason}
                    decidedAt={row.decidedAt}
                    decidedBy={row.decidedBy}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MobileCards({ rows }: { rows: AdminRegistrationRow[] }) {
  return (
    <div className="divide-y divide-ascent-border lg:hidden">
      {rows.map((row) => {
        const submitted = formatSubmittedAt(row.submittedAt);
        return (
          <article key={row.id} className="p-5 sm:p-6">
            <div>
              <div>
                <h2>
                  <a
                    href={`/admin/registrations/${row.id}`}
                    className="font-semibold text-ascent-ink underline decoration-ascent-border underline-offset-4 hover:text-ascent-brand"
                  >
                    {row.legalName}
                  </a>
                </h2>
                <p className="mt-1 text-xs text-ascent-muted">{row.email}</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-ascent-muted">
                  Institution
                </dt>
                <dd className="mt-1 font-medium leading-5">{row.institution}</dd>
                <dd className="mt-1 text-xs leading-5 text-ascent-muted">
                  {educationSummary(row)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-ascent-muted">
                  Route
                </dt>
                <dd className="mt-1 font-medium">{pathLabel(row.qualificationPath)}</dd>
              </div>
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-ascent-muted">
                  Submitted
                </dt>
                <dd className="mt-1 tabular-nums">
                  {submitted.date} · {submitted.time} IST
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[0.66rem] uppercase tracking-[0.1em] text-ascent-muted">
                  Documents
                </dt>
                <dd className="mt-2 text-xs">
                  <DocumentLinks row={row} />
                </dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-ascent-border pt-4">
              <AdminDecisionControl
                applicationId={row.id}
                applicantName={row.legalName}
                reference={row.reference}
                decision={row.decision}
                decisionReason={row.decisionReason}
                decidedAt={row.decidedAt}
                decidedBy={row.decidedBy}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters: AdminRegistrationFilters = {
    query: firstParam(searchParams.q),
    decision: parseDecision(firstParam(searchParams.decision)),
    path: parsePath(firstParam(searchParams.path)),
  };
  const [stats, latestRows] = await Promise.all([
    getAdminRegistrationStats(),
    getLatestAdminRegistrations(),
  ]);
  const rows = filterAdminRegistrations(latestRows, filters);
  const filtering =
    Boolean(filters.query) || filters.decision !== "ALL" || filters.path !== "ALL";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="flex flex-col gap-4 border-b border-ascent-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">
            Competition operations
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ascent-ink sm:text-4xl">
            Registration review
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ascent-muted">
            Review who entered, their institution and route, and the documents
            supplied with each registration.
          </p>
        </div>
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ascent-muted">
          Latest 100 registrations · IST
        </p>
      </div>

      <dl className="mt-6 grid gap-px border border-ascent-border bg-ascent-border sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Total entries" value={stats.total} detail="All received registrations" />
        <AdminMetric
          label="Pending review"
          value={stats.pending}
          detail="Awaiting an admin decision"
          emphasis
        />
        <AdminMetric label="Approved" value={stats.approved} detail="Confirmed registrations" />
        <AdminMetric
          label="Unlisted institutions"
          value={stats.unlistedInstitutions}
          detail="Need institution verification"
        />
      </dl>

      <section className="mt-6 border border-ascent-border bg-ascent-surface" aria-labelledby="entries-title">
        <div className="border-b border-ascent-border p-5 sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 id="entries-title" className="text-xl font-semibold tracking-tight">
              Entries
            </h2>
            <p className="text-xs text-ascent-muted" aria-live="polite">
              {rows.length} {rows.length === 1 ? "registration" : "registrations"} shown
            </p>
          </div>

          <form className="mt-5 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_190px_190px_auto]" method="get">
            <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
              Search this view
              <input
                className="ascent-field-control ascent-input"
                type="search"
                name="q"
                defaultValue={filters.query}
                placeholder="Name, email, institution, reference"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
              Decision
              <select
                className="ascent-field-control ascent-select"
                name="decision"
                defaultValue={filters.decision}
              >
                <option value="ALL">All decisions</option>
                <option value="PENDING">Pending review</option>
                <option value="APPROVED">Approved</option>
                <option value="WAITLISTED">Waitlisted</option>
                <option value="REJECTED">Not approved</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-ascent-ink">
              Qualification route
              <select
                className="ascent-field-control ascent-select"
                name="path"
                defaultValue={filters.path}
              >
                <option value="ALL">All routes</option>
                <option value="AUTO">Direct path</option>
                <option value="QUALIFIER">Qualifier path</option>
                <option value="UNDETERMINED">Path pending</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <Button type="submit" className="min-h-11 flex-1 lg:flex-none">
                Apply filters
              </Button>
              {filtering ? (
                <Button href="/admin" variant="secondary" className="min-h-11">
                  Clear
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        {rows.length ? (
          <>
            <DesktopTable rows={rows} />
            <MobileCards rows={rows} />
          </>
        ) : (
          <div className="px-5 py-14 text-center sm:px-8 sm:py-20">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-brand">
              {filtering ? "No matching entries" : "Queue is clear"}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ascent-ink">
              {filtering ? "Try a broader filter." : "No registrations yet."}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ascent-muted">
              {filtering
                ? "Clear one or more filters to return to the full registration view."
                : "New competition entries will appear here automatically after submission."}
            </p>
            {filtering ? (
              <Button href="/admin" variant="secondary" className="mt-6">
                Clear filters
              </Button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
