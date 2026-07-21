import { describe, expect, it } from "vitest";
import {
  normalizeAdminTags,
  parseAdminNoteInput,
  parseAdminTagsInput,
} from "../src/lib/adminOperations";

describe("admin operations validation", () => {
  it("normalizes controlled tags deterministically", () => {
    expect(
      normalizeAdminTags([
        "NEEDS_FOLLOW_UP",
        "HIGH_PRIORITY",
        "NEEDS_FOLLOW_UP",
        "UNKNOWN",
      ]),
    ).toEqual(["HIGH_PRIORITY", "NEEDS_FOLLOW_UP"]);
  });

  it("accepts a trimmed multiline private note", () => {
    expect(
      parseAdminNoteInput({
        note: "  Verify transcript.\r\nApplicant replied.  ",
        expectedRevision: 2,
      }),
    ).toEqual({
      ok: true,
      value: {
        note: "Verify transcript.\nApplicant replied.",
        expectedRevision: 2,
      },
    });
  });

  it("rejects empty notes and stale-shaped revisions", () => {
    expect(parseAdminNoteInput({ note: " ", expectedRevision: 0 }).ok).toBe(
      false,
    );
    expect(parseAdminNoteInput({ note: "Valid", expectedRevision: -1 }).ok).toBe(
      false,
    );
  });

  it("rejects unknown tags rather than silently persisting them", () => {
    expect(
      parseAdminTagsInput({ tags: ["HIGH_PRIORITY", "UNKNOWN"], expectedRevision: 0 }),
    ).toEqual({ ok: false, error: "Choose valid operational tags." });
  });

  it("accepts an empty tag set for clearing the record", () => {
    expect(parseAdminTagsInput({ tags: [], expectedRevision: 4 })).toEqual({
      ok: true,
      value: { tags: [], expectedRevision: 4 },
    });
  });
});
