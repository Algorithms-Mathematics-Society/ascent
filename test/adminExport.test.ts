import { describe, expect, it } from "vitest";
import { csvCell, protectSpreadsheetCell, registrationsCsv } from "../src/lib/adminExport";
import type { AdminRegistrationRow } from "../src/lib/adminRegistrationView";

describe("admin CSV export", () => {
  it("neutralizes spreadsheet formulas, including leading whitespace", () => {
    expect(protectSpreadsheetCell("=HYPERLINK(\"bad\")")).toBe(
      "'=HYPERLINK(\"bad\")",
    );
    expect(protectSpreadsheetCell("  +1+1")).toBe("'  +1+1");
    expect(protectSpreadsheetCell("Safe value")).toBe("Safe value");
  });

  it("quotes commas, quotes, and newlines", () => {
    expect(csvCell('One, "Two"\nThree')).toBe('"One, ""Two""\nThree"');
  });

  it("exports operational tags and protects applicant-controlled cells", () => {
    const row: AdminRegistrationRow = {
      id: "application-export-test",
      reference: "ASC-TEST",
      legalName: "=Malicious Formula",
      email: "person@example.com",
      phone: "+6581234567",
      institution: "Example University",
      educationStage: "UNIVERSITY",
      studyLevel: "Year 2",
      graduationYear: 2028,
      codeforcesHandle: null,
      qualificationPath: "QUALIFIER",
      decision: "PENDING",
      decisionReason: null,
      decidedAt: null,
      decidedBy: null,
      submittedAt: "2026-07-21T00:00:00.000Z",
      resumeUrl: "https://drive.google.com/resume",
      transcriptUrl: null,
      linkedInUrl: null,
      githubUrl: null,
      tags: ["DOCUMENT_CHECK"],
    };
    const csv = registrationsCsv([row]);
    expect(csv).toContain('"\'=Malicious Formula"');
    expect(csv).toContain('"Document check"');
  });
});
