import { csvCell } from "./adminExport";
import type { AdminDecision } from "./adminRegistrationView";

export type AdminActivityCategory =
  | "ALL"
  | "DECISIONS"
  | "OPERATIONS"
  | "SYSTEM";
export type AdminActivityRange = "24H" | "7D" | "30D" | "ALL";

export interface AdminActivityEntry {
  id: string;
  subjectId: string | null;
  applicantName: string;
  reference: string;
  event: string;
  category: Exclude<AdminActivityCategory, "ALL">;
  actor: string;
  actorEmail: string | null;
  targetEmail: string | null;
  previousDecision: AdminDecision | null;
  decision: AdminDecision | null;
  reason: string | null;
  bulkOperationId: string | null;
  timestamp: string | null;
}

export interface AdminActivityFilters {
  query: string;
  category: AdminActivityCategory;
  range: AdminActivityRange;
}

export interface AdminActivitySummary {
  last24Hours: number;
  decisions7Days: number;
  operations7Days: number;
  bulkBatches30Days: number;
}

const RANGE_MILLISECONDS: Record<Exclude<AdminActivityRange, "ALL">, number> = {
  "24H": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
};

export function adminActivityCategory(
  event: string,
): Exclude<AdminActivityCategory, "ALL"> {
  if (event.startsWith("REGISTRATION_")) return "DECISIONS";
  if (event.startsWith("ADMIN_")) return "OPERATIONS";
  return "SYSTEM";
}

export function adminActivityLabel(event: string) {
  if (event === "REGISTRATION_APPROVED") return "Registration approved";
  if (event === "REGISTRATION_WAITLISTED") return "Registration waitlisted";
  if (event === "REGISTRATION_REJECTED") return "Registration rejected";
  if (event === "ADMIN_NOTE_ADDED") return "Private note added";
  if (event === "ADMIN_TAGS_UPDATED") return "Operational tags updated";
  if (event === "ADMIN_REGISTRATION_SETTINGS_UPDATED") {
    return "Registration controls updated";
  }
  if (event === "ADMIN_ACCESS_GRANTED") return "Administrator access granted";
  if (event === "ADMIN_ROLE_CHANGED") return "Administrator role changed";
  if (event === "ADMIN_SESSIONS_REVOKED") return "Administrator sessions revoked";
  if (event === "ADMIN_ACCESS_REVOKED") return "Administrator access revoked";
  if (event === "QUALIFICATION_DETERMINED") {
    return "Qualification route determined";
  }
  return event
    .toLocaleLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase());
}

export function filterAdminActivity(
  entries: AdminActivityEntry[],
  filters: AdminActivityFilters,
  now = Date.now(),
) {
  const query = filters.query.trim().toLocaleLowerCase();
  const cutoff =
    filters.range === "ALL" ? null : now - RANGE_MILLISECONDS[filters.range];

  return entries.filter((entry) => {
    if (filters.category !== "ALL" && entry.category !== filters.category) {
      return false;
    }
    if (cutoff !== null) {
      const timestamp = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
      if (!Number.isFinite(timestamp) || timestamp < cutoff) return false;
    }
    if (!query) return true;
    return [
      entry.applicantName,
      entry.reference,
      entry.subjectId ?? "",
      adminActivityLabel(entry.event),
      entry.actorEmail ?? entry.actor,
      entry.targetEmail ?? "",
      entry.reason ?? "",
      entry.bulkOperationId ?? "",
    ].some((value) => value.toLocaleLowerCase().includes(query));
  });
}

export function summarizeAdminActivity(
  entries: AdminActivityEntry[],
  now = Date.now(),
): AdminActivitySummary {
  const oneDayAgo = now - RANGE_MILLISECONDS["24H"];
  const sevenDaysAgo = now - RANGE_MILLISECONDS["7D"];
  const thirtyDaysAgo = now - RANGE_MILLISECONDS["30D"];
  const recentBulkBatches = new Set<string>();
  let last24Hours = 0;
  let decisions7Days = 0;
  let operations7Days = 0;

  for (const entry of entries) {
    const timestamp = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
    if (!Number.isFinite(timestamp)) continue;
    if (timestamp >= oneDayAgo) last24Hours += 1;
    if (timestamp >= sevenDaysAgo && entry.category === "DECISIONS") {
      decisions7Days += 1;
    }
    if (timestamp >= sevenDaysAgo && entry.category === "OPERATIONS") {
      operations7Days += 1;
    }
    if (timestamp >= thirtyDaysAgo && entry.bulkOperationId) {
      recentBulkBatches.add(entry.bulkOperationId);
    }
  }

  return {
    last24Hours,
    decisions7Days,
    operations7Days,
    bulkBatches30Days: recentBulkBatches.size,
  };
}

export const ADMIN_ACTIVITY_EXPORT_HEADERS = [
  "Timestamp",
  "Event",
  "Category",
  "Applicant",
  "Reference",
  "Application ID",
  "Actor",
  "Target administrator",
  "Previous decision",
  "Decision",
  "Reason",
  "Bulk operation ID",
] as const;

export function adminActivityCsv(entries: AdminActivityEntry[]) {
  const rows = entries.map((entry) => [
    entry.timestamp ?? "",
    adminActivityLabel(entry.event),
    entry.category,
    entry.applicantName,
    entry.reference,
    entry.subjectId ?? "",
    entry.actorEmail ?? entry.actor,
    entry.targetEmail ?? "",
    entry.previousDecision ?? "",
    entry.decision ?? "",
    entry.reason ?? "",
    entry.bulkOperationId ?? "",
  ]);
  return [ADMIN_ACTIVITY_EXPORT_HEADERS, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
