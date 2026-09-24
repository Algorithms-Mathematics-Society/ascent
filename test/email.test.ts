import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ send: vi.fn(), constructorError: null as Error | null }));
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend: class { constructor() { if (provider.constructorError) throw provider.constructorError; } emails = { send: provider.send }; } }));
import { buildEmailMessage, emailJob, confirmationEmailId, decisionEmailId } from "../src/lib/email/messages";
import { getEmailConfig, sendResendEmail, ResendRejectedError, safeEmailErrorCode } from "../src/lib/email/resend";

beforeEach(() => { vi.resetAllMocks(); provider.constructorError = null; vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("RESEND_FROM_EMAIL", ""); vi.stubEnv("SITE_URL", "https://ascent.amshq.in"); });
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
  it.each(["re_first\nre_second", "re_first re_second", "Bearer re_test", "[SENSITIVE]", "re_test\r\nInjected: header"])("rejects malformed API-key configuration without calling the SDK", apiKey => {
    vi.stubEnv("RESEND_API_KEY", apiKey); vi.stubEnv("RESEND_FROM_EMAIL", "Ascent <notifications@amshq.in>");
    expect(getEmailConfig()).toBeNull();
    expect(provider.send).not.toHaveBeenCalled();
  });
  it("tells an accepted candidate they are through, without inventing candidate sign-in", () => {
    const message = buildEmailMessage(emailJob("REGISTRATION_CONFIRMATION", "candidate"), { reference: "ASC-TEST", adminDecision: "APPROVED" }, "https://ascent.amshq.in");
    expect(message.text).toContain("ASC-TEST");
    expect(message.text).toContain("Status: Accepted");
    expect(message.text).toContain("Round 1");
    expect(message.text).not.toContain("Under review");
    expect(message.text).not.toMatch(/password|magic link|sign in/i);
  });
  it("tells a reviewed candidate a decision is coming, and claims no outcome", () => {
    const message = buildEmailMessage(emailJob("REGISTRATION_CONFIRMATION", "candidate"), { reference: "ASC-TEST", adminDecision: "PENDING" }, "https://ascent.amshq.in");
    expect(message.text).toContain("ASC-TEST");
    expect(message.text).toContain("Status: Under review");
    expect(message.text).not.toContain("Accepted");
    expect(message.text).not.toMatch(/password|magic link|sign in/i);
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
  it("rejects malformed credentials before constructing provider headers", async () => {
    await expect(sendResendEmail("re_first\nre_second", payload, "test-key")).rejects.toThrow("invalid_email_configuration");
    expect(provider.send).not.toHaveBeenCalled();
  });
  it("redacts constructor errors before any send attempt", async () => {
    provider.constructorError = new Error('Headers.append: "Bearer re_PRIVATE_TEST_SECRET"');
    await expect(sendResendEmail("re_test", payload, "test-key")).rejects.toThrow(/^provider_transport_error$/);
    expect(provider.send).not.toHaveBeenCalled();
  });
  it.each([false, true])("redacts SDK exceptions that echo credentials or recipient data (sync: %s)", async synchronous => {
    const failure = new Error('Headers.append: "Bearer re_PRIVATE_TEST_SECRET\nRecipient test@example.test"');
    if (synchronous) provider.send.mockImplementation(() => { throw failure; });
    else provider.send.mockRejectedValue(failure);
    await expect(sendResendEmail("re_test", payload, "test-key")).rejects.toThrow(/^provider_transport_error$/);
  });
  it("allowlists error codes at both provider and persistence boundaries", async () => {
    const sensitive = "re_PRIVATE_TEST_SECRET recipient@example.test";
    provider.send.mockResolvedValue({ error: { name: sensitive, statusCode: 429, message: sensitive } });
    await expect(sendResendEmail("re_test", payload, "test-key")).rejects.toThrow(/^provider_error$/);
    expect(safeEmailErrorCode(new Error(sensitive))).toBe("provider_transport_error");
    expect(safeEmailErrorCode(new Error("provider_timeout"))).toBe("provider_timeout");
    expect(new ResendRejectedError(sensitive, 429).message).toBe("provider_error");
  });
  it("distinguishes a definite provider rejection from an ambiguous timeout", async () => {
    provider.send.mockResolvedValue({ error: { name: "rate_limit_exceeded", statusCode: 429, message: "Recipient test@example.test" } });
    await expect(sendResendEmail("re_test", payload, "test-key")).rejects.toBeInstanceOf(ResendRejectedError);
  });
});
