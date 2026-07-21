import { describe, expect, it } from "vitest";
import {
  parseRegistrationSettingsInput,
  registrationAvailability,
  registrationSettingsFromData,
} from "../src/lib/registrationSettings";

const NOW = Date.parse("2026-07-21T12:00:00.000Z");

describe("registration operational settings", () => {
  it("defaults safely to open with an actual-count fallback", () => {
    expect(registrationSettingsFromData(undefined, 17)).toMatchObject({
      isOpen: true,
      acceptedCount: 17,
      capacity: null,
      retentionDays: 365,
      revision: 0,
    });
  });

  it("resolves manual closure, deadline and capacity in priority order", () => {
    const base = registrationSettingsFromData(
      { is_open: true, accepted_count: 9, capacity: 10 },
      0,
    );
    expect(registrationAvailability({ ...base, isOpen: false }, NOW).reason).toBe(
      "MANUALLY_CLOSED",
    );
    expect(
      registrationAvailability(
        { ...base, deadline: "2026-07-21T11:59:00.000Z" },
        NOW,
      ).reason,
    ).toBe("DEADLINE_PASSED");
    expect(
      registrationAvailability({ ...base, acceptedCount: 10 }, NOW).reason,
    ).toBe("CAPACITY_REACHED");
    expect(registrationAvailability(base, NOW).reason).toBe("OPEN");
  });

  it("validates a deliberate settings update", () => {
    const result = parseRegistrationSettingsInput(
      {
        isOpen: true,
        deadline: "2026-08-01T12:00:00.000Z",
        capacity: 500,
        retentionDays: 365,
        reason: "Set the public registration operating window.",
        expectedRevision: 2,
      },
      20,
      NOW,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        isOpen: true,
        deadline: "2026-08-01T12:00:00.000Z",
        capacity: 500,
        retentionDays: 365,
        reason: "Set the public registration operating window.",
        expectedRevision: 2,
      },
    });
  });

  it("requires explicit closure confirmation and protects existing entries", () => {
    expect(
      parseRegistrationSettingsInput(
        {
          isOpen: false,
          deadline: null,
          capacity: null,
          retentionDays: 365,
          reason: "Pause while the operations team reviews capacity.",
          expectedRevision: 0,
        },
        20,
        NOW,
      ),
    ).toMatchObject({ ok: false });
    expect(
      parseRegistrationSettingsInput(
        {
          isOpen: true,
          deadline: null,
          capacity: 19,
          retentionDays: 365,
          reason: "Reduce the registration capacity carefully.",
          expectedRevision: 0,
        },
        20,
        NOW,
      ),
    ).toMatchObject({ ok: false });
  });
});
