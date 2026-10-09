import { describe, expect, it } from "vitest";
import {
  ADMIN_EXPORT_COLUMNS,
  ADMIN_EXPORT_COLUMN_KEYS,
  ADMIN_EXPORT_DEFAULT_COLUMNS,
  ADMIN_EXPORT_HEADERS,
  csvCell,
  parseAdminExportColumns,
  parseAdminExportScope,
  protectSpreadsheetCell,
  registrationsCsv,
} from "../src/lib/adminExport";
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

function exportRow(
  overrides: Partial<AdminRegistrationRow> = {},
): AdminRegistrationRow {
  return {
    id: "application-column-selection",
    reference: "ASC-0001",
    legalName: "Asha Rao",
    email: "asha@example.com",
    phone: "+919876543210",
    institution: "Example Institute",
    educationStage: "UNIVERSITY",
    studyLevel: "Year 3",
    graduationYear: 2027,
    codeforcesHandle: "asha",
    qualificationPath: "AUTO",
    decision: "APPROVED",
    decisionReason: null,
    decidedAt: null,
    decidedBy: null,
    submittedAt: "2026-07-21T00:00:00.000Z",
    resumeUrl: "https://example.com/resume",
    transcriptUrl: "https://example.com/transcript",
    linkedInUrl: "https://example.com/in",
    githubUrl: "https://example.com/gh",
    tags: ["DOCUMENT_CHECK"],
    ...overrides,
  };
}

function headerRow(csv: string) {
  return csv.split("\r\n")[0];
}

