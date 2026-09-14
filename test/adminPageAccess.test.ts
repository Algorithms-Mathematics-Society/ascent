import { describe, expect, it, vi } from "vitest";
const guards = vi.hoisted(() => ({ requireAdminSession: vi.fn(async () => { throw new Error("Login required"); }), read: vi.fn() }));
vi.mock("@/lib/adminAuth", () => ({ requireAdminSession: guards.requireAdminSession }));
vi.mock("@/lib/adminRegistrations", () => ({ getAdminRegistrationStats: guards.read, getAllAdminRegistrations: guards.read, getAdminRegistrationDetail: guards.read }));
vi.mock("@/lib/adminAnalyticsData", () => ({ getAdminAnalyticsDataset: guards.read }));
vi.mock("@/lib/adminActivityData", () => ({ getLatestAdminActivity: guards.read }));
import Registrations from "../src/app/admin/page";
import Analytics from "../src/app/admin/analytics/page";
import Activity from "../src/app/admin/activity/page";
import Detail from "../src/app/admin/registrations/[id]/page";

describe("admin pages authenticate before fetching data", () => {
  it.each([
    ["registrations", () => Registrations({ searchParams: {} })],
    ["analytics", () => Analytics({ searchParams: {} })],
    ["activity", () => Activity({ searchParams: {} })],
    ["detail", () => Detail({ params: { id: "test-id" } })],
  ] as const)("protects %s independently of its layout", async (_, render) => {
    await expect(render()).rejects.toThrow("Login required");
    expect(guards.read).not.toHaveBeenCalled();
  });
});
