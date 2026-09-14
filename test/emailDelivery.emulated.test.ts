import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { send, background } = vi.hoisted(() => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")) {
    throw new Error("Email delivery tests require a local Firestore emulator.");
  }
  process.env.FIREBASE_PROJECT_ID = "demo-ascent-email";
  process.env.GCP_PROJECT_NUMBER = "";
  return { send: vi.fn(), background: [] as Promise<unknown>[] };
});
vi.mock("server-only", () => ({}));
vi.mock("@vercel/functions", () => ({ waitUntil: (promise: Promise<unknown>) => background.push(promise) }));
vi.mock("@/lib/botProtection", () => ({ verifyBot: vi.fn(async () => ({ ok: true })), clientIp: () => "192.0.2.1" }));
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));

import { NextRequest } from "next/server";
import { POST as requestStatusLink } from "../src/app/api/register/status/link/route";
import { POST as exchangeStatusLink, DELETE as closeStatus } from "../src/app/api/register/status/session/route";
import { GET as readStatus } from "../src/app/api/register/status/route";
import { getCandidateStatus } from "../src/lib/candidate/status";
import { signStatusToken, STATUS_COOKIE } from "../src/lib/candidate/tokens";
import { sha256 } from "../src/lib/rateLimit";
import { EDITION } from "../src/lib/constants";
import { verifyBot } from "../src/lib/botProtection";
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
  background.length = 0;
  vi.stubEnv("CANDIDATE_STATUS_SECRET", "test-only-status-secret-at-least-32-characters");
  vi.mocked(verifyBot).mockResolvedValue({ ok: true });
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

