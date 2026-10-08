import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/security/BotCheck", () => ({ default: () => null }));

import {
  exchangeStatusLink,
  requestStatus,
  STATUS_REQUEST_TIMEOUT_MS,
} from "@/components/register/CandidateStatus";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mockResponse(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("candidate status link recovery", () => {
  it.each([429, 503, 403])("preserves the link after HTTP %i so the same link can be retried", async status => {
    const fetchMock = mockResponse(status, { error: "Please try again later." });
    const clearToken = vi.fn();
    await expect(exchangeStatusLink("private-link", clearToken)).rejects.toThrow("Please try again later.");
    expect(clearToken).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await exchangeStatusLink("private-link", clearToken);
    expect(clearToken).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ token: "private-link" }));
  });

  it("clears a permanently invalid or expired link and preserves the API recovery message", async () => {
    mockResponse(401, { error: "This link is invalid or expired. Request a new email below." });
    const clearToken = vi.fn();
    await expect(exchangeStatusLink("expired-link", clearToken)).rejects.toThrow("Request a new email below.");
    expect(clearToken).toHaveBeenCalledOnce();
  });

  it("does not discard a link when a temporary failure returns a non-JSON body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    const clearToken = vi.fn();
    await expect(exchangeStatusLink("private-link", clearToken)).rejects.toThrow("Please try again.");
    expect(clearToken).not.toHaveBeenCalled();
  });

  it("preserves a link on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network failure")));
    const clearToken = vi.fn();
    await expect(exchangeStatusLink("private-link", clearToken)).rejects.toThrow("Network failure");
    expect(clearToken).not.toHaveBeenCalled();
  });

  it("bounds an unresponsive exchange and keeps the token available for recovery", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }));
    const clearToken = vi.fn();
    const attempt = expect(exchangeStatusLink("private-link", clearToken)).rejects.toThrow("taking longer than expected");
    await vi.advanceTimersByTimeAsync(STATUS_REQUEST_TIMEOUT_MS);
    await attempt;
    expect(signal?.aborted).toBe(true);
    expect(clearToken).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the timeout active until a stalled response body finishes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_url, options: RequestInit) => ({
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        options.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    })));
    const attempt = expect(requestStatus("/api/register/status")).rejects.toThrow("taking longer than expected");
    await vi.advanceTimersByTimeAsync(STATUS_REQUEST_TIMEOUT_MS);
    await attempt;
    expect(vi.getTimerCount()).toBe(0);
  });
});
