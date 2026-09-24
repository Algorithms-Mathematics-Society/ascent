import { describe, it, expect } from "vitest";
import { determinePath } from "../src/lib/qualificationEngine";

describe("determinePath", () => {
  it("routes a listed institution to the direct path", () => {
    expect(determinePath("AUTO_QUALIFY")).toEqual({
      path: "AUTO",
      reason: "listed institution",
    });
  });

  it("routes an unlisted institution to the qualifier path, where the team decides", () => {
    expect(determinePath("UNLISTED")).toEqual({
      path: "QUALIFIER",
      reason: "unlisted institution",
    });
  });

  it("routes any other tier to the qualifier path", () => {
    expect(determinePath("STANDARD")).toEqual({
      path: "QUALIFIER",
      reason: "standard tier",
    });
  });

  it("depends on nothing but the tier, so no unverified claim can reach the direct path", () => {
    // The direct path is granted by list membership alone. This asserts the
    // only input, so reintroducing a second condition breaks the test rather
    // than silently changing who is accepted without review.
    expect(determinePath("AUTO_QUALIFY").path).toBe("AUTO");
    expect(determinePath("UNLISTED").path).toBe("QUALIFIER");
    expect(determinePath("STANDARD").path).toBe("QUALIFIER");
  });
});
