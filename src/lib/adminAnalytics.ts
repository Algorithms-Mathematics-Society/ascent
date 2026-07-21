import type { AdminDecision } from "./adminRegistrationView";

export type AdminAnalyticsRange = "7D" | "30D" | "ALL";

export interface AdminAnalyticsRow {
  id: string;
  institution: string;
  educationStage: string;
  codeforcesHandle: string | null;
  qualificationPath: "AUTO" | "QUALIFIER" | "UNDETERMINED";
  decision: AdminDecision;
  decidedAt: string | null;
  decidedBy: string | null;
  submittedAt: string | null;
  resumeUrl: string;
  transcriptUrl: string | null;
  linkedInUrl: string | null;
  githubUrl: string | null;
}

export interface AdminAnalyticsCount {
  key: string;
  label: string;
  count: number;
  percentage: number;
}

export interface AdminAnalyticsTrendPoint {
  key: string;
  label: string;
  count: number;
}

export interface AdminReviewerThroughput {
  reviewer: string;
  count: number;
  percentage: number;
}

export interface AdminAnalyticsSnapshot {
  range: AdminAnalyticsRange;
  cohortLabel: string;
  total: number;
  previousPeriodTotal: number | null;
  volumeChangePercent: number | null;
  reviewed: number;
  pending: number;
  reviewRate: number;
  approved: number;
  approvalRate: number;
  medianReviewHours: number | null;
  oldestPendingDays: number | null;
  pendingOlderThan7Days: number;
  undated: number;
  trendGranularity: "DAY" | "MONTH";
  trend: AdminAnalyticsTrendPoint[];
  decisions: AdminAnalyticsCount[];
  qualificationPaths: AdminAnalyticsCount[];
  educationStages: AdminAnalyticsCount[];
  institutions: AdminAnalyticsCount[];
  uniqueInstitutions: number;
  otherInstitutionCount: number;
  evidence: AdminAnalyticsCount[];
  reviewers: AdminReviewerThroughput[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const DECISION_LABELS: Record<AdminDecision, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  WAITLISTED: "Waitlisted",
  REJECTED: "Rejected",
};

const PATH_LABELS: Record<AdminAnalyticsRow["qualificationPath"], string> = {
  AUTO: "Direct path",
  QUALIFIER: "Qualifier path",
  UNDETERMINED: "Undetermined",
};

function percentage(count: number, total: number) {
  return total ? Math.round((count / total) * 1000) / 10 : 0;
}

function validTimestamp(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function startOfIstDay(timestamp: number) {
  return Math.floor((timestamp + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

function istDateKey(timestamp: number) {
  return new Date(timestamp + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function titleCase(value: string) {
  return value
    .toLocaleLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase());
}

function countBy(
  rows: AdminAnalyticsRow[],
  keyFor: (row: AdminAnalyticsRow) => string,
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFor(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function fixedDailyTrend(
  rows: AdminAnalyticsRow[],
  days: number,
  todayStart: number,
): AdminAnalyticsTrendPoint[] {
  const start = todayStart - (days - 1) * DAY_MS;
  const counts = countBy(rows, (row) => {
    const timestamp = validTimestamp(row.submittedAt);
    return timestamp === null
      ? "undated"
      : istDateKey(startOfIstDay(timestamp));
  });
  return Array.from({ length: days }, (_, index) => {
    const timestamp = start + index * DAY_MS;
    const key = istDateKey(timestamp);
    return {
      key,
      label: new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(timestamp)),
      count: counts.get(key) ?? 0,
    };
  });
}

function monthlyTrend(rows: AdminAnalyticsRow[]): AdminAnalyticsTrendPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const timestamp = validTimestamp(row.submittedAt);
    if (timestamp === null) continue;
    const date = new Date(timestamp + IST_OFFSET_MS);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => ({
      key,
      label: new Intl.DateTimeFormat("en-IN", {
        month: "short",
        year: "2-digit",
        timeZone: "Asia/Kolkata",
      }).format(new Date(`${key}-01T00:00:00.000Z`)),
      count,
    }));
}

export function parseAdminAnalyticsRange(value: unknown): AdminAnalyticsRange {
  return value === "7D" || value === "30D" ? value : "ALL";
}

export function buildAdminAnalytics(
  allRows: AdminAnalyticsRow[],
  range: AdminAnalyticsRange,
  now = Date.now(),
): AdminAnalyticsSnapshot {
  const todayStart = startOfIstDay(now);
  const days = range === "7D" ? 7 : range === "30D" ? 30 : null;
  const cohortStart = days === null ? null : todayStart - (days - 1) * DAY_MS;
  const cohort = allRows.filter((row) => {
    if (cohortStart === null) return true;
    const timestamp = validTimestamp(row.submittedAt);
    return timestamp !== null && timestamp >= cohortStart && timestamp <= now;
  });

  let previousPeriodTotal: number | null = null;
  if (days !== null && cohortStart !== null) {
    const previousStart = cohortStart - days * DAY_MS;
    previousPeriodTotal = allRows.filter((row) => {
      const timestamp = validTimestamp(row.submittedAt);
      return timestamp !== null && timestamp >= previousStart && timestamp < cohortStart;
    }).length;
  }
  const volumeChangePercent =
    previousPeriodTotal === null || previousPeriodTotal === 0
      ? null
      : Math.round(((cohort.length - previousPeriodTotal) / previousPeriodTotal) * 1000) /
        10;

  const decisionCounts = countBy(cohort, (row) => row.decision);
  const pending = decisionCounts.get("PENDING") ?? 0;
  const approved = decisionCounts.get("APPROVED") ?? 0;
  const reviewed = cohort.length - pending;
  const reviewDurations = cohort.flatMap((row) => {
    const submitted = validTimestamp(row.submittedAt);
    const decided = validTimestamp(row.decidedAt);
    return submitted !== null && decided !== null && decided >= submitted
      ? [(decided - submitted) / (60 * 60 * 1000)]
      : [];
  });
  const medianReview = median(reviewDurations);
  const pendingAges = cohort.flatMap((row) => {
    if (row.decision !== "PENDING") return [];
    const submitted = validTimestamp(row.submittedAt);
    return submitted !== null && submitted <= now ? [(now - submitted) / DAY_MS] : [];
  });

  const pathCounts = countBy(cohort, (row) => row.qualificationPath);
  const stageCounts = countBy(cohort, (row) => row.educationStage || "NOT_RECORDED");
  const institutionCounts = countBy(
    cohort,
    (row) => row.institution.trim() || "Institution not recorded",
  );
  const sortedInstitutions = [...institutionCounts.entries()].sort(
    ([leftName, leftCount], [rightName, rightCount]) =>
      rightCount - leftCount || leftName.localeCompare(rightName),
  );
  const leadingInstitutions = sortedInstitutions.slice(0, 8);

  const evidenceSignals = [
    ["resume", "Resume link", (row: AdminAnalyticsRow) => Boolean(row.resumeUrl)],
    ["transcript", "Transcript link", (row: AdminAnalyticsRow) => Boolean(row.transcriptUrl)],
    ["codeforces", "Codeforces handle", (row: AdminAnalyticsRow) => Boolean(row.codeforcesHandle)],
    ["github", "GitHub profile", (row: AdminAnalyticsRow) => Boolean(row.githubUrl)],
    ["linkedin", "LinkedIn profile", (row: AdminAnalyticsRow) => Boolean(row.linkedInUrl)],
  ] as const;

  const reviewerCounts = countBy(
    cohort.filter((row) => row.decision !== "PENDING"),
    (row) => row.decidedBy ?? "Unattributed decision",
  );
  const datedSubmissionStarts = cohort.flatMap((row) => {
    const timestamp = validTimestamp(row.submittedAt);
    return timestamp === null ? [] : [startOfIstDay(timestamp)];
  });
  const allTimeDaySpan = datedSubmissionStarts.length
    ? Math.max(
        1,
        Math.floor((todayStart - Math.min(...datedSubmissionStarts)) / DAY_MS) + 1,
      )
    : 0;
  const trendGranularity =
    days !== null || (allTimeDaySpan > 0 && allTimeDaySpan <= 31)
      ? "DAY"
      : "MONTH";

  return {
    range,
    cohortLabel:
      range === "ALL"
        ? "All loaded registrations"
        : `Registrations submitted in the past ${days} days`,
    total: cohort.length,
    previousPeriodTotal,
    volumeChangePercent,
    reviewed,
    pending,
    reviewRate: percentage(reviewed, cohort.length),
    approved,
    approvalRate: percentage(approved, reviewed),
    medianReviewHours:
      medianReview === null ? null : Math.round(medianReview * 10) / 10,
    oldestPendingDays: pendingAges.length
      ? Math.floor(Math.max(...pendingAges))
      : null,
    pendingOlderThan7Days: pendingAges.filter((age) => age >= 7).length,
    undated: cohort.filter((row) => validTimestamp(row.submittedAt) === null).length,
    trendGranularity,
    trend:
      days !== null
        ? fixedDailyTrend(cohort, days, todayStart)
        : trendGranularity === "DAY"
          ? fixedDailyTrend(cohort, allTimeDaySpan, todayStart)
          : monthlyTrend(cohort),
    decisions: (["PENDING", "APPROVED", "WAITLISTED", "REJECTED"] as const).map(
      (decision) => ({
        key: decision,
        label: DECISION_LABELS[decision],
        count: decisionCounts.get(decision) ?? 0,
        percentage: percentage(decisionCounts.get(decision) ?? 0, cohort.length),
      }),
    ),
    qualificationPaths: (["AUTO", "QUALIFIER", "UNDETERMINED"] as const).map(
      (path) => ({
        key: path,
        label: PATH_LABELS[path],
        count: pathCounts.get(path) ?? 0,
        percentage: percentage(pathCounts.get(path) ?? 0, cohort.length),
      }),
    ),
    educationStages: [...stageCounts.entries()]
      .sort(([leftName, leftCount], [rightName, rightCount]) =>
        rightCount - leftCount || leftName.localeCompare(rightName),
      )
      .map(([key, count]) => ({
        key,
        label: key === "NOT_RECORDED" ? "Not recorded" : titleCase(key),
        count,
        percentage: percentage(count, cohort.length),
      })),
    institutions: leadingInstitutions.map(([label, count]) => ({
      key: label.toLocaleLowerCase(),
      label,
      count,
      percentage: percentage(count, cohort.length),
    })),
    uniqueInstitutions: institutionCounts.size,
    otherInstitutionCount: sortedInstitutions
      .slice(8)
      .reduce((total, [, count]) => total + count, 0),
    evidence: evidenceSignals.map(([key, label, hasSignal]) => {
      const count = cohort.filter(hasSignal).length;
      return { key, label, count, percentage: percentage(count, cohort.length) };
    }),
    reviewers: [...reviewerCounts.entries()]
      .sort(([leftName, leftCount], [rightName, rightCount]) =>
        rightCount - leftCount || leftName.localeCompare(rightName),
      )
      .map(([reviewer, count]) => ({
        reviewer,
        count,
        percentage: percentage(count, reviewed),
      })),
  };
}
