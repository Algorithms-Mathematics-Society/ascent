import { describe, expect, it } from "vitest";
import {
  buildAdminAnalytics,
  parseAdminAnalyticsRange,
  type AdminAnalyticsRow,
} from "../src/lib/adminAnalytics";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");

function row(
  id: string,
  values: Partial<AdminAnalyticsRow> = {},
): AdminAnalyticsRow {
  return {
    id,
    institution: "IIT Bombay",
    educationStage: "UNIVERSITY_STUDENT",
    codeforcesHandle: null,
    qualificationPath: "AUTO",
    decision: "PENDING",
    decidedAt: null,
    decidedBy: null,
    submittedAt: "2026-07-21T08:00:00.000Z",
    resumeUrl: "https://drive.google.com/resume",
    transcriptUrl: null,
    linkedInUrl: null,
    githubUrl: null,
    ...values,
  };
}

describe("admin analytics", () => {
  it("parses only supported cohort ranges", () => {
    expect(parseAdminAnalyticsRange("7D")).toBe("7D");
    expect(parseAdminAnalyticsRange("30D")).toBe("30D");
    expect(parseAdminAnalyticsRange("90D")).toBe("ALL");
  });

  it("calculates review and approval rates with the correct denominators", () => {
    const snapshot = buildAdminAnalytics(
      [
        row("one", {
          decision: "APPROVED",
          decidedAt: "2026-07-21T10:00:00.000Z",
          decidedBy: "owner@example.com",
        }),
        row("two", {
          decision: "REJECTED",
          submittedAt: "2026-07-20T08:00:00.000Z",
          decidedAt: "2026-07-20T20:00:00.000Z",
          decidedBy: "reviewer@example.com",
        }),
        row("three"),
        row("old", { submittedAt: "2026-06-01T08:00:00.000Z" }),
      ],
      "7D",
      NOW,
    );

    expect(snapshot.total).toBe(3);
    expect(snapshot.reviewed).toBe(2);
    expect(snapshot.reviewRate).toBe(66.7);
    expect(snapshot.approvalRate).toBe(50);
    expect(snapshot.medianReviewHours).toBe(7);
    expect(snapshot.trend).toHaveLength(7);
    expect(snapshot.trend.at(-1)).toMatchObject({ label: "21 Jul", count: 2 });
  });

  it("reports institution concentration, optional evidence, and pending age", () => {
    const snapshot = buildAdminAnalytics(
      [
        row("one", {
          codeforcesHandle: "tourist",
          githubUrl: "https://github.com/example",
          submittedAt: "2026-07-10T08:00:00.000Z",
        }),
        row("two", {
          institution: "IIT Delhi",
          transcriptUrl: "https://drive.google.com/transcript",
        }),
      ],
      "ALL",
      NOW,
    );

    expect(snapshot.uniqueInstitutions).toBe(2);
    expect(snapshot.institutions[0]).toMatchObject({ count: 1, percentage: 50 });
    expect(snapshot.evidence.find((item) => item.key === "resume")?.count).toBe(2);
    expect(snapshot.evidence.find((item) => item.key === "github")?.count).toBe(1);
    expect(snapshot.oldestPendingDays).toBe(11);
    expect(snapshot.pendingOlderThan7Days).toBe(1);
    expect(snapshot.trendGranularity).toBe("DAY");
    expect(snapshot.trend).toHaveLength(12);
  });

  it("handles an empty cohort without fake percentages or invalid medians", () => {
    const snapshot = buildAdminAnalytics([], "30D", NOW);
    expect(snapshot.total).toBe(0);
    expect(snapshot.reviewRate).toBe(0);
    expect(snapshot.approvalRate).toBe(0);
    expect(snapshot.medianReviewHours).toBeNull();
    expect(snapshot.trend).toHaveLength(30);
    expect(snapshot.trend.every((point) => point.count === 0)).toBe(true);
  });
});
