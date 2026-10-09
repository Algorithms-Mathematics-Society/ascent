import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AdminRegistrationRow } from "../src/lib/adminRegistrationView";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getAllAdminRegistrations: vi.fn(),
  getAdminRegistrationStats: vi.fn(),
}));
vi.mock("@/lib/adminAuth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));
vi.mock("@/lib/adminRegistrations", () => ({
  getAllAdminRegistrations: mocks.getAllAdminRegistrations,
  getAdminRegistrationStats: mocks.getAdminRegistrationStats,
}));
// These two call useRouter, which needs a mounted app router. They are not
// part of the export surface, so they are stubbed out of the page render.
vi.mock("@/components/admin/AdminBulkReview", () => ({
  default: () => null,
}));
vi.mock("@/components/admin/AdminDecisionControl", () => ({
  default: () => null,
}));

import AdminExportPicker from "../src/components/admin/AdminExportPicker";
import AdminHomePage from "../src/app/admin/page";

function row(
  overrides: Partial<AdminRegistrationRow> = {},
): AdminRegistrationRow {
  return {
    id: "application-1",
    reference: "ASC-0001",
    legalName: "Asha Rao",
    email: "asha@example.com",
    phone: "+919876543210",
    institution: "Example Institute",
    educationStage: "UNIVERSITY",
    studyLevel: "Year 3",
    graduationYear: 2027,
    codeforcesHandle: null,
    qualificationPath: "AUTO",
    decision: "APPROVED",
    decisionReason: null,
    decidedAt: null,
    decidedBy: null,
    submittedAt: "2026-07-21T00:00:00.000Z",
    resumeUrl: "https://example.com/resume",
    transcriptUrl: null,
    linkedInUrl: null,
    githubUrl: null,
    tags: [],
    ...overrides,
  };
}

/** Attribute order in rendered markup is not a contract, so parse the tags. */
function inputs(html: string) {
  return (html.match(/<input\b[^>]*>/g) ?? []).map((tag) => {
    const attributes: Record<string, string> = {};
    for (const match of tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
      attributes[match[1]] = match[2];
    }
    return attributes;
  });
}

function columnBoxes(html: string) {
  return inputs(html).filter(
    (input) => input.type === "checkbox" && input.name === "columns",
  );
}

function tickedColumns(html: string) {
  return columnBoxes(html)
    .filter((input) => "checked" in input)
    .map((input) => input.value);
}

function hiddenInputs(html: string) {
  return inputs(html).filter((input) => input.type === "hidden");
}

function exportLink(html: string) {
  const href = /href="(\/api\/admin\/registrations\/export[^"]*)"/.exec(html);
  return (href?.[1] ?? "").replaceAll("&amp;", "&");
}

const DEFAULT_COLUMN_QUERY =
  "columns=reference&columns=name&columns=email&columns=institution&columns=decision";

