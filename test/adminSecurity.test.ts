import { describe, expect, it } from "vitest";
import {
  ADMIN_RECENT_SIGN_IN_SECONDS,
  hasAdminClaim,
  isRecentAuthentication,
  requestHasSameOrigin,
  secureTokenEqual,
} from "../src/lib/adminSecurity";

describe("admin security helpers", () => {
  it("accepts only the explicit admin claim", () => {
    expect(hasAdminClaim({ ascent_admin: true })).toBe(true);
    expect(hasAdminClaim({ ascent_admin: false })).toBe(false);
    expect(hasAdminClaim({ admin: true })).toBe(false);
  });

  it("requires a recent authentication time", () => {
    const now = 1_800_000_000;
    expect(isRecentAuthentication(now, now)).toBe(true);
    expect(isRecentAuthentication(now - ADMIN_RECENT_SIGN_IN_SECONDS, now)).toBe(true);
    expect(isRecentAuthentication(now - ADMIN_RECENT_SIGN_IN_SECONDS - 1, now)).toBe(false);
    expect(isRecentAuthentication(now + 61, now)).toBe(false);
    expect(isRecentAuthentication(undefined, now)).toBe(false);
  });

  it("compares CSRF tokens without accepting length or value mismatches", () => {
    expect(secureTokenEqual("abc123", "abc123")).toBe(true);
    expect(secureTokenEqual("abc123", "abc124")).toBe(false);
    expect(secureTokenEqual("short", "a-longer-token")).toBe(false);
  });

  it("accepts only requests whose origin matches the served host", () => {
    const sameOrigin = new Request("https://ascent.amshq.in/api/admin/session", {
      headers: { origin: "https://ascent.amshq.in" },
    });
    const foreignOrigin = new Request("https://ascent.amshq.in/api/admin/session", {
      headers: { origin: "https://attacker.example" },
    });
    const wrongProtocol = new Request("https://ascent.amshq.in/api/admin/session", {
      headers: { origin: "http://ascent.amshq.in" },
    });
    expect(requestHasSameOrigin(sameOrigin)).toBe(true);
    expect(requestHasSameOrigin(foreignOrigin)).toBe(false);
    expect(requestHasSameOrigin(wrongProtocol)).toBe(false);
  });
});
