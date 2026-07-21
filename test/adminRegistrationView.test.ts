import { describe, expect, it } from "vitest";
import {
  filterAdminRegistrations,
  paginateAdminRegistrations,
  sortAdminRegistrations,
  type AdminRegistrationRow,
} from "../src/lib/adminRegistrationView";

const ROWS: AdminRegistrationRow[] = [
  {
    id: "one",
    reference: "ASC-ONE",
    legalName: "Asha Rao",
    email: "asha@example.com",
    phone: "+919876543210",
    institution: "IIT Bombay",
    educationStage: "UNIVERSITY",
    studyLevel: "Third year",
    graduationYear: 2027,
    codeforcesHandle: "asha_codes",
    qualificationPath: "AUTO",
    decision: "PENDING",
    decisionReason: null,
    decidedAt: null,
    decidedBy: null,
    submittedAt: "2026-07-20T10:00:00.000Z",
    resumeUrl: "https://drive.google.com/file/d/resume/view",
    transcriptUrl: null,
    linkedInUrl: null,
    githubUrl: null,
    tags: ["HIGH_PRIORITY"],
  },
  {
    id: "two",
    reference: "ASC-TWO",
    legalName: "Dev Menon",
    email: "dev@example.com",
    phone: "+6581234567",
    institution: "National University of Singapore",
    educationStage: "GRADUATED",
    studyLevel: "—",
    graduationYear: 2024,
    codeforcesHandle: null,
    qualificationPath: "QUALIFIER",
    decision: "APPROVED",
    decisionReason: null,
    decidedAt: "2026-07-20T12:00:00.000Z",
    decidedBy: "admin@example.com",
    submittedAt: "2026-07-20T11:00:00.000Z",
    resumeUrl: "https://drive.google.com/file/d/resume-two/view",
    transcriptUrl: null,
    linkedInUrl: null,
    githubUrl: null,
    tags: ["INSTITUTION_CHECK"],
  },
];

describe("filterAdminRegistrations", () => {
  it("searches applicant, contact, institution, reference, and handle", () => {
    for (const query of ["asha", "987654", "bombay", "asc-one", "asha_codes"]) {
      expect(
        filterAdminRegistrations(ROWS, {
          query,
          decision: "ALL",
          path: "ALL",
          tag: "ALL",
        }).map((row) => row.id),
      ).toEqual(["one"]);
    }
  });

  it("combines decision and route filters", () => {
    expect(
      filterAdminRegistrations(ROWS, {
        query: "",
        decision: "APPROVED",
        path: "QUALIFIER",
        tag: "ALL",
      }).map((row) => row.id),
    ).toEqual(["two"]);
  });

  it("returns no entries when filters conflict", () => {
    expect(
      filterAdminRegistrations(ROWS, {
        query: "asha",
        decision: "APPROVED",
        path: "ALL",
        tag: "ALL",
      }),
    ).toEqual([]);
  });

  it("filters by controlled operational tag", () => {
    expect(
      filterAdminRegistrations(ROWS, {
        query: "",
        decision: "ALL",
        path: "ALL",
        tag: "INSTITUTION_CHECK",
      }).map((row) => row.id),
    ).toEqual(["two"]);
  });
});

describe("admin registration data operations", () => {
  it("sorts by oldest, applicant, institution, and review priority", () => {
    expect(sortAdminRegistrations(ROWS, "OLDEST").map((row) => row.id)).toEqual([
      "one",
      "two",
    ]);
    expect(sortAdminRegistrations(ROWS, "NAME").map((row) => row.id)).toEqual([
      "one",
      "two",
    ]);
    expect(
      sortAdminRegistrations(ROWS, "INSTITUTION").map((row) => row.id),
    ).toEqual(["one", "two"]);
    expect(
      sortAdminRegistrations([...ROWS].reverse(), "DECISION").map(
        (row) => row.id,
      ),
    ).toEqual(["one", "two"]);
  });

  it("paginates deterministically and clamps an out-of-range page", () => {
    const rows = Array.from({ length: 53 }, (_, index) => ({
      ...ROWS[0],
      id: `row-${index + 1}`,
    }));
    const second = paginateAdminRegistrations(rows, 2, 25);
    expect(second.rows).toHaveLength(25);
    expect(second.start).toBe(26);
    expect(second.end).toBe(50);
    expect(second.pageCount).toBe(3);
    const clamped = paginateAdminRegistrations(rows, 99, 25);
    expect(clamped.page).toBe(3);
    expect(clamped.rows).toHaveLength(3);
    expect(clamped.end).toBe(53);
  });
});
