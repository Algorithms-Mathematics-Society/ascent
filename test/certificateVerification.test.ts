import { describe, expect, it } from "vitest";
import { CERTIFICATE_VERIFICATIONS, findCertificateVerification,
  getVerificationContext, normalizeVerificationCode } from "@/content/certificateVerifications";
import { ROUND_ONE_SELECTION_COUNT } from "@/lib/results";

describe("certificate verification records", () => {
  it("covers all 133 selected ranks exactly once", () => {
    const published = CERTIFICATE_VERIFICATIONS.filter((entry) => !entry.additional);
    expect(published.map((entry) => entry.rank)).toEqual(Array.from({ length: ROUND_ONE_SELECTION_COUNT }, (_, index) => index + 1));
    expect(new Set(CERTIFICATE_VERIFICATIONS.map((entry) => entry.code)).size).toBe(CERTIFICATE_VERIFICATIONS.length);
  });

  it("verifies additional qualifiers without claiming a top-133 percentile", () => {
    expect(findCertificateVerification("prn3kaxy")).toEqual({ rank: 135, code: "PRN3-KAXY", additional: true });
    expect(CERTIFICATE_VERIFICATIONS.filter((entry) => entry.additional).every((entry) => entry.rank > ROUND_ONE_SELECTION_COUNT)).toBe(true);
    expect(getVerificationContext(135)).toEqual({ topPercent: null, distinction: "Round 2 qualifier" });
  });

  it("matches codes case-insensitively with or without the hyphen", () => {
    expect(normalizeVerificationCode(" 5jhtg97d ")).toBe("5JHT-G97D");
    expect(findCertificateVerification("5jht-g97d")).toEqual({ rank: 1, code: "5JHT-G97D" });
    expect(findCertificateVerification("g4qem8bh")).toEqual({ rank: 133, code: "G4QE-M8BH" });
  });

  it("fails closed for unknown or malformed codes", () => {
    expect(findCertificateVerification("XXXX-XXXX")).toBeNull();
    expect(findCertificateVerification("5JHT-G97")).toBeNull();
  });

  it("describes rank only within the selected cohort", () => {
    expect(getVerificationContext(1)).toEqual({ topPercent: 1, distinction: "Top 10 published rank" });
    expect(getVerificationContext(25)).toEqual({ topPercent: 19, distinction: "Top 25 published rank" });
    expect(getVerificationContext(133)).toEqual({ topPercent: 100, distinction: "Round 2 qualifier" });
  });
});
