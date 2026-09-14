import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { signStatusToken, verifyStatusToken, STATUS_TTL_SECONDS } from "../src/lib/candidate/tokens";
const emailHash = "a".repeat(64);
beforeEach(() => vi.stubEnv("CANDIDATE_STATUS_SECRET", "test-only-status-secret-with-at-least-32-characters"));
afterEach(() => vi.unstubAllEnvs());
describe("private status capabilities", () => {
  it("binds purpose, recipient and expiry with independent nonces", () => {
    const now = Date.now();
    const a = signStatusToken("link", "student", emailHash, now);
    const b = signStatusToken("link", "student", emailHash, now);
    expect(a.token).not.toBe(b.token);
    expect(verifyStatusToken(a.token, "link", now)).toEqual(a.claims);
    expect(verifyStatusToken(a.token, "session", now)).toBeNull();
    expect(verifyStatusToken(a.token, "link", now + STATUS_TTL_SECONDS * 1000)).toBeNull();
  });
  it("rejects tampering, malformed signatures and oversized input", () => {
    const { token } = signStatusToken("session", "student", emailHash);
    const [body, signature] = token.split(".");
    for (const invalid of [null, "", `${body}.bad`, `A${body.slice(1)}.${signature}`, `${token}.extra`, "x".repeat(1501)]) {
      expect(verifyStatusToken(invalid, "session")).toBeNull();
    }
  });
  it("fails closed without a strong secret and invalidates links after rotation", () => {
    const { token } = signStatusToken("link", "student", emailHash);
    vi.stubEnv("CANDIDATE_STATUS_SECRET", "short");
    expect(verifyStatusToken(token, "link")).toBeNull();
    expect(() => signStatusToken("link", "student", emailHash)).toThrow();
    vi.stubEnv("CANDIDATE_STATUS_SECRET", "a-different-independent-secret-of-32-characters");
    expect(verifyStatusToken(token, "link")).toBeNull();
  });
});
