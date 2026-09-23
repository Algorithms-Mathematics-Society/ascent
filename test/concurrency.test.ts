import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

vi.hoisted(() => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || "")) {
    throw new Error("Concurrency tests require a local Firestore emulator.");
  }
  process.env.FIREBASE_PROJECT_ID = "demo-ascent-concurrency";
  process.env.GCP_PROJECT_NUMBER = "";
  process.env.RESEND_API_KEY = "";
  process.env.RESEND_FROM_EMAIL = "";
});
vi.mock("@/lib/botProtection", () => ({ verifyBot: vi.fn(async () => ({ ok: true })) }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/registrationLaunch", async (importOriginal) => ({ ...(await importOriginal<typeof import("../src/lib/registrationLaunch")>()), registrationHasOpened: () => true }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminSessionValue: async () => ({ uid: "test-owner", email: "owner@example.test", role: "OWNER" }) }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }, genReqId: () => "test", maskEmail: () => "masked" }));

import { verifyBot } from "../src/lib/botProtection";
import { PRIVACY_VERSION, TERMS_VERSION, PARTICIPATION_NOTICE } from "../src/content/legal";
import { adminDb } from "../src/lib/firebaseAdmin";
import { POST as remind } from "../src/app/api/reminders/route";
import { POST as register } from "../src/app/api/register/route";
import { PATCH as decision } from "../src/app/api/admin/registrations/[id]/decision/route";
import { PATCH as bulkDecision } from "../src/app/api/admin/registrations/bulk-decision/route";
import { PATCH as settings } from "../src/app/api/admin/settings/registration/route";
import { checkSlidingWindow, consumeSlidingWindow, sha256 } from "../src/lib/rateLimit";
import { getRegistrationSettings } from "../src/lib/registrationSettingsData";
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE } from "../src/lib/adminSecurity";

beforeEach(async () => {
  vi.mocked(verifyBot).mockResolvedValue({ ok: true });
  const result = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-ascent-concurrency/databases/(default)/documents`, { method: "DELETE" });
  if (!result.ok) throw new Error("Could not clear isolated emulator project.");
  await adminDb.collection("admin_config").doc("registration").set({ is_open: true, capacity: null, accepted_count: 0, revision: 0 });
});
const count = async (name: string) => (await adminDb.collection(name).count().get()).data().count;
function reminder(email: string, ip: string) {
  return new NextRequest("https://ascent.test/api/reminders", { method: "POST", headers: { origin: "https://ascent.test", "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ email, consent: true, policyVersion: PRIVACY_VERSION, botToken: "test-token" }) });
}
function registration(index: number, token = randomUUID(), email = `student${index}@example.test`) {
  const form = new FormData();
  Object.entries({ submission_token: token, legal_name: "Test Student", email, phone: `+9198${String(index).padStart(8, "0")}`, education_stage: "UNIVERSITY", graduation_year: "2027", unlisted_name: "Test University", resume_url: "https://drive.google.com/file/d/test-resume/view", contest_consent: "true", terms_accepted: "true", policy_version: PRIVACY_VERSION, terms_version: TERMS_VERSION, bot_token: "test-token" }).forEach(([key, value]) => form.set(key, value));
  return new NextRequest("https://ascent.test/api/register", { method: "POST", headers: { origin: "https://ascent.test", host: "ascent.test", "x-forwarded-for": `192.0.2.${index}` }, body: form });
}
function settingsRequest(capacity: number | null, isOpen: boolean, revision: number) {
  return new NextRequest("https://ascent.test/api/admin/settings/registration", {
    method: "PATCH", headers: { origin: "https://ascent.test", "content-type": "application/json", "x-csrf-token": "test-csrf", cookie: `${ADMIN_CSRF_COOKIE}=test-csrf; ${ADMIN_SESSION_COOKIE}=test-session` },
    body: JSON.stringify({ capacity, isOpen, expectedRevision: revision, deadline: null, retentionDays: 365, reason: "Testing capacity transitions safely", confirmation: "CLOSE_REGISTRATION", csrfToken: "test-csrf" }),
  });
}

function decisionRequest(body: Record<string, unknown>) {
  return new NextRequest("https://ascent.test/api/admin/registrations/bulk-decision", {
    method: "PATCH", headers: { origin: "https://ascent.test", "content-type": "application/json", "x-csrf-token": "test-csrf", cookie: `${ADMIN_CSRF_COOKIE}=test-csrf; ${ADMIN_SESSION_COOKIE}=test-session` },
    body: JSON.stringify({ ...body, csrfToken: "test-csrf" }),
  });
}

describe("concurrent submissions against real Firestore transactions", () => {
  it("records a corrected decision without leaving the first one behind", async () => {
    const id = randomUUID();
    await adminDb.collection("applications").doc(id).set({ admin_decision: "PENDING" });
    await adminDb.collection("pii").doc(id).set({ email: "test@example.test", legal_name: "Test Student" });
    expect((await decision(decisionRequest({ decision: "APPROVED", expectedDecision: "PENDING" }), { params: { id } })).status).toBe(200);
    expect((await decision(decisionRequest({ decision: "REJECTED", expectedDecision: "APPROVED", reason: "Corrected after review" }), { params: { id } })).status).toBe(200);
    expect((await adminDb.collection("applications").doc(id).get()).data()?.admin_decision).toBe("REJECTED");
  });

  it("commits only one decision email when admins decide the same application concurrently", async () => {
    const id = randomUUID();
    await adminDb.collection("applications").doc(id).set({ admin_decision: "PENDING" });
    const responses = await Promise.all(Array.from({ length: 10 }, () => decision(decisionRequest({ decision: "APPROVED", expectedDecision: "PENDING" }), { params: { id } })));
    expect(responses.filter(r => r.status === 200)).toHaveLength(1);
    expect(responses.filter(r => r.status === 409)).toHaveLength(9);
    expect(await count("email_outbox")).toBe(1);
  }, 60000);

  it("commits bulk decisions and their emails together", async () => {
    const ids = Array.from({ length: 25 }, () => randomUUID());
    await Promise.all(ids.map(id => adminDb.collection("applications").doc(id).set({ admin_decision: "PENDING" })));
    const body = { applicationIds: ids, decision: "WAITLISTED", reason: "Test batch decision reason" };
    expect((await bulkDecision(decisionRequest(body))).status).toBe(200);
    expect(await count("email_outbox")).toBe(25);
    expect((await bulkDecision(decisionRequest(body))).status).toBe(409);
    expect(await count("email_outbox")).toBe(25);
  }, 60000);

  it("saves 40 distinct reminders concurrently, including one shared campus IP", async () => {
    const started = performance.now();
    const responses = await Promise.all(Array.from({ length: 40 }, (_, i) => remind(reminder(`student${i}@example.test`, "192.0.2.1"))));
    expect(responses.map(r => r.status)).toEqual(Array(40).fill(200));
    expect(await count("registration_reminders")).toBe(40);
    console.log(`40 concurrent reminder requests: ${Math.round(performance.now() - started)} ms total`);
  }, 60000);

  it("deduplicates 20 concurrent reminder requests for one email", async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => remind(reminder("same@example.test", `192.0.2.${i}`))));
    expect(responses.map(r => r.status)).toEqual(Array(20).fill(200));
    expect(await count("registration_reminders")).toBe(1);
  }, 60000);

  it("does not overrun the reminder limit during a burst", async () => {
    await adminDb.collection("_rate_limits_reminders").doc(sha256("192.0.2.1")).set({ timestamps: Array(115).fill(Date.now()) });
    const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => remind(reminder(`burst${i}@example.test`, "192.0.2.1"))));
    expect(responses.filter(r => r.status === 200)).toHaveLength(5);
    expect(responses.filter(r => r.status === 429)).toHaveLength(15);
    expect(await count("registration_reminders")).toBe(5);
  }, 60000);

  it("preserves every concurrent rate-limit failure and bounds request admission", async () => {
    const checks = await Promise.all(Array.from({ length: 20 }, () => checkSlidingWindow(adminDb, "_rate_limits", "failures", 30, 60000)));
    await Promise.all(checks.map(check => check.recordFailure()));
    expect((await adminDb.collection("_rate_limits").doc("failures").get()).data()!.timestamps).toHaveLength(20);
    const admissions = await Promise.all(Array.from({ length: 20 }, () => consumeSlidingWindow(adminDb, "_rate_limits", "admissions", 5, 60000)));
    expect(admissions.filter(result => !result.overLimit)).toHaveLength(5);
  }, 60000);

  it("commits 40 registrations without a shared unlimited counter write", async () => {
    const started = performance.now();
    const responses = await Promise.all(Array.from({ length: 40 }, (_, i) => register(registration(i))));
    expect(responses.map(r => r.status)).toEqual(Array(40).fill(200));
    for (const collection of ["applications", "pii", "consent", "emails", "phones", "registration_submissions", "email_outbox"]) expect(await count(collection)).toBe(40);
    expect((await adminDb.collection("admin_config").doc("registration").get()).data()!.accepted_count).toBe(0);
    expect((await getRegistrationSettings()).acceptedCount).toBe(40);
    const consent = await adminDb.collection("consent").get();
    for (const record of consent.docs) expect(record.data()).toMatchObject({
      CONTEST_PARTICIPATION: { granted: true, policy_version: PRIVACY_VERSION, notice: PARTICIPATION_NOTICE },
      TERMS_ACCEPTANCE: { accepted: true, version: TERMS_VERSION },
    });
    console.log(`40 concurrent registrations: ${Math.round(performance.now() - started)} ms total`);
  }, 60000);

  it.each(["terms_accepted", "policy_version", "terms_version"])("rejects outdated or missing %s before saving", async field => {
    const original = registration(1);
    const form = await original.formData(); form.set(field, "old");
    const response = await register(new NextRequest(original.url, { method: "POST", headers: { origin: "https://ascent.test", host: "ascent.test" }, body: form }));
    expect(response.status).toBe(400);
    expect(await count("applications")).toBe(0);
    expect(await count("email_outbox")).toBe(0);
  });
  it("rejects a failed bot check before registration or mail creation", async () => {
    vi.mocked(verifyBot).mockResolvedValue({ ok: false, status: 400, error: "Invalid verification" });
    expect((await register(registration(1))).status).toBe(400);
    expect(await count("applications")).toBe(0);
    expect(await count("email_outbox")).toBe(0);
  });

  it("returns one receipt for 20 concurrent retries of a registration", async () => {
    const token = randomUUID();
    const responses = await Promise.all(Array.from({ length: 20 }, () => register(registration(1, token))));
    expect(responses.map(r => r.status)).toEqual(Array(20).fill(200));
    const bodies = await Promise.all(responses.map(r => r.json()));
    expect(new Set(bodies.map(body => body.reference)).size).toBe(1);
    expect(await count("applications")).toBe(1);
  }, 60000);

  it("admits one registration when different requests compete for the same email", async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => register(registration(i, randomUUID(), "same@example.test"))));
    expect(responses.filter(r => r.status === 200)).toHaveLength(1);
    expect(responses.filter(r => r.status === 409)).toHaveLength(19);
    expect(await count("applications")).toBe(1);
  }, 60000);

  it("never exceeds configured capacity during concurrent registration", async () => {
    await adminDb.collection("admin_config").doc("registration").update({ capacity: 5 });
    const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => register(registration(i))));
    expect(responses.filter(r => r.status === 200)).toHaveLength(5);
    expect(responses.filter(r => r.status === 423)).toHaveLength(15);
    expect(await count("applications")).toBe(5);
    expect((await getRegistrationSettings()).acceptedCount).toBe(5);
  }, 60000);

  it("requires a pause before enabling capacity and initializes the existing count", async () => {
    expect((await register(registration(1))).status).toBe(200);
    expect((await settings(settingsRequest(5, true, 0))).status).toBe(409);
    expect((await settings(settingsRequest(null, false, 0))).status).toBe(200);
    expect((await register(registration(2))).status).toBe(423);
    expect((await settings(settingsRequest(5, true, 1))).status).toBe(200);
    expect((await getRegistrationSettings()).acceptedCount).toBe(1);
    expect((await register(registration(2))).status).toBe(200);
    expect((await getRegistrationSettings()).acceptedCount).toBe(2);
  }, 60000);
  it("rejects a capacity reduction below the transaction's newer accepted count", async () => {
    // The aggregation preflight can lag registrations committed before the
    // settings transaction. The transaction's counter must take precedence.
    await adminDb.collection("admin_config").doc("registration").update({ capacity: 20, accepted_count: 10 });
    expect((await settings(settingsRequest(5, true, 0))).status).toBe(409);
    expect((await getRegistrationSettings()).capacity).toBe(20);
  });

});