describe("admin CSV column selection", () => {
  it("keeps the canonical column table and headers in step", () => {
    expect(ADMIN_EXPORT_COLUMNS).toHaveLength(17);
    expect(ADMIN_EXPORT_HEADERS).toEqual([
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
    ]);
    expect(ADMIN_EXPORT_COLUMN_KEYS).toEqual([
      "reference",
      "name",
      "email",
      "mobile",
      "institution",
      "stage",
      "level",
      "graduation",
      "codeforces",
      "path",
      "decision",
      "tags",
      "submitted",
      "resume",
      "transcript",
      "linkedin",
      "github",
    ]);
  });

  it("defaults to operational identity only, with no personal data", () => {
    expect(ADMIN_EXPORT_DEFAULT_COLUMNS).toEqual([
      "reference",
      "name",
      "email",
      "institution",
      "decision",
    ]);
    const personalKeys = ADMIN_EXPORT_COLUMNS.filter(
      (column) => column.personal,
    ).map((column) => column.key);
    expect(personalKeys).toEqual([
      "mobile",
      "resume",
      "transcript",
      "linkedin",
      "github",
    ]);
    for (const key of personalKeys) {
      expect(ADMIN_EXPORT_DEFAULT_COLUMNS).not.toContain(key);
    }
  });

  it("declares the defaults in canonical order", () => {
    const canonicalOrder = ADMIN_EXPORT_COLUMN_KEYS.filter((key) =>
      ADMIN_EXPORT_DEFAULT_COLUMNS.includes(key),
    );
    expect([...ADMIN_EXPORT_DEFAULT_COLUMNS]).toEqual(canonicalOrder);
  });

  it("falls back to the defaults when nothing is requested", () => {
    for (const requested of [
      undefined,
      null,
      "",
      "   ",
      [],
      [""],
      [undefined],
      {},
      42,
    ]) {
      expect(parseAdminExportColumns(requested)).toEqual([
        ...ADMIN_EXPORT_DEFAULT_COLUMNS,
      ]);
    }
  });

  it("honours a chosen subset", () => {
    expect(parseAdminExportColumns(["reference", "mobile"])).toEqual([
      "reference",
      "mobile",
    ]);
    expect(parseAdminExportColumns("email")).toEqual(["email"]);
  });

  it("accepts repeated params and comma separated values alike", () => {
    expect(parseAdminExportColumns(["reference,email", "github"])).toEqual([
      "reference",
      "email",
      "github",
    ]);
    expect(parseAdminExportColumns("github,email,reference")).toEqual([
      "reference",
      "email",
      "github",
    ]);
  });

  it("returns canonical order whatever order was requested", () => {
    const requested = ["github", "decision", "reference", "mobile", "tags"];
    const forwards = parseAdminExportColumns(requested);
    const backwards = parseAdminExportColumns([...requested].reverse());
    expect(forwards).toEqual([
      "reference",
      "mobile",
      "decision",
      "tags",
      "github",
    ]);
    expect(backwards).toEqual(forwards);
  });

  it("is case and whitespace tolerant without becoming permissive", () => {
    expect(parseAdminExportColumns([" Email ", "REFERENCE"])).toEqual([
      "reference",
      "email",
    ]);
    expect(parseAdminExportColumns(["e mail", "ref", "emails"])).toEqual([
      ...ADMIN_EXPORT_DEFAULT_COLUMNS,
    ]);
  });

  it("ignores unknown and duplicate keys", () => {
    expect(
      parseAdminExportColumns([
        "email",
        "email",
        "email,email",
        "__proto__",
        "constructor",
        "legalName",
        "../../etc/passwd",
        "reference",
      ]),
    ).toEqual(["reference", "email"]);
  });

  it("never widens beyond the known columns", () => {
    const hostile = [
      ...ADMIN_EXPORT_COLUMN_KEYS,
      ...ADMIN_EXPORT_COLUMN_KEYS,
      "id",
      "decisionReason",
      "*",
      "x".repeat(5000),
    ];
    const parsed = parseAdminExportColumns(hostile);
    expect(parsed).toEqual([...ADMIN_EXPORT_COLUMN_KEYS]);
    expect(parsed).toHaveLength(17);
  });

  it("falls back to the defaults when the selection resolves to nothing", () => {
    const csv = registrationsCsv([exportRow()], []);
    expect(headerRow(csv)).toBe(
      '"Reference","Full name","Email","Institution","Decision"',
    );
    expect(csv.split("\r\n")).toHaveLength(2);
    const unknownOnly = registrationsCsv(
      [exportRow()],
      parseAdminExportColumns(["nope", "also-nope"]),
    );
    expect(unknownOnly).toBe(csv);
  });

  it("emits only the selected columns, in canonical order", () => {
    const csv = registrationsCsv(
      [exportRow()],
      parseAdminExportColumns(["github", "mobile", "reference"]),
    );
    expect(csv).toBe(
      '"Reference","Mobile number","GitHub"\r\n' +
        '"ASC-0001","\'+919876543210","https://example.com/gh"',
    );
  });

  it("still emits all seventeen columns when no selection is passed", () => {
    const row = exportRow();
    expect(registrationsCsv([row])).toBe(
      registrationsCsv([row], ADMIN_EXPORT_COLUMN_KEYS),
    );
    expect(headerRow(registrationsCsv([row])).split('","')).toHaveLength(17);
  });

  it("protects every selected column against spreadsheet injection", () => {
    const hostile = exportRow({
      reference: "=ASC-0001",
      legalName: "=cmd|calc",
      email: "+asha@example.com",
      phone: "+919876543210",
      institution: "-Example Institute",
      educationStage: "@UNIVERSITY",
      studyLevel: "=Year 3",
      codeforcesHandle: "  =asha",
      submittedAt: "=2026-07-21T00:00:00.000Z",
      resumeUrl: "=HYPERLINK(\"https://evil.example\")",
      transcriptUrl: "+transcript",
      linkedInUrl: "-in",
      githubUrl: "@gh",
    });

    let neutralized = 0;
    for (const column of ADMIN_EXPORT_COLUMNS) {
      const csv = registrationsCsv([hostile], [column.key]);
      const [header, data] = csv.split("\r\n");
      const raw = column.value(hostile);
      expect(header).toBe(csvCell(column.header));
      expect(data).toBe(csvCell(raw));
      if (/^[\s]*[=+\-@]/.test(raw) || /^[\t\r]/.test(raw)) {
        expect(data.startsWith('"\'')).toBe(true);
        neutralized += 1;
      }
    }
    // Guards against this assertion going vacuous if a column stops being
    // applicant controlled or the fixture drifts.
    expect(neutralized).toBe(13);

    const everything = registrationsCsv([hostile], ADMIN_EXPORT_COLUMN_KEYS);
    expect(everything).toBe(registrationsCsv([hostile]));
    expect(everything).toContain('"\'=cmd|calc"');
  });

  it("defaults the row scope to every registrant", () => {
    for (const value of [undefined, null, "", "all", "ALL", "nonsense", 7, {}]) {
      expect(parseAdminExportScope(value)).toBe("ALL");
    }
  });

  it("narrows the row scope only on an explicit filter request", () => {
    expect(parseAdminExportScope("filter")).toBe("FILTERED");
    expect(parseAdminExportScope(" FILTER ")).toBe("FILTERED");
    expect(parseAdminExportScope("filtered")).toBe("ALL");
  });
});
