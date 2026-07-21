import type { AdminRegistrationRow } from "./adminRegistrationView";
import { ADMIN_REGISTRATION_TAG_LABEL } from "./adminOperations";

export const ADMIN_EXPORT_HEADERS = [
  "Reference",
  "Full name",
  "Email",
  "Mobile number",
  "Institution",
  "Education stage",
  "Study level",
  "Graduation year",
  "Codeforces handle",
  "Qualification path",
  "Decision",
  "Operational tags",
  "Submitted at",
  "Resume link",
  "Transcript link",
  "LinkedIn",
  "GitHub",
] as const;

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

export function registrationsCsv(rows: AdminRegistrationRow[]) {
  const records = rows.map((row) => [
    row.reference,
    row.legalName,
    row.email,
    row.phone,
    row.institution,
    row.educationStage,
    row.studyLevel,
    row.graduationYear ?? "",
    row.codeforcesHandle ?? "",
    row.qualificationPath,
    row.decision,
    row.tags.map((tag) => ADMIN_REGISTRATION_TAG_LABEL[tag]).join(" | "),
    row.submittedAt ?? "",
    row.resumeUrl,
    row.transcriptUrl ?? "",
    row.linkedInUrl ?? "",
    row.githubUrl ?? "",
  ]);
  return [ADMIN_EXPORT_HEADERS, ...records]
    .map((record) => record.map(csvCell).join(","))
    .join("\r\n");
}
