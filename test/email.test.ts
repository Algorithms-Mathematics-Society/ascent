import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend: class { emails = { send: provider.send }; } }));
import { buildEmailMessage, emailJob, confirmationEmailId, decisionEmailId } from "../src/lib/email/messages";
import { getEmailConfig, sendResendEmail, ResendRejectedError } from "../src/lib/email/resend";

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("RESEND_FROM_EMAIL", ""); vi.stubEnv("SITE_URL", "https://ascent.amshq.in"); });
afterEach(() => vi.unstubAllEnvs());

describe("email configuration and templates", () => {
  it("stays disabled with placeholder credentials", () => {
    expect(getEmailConfig()).toBeNull();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    expect(getEmailConfig()).toBeNull();
    expect(provider.send).not.toHaveBeenCalled();
  });
  it("accepts a configured sender but rejects unsafe site links", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test"); vi.stubEnv("RESEND_FROM_EMAIL", "Ascent <notifications@amshq.in>");
    expect(getEmailConfig()?.from).toBe("Ascent <notifications@amshq.in>");
    vi.stubEnv("SITE_URL", "javascript:alert(1)"); expect(getEmailConfig()).toBeNull();
  });
  it("sends the reference and path without inventing candidate sign-in", () => {
    const message = buildEmailMessage(emailJob("REGISTRATION_CONFIRMATION", "candidate"), { reference: "ASC-TEST", qualificationPath: "QUALIFIER" }, "https://ascent.amshq.in");
    expect(message.text).toContain("ASC-TEST"); expect(message.text).toContain("Qualifier path");
    expect(message.text).not.toMatch(/password|magic link|sign in/i);
    expect(message.text).toContain("Status at submission: Received");
    expect(message.text).not.toContain("awaiting review");
  });
  it.each(["APPROVED", "WAITLISTED", "REJECTED"] as const)("renders a %s decision without internal reviewer notes", decision => {
    const message = buildEmailMessage({ ...emailJob("DECISION", "candidate"), decision, revision: 1 }, { reference: "ASC-TEST" }, "https://ascent.amshq.in");
    expect(message.text).toContain("ASC-TEST"); expect(message.subject).toContain("update");
    expect(message.text).not.toContain("qualification_reason");
  });
  it("uses one job per confirmation and one per decision revision", () => {
    expect(confirmationEmailId("a")).toBe(confirmationEmailId("a"));
    expect(decisionEmailId("a", 1)).not.toBe(decisionEmailId("a", 2));
  });
});

describe("Resend transport", () => {
  const payload = { from: "Ascent <notifications@amshq.in>", to: "test@example.test", replyTo: "partners@amshq.in", subject: "Test", text: "Test body", scheduledAt: "2026-09-24T00:30:00.000Z" };
  it("passes a stable idempotency key and schedule to the SDK", async () => {
    provider.send.mockResolvedValue({ data: { id: "resend-test" }, error: null });
    expect(await sendResendEmail("re_test", payload, "test-key")).toBe("resend-test");
    expect(provider.send).toHaveBeenCalledWith(payload, { idempotencyKey: "test-key" });
  });
  it("distinguishes a definite provider rejection from an ambiguous timeout", async () => {
    provider.send.mockResolvedValue({ error: { name: "rate_limit_exceeded", statusCode: 429, message: "Recipient test@example.test" } });
    await expect(sendResendEmail("re_test", payload, "test-key")).rejects.toBeInstanceOf(ResendRejectedError);
  });
});
