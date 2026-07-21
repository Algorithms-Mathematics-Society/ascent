import { describe, expect, it } from "vitest";
import {
  activeOwnerCount,
  adminMfaReadiness,
  ownerRecoveryReadiness,
  parseAdminTeamMutation,
  type AdminTeamMember,
} from "../src/lib/adminTeam";

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
          emailVerified: true,
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
          emailVerified: true,
          createdAt: null,
          lastSignInAt: null,
          tokensValidAfter: null,
          factorCount: 0,
        },
      ]),
    ).toBe(1);
  });

  it("requires two verified owners with successful sign-ins for recovery readiness", () => {
    const owner = (
      uid: string,
      values: Partial<AdminTeamMember> = {},
    ): AdminTeamMember => ({
      uid,
      email: `${uid}@example.com`,
      role: "OWNER",
      disabled: false,
      emailVerified: true,
      createdAt: null,
      lastSignInAt: "2026-07-21T10:00:00.000Z",
      tokensValidAfter: null,
      factorCount: 0,
      ...values,
    });
    expect(ownerRecoveryReadiness([owner("one")]).state).toBe(
      "SECOND_OWNER_REQUIRED",
    );
    expect(
      ownerRecoveryReadiness([
        owner("one"),
        owner("two", { emailVerified: false }),
      ]).state,
    ).toBe("EMAIL_VERIFICATION_REQUIRED");
    expect(
      ownerRecoveryReadiness([
        owner("one"),
        owner("two", { lastSignInAt: null }),
      ]).state,
    ).toBe("SIGN_IN_DRILL_REQUIRED");
    expect(ownerRecoveryReadiness([owner("one"), owner("two")])).toMatchObject({
      state: "READY",
      enabledOwners: 2,
      verifiedOwners: 2,
      testedOwners: 2,
    });
  });

  it("blocks MFA enforcement until two owners and every admin are enrolled", () => {
    const member = (
      uid: string,
      role: AdminTeamMember["role"],
      factorCount: number,
    ): AdminTeamMember => ({
      uid,
      email: `${uid}@example.com`,
      role,
      disabled: false,
      emailVerified: true,
      createdAt: null,
      lastSignInAt: "2026-07-21T10:00:00.000Z",
      tokensValidAfter: null,
      factorCount,
    });

    expect(adminMfaReadiness([member("one", "OWNER", 1)])).toMatchObject({
      state: "OWNER_REDUNDANCY_REQUIRED",
    });
    expect(
      adminMfaReadiness([
        member("one", "OWNER", 1),
        member("two", "OWNER", 0),
      ]),
    ).toMatchObject({
      state: "OWNER_ENROLLMENT_REQUIRED",
      enrolledOwners: 1,
      enabledOwners: 2,
    });
    expect(
      adminMfaReadiness([
        member("one", "OWNER", 1),
        member("two", "OWNER", 1),
        member("reviewer", "REVIEWER", 0),
      ]),
    ).toMatchObject({ state: "ADMIN_ENROLLMENT_REQUIRED" });
    expect(
      adminMfaReadiness([
        member("one", "OWNER", 1),
        member("two", "OWNER", 1),
        member("reviewer", "REVIEWER", 1),
      ]),
    ).toMatchObject({
      state: "READY",
      enrolledAdmins: 3,
      enabledAdmins: 3,
    });
  });
});
