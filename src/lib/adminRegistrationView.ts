import type { AdminRegistrationTag } from "@/lib/adminOperations";

export type AdminDecision = "PENDING" | "APPROVED" | "WAITLISTED" | "REJECTED";

export interface AdminRegistrationRow {
  id: string;
  reference: string;
  legalName: string;
  email: string;
  phone: string;
  institution: string;
  educationStage: string;
  studyLevel: string;
  graduationYear: number | null;
  codeforcesHandle: string | null;
  qualificationPath: "AUTO" | "QUALIFIER" | "UNDETERMINED";
  decision: AdminDecision;
  decisionReason: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  submittedAt: string | null;
  resumeUrl: string;
  transcriptUrl: string | null;
  linkedInUrl: string | null;
  githubUrl: string | null;
  tags: AdminRegistrationTag[];
}

export interface AdminRegistrationFilters {
  query: string;
  decision: "ALL" | AdminDecision;
  path: "ALL" | AdminRegistrationRow["qualificationPath"];
  tag: "ALL" | AdminRegistrationTag;
}

export type AdminRegistrationSort =
  | "NEWEST"
  | "OLDEST"
  | "NAME"
  | "INSTITUTION"
  | "DECISION";

export interface AdminRegistrationPage {
  rows: AdminRegistrationRow[];
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
}

export function filterAdminRegistrations(
  rows: AdminRegistrationRow[],
  filters: AdminRegistrationFilters,
): AdminRegistrationRow[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return rows.filter((row) => {
    if (filters.decision !== "ALL" && row.decision !== filters.decision) {
      return false;
    }
    if (filters.path !== "ALL" && row.qualificationPath !== filters.path) {
      return false;
    }
    if (filters.tag !== "ALL" && !row.tags.includes(filters.tag)) {
      return false;
    }
    if (!query) return true;

    return [
      row.reference,
      row.legalName,
      row.email,
      row.phone,
      row.institution,
      row.codeforcesHandle ?? "",
    ].some((value) => value.toLocaleLowerCase().includes(query));
  });
}

export function sortAdminRegistrations(
  rows: AdminRegistrationRow[],
  sort: AdminRegistrationSort,
): AdminRegistrationRow[] {
  const sorted = [...rows];
  const textCompare = (left: string, right: string) =>
    left.localeCompare(right, "en", { sensitivity: "base" });
  const newestFirst = (left: AdminRegistrationRow, right: AdminRegistrationRow) =>
    (right.submittedAt ?? "").localeCompare(left.submittedAt ?? "") ||
    textCompare(left.reference, right.reference);

  return sorted.sort((left, right) => {
    if (sort === "OLDEST") {
      return (
        (left.submittedAt ?? "").localeCompare(right.submittedAt ?? "") ||
        textCompare(left.reference, right.reference)
      );
    }
    if (sort === "NAME") {
      return textCompare(left.legalName, right.legalName) || newestFirst(left, right);
    }
    if (sort === "INSTITUTION") {
      return textCompare(left.institution, right.institution) || newestFirst(left, right);
    }
    if (sort === "DECISION") {
      const order: Record<AdminDecision, number> = {
        PENDING: 0,
        WAITLISTED: 1,
        APPROVED: 2,
        REJECTED: 3,
      };
      return order[left.decision] - order[right.decision] || newestFirst(left, right);
    }
    return newestFirst(left, right);
  });
}

export function paginateAdminRegistrations(
  rows: AdminRegistrationRow[],
  requestedPage: number,
  pageSize = 25,
): AdminRegistrationPage {
  const safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 25;
  const pageCount = Math.max(1, Math.ceil(rows.length / safePageSize));
  const page = Math.min(
    pageCount,
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  );
  const offset = (page - 1) * safePageSize;
  const pageRows = rows.slice(offset, offset + safePageSize);
  return {
    rows: pageRows,
    page,
    pageSize: safePageSize,
    pageCount,
    total: rows.length,
    start: pageRows.length ? offset + 1 : 0,
    end: offset + pageRows.length,
  };
}
