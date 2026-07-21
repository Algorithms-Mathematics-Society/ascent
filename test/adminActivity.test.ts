import { describe, expect, it } from "vitest";
import {
  adminActivityCategory,
  adminActivityCsv,
  adminActivityLabel,
  filterAdminActivity,
  summarizeAdminActivity,
  type AdminActivityEntry,
} from "../src/lib/adminActivity";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");
const entries: AdminActivityEntry[] = [
  {
    id: "decision-1",
    subjectId: "application-activity-001",
    applicantName: "Asha Rao",
    reference: "ASC-001",
    event: "REGISTRATION_APPROVED",
    category: "DECISIONS",
    actor: "admin:one",
    actorEmail: "admin@example.com",
    targetEmail: null,
    previousDecision: "PENDING",
    decision: "APPROVED",
    reason: "Reviewed all evidence.",
    bulkOperationId: null,
    timestamp: "2026-07-21T10:00:00.000Z",
  },
  {
    id: "note-1",
    subjectId: "application-activity-002",
    applicantName: "Dev Menon",
    reference: "ASC-002",
    event: "ADMIN_NOTE_ADDED",
    category: "OPERATIONS",
    actor: "admin:two",
    actorEmail: "ops@example.com",
    targetEmail: null,
    previousDecision: null,
    decision: null,
    reason: "Needs transcript follow-up.",
    bulkOperationId: null,
    timestamp: "2026-07-10T10:00:00.000Z",
  },
];

describe("admin activity oversight", () => {
  it("classifies and labels known events", () => {
    expect(adminActivityCategory("REGISTRATION_WAITLISTED")).toBe("DECISIONS");
    expect(adminActivityCategory("ADMIN_TAGS_UPDATED")).toBe("OPERATIONS");
    expect(adminActivityCategory("QUALIFICATION_DETERMINED")).toBe("SYSTEM");
    expect(adminActivityLabel("ADMIN_NOTE_ADDED")).toBe("Private note added");
    expect(adminActivityLabel("ADMIN_ACCESS_REVOKED")).toBe(
      "Administrator access revoked",
    );
  });

  it("combines time, category, and text filters", () => {
    expect(
      filterAdminActivity(
        entries,
        { query: "asha", category: "DECISIONS", range: "24H" },
        NOW,
      ).map((entry) => entry.id),
    ).toEqual(["decision-1"]);
    expect(
      filterAdminActivity(
        entries,
        { query: "follow-up", category: "ALL", range: "7D" },
        NOW,
      ),
    ).toEqual([]);
  });

  it("protects formula-like audit text in CSV exports", () => {
    const csv = adminActivityCsv([
      { ...entries[0], reason: "=HYPERLINK(\"unsafe\")" },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""unsafe"")"');
  });

  it("summarizes recent work without counting a bulk batch twice", () => {
    const summary = summarizeAdminActivity(
      [
        entries[0],
        {
          ...entries[0],
          id: "decision-2",
          bulkOperationId: "bulk-001",
        },
        {
          ...entries[0],
          id: "decision-3",
          bulkOperationId: "bulk-001",
          category: "OPERATIONS",
          event: "ADMIN_TAGS_UPDATED",
        },
        entries[1],
      ],
      NOW,
    );

    expect(summary).toEqual({
      last24Hours: 3,
      decisions7Days: 2,
      operations7Days: 1,
      bulkBatches30Days: 1,
    });
  });
});
