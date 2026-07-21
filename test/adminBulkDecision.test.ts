import { describe, expect, it } from "vitest";
import {
  ADMIN_BULK_MAX_APPLICATIONS,
  parseAdminBulkDecisionInput,
} from "../src/lib/adminBulkDecision";

const id = (index: number) => `application_bulk_test_${String(index).padStart(3, "0")}`;

describe("admin bulk decision validation", () => {
  it("accepts a deduplicated pending-safe approval batch", () => {
    expect(
      parseAdminBulkDecisionInput({
        applicationIds: [id(1), id(2), id(1)],
        decision: "APPROVED",
        reason: "  Reviewed each application and document.  ",
      }),
    ).toEqual({
      ok: true,
      value: {
        applicationIds: [id(1), id(2)],
        decision: "APPROVED",
        reason: "Reviewed each application and document.",
      },
    });
  });

  it("does not permit bulk rejection", () => {
    expect(
      parseAdminBulkDecisionInput({
        applicationIds: [id(1)],
        decision: "REJECTED",
        reason: "A reason long enough to submit.",
      }),
    ).toEqual({
      ok: false,
      error: "Batch review supports approval or waitlisting only.",
    });
  });

  it("enforces the batch cap and safe IDs", () => {
    expect(
      parseAdminBulkDecisionInput({
        applicationIds: Array.from(
          { length: ADMIN_BULK_MAX_APPLICATIONS + 1 },
          (_, index) => id(index),
        ),
        decision: "WAITLISTED",
        reason: "Capacity review is still required.",
      }).ok,
    ).toBe(false);
    expect(
      parseAdminBulkDecisionInput({
        applicationIds: ["../unsafe"],
        decision: "APPROVED",
        reason: "Reviewed each application and document.",
      }).ok,
    ).toBe(false);
  });

  it("requires a reason even for batch approval", () => {
    expect(
      parseAdminBulkDecisionInput({
        applicationIds: [id(1)],
        decision: "APPROVED",
        reason: "short",
      }),
    ).toEqual({
      ok: false,
      error: "Add a batch reason of at least 10 characters.",
    });
  });
});
