/**
 * Pushing approved registrants into AMS Access.
 *
 * The property these protect: a registrant who is approved here must become a
 * person there, exactly once, or not appear to have been synced at all. The
 * outbox exists because an HTTP call cannot join a Firestore transaction —
 * made inside, a retry re-sends it; made after, a crash between commit and
 * call loses the registrant silently.
 */

import { describe, expect, it } from "vitest";
import { buildPayload, shouldSync, SYNCABLE_DECISIONS } from "../src/lib/amsSync";

const APPLICATION = {
  codeforces_handle: "ayushs",
  college_id: "iitb",
  college_name: "IIT Bombay",
  college_tier: "tier-1",
  college_verification_status: "VERIFIED",
  education_stage: "undergraduate",
  current_study_level: "3",
  graduation_year: 2027,
  branch: "Computer Science",
};

const PII = {
  legal_name: "Ayush Shukla",
  email: "Hawwyush@Example.test",
  phone: "+911234567890",
  linkedin_url: "https://linkedin.com/in/ayush",
  github_url: "",
  resume_url: "https://example.test/r.pdf",
  transcript_url: "https://example.test/t.pdf",
};

const CONSENT = {
  CONTEST_PARTICIPATION: {
    granted: true,
    policy_version: "v1",
    granted_at: new Date("2026-09-01T10:00:00Z"),
  },
};

function build(overrides: { app?: object; pii?: object; consent?: object } = {}) {
  return buildPayload(
    "ascent-2026-0001",
    { ...APPLICATION, ...(overrides.app ?? {}) },
    { ...PII, ...(overrides.pii ?? {}) },
    { ...CONSENT, ...(overrides.consent ?? {}) },
  );
}

describe("which decisions sync", () => {
  it("approved and waitlisted cross", () => {
    // Waitlisted included deliberately: somebody promoted on contest morning
    // must already exist, and provisioning under time pressure is how
    // mistakes happen.
    expect(shouldSync("APPROVED")).toBe(true);
    expect(shouldSync("WAITLISTED")).toBe(true);
    expect([...SYNCABLE_DECISIONS]).toEqual(["APPROVED", "WAITLISTED"]);
  });

  it("rejected never crosses", () => {
    // There is no reason to copy the personal data of somebody who will not
    // compete, and every reason not to.
    expect(shouldSync("REJECTED")).toBe(false);
    expect(shouldSync("PENDING")).toBe(false);
    expect(shouldSync(undefined)).toBe(false);
    expect(shouldSync(null)).toBe(false);
  });
});

describe("assembling a payload from three collections", () => {
  it("takes the person from pii and the rest from the application", () => {
    const payload = build();
    if ("error" in payload) throw new Error(payload.error);

    expect(payload.subject_id).toBe("ascent-2026-0001");
    expect(payload.display_name).toBe("Ayush Shukla");
    expect(payload.codeforces_handle).toBe("ayushs");
    expect(payload.graduation_year).toBe(2027);
    expect(payload.college_verification_status).toBe("VERIFIED");
  });

  it("lowercases the email, because it is the merge key on the far side", () => {
    // AMS matches a returning competitor on email. A capitalised copy would
    // create a second person for the same human — the exact failure the
    // directory exists to prevent.
    const payload = build();
    if ("error" in payload) throw new Error(payload.error);
    expect(payload.email).toBe("hawwyush@example.test");
  });

  it("prefers the college name over its id", () => {
    const payload = build();
    if ("error" in payload) throw new Error(payload.error);
    expect(payload.college).toBe("IIT Bombay");
  });

  it("falls back to the college id when no name was recorded", () => {
    const payload = build({ app: { college_name: "" } });
    if ("error" in payload) throw new Error(payload.error);
    expect(payload.college).toBe("iitb");
  });

  it("carries the consent grant, version and time", () => {
    // The legal basis for holding any of the rest. "They consented" is not
    // answerable without knowing to what and when.
    const payload = build();
    if ("error" in payload) throw new Error(payload.error);
    expect(payload.consent_version).toBe("v1");
    expect(payload.consent_granted_at).toBe("2026-09-01T10:00:00.000Z");
  });

  it("reads a Firestore Timestamp as readily as a Date", () => {
    // Timestamps come back as Timestamp, Date or ISO string depending on how
    // they were written and by which SDK.
    const payload = build({
      consent: {
        CONTEST_PARTICIPATION: {
          policy_version: "v2",
          granted_at: { toDate: () => new Date("2026-01-02T03:04:05Z") },
        },
      },
    });
    if ("error" in payload) throw new Error(payload.error);
    expect(payload.consent_granted_at).toBe("2026-01-02T03:04:05.000Z");
  });

  it("reads year_of_study from either field it may have been written to", () => {
    const fromLevel = build();
    if ("error" in fromLevel) throw new Error(fromLevel.error);
    expect(fromLevel.year_of_study).toBe("3");

    const explicit = build({ app: { year_of_study: "4" } });
    if ("error" in explicit) throw new Error(explicit.error);
    expect(explicit.year_of_study).toBe("4");
  });

  it("sends empty strings, not undefined, for what was never filled in", () => {
    const payload = build();
    if ("error" in payload) throw new Error(payload.error);
    expect(payload.github_url).toBe("");
  });

  it("tolerates missing documents rather than throwing", () => {
    // A consent document that was never written must not take down a whole
    // drain batch.
    const payload = buildPayload("s1", APPLICATION, PII, undefined);
    if ("error" in payload) throw new Error(payload.error);
    expect(payload.consent_version).toBe("");
    expect(payload.consent_granted_at).toBeNull();
  });
});

describe("refusing to send something the far side will reject", () => {
  it("an email-less record is an error, not a request", () => {
    // Learning a record is incomplete from a remote 422 is a much worse way
    // to learn it, and it burns a send doing so.
    const payload = buildPayload("s1", APPLICATION, { ...PII, email: "" }, CONSENT);
    expect("error" in payload && payload.error).toMatch(/email/);
  });

  it("a nameless record is an error too", () => {
    const payload = buildPayload("s1", APPLICATION, { ...PII, legal_name: "" }, CONSENT);
    expect("error" in payload && payload.error).toMatch(/legal_name/);
  });

  it("a missing pii document is caught rather than sent as blanks", () => {
    const payload = buildPayload("s1", APPLICATION, undefined, CONSENT);
    expect("error" in payload).toBe(true);
  });
});
