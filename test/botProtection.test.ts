import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebaseAdmin", () => ({ adminDb: {} }));
vi.mock("@/lib/rateLimit", () => ({ sha256: () => "hashed-ip", consumeSlidingWindow: vi.fn(async () => ({ overLimit: false })) }));
import { verifyBot } from "../src/lib/botProtection";
import { consumeSlidingWindow } from "../src/lib/rateLimit";
const fetchMock = vi.fn();
const request = new Request("https://ascent.example.test", { headers: { "x-forwarded-for": "192.0.2.1" } });
beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "private-test-secret");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "public-test-key");
  vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "ascent.example.test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue(Response.json({ success: true, action: "registration", hostname: "ascent.example.test" }));
  vi.mocked(consumeSlidingWindow).mockResolvedValue({ overLimit: false });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("server-side Turnstile verification", () => {
  it("accepts only a verified token with the expected action and allowed hostname", async () => {
    expect(await verifyBot(request, "token", "registration")).toEqual({ ok: true });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(JSON.parse(options.body)).toMatchObject({ secret: "private-test-secret", response: "token" });
    expect(options.cache).toBe("no-store");
  });
  it.each([{ success: false }, { success: true, action: "reminder", hostname: "ascent.example.test" }, { success: true, action: "registration", hostname: "attacker.test" }, {}])("rejects invalid or replayed provider results %j", async result => {
    fetchMock.mockResolvedValue(Response.json(result));
    expect(await verifyBot(request, "token", "registration")).toMatchObject({ ok: false, status: 400 });
  });
  it.each(["TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_ALLOWED_HOSTNAMES"])("fails closed with missing %s", async key => {
    vi.stubEnv(key, "");
    expect(await verifyBot(request, "token", "registration")).toMatchObject({ ok: false, status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refuses Cloudflare test keys in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    expect(await verifyBot(request, "token", "registration")).toMatchObject({ ok: false, status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "x".repeat(2049)])("rejects malformed tokens before external calls", async token => {
    expect(await verifyBot(request, token, "registration")).toMatchObject({ ok: false, status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("enforces rate limits before the provider call", async () => {
    vi.mocked(consumeSlidingWindow).mockResolvedValue({ overLimit: true });
    expect(await verifyBot(request, "token", "status_link")).toMatchObject({ ok: false, status: 429 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed during provider outages", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));
    expect(await verifyBot(request, "token", "registration")).toMatchObject({ ok: false, status: 503 });
  });
});
