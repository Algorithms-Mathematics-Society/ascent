import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { summarizeDecisionEmail } from "../src/lib/adminDecisionEmail";
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE } from "../src/lib/adminSecurity";

const mocks = vi.hoisted(() => ({ session: vi.fn(), getAll: vi.fn(), get: vi.fn(), config: vi.fn(), deliver: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminSessionValue: mocks.session }));
vi.mock("@/lib/firebaseAdmin", () => ({ adminDb: {
  getAll: mocks.getAll,
  collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}`, get: mocks.get }) }),
} }));
vi.mock("@/lib/email/resend", () => ({ getEmailConfig: mocks.config }));
vi.mock("@/lib/email/delivery", () => ({ tryDeliverEmail: mocks.deliver }));
import { POST } from "../src/app/api/admin/registrations/[id]/decision/email/route";

const id = "correction_email_test_application";
const params = { params: { id } };
const pending = () => ({ kind: "DECISION", source_id: id, revision: 2, decision: "APPROVED", status: "RETRY", due_at: Date.now() - 100, attempts: 1 });
const doc = (data: Record<string, unknown>, exists = true) => ({ exists, data: () => data });
function request(body: unknown = { expectedRevision: 2 }, csrf = "test", origin = "https://ascent.test") {
  return new NextRequest(`https://ascent.test/api/admin/registrations/${id}/decision/email`, {
    method: "POST", headers: { origin, "content-type": "application/json", "x-csrf-token": csrf,
      cookie: `${ADMIN_SESSION_COOKIE}=session; ${ADMIN_CSRF_COOKIE}=test` }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected external request"); }));
  mocks.session.mockResolvedValue({ role: "OWNER" });
  mocks.config.mockReturnValue({ siteUrl: "https://ascent.test" });
  mocks.getAll.mockResolvedValue([doc({ state: "SUBMITTED", admin_decision: "APPROVED" }), doc({ revision: 2, decision: "APPROVED" }), doc(pending())]);
  mocks.get.mockResolvedValue(doc({ ...pending(), status: "SENT", provider_id: "provider-test", payload: { text: "private" } }));
  mocks.deliver.mockResolvedValue("SENT");
});
import { afterEach } from "vitest";
afterEach(() => vi.unstubAllGlobals());

describe("decision email metadata", () => {
  it("only returns safe metadata and never the frozen recipient or message", () => {
    expect(summarizeDecisionEmail({ ...pending(), payload: { to: "private@example.test" }, provider_id: "private-id" }, true, true)).toEqual({ status: "RETRY", configured: true, attempts: 1, lastError: null, canRetry: true });
    expect(summarizeDecisionEmail(undefined, false, true)).toEqual({ status: null, configured: false, attempts: 0, lastError: null, canRetry: false });
  });
  it.each(["SENT", "SCHEDULED", "SENDING", "REVIEW", "SKIPPED"])("does not offer retry for %s", status => {
    expect(summarizeDecisionEmail({ ...pending(), status }, true, true).canRetry).toBe(false);
  });
  it("respects backoff, disabled configuration and inactive applications", () => {
    expect(summarizeDecisionEmail({ ...pending(), due_at: Date.now() + 60000 }, true, true).canRetry).toBe(false);
    expect(summarizeDecisionEmail(pending(), false, true).canRetry).toBe(false);
    expect(summarizeDecisionEmail(pending(), true, false).canRetry).toBe(false);
  });
});

describe("retry latest decision email", () => {
  it("reuses the existing job and returns persisted provider acceptance separately", async () => {
    const response = await POST(request(), params);
    expect(response.status).toBe(200);
    expect(mocks.deliver).toHaveBeenCalledExactlyOnceWith(`decision_${id}_2`);
    expect(await response.json()).toEqual({ success: true, decisionEmail: { status: "SENT", configured: true, attempts: 1, lastError: null, canRetry: false } });
  });
  it.each([null, { role: "REVIEWER" }])("requires owner access", async session => {
    mocks.session.mockResolvedValue(session);
    expect((await POST(request(), params)).status).toBe(403);
    expect(mocks.getAll).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("requires matching CSRF and same origin", async () => {
    expect((await POST(request(undefined, "wrong"), params)).status).toBe(403);
    expect((await POST(request(undefined, "test", "https://other.test"), params)).status).toBe(403);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it.each([{}, { expectedRevision: -1 }, { expectedRevision: 1.5 }, { expectedRevision: "2" }])("rejects invalid revision %j", async body => {
    expect((await POST(request(body), params)).status).toBe(422);
    expect(mocks.getAll).not.toHaveBeenCalled();
  });
  it.each(["WITHDRAWN", "DELETED"])("blocks %s entries", async state => {
    mocks.getAll.mockResolvedValue([doc({ state, admin_decision: "APPROVED" }), doc({ revision: 2, decision: "APPROVED" }), doc(pending())]);
    expect((await POST(request(), params)).status).toBe(409);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("blocks a stale revision even when the decision has returned to the same outcome", async () => {
    mocks.getAll.mockResolvedValue([doc({ admin_decision: "APPROVED" }), doc({ revision: 4, decision: "APPROVED" }), doc(pending())]);
    expect((await POST(request(), params)).status).toBe(409);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it.each(["SENT", "REVIEW", "SENDING", "SKIPPED", "SCHEDULED"])("does not reset a %s job", async status => {
    mocks.getAll.mockResolvedValue([doc({ admin_decision: "APPROVED" }), doc({ revision: 2, decision: "APPROVED" }), doc({ ...pending(), status })]);
    expect((await POST(request(), params)).status).toBe(409);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("does not bypass retry backoff", async () => {
    mocks.getAll.mockResolvedValue([doc({ admin_decision: "APPROVED" }), doc({ revision: 2, decision: "APPROVED" }), doc({ ...pending(), due_at: Date.now() + 60000 })]);
    expect((await POST(request(), params)).status).toBe(409);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("leaves the job queued when sending is disabled", async () => {
    mocks.config.mockReturnValue(null);
    expect((await POST(request(), params)).status).toBe(503);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("reports persisted review state without claiming delivery after a timeout", async () => {
    mocks.deliver.mockResolvedValue("REVIEW");
    mocks.get.mockResolvedValue(doc({ ...pending(), status: "REVIEW", last_error: "Check Resend before retrying." }));
    const response = await POST(request(), params);
    expect(await response.json()).toMatchObject({ success: true, decisionEmail: { status: "REVIEW", canRetry: false } });
  });
});
