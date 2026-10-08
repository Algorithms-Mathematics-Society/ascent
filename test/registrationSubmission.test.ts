import { describe, expect, it } from "vitest";
import {
  registrationRejectionAllowsEditing,
  registrationRetryBody,
  snapshotRegistrationSubmission,
} from "@/components/register/registrationSubmission";

function originalRequest() {
  const body = new FormData();
  body.set("email", "original@example.com");
  body.set("phone", "+919876543210");
  body.set("resume_url", "https://drive.google.com/file/d/original/view");
  body.set("contest_consent", "true");
  body.set("terms_accepted", "true");
  body.set("submission_token", "same-attempt-token");
  body.set("bot_token", "used-token");
  return body;
}

describe("registration recovery preserves the original entry", () => {
  it("freezes the submitted email, answers and token even if the source is edited", () => {
    const body = originalRequest();
    const submitted = snapshotRegistrationSubmission(body);
    body.set("email", "edited@example.com");
    body.set("submission_token", "different-attempt");
    body.set("resume_url", "https://drive.google.com/file/d/edited/view");
    const retry = registrationRetryBody(submitted, "fresh-bot-token");
    expect(submitted.email).toBe("original@example.com");
    expect(retry.get("email")).toBe("original@example.com");
    expect(retry.get("submission_token")).toBe("same-attempt-token");
    expect(retry.get("resume_url")).toBe("https://drive.google.com/file/d/original/view");
    expect(retry.get("contest_consent")).toBe("true");
    expect(retry.get("terms_accepted")).toBe("true");
    expect(Object.isFrozen(submitted.fields)).toBe(true);
  });

  it("uses a fresh verification token for every retry without changing saved answers", () => {
    const submitted = snapshotRegistrationSubmission(originalRequest());
    const firstRetry = registrationRetryBody(submitted, "new-bot-1");
    firstRetry.set("email", "mutated@example.com");
    const secondRetry = registrationRetryBody(submitted, "new-bot-2");
    expect(secondRetry.get("email")).toBe("original@example.com");
    expect(secondRetry.get("bot_token")).toBe("new-bot-2");
    expect(submitted.fields.some(([key]) => key === "bot_token")).toBe(false);
  });

  it("allows correction of a definite first rejection", () => {
    expect(registrationRejectionAllowsEditing(400, { success: false, error: "Invalid email" }, false)).toBe(true);
  });

  it("allows corrections after a confirmed pre-submission service failure", () => {
    for (const status of [500, 503]) {
      expect(registrationRejectionAllowsEditing(status, {
        success: false,
        error: "Verification is temporarily unavailable.",
        submission_outcome: "not_created",
      }, false)).toBe(true);
    }
  });

  it("does not use a later request's outcome to unlock an earlier uncertain submission", () => {
    for (const status of [400, 500, 503]) {
      expect(registrationRejectionAllowsEditing(status, {
        success: false,
        error: "This request was rejected before submission.",
        submission_outcome: "not_created",
      }, true)).toBe(false);
    }
  });

  it("does not trust unknown outcomes or a success-shaped failure", () => {
    expect(registrationRejectionAllowsEditing(503, {
      success: false, error: "Unavailable", submission_outcome: "unknown",
    }, false)).toBe(false);
    expect(registrationRejectionAllowsEditing(503, {
      success: true, error: "Unavailable", submission_outcome: "not_created",
    }, false)).toBe(false);
  });

  it("does not unlock after a later 4xx if an earlier request may have committed", () => {
    for (const status of [400, 403, 409, 429]) {
      expect(registrationRejectionAllowsEditing(status, { success: false, error: "Rejected" }, true)).toBe(false);
    }
  });

  it("treats server errors and malformed responses as uncertain", () => {
    expect(registrationRejectionAllowsEditing(500, { success: false, error: "Failed" }, false)).toBe(false);
    expect(registrationRejectionAllowsEditing(400, {}, false)).toBe(false);
    expect(registrationRejectionAllowsEditing(200, { success: false, error: "Failed" }, false)).toBe(false);
  });
});
