import { describe, it, expect } from "vitest";
import { determinePath } from "../src/lib/qualificationEngine";

describe("determinePath", () => {
  it("AUTO_QUALIFY + VERIFIED -> AUTO", () => {
    expect(determinePath("AUTO_QUALIFY", "VERIFIED")).toEqual({
      path: "AUTO",
      reason: "verified tier-1 college",
    });
  });

  it("AUTO_QUALIFY + UNVERIFIED -> QUALIFIER, tier-1 claim unverified", () => {
    expect(determinePath("AUTO_QUALIFY", "UNVERIFIED")).toEqual({
      path: "QUALIFIER",
      reason: "tier-1 claim unverified",
    });
  });

  it("STANDARD + VERIFIED -> QUALIFIER, standard tier", () => {
    expect(determinePath("STANDARD", "VERIFIED")).toEqual({
      path: "QUALIFIER",
      reason: "standard tier",
    });
  });

  it("STANDARD + UNVERIFIED -> QUALIFIER, standard tier", () => {
    expect(determinePath("STANDARD", "UNVERIFIED")).toEqual({
      path: "QUALIFIER",
      reason: "standard tier",
    });
  });

  it("UNLISTED + UNVERIFIED -> QUALIFIER, unlisted college", () => {
    expect(determinePath("UNLISTED", "UNVERIFIED")).toEqual({
      path: "QUALIFIER",
      reason: "unlisted college",
    });
  });

  it("UNLISTED + VERIFIED -> QUALIFIER, unlisted college (verification is meaningless without a college)", () => {
    expect(determinePath("UNLISTED", "VERIFIED")).toEqual({
      path: "QUALIFIER",
      reason: "unlisted college",
    });
  });
});
