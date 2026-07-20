import { describe, it, expect } from "vitest";
import {
  normalizeCodeforcesHandle,
  normalizeEmail,
  normalizeGoogleDriveUrl,
  normalizeIndianPhone,
  validateLegalName,
  validateSubmissionToken,
} from "../src/lib/validators";

describe("validateLegalName", () => {
  it("accepts and normalizes Unicode names", () => {
    expect(validateLegalName("  साक्षी   शर्मा ")).toEqual({
      valid: true,
      normalized: "साक्षी शर्मा",
    });
    expect(validateLegalName("Élodie O’Connor").valid).toBe(true);
  });

  it("rejects implausible names and out-of-range lengths", () => {
    expect(validateLegalName("A").valid).toBe(false);
    expect(validateLegalName("A".repeat(101)).valid).toBe(false);
    expect(validateLegalName("Robert <script>").valid).toBe(false);
    expect(validateLegalName("User 123").valid).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases a valid address", () => {
    expect(normalizeEmail("  Student@Example.COM ")).toEqual({
      valid: true,
      normalized: "student@example.com",
    });
  });

  it("rejects invalid addresses", () => {
    expect(normalizeEmail("student@example").valid).toBe(false);
    expect(normalizeEmail("two words@example.com").valid).toBe(false);
    expect(normalizeEmail(`${"a".repeat(250)}@example.com`).valid).toBe(false);
  });
});

describe("validateSubmissionToken", () => {
  it("accepts a canonical UUID", () => {
    expect(
      validateSubmissionToken("5d46dc84-2bbb-4b7e-a8dc-1eb9de16c074"),
    ).toBe(true);
  });

  it("rejects arbitrary idempotency keys", () => {
    expect(validateSubmissionToken("not-a-uuid")).toBe(false);
  });
});

describe("normalizeCodeforcesHandle", () => {
  it("treats an empty handle as an intentional optional value", () => {
    expect(normalizeCodeforcesHandle("  ")).toEqual({
      valid: true,
      normalized: null,
    });
  });

  it("accepts and trims common Codeforces handles", () => {
    expect(normalizeCodeforcesHandle("  tourist  ")).toEqual({
      valid: true,
      normalized: "tourist",
    });
    expect(normalizeCodeforcesHandle("user.name-1").valid).toBe(true);
  });

  it("rejects invalid lengths and characters", () => {
    expect(normalizeCodeforcesHandle("ab").valid).toBe(false);
    expect(normalizeCodeforcesHandle("a".repeat(25)).valid).toBe(false);
    expect(normalizeCodeforcesHandle("tour ist").valid).toBe(false);
    expect(normalizeCodeforcesHandle("tour/ist").valid).toBe(false);
  });
});

describe("normalizeGoogleDriveUrl", () => {
  it("requires a resume link but permits a blank optional transcript", () => {
    expect(normalizeGoogleDriveUrl("", true).valid).toBe(false);
    expect(normalizeGoogleDriveUrl("", false)).toEqual({
      valid: true,
      normalized: null,
    });
  });

  it("accepts Drive file and Google Docs sharing links", () => {
    expect(
      normalizeGoogleDriveUrl(
        "http://drive.google.com/file/d/resume-file-id/view?usp=sharing#top",
        true,
      ),
    ).toEqual({
      valid: true,
      normalized:
        "https://drive.google.com/file/d/resume-file-id/view?usp=sharing",
    });
    expect(
      normalizeGoogleDriveUrl(
        "https://docs.google.com/document/d/resume-doc-id/edit?usp=sharing",
        true,
      ).valid,
    ).toBe(true);
    expect(
      normalizeGoogleDriveUrl(
        "drive.google.com/open?id=transcript-file-id",
        false,
      ).valid,
    ).toBe(true);
  });

  it("rejects non-Google URLs, folders, and bare Drive pages", () => {
    expect(
      normalizeGoogleDriveUrl("https://dropbox.com/resume.pdf", true).valid,
    ).toBe(false);
    expect(
      normalizeGoogleDriveUrl(
        "https://drive.google.com/drive/folders/folder-id",
        true,
      ).valid,
    ).toBe(false);
    expect(
      normalizeGoogleDriveUrl("https://drive.google.com/", true).valid,
    ).toBe(false);
  });
});

describe("normalizeIndianPhone", () => {
  it("normalizes a bare 10-digit number to E.164", () => {
    expect(normalizeIndianPhone("9876543210")).toEqual({
      valid: true,
      e164: "+919876543210",
    });
  });

  it("strips a leading 0", () => {
    expect(normalizeIndianPhone("09876543210")).toEqual({
      valid: true,
      e164: "+919876543210",
    });
  });

  it("strips a leading country code", () => {
    expect(normalizeIndianPhone("919876543210")).toEqual({
      valid: true,
      e164: "+919876543210",
    });
  });

  it("rejects a number not starting with 6-9", () => {
    const result = normalizeIndianPhone("5876543210");
    expect(result.valid).toBe(false);
  });

  it("rejects a too-short number", () => {
    const result = normalizeIndianPhone("98765");
    expect(result.valid).toBe(false);
  });
});
