import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COLLEGE_SEARCH_TIMEOUT_MS,
  fetchCollegeSearch,
} from "@/components/register/CollegeTypeahead";

const college = {
  college_id: "test-college",
  canonical_name: "Test College",
  campus: null,
  tier: "AUTO_QUALIFY",
};

describe("institution search deadline and cancellation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("times out a stalled request and aborts the network operation", async () => {
    let networkSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, options) => {
      networkSignal = options.signal;
      return new Promise(() => {});
    }));
    const search = fetchCollegeSearch("Unlisted College", new AbortController().signal);
    const failed = expect(search).rejects.toThrow("continue with this institution name");
    await vi.advanceTimersByTimeAsync(COLLEGE_SEARCH_TIMEOUT_MS);
    await failed;
    expect(networkSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("also bounds a stalled body after response headers arrive", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => new Promise(() => {}),
    }));
    const search = fetchCollegeSearch("Unlisted College", new AbortController().signal);
    const failed = expect(search).rejects.toThrow("taking too long");
    await vi.advanceTimersByTimeAsync(COLLEGE_SEARCH_TIMEOUT_MS);
    await failed;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels an obsolete query immediately without reporting a timeout", async () => {
    let networkSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, options) => {
      networkSignal = options.signal;
      return new Promise(() => {});
    }));
    const controller = new AbortController();
    const search = fetchCollegeSearch("Old query", controller.signal);
    const cancelled = expect(search).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await cancelled;
    expect(networkSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a query that was already cancelled", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    controller.abort();
    await expect(fetchCollegeSearch("Old query", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns results and clears the deadline when the search finishes", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [college] }),
    });
    vi.stubGlobal("fetch", fetch);
    await expect(fetchCollegeSearch("Test & College", new AbortController().signal)).resolves.toEqual([college]);
    expect(fetch.mock.calls[0][0]).toBe("/api/colleges/search?q=Test%20%26%20College");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the useful rate-limit message and clears the deadline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(fetchCollegeSearch("Test College", new AbortController().signal)).rejects.toThrow("Too many searches");
    expect(vi.getTimerCount()).toBe(0);
  });
});
