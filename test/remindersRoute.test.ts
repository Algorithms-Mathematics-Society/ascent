import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sha256 } from "../src/lib/rateLimit";

const store = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  unavailable: false,
}));
vi.mock("@/lib/firebaseAdmin", () => ({
  adminServerTimestamp: () => "server-timestamp",
  adminDb: {
    collection: (name: string) => ({ doc: (id: string) => `${name}/${id}` }),
    runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) => {
      if (store.unavailable) throw new Error("Unavailable");
      return callback({
        get: async (ref: string) => ({
          exists: store.records.has(ref),
          data: () => store.records.get(ref),
        }),
        set: (ref: string, data: Record<string, unknown>) => store.records.set(ref, data),
        create: (ref: string, data: Record<string, unknown>) => {
          if (store.records.has(ref)) throw new Error("Already exists");
          store.records.set(ref, data);
        },
      });
    },
  },
}));
vi.mock("@/lib/email/delivery", () => ({ tryDeliverEmail: vi.fn(async () => "DISABLED") }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn() }, genReqId: () => "test-request" }));
import { POST } from "../src/app/api/reminders/route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://ascent.example/api/reminders", {
    method: "POST",
    headers: { origin: "https://ascent.example", "content-type": "application/json", "x-forwarded-for": "192.0.2.1", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => { store.records.clear(); store.unavailable = false; });

describe("email reminder signup", () => {
  it("stores a normalized email and timestamp without creating a registration", async () => {
    const response = await POST(request({ email: " Student@Example.com ", name: "Ignored" }));
    expect(response.status).toBe(200);
    expect(store.records.get(`registration_reminders/${sha256("student@example.com")}`)).toEqual({
      email: "student@example.com", created_at: "server-timestamp", purpose: "ASCENT_2026_REGISTRATION_REMINDER",
    });
    expect([...store.records.keys()].every((key) => !key.startsWith("applications/"))).toBe(true);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("deduplicates addresses without revealing membership or replacing the first signup", async () => {
    const first = await POST(request({ email: "student@example.com" }));
    const key = `registration_reminders/${sha256("student@example.com")}`;
    store.records.get(key)!.created_at = "original-timestamp";
    const second = await POST(request({ email: "STUDENT@EXAMPLE.COM" }));
    expect(await second.json()).toEqual(await first.json());
    expect([...store.records.keys()].filter((key) => key.startsWith("registration_reminders/"))).toHaveLength(1);
    expect(store.records.get(key)!.created_at).toBe("original-timestamp");
  });

  it.each([null, {}, { email: 123 }, { email: "bad" }, { email: "a b@example.com" }, { email: `${"x".repeat(250)}@example.com` }])("rejects invalid email input %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(store.records.size).toBe(0);
  });

  it("rejects cross-origin requests before writing", async () => {
    expect((await POST(request({ email: "student@example.com" }, { origin: "https://other.example" }))).status).toBe(403);
    expect(store.records.size).toBe(0);
  });

  it("rejects malformed JSON and oversized bodies", async () => {
    const malformed = new NextRequest("https://ascent.example/api/reminders", {
      method: "POST", headers: { origin: "https://ascent.example", "content-type": "application/json" }, body: "{",
    });
    expect((await POST(malformed)).status).toBe(400);
    expect((await POST(request({ email: "x".repeat(2100) }))).status).toBe(413);
  });

  it("limits repeated requests even when the address is already saved", async () => {
    for (let i = 0; i < 120; i++) expect((await POST(request({ email: "student@example.com" }))).status).toBe(200);
    const blocked = await POST(request({ email: "another@example.com" }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("3600");
    expect(store.records.has(`registration_reminders/${sha256("another@example.com")}`)).toBe(false);
  });

  it("does not show success if storage fails", async () => {
    store.unavailable = true;
    expect((await POST(request({ email: "student@example.com" }))).status).toBe(503);
    expect(store.records.size).toBe(0);
  });
});
