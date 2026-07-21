import { describe, expect, it } from "vitest";
import {
  filterAdminRegistrations,
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
      }).map((row) => row.id),
    ).toEqual(["two"]);
  });

  it("returns no entries when filters conflict", () => {
    expect(
      filterAdminRegistrations(ROWS, {
        query: "asha",
        decision: "APPROVED",
        path: "ALL",
      }),
    ).toEqual([]);
  });
});
