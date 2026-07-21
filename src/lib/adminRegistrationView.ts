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
