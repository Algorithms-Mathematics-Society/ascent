import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")) {
    throw new Error("Email delivery tests require a local Firestore emulator.");
  }
  process.env.FIREBASE_PROJECT_ID = "demo-ascent-email";
  process.env.GCP_PROJECT_NUMBER = "";
  return { send: vi.fn() };
});
vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));

import { adminDb } from "../src/lib/firebaseAdmin";
import { deliverEmail } from "../src/lib/email/delivery";
import { processEmailQueue } from "../src/lib/email/worker";
import { EMAIL_OUTBOX, emailJob, confirmationEmailId, reminderEmailId, decisionEmailId } from "../src/lib/email/messages";
import { REGISTRATION_OPENS_AT } from "../src/lib/registrationLaunch";

beforeEach(async () => {
  const result = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-ascent-email/databases/(default)/documents`, { method: "DELETE" });
  if (!result.ok) throw new Error("Could not clear isolated email emulator project.");
  vi.stubEnv("RESEND_API_KEY", "re_test_mock_only");
  vi.stubEnv("RESEND_FROM_EMAIL", "Ascent <notifications@example.test>");
  vi.stubEnv("RESEND_REPLY_TO", "support@example.test");
  vi.stubEnv("SITE_URL", "https://ascent.example.test");
  send.mockReset().mockResolvedValue({ data: { id: "mock-provider-id" }, error: null });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function confirmation() {
  await adminDb.collection("applications").doc("student").set({ reference: "ASC-TEST12", state: "SUBMITTED", qualification_path: "QUALIFIER" });
  await adminDb.collection("pii").doc("student").set({ email: "student@example.test" });
  const id = confirmationEmailId("student");
  await adminDb.collection(EMAIL_OUTBOX).doc(id).set(emailJob("REGISTRATION_CONFIRMATION", "student"));
  return id;
}
const jobRef = (id: string) => adminDb.collection(EMAIL_OUTBOX).doc(id);

describe("durable email delivery with real Firestore and mocked Resend", () => {
  it("keeps jobs pending while configuration is absent", async () => {
    const id = await confirmation();
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await deliverEmail(id)).toBe("DISABLED");
    expect((await jobRef(id).get()).data()?.status).toBe("PENDING");
    expect(send).not.toHaveBeenCalled();
  });

  it("leases one message across 20 concurrent delivery attempts", async () => {
    const id = await confirmation();
    const results = await Promise.all(Array.from({ length: 20 }, () => deliverEmail(id)));
    expect(results.filter(result => result === "SENT")).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].text).toContain("ASC-TEST12");
    expect((await jobRef(id).get()).data()?.attempts).toBe(1);
  }, 30000);

  it("retries an ambiguous response with the identical payload and idempotency key", async () => {
    const id = await confirmation();
    send.mockResolvedValueOnce({ data: null, error: { name: "application_error", statusCode: 500 } });
    expect(await deliverEmail(id)).toBe("RETRY");
    const firstCall = send.mock.calls[0];
    vi.stubEnv("RESEND_FROM_EMAIL", "changed@example.test");
    await jobRef(id).update({ due_at: 0 });
    expect(await deliverEmail(id)).toBe("SENT");
    expect(send.mock.calls[1]).toEqual(firstCall);
  });

  it("recovers an expired worker lease using the previous provider key", async () => {
    const id = await confirmation();
    send.mockResolvedValueOnce({ data: null, error: { name: "application_error", statusCode: 500 } });
    await deliverEmail(id);
    await jobRef(id).update({ status: "SENDING", lease: "crashed-worker", due_at: 0 });
    expect(await deliverEmail(id)).toBe("SENT");
    expect(send.mock.calls[1]).toEqual(send.mock.calls[0]);
  });

  it("requires review rather than resend outside the provider idempotency window", async () => {
    const id = await confirmation();
    await jobRef(id).update({ status: "SENDING", first_attempt_at: Date.now() - 24 * 3600000, due_at: 0, uncertain: true });
    await deliverEmail(id);
    expect((await jobRef(id).get()).data()?.status).toBe("REVIEW");
    expect(send).not.toHaveBeenCalled();
  });

  it("can retry a definite rejection on the next daily run with a fresh key", async () => {
    const id = await confirmation();
    send.mockResolvedValueOnce({ data: null, error: { name: "rate_limit_exceeded", statusCode: 429 } });
    expect(await deliverEmail(id)).toBe("RETRY");
    expect((await jobRef(id).get()).data()).toMatchObject({ first_attempt_at: null, payload: null, uncertain: false, generation: 1 });
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 25 * 3600000);
    expect(await deliverEmail(id)).toBe("SENT");
    expect(send.mock.calls[1][1].idempotencyKey).not.toBe(send.mock.calls[0][1].idempotencyKey);
  });

  it("schedules opening reminders with Resend before registration opens", async () => {
    const now = Date.parse(REGISTRATION_OPENS_AT) - 10 * 86400000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    await adminDb.collection("registration_reminders").doc("reminder").set({ email: "student@example.test" });
    const id = reminderEmailId("reminder");
    await jobRef(id).set(emailJob("REGISTRATION_REMINDER", "reminder"));
    expect(await deliverEmail(id)).toBe("SCHEDULED");
    expect(send.mock.calls[0][0].scheduledAt).toBe(new Date(REGISTRATION_OPENS_AT).toISOString());
  });

  it("skips a superseded decision before attempting delivery", async () => {
    await confirmation();
    const id = decisionEmailId("student", 1);
    await jobRef(id).set({ ...emailJob("DECISION", "student"), decision: "REJECTED", revision: 1 });
    await adminDb.collection("admin_registration_decisions").doc("student").set({ decision: "APPROVED", revision: 2 });
    expect(await deliverEmail(id)).toBe("SKIPPED");
    expect((await jobRef(id).get()).data()?.status).toBe("SKIPPED");
    expect(send).not.toHaveBeenCalled();
  });

  it("does not retry an older decision after a corrected decision is recorded", async () => {
    await confirmation();
    const id = decisionEmailId("student", 1);
    await jobRef(id).set({ ...emailJob("DECISION", "student"), decision: "REJECTED", revision: 1 });
    const latest = adminDb.collection("admin_registration_decisions").doc("student");
    await latest.set({ decision: "REJECTED", revision: 1 });
    send.mockResolvedValueOnce({ data: null, error: { name: "application_error", statusCode: 500 } });
    expect(await deliverEmail(id)).toBe("RETRY");
    await latest.set({ decision: "APPROVED", revision: 2 });
    await jobRef(id).update({ due_at: 0 });
    expect(await deliverEmail(id)).toBe("REVIEW");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each(["DELETED", "WITHDRAWN", "missing application", "missing pii"])("does not reuse frozen recipient data after %s", async state => {
    const id = await confirmation();
    send.mockResolvedValueOnce({ data: null, error: { name: "application_error", statusCode: 500 } });
    await deliverEmail(id);
    if (state === "missing application") await adminDb.collection("applications").doc("student").delete();
    else if (state === "missing pii") await adminDb.collection("pii").doc("student").delete();
    else await adminDb.collection("applications").doc("student").update({ state });
    await jobRef(id).update({ due_at: 0 });
    expect(await deliverEmail(id)).toBe("REVIEW");
    expect(send).toHaveBeenCalledTimes(1);
    expect((await jobRef(id).get()).data()?.payload).toBeNull();
  });

  it("isolates a permanently invalid message so the worker can send later messages", async () => {
    const id = await confirmation();
    await jobRef(id).update({ due_at: 1 });
    await adminDb.collection("applications").doc("second").set({ reference: "ASC-SECOND", state: "SUBMITTED" });
    await adminDb.collection("pii").doc("second").set({ email: "second@example.test" });
    const second = confirmationEmailId("second");
    await jobRef(second).set(emailJob("REGISTRATION_CONFIRMATION", "second"));
    send.mockResolvedValueOnce({ data: null, error: { name: "validation_error", statusCode: 422 } });
    await processEmailQueue();
    expect((await jobRef(id).get()).data()?.status).toBe("REVIEW");
    expect((await jobRef(second).get()).data()?.status).toBe("SENT");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("backfills old reminder records once and excludes simultaneous workers", async () => {
    await adminDb.collection("registration_reminders").doc("legacy").set({ email: "legacy@example.test" });
    const results = await Promise.all([processEmailQueue(), processEmailQueue()]);
    expect(results.filter(result => result.busy)).toHaveLength(1);
    await processEmailQueue();
    expect((await adminDb.collection(EMAIL_OUTBOX).count().get()).data().count).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  }, 30000);
});
