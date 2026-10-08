import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PRIVACY_VERSION, TERMS_VERSION } from "../src/content/legal";

const mocks = vi.hoisted(() => ({
  verifyBot: vi.fn(),
  receiptGet: vi.fn(),
  collection: vi.fn(),
  runTransaction: vi.fn(),
  availability: vi.fn(),
  checkSlidingWindow: vi.fn(),
  recordFailure: vi.fn(),
  deliverEmail: vi.fn(),
  transactionSet: vi.fn(),
  transactionCreate: vi.fn(),
}));

// The route runs against inert references and explicit mocks. It never imports
// Firebase credentials, contacts Cloudflare, delivers mail, or writes entries.
vi.mock("@/lib/firebaseAdmin", () => ({
  adminServerTimestamp: () => "test-server-timestamp",
  adminDb: { collection: mocks.collection, runTransaction: mocks.runTransaction },
}));
vi.mock("@/lib/botProtection", () => ({ verifyBot: mocks.verifyBot }));
vi.mock("@/lib/registrationSettingsData", () => ({
  getRegistrationAvailability: mocks.availability,
  PUBLIC_REGISTRATION_AVAILABILITY_CACHE_TAG: "test-registration-availability",
}));
vi.mock("@/lib/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/rateLimit")>()),
  checkSlidingWindow: mocks.checkSlidingWindow,
}));
vi.mock("@/lib/registrationLaunch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/registrationLaunch")>()),
  registrationHasOpened: () => true,
}));
vi.mock("@/lib/email/delivery", () => ({ tryDeliverEmail: mocks.deliverEmail }));
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  genReqId: () => "test-registration-failure",
  maskEmail: () => "masked@example.test",
}));

import { POST } from "../src/app/api/register/route";

const emptySnapshot = () => ({ exists: false, data: () => undefined });

function registration(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const fields = {
    submission_token: "8c7c1768-3287-46ec-b082-22b3258cedc2",
    legal_name: "Test Student",
    email: "student@example.test",
    phone: "+919876543210",
    education_stage: "UNIVERSITY",
    graduation_year: "2027",
    unlisted_name: "Test University",
    resume_url: "https://drive.google.com/file/d/test-resume/view",
    contest_consent: "true",
    terms_accepted: "true",
    policy_version: PRIVACY_VERSION,
    terms_version: TERMS_VERSION,
    bot_token: "test-verification-token",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new NextRequest("https://ascent.example.test/api/register", {
    method: "POST",
    headers: {
      origin: "https://ascent.example.test",
      host: "ascent.example.test",
      "x-forwarded-for": "192.0.2.1",
    },
    body: form,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external request in isolated route test"); }));
  mocks.verifyBot.mockResolvedValue({ ok: true });
  mocks.receiptGet.mockResolvedValue(emptySnapshot());
  mocks.collection.mockImplementation((name: string) => ({
    doc: (id: string) => ({ path: `${name}/${id}`, get: mocks.receiptGet }),
  }));
  mocks.availability.mockResolvedValue({
    settings: {},
    availability: { acceptsRegistrations: true, reason: "OPEN", message: "Registration is open." },
  });
  mocks.recordFailure.mockResolvedValue(undefined);
  mocks.checkSlidingWindow.mockResolvedValue({ overLimit: false, recordFailure: mocks.recordFailure });
  mocks.deliverEmail.mockResolvedValue("DISABLED");
  mocks.runTransaction.mockRejectedValue(new Error("Entry transaction result is unknown"));
});
afterEach(() => vi.unstubAllGlobals());

async function expectNotCreated(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ success: false, submission_outcome: "not_created" });
  expect(mocks.runTransaction).not.toHaveBeenCalled();
  expect(mocks.deliverEmail).not.toHaveBeenCalled();
}

