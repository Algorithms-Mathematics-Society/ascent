import { describe, expect, it } from "vitest";
import {
  ADMIN_DECISION_REASON_MAX_LENGTH,
  ADMIN_REQUIRED_REASON_MIN_LENGTH,
  isSafeApplicationId,
  parseAdminDecisionInput,
} from "../src/lib/adminDecision";

describe("admin decision validation", () => {
  it("accepts an approval with an optional normalized note", () => {
    expect(
      parseAdminDecisionInput({
        decision: "APPROVED",
        expectedDecision: "PENDING",
        reason: "  Strong profile\n and eligibility confirmed. ",
      }),
    ).toEqual({
      ok: true,
      value: {
        decision: "APPROVED",
        expectedDecision: "PENDING",
        reason: "Strong profile and eligibility confirmed.",
      },
    });
  });

  it("requires a useful reason for rejection", () => {
    expect(
      parseAdminDecisionInput({
        decision: "REJECTED",
        expectedDecision: "PENDING",
        reason: "No",
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseAdminDecisionInput({
        decision: "REJECTED",
        expectedDecision: "PENDING",
        reason: "Eligibility requirements were not met.",
      }),
    ).toMatchObject({
      ok: true,
      value: { decision: "REJECTED" },
    });
  });

  it("supports waitlisting and requires context", () => {
    expect(
      parseAdminDecisionInput({
        decision: "WAITLISTED",
        expectedDecision: "PENDING",
        reason: "a".repeat(ADMIN_REQUIRED_REASON_MIN_LENGTH - 1),
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseAdminDecisionInput({
        decision: "WAITLISTED",
        expectedDecision: "PENDING",
        reason: "Awaiting institution verification.",
      }),
    ).toMatchObject({
      ok: true,
      value: { decision: "WAITLISTED", expectedDecision: "PENDING" },
    });
  });

  it("allows corrections only with a reason and a changed outcome", () => {
    expect(
      parseAdminDecisionInput({
        decision: "APPROVED",
        expectedDecision: "REJECTED",
        reason: "",
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseAdminDecisionInput({
        decision: "APPROVED",
        expectedDecision: "REJECTED",
        reason: "Eligibility evidence was verified on review.",
      }),
    ).toMatchObject({
      ok: true,
      value: { decision: "APPROVED", expectedDecision: "REJECTED" },
    });
    expect(
      parseAdminDecisionInput({
        decision: "APPROVED",
        expectedDecision: "APPROVED",
        reason: "No actual change.",
      }),
    ).toMatchObject({ ok: false });
  });

  it("rejects stale, unsupported, and oversized decisions", () => {
    expect(
      parseAdminDecisionInput({
        decision: "UNKNOWN",
        expectedDecision: "PENDING",
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseAdminDecisionInput({
        decision: "APPROVED",
        expectedDecision: "APPROVED",
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseAdminDecisionInput({
        decision: "APPROVED",
        expectedDecision: "PENDING",
        reason: "a".repeat(ADMIN_DECISION_REASON_MAX_LENGTH + 1),
      }),
    ).toMatchObject({ ok: false });
  });

  it("accepts only Firestore-safe application identifiers", () => {
    expect(isSafeApplicationId("21b7f43d-29ce-49f8-a433-c7e42fb804ca")).toBe(true);
    expect(isSafeApplicationId("short")).toBe(false);
    expect(isSafeApplicationId("21b7f43d/another-document")).toBe(false);
  });
});
