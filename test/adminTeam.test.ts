import { describe, expect, it } from "vitest";
import { activeOwnerCount, parseAdminTeamMutation } from "../src/lib/adminTeam";

describe("administrator team controls", () => {
  it("requires explicit email confirmation and a reason to grant access", () => {
    expect(
      parseAdminTeamMutation({
        action: "GRANT_ACCESS",
        email: "reviewer@example.com",
        role: "REVIEWER",
        confirmation: "wrong@example.com",
        reason: "Adding a competition reviewer.",
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseAdminTeamMutation({
        action: "GRANT_ACCESS",
        email: "Reviewer@Example.com",
        role: "REVIEWER",
        confirmation: "reviewer@example.com",
        reason: "Adding a competition reviewer.",
      }),
    ).toMatchObject({
      ok: true,
      value: { email: "reviewer@example.com", role: "REVIEWER" },
    });
  });

  it("rejects stale and no-op role changes", () => {
    expect(
      parseAdminTeamMutation({
        action: "CHANGE_ROLE",
        targetUid: "uid-1",
        targetEmail: "owner@example.com",
        expectedRole: "OWNER",
        role: "OWNER",
        confirmation: "owner@example.com",
        reason: "Updating administrator permissions.",
      }),
    ).toEqual({ ok: false, error: "Choose a different role before saving." });
  });

  it("counts only enabled owners for lockout protection", () => {
    expect(
      activeOwnerCount([
        {
          uid: "one",
          email: "one@example.com",
          role: "OWNER",
          disabled: false,
          createdAt: null,
          lastSignInAt: null,
          tokensValidAfter: null,
          factorCount: 0,
        },
        {
          uid: "two",
          email: "two@example.com",
          role: "OWNER",
          disabled: true,
          createdAt: null,
          lastSignInAt: null,
          tokensValidAfter: null,
          factorCount: 0,
        },
      ]),
    ).toBe(1);
  });
});
