import type { AdminRegistrationRow } from "./adminRegistrationView";
import { ADMIN_REGISTRATION_TAG_LABEL } from "./adminOperations";

export interface AdminExportColumn {
  /**
   * Stable query-string value. Never rename one of these: shared export links
   * and saved admin bookmarks carry them.
   */
  key: string;
  header: string;
  /**
   * Personal data an operational export rarely needs. These stay opt-in so a
   * routine export does not leave contact details and document links sitting
   * in a spreadsheet on someone's laptop.
   */
  personal: boolean;
  value: (row: AdminRegistrationRow) => string;
}

/**
 * The canonical column order. The CSV always follows this order, whatever
 * order the admin ticked the boxes in or the query string listed them in.
 */
export const ADMIN_EXPORT_COLUMNS = [
  {
    key: "reference",
    header: "Reference",
    personal: false,
    value: (row: AdminRegistrationRow) => row.reference,
  },
  {
    key: "name",
    header: "Full name",
    personal: false,
    value: (row: AdminRegistrationRow) => row.legalName,
  },
  {
    key: "email",
    header: "Email",
    personal: false,
    value: (row: AdminRegistrationRow) => row.email,
  },
  {
    key: "mobile",
    header: "Mobile number",
    personal: true,
    value: (row: AdminRegistrationRow) => row.phone,
  },
  {
    key: "institution",
    header: "Institution",
    personal: false,
    value: (row: AdminRegistrationRow) => row.institution,
  },
  {
    key: "stage",
    header: "Education stage",
    personal: false,
    value: (row: AdminRegistrationRow) => row.educationStage,
  },
  {
    key: "level",
    header: "Study level",
    personal: false,
    value: (row: AdminRegistrationRow) => row.studyLevel,
  },
  {
    key: "graduation",
    header: "Graduation year",
    personal: false,
    value: (row: AdminRegistrationRow) => String(row.graduationYear ?? ""),
  },
  {
    key: "codeforces",
    header: "Codeforces handle",
    personal: false,
    value: (row: AdminRegistrationRow) => row.codeforcesHandle ?? "",
  },
  {
    key: "path",
    header: "Qualification path",
    personal: false,
    value: (row: AdminRegistrationRow) => row.qualificationPath,
  },
  {
    key: "decision",
    header: "Decision",
    personal: false,
    value: (row: AdminRegistrationRow) => row.decision,
  },
  {
    key: "tags",
    header: "Operational tags",
    personal: false,
    value: (row: AdminRegistrationRow) =>
      row.tags.map((tag) => ADMIN_REGISTRATION_TAG_LABEL[tag]).join(" | "),
  },
  {
    key: "submitted",
    header: "Submitted at",
    personal: false,
    value: (row: AdminRegistrationRow) => row.submittedAt ?? "",
  },
  {
    key: "resume",
    header: "Resume link",
    personal: true,
    value: (row: AdminRegistrationRow) => row.resumeUrl,
  },
  {
    key: "transcript",
    header: "Transcript link",
    personal: true,
    value: (row: AdminRegistrationRow) => row.transcriptUrl ?? "",
  },
  {
    key: "linkedin",
    header: "LinkedIn",
    personal: true,
    value: (row: AdminRegistrationRow) => row.linkedInUrl ?? "",
  },
  {
    key: "github",
    header: "GitHub",
    personal: true,
    value: (row: AdminRegistrationRow) => row.githubUrl ?? "",
  },
] as const satisfies readonly AdminExportColumn[];

export type AdminExportColumnKey = (typeof ADMIN_EXPORT_COLUMNS)[number]["key"];

export const ADMIN_EXPORT_COLUMN_KEYS: readonly AdminExportColumnKey[] =
  ADMIN_EXPORT_COLUMNS.map((column) => column.key);

export const ADMIN_EXPORT_HEADERS: readonly string[] =
  ADMIN_EXPORT_COLUMNS.map((column) => column.header);

/**
 * What an export carries when the admin has not chosen. Operational identity
 * only: no mobile number, no document links, no social profiles.
 */
export const ADMIN_EXPORT_DEFAULT_COLUMNS: readonly AdminExportColumnKey[] = [
  "reference",
  "name",
  "email",
  "institution",
  "decision",
];

export type AdminExportScope = "ALL" | "FILTERED";

export function isAdminExportColumnKey(
  value: unknown,
): value is AdminExportColumnKey {
  return (
    typeof value === "string" &&
    (ADMIN_EXPORT_COLUMN_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Turns the `columns` query string into a column selection. The query string
 * is treated as hostile: unknown, duplicate, non-string and malformed entries
 * are dropped, the result can never be wider than the canonical column list,
 * and an empty result falls back to the defaults rather than producing a
 * header-only file.
 */
export function parseAdminExportColumns(
  requested: unknown,
): AdminExportColumnKey[] {
  const requestedKeys = new Set<AdminExportColumnKey>();
  const collect = (value: unknown) => {
    if (typeof value !== "string") return;
    for (const part of value.split(",")) {
      const candidate = part.trim().toLowerCase();
      if (isAdminExportColumnKey(candidate)) requestedKeys.add(candidate);
    }
  };
  if (Array.isArray(requested)) {
    for (const value of requested) collect(value);
  } else {
    collect(requested);
  }

  const selected = ADMIN_EXPORT_COLUMN_KEYS.filter((key) =>
    requestedKeys.has(key),
  );
  return selected.length ? [...selected] : [...ADMIN_EXPORT_DEFAULT_COLUMNS];
}

/**
 * Row scope. The default is every registrant regardless of approval state,
 * which is what the export is for. Only an explicit `filter` narrows it to the
 * admin list's current filters.
 */
export function parseAdminExportScope(value: unknown): AdminExportScope {
  return typeof value === "string" && value.trim().toLowerCase() === "filter"
    ? "FILTERED"
    : "ALL";
}

export function protectSpreadsheetCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /^[\s]*[=+\-@]/.test(text) || /^[\t\r]/.test(text)
    ? `'${text}`
    : text;
}

export function csvCell(value: unknown) {
  const protectedValue = protectSpreadsheetCell(value);
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

function resolveColumns(columns: readonly AdminExportColumnKey[]) {
  const wanted = new Set<AdminExportColumnKey>(columns);
  const picked = ADMIN_EXPORT_COLUMNS.filter((column) => wanted.has(column.key));
  if (picked.length) return picked;
  return ADMIN_EXPORT_COLUMNS.filter((column) =>
    ADMIN_EXPORT_DEFAULT_COLUMNS.includes(column.key),
  );
}

export function registrationsCsv(
  rows: AdminRegistrationRow[],
  columns: readonly AdminExportColumnKey[] = ADMIN_EXPORT_COLUMN_KEYS,
) {
  const selected = resolveColumns(columns);
  const records = rows.map((row) => selected.map((column) => column.value(row)));
  return [selected.map((column) => column.header), ...records]
    .map((record) => record.map(csvCell).join(","))
    .join("\r\n");
}
