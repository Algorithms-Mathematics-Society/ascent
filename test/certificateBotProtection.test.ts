import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/firebaseAdmin", () => ({ adminDb: {} }));
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn() }, genReqId: () => "verification-test" }));
vi.mock("@/lib/rateLimit", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/rateLimit")>()),
  sha256: () => "hashed-ip",
  consumeSlidingWindow: vi.fn(async () => ({ overLimit: false })),
  consumeSlidingWindows: vi.fn(async () => ({ overLimitIndex: -1 })),
}));
import { verifyBot } from "../src/lib/botProtection";
import { consumeSlidingWindow, consumeSlidingWindows } from "../src/lib/rateLimit";

const fetchMock = vi.fn();
const request = new Request("https://ascent.example.test", { headers: { "x-forwarded-for": "192.0.2.1" } });
const verified = () => Response.json({ success: true, action: "certificate_code", hostname: "ascent.example.test" });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TURNSTILE_SECRET_KEY", "private-test-secret");
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "public-test-key");
  vi.stubEnv("TURNSTILE_ALLOWED_HOSTNAMES", "ascent.example.test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => verified());
  vi.mocked(consumeSlidingWindows).mockResolvedValue({ overLimitIndex: -1 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("certificate_code bot check", () => {
  it("calls Cloudflare while the rate-limit slot is still being reserved", async () => {
    const slot = deferred<{ overLimitIndex: number }>();
    vi.mocked(consumeSlidingWindows).mockReturnValueOnce(slot.promise);
    const result = verifyBot(request, "token", "certificate_code");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    slot.resolve({ overLimitIndex: -1 });
    expect(await result).toEqual({ ok: true });
  });
  it("reserves in a 120 per hour window over 20 shards of 6", async () => {
    const { shardCapacity } = await vi.importActual<typeof import("../src/lib/rateLimit")>("../src/lib/rateLimit");
    await verifyBot(request, "token", "certificate_code");
    const [, windows] = vi.mocked(consumeSlidingWindows).mock.calls[0];
    expect(windows).toEqual([{ collection: "_rate_limits_bot", key: "certificate_code_hashed-ip", maxCount: 120, windowMs: 3600000, shards: 20 }]);
    expect(shardCapacity(windows[0]) * 20).toBe(120);
    expect(consumeSlidingWindow).not.toHaveBeenCalled();
  });
  it("rejects over the limit even when the token verifies", async () => {
    vi.mocked(consumeSlidingWindows).mockResolvedValueOnce({ overLimitIndex: 0 });
    expect(await verifyBot(request, "token", "certificate_code")).toMatchObject({ ok: false, status: 429 });
  });
  it("fails closed when the limiter fails, even when the token verifies", async () => {
    vi.mocked(consumeSlidingWindows).mockRejectedValueOnce(new Error("aborted"));
    expect(await verifyBot(request, "token", "certificate_code")).toMatchObject({ ok: false, status: 503 });
  });
  it("rejects a token Cloudflare rejects, with the slot reserved once", async () => {
    fetchMock.mockImplementation(async () => Response.json({ success: false, "error-codes": ["invalid-input-response"] }));
    expect(await verifyBot(request, "token", "certificate_code")).toMatchObject({ ok: false, status: 400 });
    expect(consumeSlidingWindows).toHaveBeenCalledOnce();
  });
  it("fails closed during a provider outage", async () => {
    fetchMock.mockImplementation(async () => { throw new Error("timeout"); });
    expect(await verifyBot(request, "token", "certificate_code")).toMatchObject({ ok: false, status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(consumeSlidingWindows).toHaveBeenCalledOnce();
  });
  it("leaves the other actions sequential on their single document", async () => {
    vi.mocked(consumeSlidingWindow).mockResolvedValueOnce({ overLimit: true });
    expect(await verifyBot(request, "token", "status_link")).toMatchObject({ ok: false, status: 429 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consumeSlidingWindows).not.toHaveBeenCalled();
    expect(consumeSlidingWindow).toHaveBeenCalledWith({}, "_rate_limits_bot", "status_link_hashed-ip", 20, 3600000);
  });
});
