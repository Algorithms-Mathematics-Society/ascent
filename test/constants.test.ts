import { describe, it, expect } from "vitest";
import {
  EDITION,
  IP_RATE_LIMIT_MAX_PER_HOUR,
  IDENTIFIER_RATE_LIMIT_MAX,
  IDENTIFIER_RATE_LIMIT_WINDOW_MS,
} from "../src/lib/constants";

describe("constants", () => {
  it("defines the current edition", () => {
    expect(EDITION).toBe("ascent-2026");
  });

  it("defines rate limit windows", () => {
    expect(IP_RATE_LIMIT_MAX_PER_HOUR).toBe(10);
    expect(IDENTIFIER_RATE_LIMIT_MAX).toBe(3);
    expect(IDENTIFIER_RATE_LIMIT_WINDOW_MS).toBe(30 * 60 * 1000);
  });
});
