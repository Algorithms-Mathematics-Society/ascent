import { describe, it, expect } from "vitest";
import {
  normalizeCodeforcesHandle,
  normalizeEmail,
  normalizeGoogleDriveUrl,
  normalizeApacPhone,
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

  it("tells a student who pasted a folder which link to fetch instead", () => {
    const folderError =
      "That is a link to a folder. Open the file inside it, then copy that file's share link.";
    for (const link of [
      "https://drive.google.com/drive/folders/1FolderId",
      "https://drive.google.com/drive/folders/1FolderId?usp=sharing",
      "https://drive.google.com/drive/folders/1FolderId?usp=drive_link",
      "https://drive.google.com/drive/u/0/folders/1FolderId",
      "https://drive.google.com/drive/u/12/folders/1FolderId",
      "drive.google.com/drive/folders/1FolderId",
    ]) {
      expect(normalizeGoogleDriveUrl(link, true)).toEqual({
        valid: false,
        normalized: null,
        error: folderError,
      });
    }
  });

  it("tells a student who pasted a Drive listing page rather than a file", () => {
    const listingError =
      "That is a link to Drive itself, not to a file. Open the file, then copy its share link.";
    for (const link of [
      "https://drive.google.com/",
      "https://drive.google.com/drive/my-drive",
      "https://drive.google.com/drive/u/0/my-drive",
      "https://drive.google.com/drive/home",
      "https://drive.google.com/drive/recent",
      "https://drive.google.com/drive/shared-with-me",
    ]) {
      expect(normalizeGoogleDriveUrl(link, true).error).toBe(listingError);
    }
  });

  it("tells a student who pasted a download URL to share the file instead", () => {
    const downloadError =
      "That is a download link, not a sharing link. Open the file in Drive, then copy its share link.";
    for (const link of [
      "https://drive.usercontent.google.com/download?id=1FileId&export=download",
      "https://lh3.googleusercontent.com/d/1FileId",
      "https://doc-0s-8c-docs.googleusercontent.com/docs/securesc/abc/def",
    ]) {
      expect(normalizeGoogleDriveUrl(link, true).error).toBe(downloadError);
    }
  });

  it("accepts an address-bar link carrying a signed-in account index and drops it", () => {
    expect(
      normalizeGoogleDriveUrl(
        "https://docs.google.com/document/u/0/d/1DocId/edit?usp=sharing",
        true,
      ),
    ).toEqual({
      valid: true,
      normalized: "https://docs.google.com/document/d/1DocId/edit?usp=sharing",
    });
    expect(
      normalizeGoogleDriveUrl(
        "https://drive.google.com/drive/u/1/file/d/1FileId/view",
        true,
      ),
    ).toEqual({
      valid: true,
      normalized: "https://drive.google.com/file/d/1FileId/view",
    });
    expect(
      normalizeGoogleDriveUrl("https://drive.google.com/u/2/open?id=1FileId", true),
    ).toEqual({
      valid: true,
      normalized: "https://drive.google.com/open?id=1FileId",
    });
    expect(
      normalizeGoogleDriveUrl(
        "https://docs.google.com/u/0/spreadsheets/d/1SheetId/edit",
        true,
      ),
    ).toEqual({
      valid: true,
      normalized: "https://docs.google.com/spreadsheets/d/1SheetId/edit",
    });
  });

  it("leaves an already canonical link byte for byte alone", () => {
    for (const link of [
      "https://drive.google.com/file/d/1FileId/view?usp=sharing",
      "https://drive.google.com/file/d/1FileId/view?usp=drive_link",
      "https://drive.google.com/file/d/1FileId/view?usp=sharing&resourcekey=0-abc",
      "https://drive.google.com/uc?id=1FileId&export=download",
      "https://docs.google.com/presentation/d/1DeckId/edit",
    ]) {
      expect(normalizeGoogleDriveUrl(link, true)).toEqual({
        valid: true,
        normalized: link,
      });
    }
  });

  it("keeps the generic message for input it cannot place", () => {
    const generic = "Paste a valid Google Drive sharing link.";
    for (const link of [
      "https://dropbox.com/s/resume.pdf",
      "https://bit.ly/my-resume",
      "https://drive.google.com.evil.example/file/d/1FileId/view",
      "not a url at all",
      "https://docs.google.com/forms/d/1FormId/viewform",
    ]) {
      expect(normalizeGoogleDriveUrl(link, true).error).toBe(generic);
    }
  });

  it("gates every specific message on the real host, not on the path", () => {
    // The userinfo before the @ is not the host. A folder path under an
    // attacker host must stay unrecognised rather than be described back to
    // the student as though it were a Drive folder.
    for (const link of [
      "https://drive.google.com@evil.example/drive/folders/1FolderId",
      "https://evil.example/drive/folders/1FolderId",
      "https://evil.example/drive/my-drive",
      "https://googleusercontent.com.evil.example/d/1FileId",
    ]) {
      const result = normalizeGoogleDriveUrl(link, true);
      expect(result.valid).toBe(false);
      expect(result.normalized).toBe(null);
      expect(result.error).toBe("Paste a valid Google Drive sharing link.");
    }
  });

  it("never returns a normalized link off the two allowed hosts", () => {
    for (const link of [
      "https://drive.google.com/file/d/1FileId/view",
      "https://docs.google.com/document/d/1DocId/edit",
      "https://drive.google.com@evil.example/file/d/1FileId/view",
      "https://evil.example/file/d/1FileId/view",
      "//evil.example/file/d/1FileId/view",
      "javascript:alert(1)//drive.google.com/file/d/1FileId/view",
    ]) {
      const result = normalizeGoogleDriveUrl(link, true);
      if (result.normalized !== null) {
        expect(new URL(result.normalized).protocol).toBe("https:");
        expect(["drive.google.com", "docs.google.com"]).toContain(
          new URL(result.normalized).hostname,
        );
      }
    }
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

describe("normalizeApacPhone", () => {
  it("keeps an Indian mobile whose own digits start with the country code", () => {
    // 9123456789 is a valid 10-digit mobile that happens to begin 91. Reading
    // those two digits as the country code left 23456789 and rejected it.
    expect(normalizeApacPhone("9123456789", "91")).toEqual({
      valid: true,
      e164: "+919123456789",
    });
    expect(normalizeApacPhone("9198765432", "91")).toEqual({
      valid: true,
      e164: "+919198765432",
    });
    expect(normalizeApacPhone("09123456789", "91")).toEqual({
      valid: true,
      e164: "+919123456789",
    });
  });

  it("still strips a country code the candidate typed in front of it", () => {
    expect(normalizeApacPhone("919123456789", "91")).toEqual({
      valid: true,
      e164: "+919123456789",
    });
    expect(normalizeApacPhone("919876543210", "91")).toEqual({
      valid: true,
      e164: "+919876543210",
    });
    expect(normalizeApacPhone("+91 9123456789", "91")).toEqual({
      valid: true,
      e164: "+919123456789",
    });
  });

  it("normalizes selected APAC mobile numbers to E.164", () => {
    expect(normalizeApacPhone("0412 345 678", "61")).toEqual({
      valid: true,
      e164: "+61412345678",
    });
    expect(normalizeApacPhone("8123 4567", "65")).toEqual({
      valid: true,
      e164: "+6581234567",
    });
    expect(normalizeApacPhone("090-1234-5678", "81")).toEqual({
      valid: true,
      e164: "+819012345678",
    });
  });

  it("accepts a complete APAC E.164 number on the server boundary", () => {
    expect(normalizeApacPhone("+639171234567")).toEqual({
      valid: true,
      e164: "+639171234567",
    });
  });

  it("rejects an invalid selected country code and too-short numbers", () => {
    expect(normalizeApacPhone("1234567", "44").valid).toBe(false);
    expect(normalizeApacPhone("1234", "65").valid).toBe(false);
  });
});
});
