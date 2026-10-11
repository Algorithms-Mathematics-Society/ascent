import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE } from "../src/lib/adminSecurity";
import { decisionEmailId, EMAIL_OUTBOX } from "../src/lib/email/messages";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  transaction: vi.fn(),
  getAll: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  create: vi.fn(),
  deliver: vi.fn(),
  waitUntil: vi.fn(),
  revalidatePath: vi.fn(),
}));

// All persistence, auth, and delivery are isolated: no real records or emails.
vi.mock("@/lib/firebaseAdmin", () => ({
  adminDb: {
    collection: (name: string) => ({ doc: (id: string) => ({ id, path: `${name}/${id}` }) }),
    runTransaction: mocks.transaction,
  },
  adminServerTimestamp: () => "test-timestamp",
}));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminSessionValue: mocks.session }));
vi.mock("@/lib/email/delivery", () => ({ tryDeliverEmail: mocks.deliver }));
vi.mock("@vercel/functions", () => ({ waitUntil: mocks.waitUntil }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { PATCH as singleDecision } from "../src/app/api/admin/registrations/[id]/decision/route";
import { PATCH as bulkDecision } from "../src/app/api/admin/registrations/bulk-decision/route";

const ids = ["admin_latency_test_application_1", "admin_latency_test_application_2"];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function request(bulk: boolean, decision = "APPROVED", csrf = "test-csrf", details: Record<string, unknown> = {}) {
  return new NextRequest(`https://ascent.test/api/admin/registrations/${bulk ? "bulk-decision" : `${ids[0]}/decision`}`, {
    method: "PATCH",
    headers: {
      origin: "https://ascent.test",
      "content-type": "application/json",
      cookie: `${ADMIN_SESSION_COOKIE}=session; ${ADMIN_CSRF_COOKIE}=test-csrf`,
    },
    body: JSON.stringify({
      csrfToken: csrf,
      decision,
      reason: "Eligibility evidence reviewed carefully.",
      ...(bulk ? { applicationIds: ids } : { expectedDecision: "PENDING" }),
      ...details,
    }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external request"); }));
  mocks.session.mockResolvedValue({ uid: "reviewer", email: "reviewer@example.test", role: "REVIEWER" });
  mocks.getAll.mockImplementation(async (...refs: { id: string; path: string }[]) => refs.map((ref) => ({
    ref,
    id: ref.id,
    exists: true,
    data: () => ref.path.startsWith("applications/") ? { admin_decision: "PENDING" } : { revision: 2 },
  })));
  mocks.transaction.mockImplementation(async (callback) => callback({
    getAll: mocks.getAll, update: mocks.update, set: mocks.set, create: mocks.create,
  }));
  mocks.deliver.mockResolvedValue("DISABLED");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Bound the observation independently of delivery; an awaited email fails this
// assertion instead of hanging the suite until the test runner's timeout.
async function responseBeforeEmail(response: Promise<Response>) {
  const observed = Promise.race([
    response,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
  ]);
  await vi.advanceTimersByTimeAsync(100);
  const result = await observed;
  expect(result, "Committed decision must not wait for email").not.toBeNull();
  return result!;
}

for (const bulk of [false, true]) {
  const save = (decision = "APPROVED", csrf = "test-csrf") => bulk
    ? bulkDecision(request(true, decision, csrf))
    : singleDecision(request(false, decision, csrf), { params: { id: ids[0] } });

  describe(bulk ? "bulk decision delivery latency" : "single decision delivery latency", () => {
    it.each(bulk ? ["APPROVED", "WAITLISTED"] : ["APPROVED", "WAITLISTED", "REJECTED"])(
      "returns committed %s while email is still pending",
      async (decision) => {
        const email = deferred<string>();
        mocks.deliver.mockReturnValue(email.promise);
        const response = await responseBeforeEmail(save(decision));
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, decision });
        expect(mocks.waitUntil).toHaveBeenCalledOnce();
        expect(mocks.deliver).toHaveBeenCalledWith(decisionEmailId(ids[0], 3));
        for (const id of bulk ? ids : [ids[0]]) {
          expect(mocks.update).toHaveBeenCalledWith(
            expect.objectContaining({ path: `applications/${id}` }),
            expect.objectContaining({ admin_decision: decision }),
          );
          expect(mocks.create).toHaveBeenCalledWith(
            expect.objectContaining({ path: `${EMAIL_OUTBOX}/${decisionEmailId(id, 3)}` }),
            expect.objectContaining({ kind: "DECISION", status: "PENDING", decision, revision: 3 }),
          );
          expect(mocks.create).toHaveBeenCalledWith(
            expect.objectContaining({ path: expect.stringContaining("audit_log/") }),
            expect.objectContaining({ subject_id: id, decision }),
          );
          expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/registrations/${id}`);
        }
        // A provider retry cannot change the already-successful HTTP result.
        email.resolve("RETRY");
        await mocks.waitUntil.mock.calls[0][0];
        expect(mocks.deliver).toHaveBeenCalledOnce();
      },
    );

    it("waits for the decision commit before responding or delivering", async () => {
      const commit = deferred<void>();
      const transaction = mocks.transaction.getMockImplementation()!;
      mocks.transaction.mockImplementationOnce(async (callback) => {
        const result = await transaction(callback);
        await commit.promise;
        return result;
      });
      let returned = false;
      const response = save().then((result) => { returned = true; return result; });
      await vi.advanceTimersByTimeAsync(100);
      expect(returned).toBe(false);
      expect(mocks.deliver).not.toHaveBeenCalled();
      expect(mocks.waitUntil).not.toHaveBeenCalled();
      commit.resolve();
      expect((await response).status).toBe(200);
      await mocks.waitUntil.mock.calls[0][0];
    });

    it.each(["not_found", "conflict"])("does not deliver on %s", async (kind) => {
      mocks.getAll.mockImplementationOnce(async (...refs: { id: string; path: string }[]) => refs.map((ref) => ({
        ref, id: ref.id, exists: kind !== "not_found",
        data: () => ({ admin_decision: "REJECTED" }),
      })));
      expect((await save()).status).toBe(kind === "conflict" ? 409 : 404);
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.waitUntil).not.toHaveBeenCalled();
      expect(mocks.deliver).not.toHaveBeenCalled();
    });

    it("does not deliver when the database transaction fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.transaction.mockRejectedValueOnce(new Error("Commit failed"));
      expect((await save()).status).toBe(500);
      expect(mocks.waitUntil).not.toHaveBeenCalled();
      expect(mocks.deliver).not.toHaveBeenCalled();
    });

    it("still requires an authenticated session and matching CSRF token", async () => {
      mocks.session.mockResolvedValueOnce(null);
      expect((await save()).status).toBe(401);
      expect((await save("APPROVED", "wrong-token")).status).toBe(403);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.deliver).not.toHaveBeenCalled();
    });
  });
}

it("continues bulk emails in the background with the existing provider pacing", async () => {
  mocks.deliver.mockResolvedValue("SENT");
  const response = await responseBeforeEmail(bulkDecision(request(true)));
  expect(response.status).toBe(200);
  expect(mocks.deliver).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(500);
  expect(mocks.deliver).toHaveBeenCalledTimes(2);
  expect(mocks.deliver).toHaveBeenLastCalledWith(decisionEmailId(ids[1], 3));
  await vi.advanceTimersByTimeAsync(600);
  await mocks.waitUntil.mock.calls[0][0];
});


describe("single decision corrections", () => {
  function existing(decision: string, revision: number | undefined = 2, state = "RECEIVED") {
    mocks.getAll.mockImplementation(async (...refs: { id: string; path: string }[]) => refs.map((ref) => ({
      ref, id: ref.id, exists: true,
      data: () => ref.path.startsWith("applications/") ? { admin_decision: decision, state } : { revision },
    })));
  }
  function correct(decision = "APPROVED", expectedDecision = "REJECTED", expectedRevision: unknown = 2) {
    return singleDecision(request(false, decision, "test-csrf", { expectedDecision, expectedRevision }), { params: { id: ids[0] } });
  }

  it.each([
    ["REJECTED", "APPROVED"], ["REJECTED", "WAITLISTED"],
    ["APPROVED", "REJECTED"], ["APPROVED", "WAITLISTED"],
    ["WAITLISTED", "APPROVED"], ["WAITLISTED", "REJECTED"],
  ])("atomically audits and queues correction from %s to %s", async (previous, decision) => {
    existing(previous);
    const response = await correct(decision, previous);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, decision, decisionRevision: 3, emailStatus: "QUEUED" });
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ path: `admin_registration_decisions/${ids[0]}` }),
      expect.objectContaining({ previous_decision: previous, decision, revision: 3, reason: "Eligibility evidence reviewed carefully.", actor_uid: "reviewer" }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ path: `${EMAIL_OUTBOX}/${decisionEmailId(ids[0], 3)}` }),
      expect.objectContaining({ kind: "DECISION", decision, previous_decision: previous, revision: 3 }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining("audit_log/") }),
      expect.objectContaining({ previous_decision: previous, decision, revision: 3, actor_email: "reviewer@example.test" }));
  });

  it("rejects an old revision even after repeated reversals restore the same outcome", async () => {
    existing("REJECTED", 4);
    const response = await correct();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ currentDecision: "REJECTED", currentRevision: 4 });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it("requires a revision before starting a correction transaction", async () => {
    const response = await singleDecision(request(false, "APPROVED", "test-csrf", { expectedDecision: "REJECTED" }), { params: { id: ids[0] } });
    expect(response.status).toBe(422);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("supports legacy records with no stored revision", async () => {
    mocks.getAll.mockImplementation(async (...refs: { id: string; path: string }[]) => refs.map((ref) => ({
      ref, id: ref.id, exists: true, data: () => ({ admin_decision: "REJECTED" }),
    })));
    expect((await correct("APPROVED", "REJECTED", 0)).status).toBe(200);
    expect(mocks.deliver).toHaveBeenCalledWith(decisionEmailId(ids[0], 1));
  });

  it.each(["WITHDRAWN", "DELETED"])("blocks changes to %s registrations", async (state) => {
    existing("REJECTED", 2, state);
    expect((await correct()).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it.each(["waitUntil", "revalidatePath", "deliver"] as const)("reports committed success when %s throws", async (name) => {
    existing("REJECTED");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks[name].mockImplementationOnce(() => { throw new Error("Post-commit failure"); });
    const response = await correct();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, decision: "APPROVED", emailStatus: "QUEUED" });
    expect(mocks.update).toHaveBeenCalledOnce();
  });

  it("contains background delivery rejection after a successful save", async () => {
    existing("REJECTED");
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.deliver.mockRejectedValueOnce(new Error("Provider unavailable"));
    const response = await correct();
    expect(response.status).toBe(200);
    await expect(mocks.waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });
});