function statusRequest(body: unknown, extraHeaders: Record<string, string> = {}) {
  return new NextRequest("https://ascent.example.test/api/register/status/link", { method: "POST", headers: {
    origin: "https://ascent.example.test", "content-type": "application/json", ...extraHeaders,
  }, body: JSON.stringify(body) });
}
async function seedStatus() {
  await adminDb.collection("applications").doc("student").set({ reference: "ASC-TEST12", state: "QUALIFICATION_DETERMINED", admin_decision: "PENDING", qualification_path: "AUTO", college_verification_status: "UNVERIFIED", private_field: "Never reveal" });
  await adminDb.collection("pii").doc("student").set({ email: "student@example.test", phone: "+919876543210", resume_url: "https://private.test" });
  await adminDb.collection("emails").doc(`${EDITION}_${sha256("student@example.test")}`).set({ subject_id: "student" });
}
async function emailStatusLink() {
  await seedStatus();
  expect((await requestStatusLink(statusRequest({ email: "student@example.test", botToken: "mock-token" }))).status).toBe(202);
  await Promise.all(background);
  const token = send.mock.calls[0][0].text.match(/#token=([A-Za-z0-9_.-]+)/)?.[1];
  expect(token).toBeTruthy();
  return token as string;
}

describe("candidate status without accounts", () => {
  it("returns the same response for registered and unknown emails, sending only to the registered mailbox", async () => {
    await seedStatus();
    const known = await requestStatusLink(statusRequest({ email: "student@example.test", botToken: "mock-token" }));
    const unknown = await requestStatusLink(statusRequest({ email: "unknown@example.test", botToken: "mock-token" }));
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await known.json()).toEqual(await unknown.json());
    await Promise.all(background);
    expect(send).toHaveBeenCalledTimes(1);
    const jobs = await adminDb.collection(EMAIL_OUTBOX).get();
    expect(jobs.docs.map(doc => doc.data().status).sort()).toEqual(["SENT", "SKIPPED"]);
    expect(jobs.docs.every(doc => doc.data().request_email === null)).toBe(true);
  });
  it("consumes a link only once across concurrent exchanges and returns a private, minimal status", async () => {
    const token = await emailStatusLink();
    const responses = await Promise.all(Array.from({ length: 10 }, () => exchangeStatusLink(statusRequest({ token }))));
    expect(responses.filter(response => response.status === 200)).toHaveLength(1);
    expect(responses.filter(response => response.status === 401)).toHaveLength(9);
    const accepted = responses.find(response => response.status === 200)!;
    const cookie = accepted.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    const response = await readStatus(new NextRequest("https://ascent.example.test/api/register/status", { headers: { cookie } }));
    expect(response.headers.get("cache-control")).toContain("no-store");
    const result = await response.json();
    expect(result.entry).toMatchObject({ reference: "ASC-TEST12", state: "RECEIVED", qualificationPath: "QUALIFIER", collegeVerified: false });
    expect(Object.keys(result.entry).sort()).toEqual(["collegeVerified", "qualificationPath", "reference", "roundOneDate", "state"]);
    expect(JSON.stringify(result)).not.toContain("student@example.test");
    expect((await readStatus(new NextRequest("https://ascent.example.test/api/register/status"))).status).toBe(401);
    expect((await closeStatus(new NextRequest("https://ascent.example.test/api/register/status/session", { method: "DELETE", headers: { origin: "https://ascent.example.test" } }))).headers.get("set-cookie")).toContain("Max-Age=0");
  }, 30000);
  it("does not consume credentials on a cross-origin request", async () => {
    const token = await emailStatusLink();
    expect((await exchangeStatusLink(statusRequest({ token }, { origin: "https://other.test" }))).status).toBe(403);
    expect((await exchangeStatusLink(statusRequest({ token }))).status).toBe(200);
  });
  it.each(["DELETED", "email changed"])("revokes link and session access when %s", async change => {
    const token = await emailStatusLink();
    const session = signStatusToken("session", "student", sha256("student@example.test")).token;
    if (change === "DELETED") await adminDb.collection("applications").doc("student").update({ state: "DELETED" });
    else await adminDb.collection("pii").doc("student").update({ email: "changed@example.test" });
    expect((await exchangeStatusLink(statusRequest({ token }))).status).toBe(401);
    expect(await getCandidateStatus(session)).toBeNull();
  });
  it("reports review, decisions and verified qualification without private review notes", async () => {
    await seedStatus();
    const session = signStatusToken("session", "student", sha256("student@example.test")).token;
    await adminDb.collection("admin_registration_operations").doc("student").set({ revision: 1, reason: "Private concern", tags: ["HIGH_PRIORITY"] });
    expect((await getCandidateStatus(session))?.state).toBe("UNDER_REVIEW");
    for (const decision of ["APPROVED", "WAITLISTED", "REJECTED"]) {
      await adminDb.collection("applications").doc("student").update({ admin_decision: decision, college_verification_status: "VERIFIED" });
      const entry = await getCandidateStatus(session);
      expect(entry).toMatchObject({ state: decision, qualificationPath: "AUTO", collegeVerified: true });
      expect(JSON.stringify(entry)).not.toContain("Private concern");
    }
    await adminDb.collection("applications").doc("student").update({ state: "WITHDRAWN" });
    expect((await getCandidateStatus(session))?.state).toBe("WITHDRAWN");
  });
  it("deduplicates concurrent email requests and caps repeated mailbox requests", async () => {
    await seedStatus();
    const responses = await Promise.all(Array.from({ length: 10 }, () => requestStatusLink(statusRequest({ email: "student@example.test", botToken: "mock-token" }))));
    expect(responses.map(response => response.status)).toEqual(Array(10).fill(202));
    await Promise.all(background);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await adminDb.collection(EMAIL_OUTBOX).get()).size).toBe(1);
  }, 30000);
  it("does not queue email on failed verification or missing configuration", async () => {
    vi.mocked(verifyBot).mockResolvedValue({ ok: false, status: 400, error: "Invalid check" });
    expect((await requestStatusLink(statusRequest({ email: "student@example.test", botToken: "bad" }))).status).toBe(400);
    vi.stubEnv("CANDIDATE_STATUS_SECRET", "");
    expect((await requestStatusLink(statusRequest({ email: "student@example.test", botToken: "mock-token" }))).status).toBe(503);
    expect((await adminDb.collection(EMAIL_OUTBOX).get()).empty).toBe(true);
  });
  it("retains delivery uncertainty when an attempted status request later expires", async () => {
    await seedStatus();
    const id = "uncertain-status";
    await jobRef(id).set({ ...emailJob("STATUS_ACCESS", sha256("student@example.test")), request_email: "student@example.test", request_expires_at: Date.now() + 15 * 60000 });
    send.mockResolvedValueOnce({ data: null, error: { name: "application_error", statusCode: 500 } });
    expect(await deliverEmail(id)).toBe("RETRY");
    await jobRef(id).update({ due_at: 0, request_expires_at: Date.now() - 1 });
    expect(await deliverEmail(id)).toBe("REVIEW");
    expect(send).toHaveBeenCalledTimes(1);
    expect((await jobRef(id).get()).data()?.last_error).toContain("may have been accepted");
  });

  it("does not email an expired queued access request on the daily cron", async () => {
    await seedStatus();
    const id = "expired-status";
    await jobRef(id).set({ ...emailJob("STATUS_ACCESS", sha256("student@example.test")), request_email: "student@example.test", request_expires_at: Date.now() - 1 });
    expect(await deliverEmail(id)).toBe("SKIPPED");
    expect(send).not.toHaveBeenCalled();
    expect((await adminDb.collection("candidate_access_tokens").get()).empty).toBe(true);
  });
  it("rejects malformed, expired and oversized token requests", async () => {
    const old = signStatusToken("link", "student", sha256("student@example.test"), Date.now() - 21 * 60000).token;
    expect((await exchangeStatusLink(statusRequest({ token: old }))).status).toBe(401);
    expect((await exchangeStatusLink(statusRequest({ token: "x".repeat(3000) }))).status).toBe(413);
    expect((await exchangeStatusLink(new NextRequest("https://ascent.example.test/api/register/status/session", { method: "POST", headers: { origin: "https://ascent.example.test", "content-type": "application/json" }, body: "{" }))).status).toBe(400);
    expect((await adminDb.collection("candidate_access_tokens").get()).empty).toBe(true);
  });
});