describe("registration failure outcome before any entry transaction", () => {
  it("marks an unavailable bot verifier without reading a receipt or entering a transaction", async () => {
    mocks.verifyBot.mockResolvedValue({ ok: false, status: 503, error: "Verification is temporarily unavailable." });
    await expectNotCreated(await POST(registration()), 503);
    expect(mocks.collection).not.toHaveBeenCalled();
    expect(mocks.receiptGet).not.toHaveBeenCalled();
    expect(mocks.availability).not.toHaveBeenCalled();
  });

  it("marks a failed idempotency lookup before creating an entry", async () => {
    mocks.receiptGet.mockRejectedValueOnce(new Error("Receipt lookup unavailable"));
    await expectNotCreated(await POST(registration()), 500);
    expect(mocks.receiptGet).toHaveBeenCalledOnce();
    expect(mocks.collection).toHaveBeenCalledWith("registration_submissions");
    expect(mocks.availability).not.toHaveBeenCalled();
  });

  it("marks unavailable registration controls after an empty receipt lookup", async () => {
    mocks.availability.mockRejectedValueOnce(new Error("Registration controls unavailable"));
    await expectNotCreated(await POST(registration()), 503);
    expect(mocks.receiptGet).toHaveBeenCalledOnce();
    expect(mocks.checkSlidingWindow).not.toHaveBeenCalled();
  });

  it("marks an identifier rate-limit lookup failure", async () => {
    mocks.checkSlidingWindow.mockResolvedValueOnce({ overLimit: false, recordFailure: mocks.recordFailure });
    mocks.checkSlidingWindow.mockRejectedValueOnce(new Error("Identifier lookup unavailable"));
    await expectNotCreated(await POST(registration()), 500);
  });

  it.each([
    ["legal_name", "A"],
    ["resume_url", "https://drive.google.com/open?id="],
  ])("marks a rejected %s field without entering a transaction", async (field, value) => {
    const response = await POST(registration({ [field]: value }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      success: false,
      field,
      submission_outcome: "not_created",
    });
    expect(mocks.runTransaction).not.toHaveBeenCalled();
    expect(mocks.deliverEmail).not.toHaveBeenCalled();
  });
});

describe("an attempted entry transaction can still have an uncertain outcome", () => {
  it("marks an explicit transaction rejection that queued no entry writes", async () => {
    mocks.runTransaction.mockImplementationOnce(async (callback) => callback({
      get: vi.fn(async (ref: { path: string }) => ref.path === "admin_config/registration"
        ? { exists: true, data: () => ({ is_open: false }) }
        : emptySnapshot()),
      set: mocks.transactionSet,
      create: mocks.transactionCreate,
      update: vi.fn(),
    }));
    const response = await POST(registration());
    expect(response.status).toBe(423);
    expect(await response.json()).toMatchObject({ success: false, submission_outcome: "not_created" });
    expect(mocks.runTransaction).toHaveBeenCalledOnce();
    expect(mocks.transactionSet).not.toHaveBeenCalled();
    expect(mocks.transactionCreate).not.toHaveBeenCalled();
    expect(mocks.deliverEmail).not.toHaveBeenCalled();
  });

  it("does not mark a transaction exception even if the recovery read is empty", async () => {
    // Exercise the real transaction callback through its queued entry writes,
    // then simulate losing the commit acknowledgement. No writes are persisted.
    mocks.runTransaction.mockImplementationOnce(async (callback) => {
      await callback({
        get: vi.fn(async () => emptySnapshot()),
        set: mocks.transactionSet,
        create: mocks.transactionCreate,
        update: vi.fn(),
      });
      throw new Error("Commit acknowledgement lost");
    });
    const response = await POST(registration());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body).not.toHaveProperty("submission_outcome");
    expect(mocks.runTransaction).toHaveBeenCalledOnce();
    expect(mocks.transactionSet.mock.calls.some(([ref]) => ref.path.startsWith("applications/"))).toBe(true);
    expect(mocks.receiptGet).toHaveBeenCalledTimes(2);
    expect(mocks.deliverEmail).not.toHaveBeenCalled();
  });

  it("does not mark a transaction exception when its recovery lookup also fails", async () => {
    mocks.receiptGet.mockResolvedValueOnce(emptySnapshot()).mockRejectedValueOnce(new Error("Recovery lookup unavailable"));
    const response = await POST(registration());
    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty("submission_outcome");
    expect(mocks.runTransaction).toHaveBeenCalledOnce();
    expect(mocks.receiptGet).toHaveBeenCalledTimes(2);
  });

  it("returns a recovered receipt as success rather than claiming that no entry was created", async () => {
    const receipt = {
      reference: "ASC-TEST123456",
      codeforces_handle: null,
      qualification_path: "QUALIFIER",
      qualification_reason: "unlisted institution",
      college: "Test University",
    };
    mocks.receiptGet.mockResolvedValueOnce(emptySnapshot()).mockResolvedValueOnce({ exists: true, data: () => receipt });
    const response = await POST(registration());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, ...receipt });
    expect(body).not.toHaveProperty("submission_outcome");
    expect(mocks.runTransaction).toHaveBeenCalledOnce();
  });
});
