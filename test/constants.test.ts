import { describe, it, expect } from "vitest";
import {
  EDITION,
  MAX_RESUME_BYTES,
  IP_RATE_LIMIT_MAX_PER_HOUR,
  IDENTIFIER_RATE_LIMIT_MAX,
  IDENTIFIER_RATE_LIMIT_WINDOW_MS,
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from "../src/lib/constants";

describe("constants", () => {
  it("defines the current edition", () => {
    expect(EDITION).toBe("ascent-2026");
  });

  it("caps the resume upload at 500KB", () => {
    expect(MAX_RESUME_BYTES).toBe(500 * 1024);
  });

  it("defines rate limit windows", () => {
    expect(IP_RATE_LIMIT_MAX_PER_HOUR).toBe(10);
    expect(IDENTIFIER_RATE_LIMIT_MAX).toBe(3);
    expect(IDENTIFIER_RATE_LIMIT_WINDOW_MS).toBe(30 * 60 * 1000);
  });

  it("defines the session cookie name and max age", () => {
    expect(SESSION_COOKIE_NAME).toBe("ascent_session");
    expect(SESSION_COOKIE_MAX_AGE_MS).toBe(5 * 24 * 60 * 60 * 1000);
  });
});
