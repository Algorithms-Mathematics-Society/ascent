import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE } from "../src/lib/adminSecurity";
const mocks = vi.hoisted(() => ({ session: vi.fn(), process: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ verifyAdminSessionValue: mocks.session }));
vi.mock("@/lib/email/worker", () => ({ processEmailQueue: mocks.process }));
import { POST } from "../src/app/api/admin/email/route";
import { GET } from "../src/app/api/cron/email/route";

beforeEach(() => { vi.resetAllMocks(); mocks.process.mockResolvedValue({ configured: false, processed: 0 }); });
function request(csrf = "test") { return new NextRequest("https://ascent.test/api/admin/email", { method: "POST", headers: { origin: "https://ascent.test", cookie: `${ADMIN_SESSION_COOKIE}=session; ${ADMIN_CSRF_COOKIE}=test`, "x-csrf-token": csrf } }); }

describe("email worker authorization", () => {
  it("requires owner access", async () => {
    mocks.session.mockResolvedValue({ role: "REVIEWER" });
    expect((await POST(request())).status).toBe(403); expect(mocks.process).not.toHaveBeenCalled();
  });
  it("requires matching CSRF tokens", async () => {
    mocks.session.mockResolvedValue({ role: "OWNER" });
    expect((await POST(request("wrong"))).status).toBe(403); expect(mocks.process).not.toHaveBeenCalled();
  });
  it("allows an owner to check an unconfigured queue safely", async () => {
    mocks.session.mockResolvedValue({ role: "OWNER" });
    const response = await POST(request()); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ configured: false });
  });
  it("rejects blank cron secrets and accepts only the configured secret", async () => {
    vi.stubEnv("CRON_SECRET", ""); expect((await GET(new NextRequest("https://ascent.test/api/cron/email"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "x".repeat(40)); expect((await GET(new NextRequest("https://ascent.test/api/cron/email", { headers: { authorization: `Bearer ${"x".repeat(40)}` } }))).status).toBe(200);
    vi.unstubAllEnvs();
  });
});
