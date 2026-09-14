import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  collection: vi.fn(),
  query: { orderBy: vi.fn(), limit: vi.fn(), get: vi.fn(), count: vi.fn(), startAfter: vi.fn(), doc: vi.fn() },
}));
vi.mock("@/lib/adminAuth", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/firebaseAdmin", () => ({ adminDb: { collection: mocks.collection } }));
import AdminRemindersPage from "../src/app/admin/reminders/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdminSession.mockResolvedValue({ uid: "admin", role: "REVIEWER" });
  mocks.collection.mockReturnValue(mocks.query);
  mocks.query.orderBy.mockReturnThis();
  mocks.query.limit.mockReturnThis();
  mocks.query.startAfter.mockReturnThis();
  mocks.query.count.mockReturnValue({ get: async () => ({ data: () => ({ count: 1 }) }) });
  mocks.query.get.mockResolvedValue({ size: 1, docs: [{ id: "a".repeat(64), data: () => ({ email: "student@example.com", created_at: { toDate: () => new Date("2026-09-14T10:00:00Z") } }) }] });
});

describe("admin reminder list", () => {
  it("requires an admin session before reading any emails", async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error("Redirect to login"));
    await expect(AdminRemindersPage({ searchParams: {} })).rejects.toThrow("Redirect to login");
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it("shows saved emails and signup dates to an authenticated admin", async () => {
    const html = renderToStaticMarkup(await AdminRemindersPage({ searchParams: {} }));
    expect(html).toContain("student@example.com");
    expect(html).toContain("14 Sept 2026");
    expect(mocks.collection).toHaveBeenCalledWith("registration_reminders");
    expect(mocks.query.orderBy).toHaveBeenCalledWith("created_at", "desc");
    expect(mocks.query.limit).toHaveBeenCalledWith(51);
  });

  it("offers an older page without exposing more than 50 emails at once", async () => {
    mocks.query.get.mockResolvedValue({ size: 51, docs: Array.from({ length: 51 }, (_, i) => ({ id: i.toString(16).padStart(64, "0"), data: () => ({ email: `student${i}@example.com` }) })) });
    const html = renderToStaticMarkup(await AdminRemindersPage({ searchParams: {} }));
    expect(html).toContain("student49@example.com");
    expect(html).not.toContain("student50@example.com");
    expect(html).toContain(`/admin/reminders?after=${(49).toString(16).padStart(64, "0")}`);
  });
});