describe("admin export picker markup", () => {
  const html = renderToStaticMarkup(
    <AdminExportPicker
      exportHref="/api/admin/registrations/export?scope=all&columns=reference"
      columns={["reference", "mobile"]}
      scope="FILTERED"
      carried={[
        { name: "q", value: "rao" },
        { name: "decision", value: "APPROVED" },
      ]}
      loadedCount={412}
      filteredCount={37}
    />,
  );

  it("is a plain GET form aimed at the export route, so it needs no scripting", () => {
    expect(html).toMatch(
      /<form method="get" action="\/api\/admin\/registrations\/export"/,
    );
    expect(html).not.toContain("onclick");
  });

  it("carries the admin list filters as hidden inputs", () => {
    expect(hiddenInputs(html)).toEqual([
      { type: "hidden", name: "q", value: "rao" },
      { type: "hidden", name: "decision", value: "APPROVED" },
    ]);
  });

  it("offers every column as a named checkbox and ticks only the chosen ones", () => {
    expect(columnBoxes(html).map((input) => input.value)).toEqual([
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
    expect(tickedColumns(html)).toEqual(["reference", "mobile"]);
  });

  it("shows a labelled scope control with both row counts", () => {
    const scopes = inputs(html).filter((input) => input.name === "scope");
    expect(scopes.map((input) => input.value)).toEqual(["all", "filter"]);
    expect(scopes.map((input) => "checked" in input)).toEqual([false, true]);
    expect(html).toContain("All registrants");
    expect(html).toContain("Current filter only");
    expect(html).toContain("412 loaded");
    expect(html).toContain("37 matching");
  });

  it("names the personal data columns and warns when one is selected", () => {
    expect(html).toContain("1 personal data column");
    expect(html).toContain("Mobile number");
  });

  it("does not warn about unsaved ticks on a freshly loaded panel", () => {
    expect(html).not.toContain("until you save");
  });

  it("can download and can save the choice back to the page URL", () => {
    expect(html.match(/type="submit"/g)).toHaveLength(2);
    expect(html.toLowerCase()).toContain('formaction="/admin"');
  });
});

describe("admin page export link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      uid: "admin",
      role: "OWNER",
    });
    mocks.getAdminRegistrationStats.mockResolvedValue({
      total: 2,
      pending: 1,
      approved: 1,
      waitlisted: 0,
      rejected: 0,
      unlistedInstitutions: 0,
    });
    mocks.getAllAdminRegistrations.mockResolvedValue({
      rows: [row(), row({ id: "application-2", decision: "PENDING" })],
      truncated: false,
    });
  });

  async function render(searchParams: Record<string, string | string[]>) {
    return renderToStaticMarkup(await AdminHomePage({ searchParams }));
  }

  it("defaults the export to all registrants with the default columns", async () => {
    const html = await render({});
    expect(exportLink(html)).toBe(
      `/api/admin/registrations/export?scope=all&${DEFAULT_COLUMN_QUERY}`,
    );
    expect(html).toContain("Export all registrants · 5 columns · CSV");
  });

  it("leaves an all-registrants export unnarrowed by the page filters", async () => {
    const html = await render({ decision: "PENDING", q: "rao" });
    expect(exportLink(html)).toBe(
      `/api/admin/registrations/export?scope=all&${DEFAULT_COLUMN_QUERY}`,
    );
    expect(exportLink(html)).not.toContain("q=rao");
    expect(exportLink(html)).not.toContain("decision=PENDING");
  });

  it("carries the page filters into the export link once the filter scope is chosen", async () => {
    const html = await render({
      scope: "filter",
      decision: "PENDING",
      sort: "NAME",
    });
    expect(exportLink(html)).toBe(
      "/api/admin/registrations/export?scope=filter&decision=PENDING&sort=NAME&" +
        DEFAULT_COLUMN_QUERY,
    );
    expect(html).toContain("Export the current filter · 5 columns · CSV");
  });

  it("keeps a chosen column set in canonical order in the export link", async () => {
    const html = await render({ columns: ["github", "mobile", "reference"] });
    expect(exportLink(html)).toBe(
      "/api/admin/registrations/export?scope=all&columns=reference&columns=mobile&columns=github",
    );
    expect(html).toContain("Export all registrants · 3 columns · CSV");
    expect(tickedColumns(html)).toEqual(["reference", "mobile", "github"]);
  });

  it("keeps the choice in the filter form so applying a filter does not drop it", async () => {
    const html = await render({ columns: ["mobile"], scope: "filter" });
    expect(hiddenInputs(html)).toEqual(
      expect.arrayContaining([
        { type: "hidden", name: "scope", value: "filter" },
        { type: "hidden", name: "columns", value: "mobile" },
      ]),
    );
  });

  it("adds no hidden choice inputs while the selection is the default", async () => {
    const html = await render({});
    expect(
      hiddenInputs(html).filter(
        (input) => input.name === "columns" || input.name === "scope",
      ),
    ).toEqual([]);
  });

  it("degrades hostile column and scope values to the safe defaults", async () => {
    const html = await render({
      columns: ["id", "__proto__", "*", "decisionReason"],
      scope: "everything",
    });
    expect(exportLink(html)).toBe(
      `/api/admin/registrations/export?scope=all&${DEFAULT_COLUMN_QUERY}`,
    );
    expect(columnBoxes(html)).toHaveLength(17);
    expect(tickedColumns(html)).toEqual([
      "reference",
      "name",
      "email",
      "institution",
      "decision",
    ]);
  });
});
