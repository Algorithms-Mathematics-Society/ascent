import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CERTIFICATE_IMAGE_URL,
  startCertificateImage,
  type CertificateImageJob,
  type CertificateImageState,
} from "@/components/certificates/certificateImage";
import BotCheck from "@/components/security/BotCheck";

const PNG = { "content-type": "image/png" };

function streamed(chunks: number[], headers: Record<string, string>) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers });
}

function settle(job: CertificateImageJob) {
  return new Promise<CertificateImageState>((resolve) => {
    const check = () => {
      const state = job.getState();
      if (state.status !== "loading") resolve(state);
    };
    job.subscribe(check);
    check();
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("startCertificateImage", () => {
  it("fetches the inline PNG once, reports whole-percent progress and exposes a blob URL", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      streamed([250, 250, 500], { ...PNG, "content-length": "1000" }),
    );
    const createUrl = vi.fn((_blob: Blob) => "blob:certificate");
    const job = startCertificateImage({
      fetchImpl,
      createUrl,
      revokeUrl: vi.fn(),
    });
    const seen: number[] = [];
    job.subscribe(() => {
      const state = job.getState();
      if (state.status === "loading" && state.progress !== null)
        seen.push(state.progress);
    });
    expect(job.getState()).toEqual({ status: "loading", progress: null });

    expect(await settle(job)).toEqual({
      status: "ready",
      url: "blob:certificate",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]).toEqual([
      CERTIFICATE_IMAGE_URL,
      expect.objectContaining({ cache: "no-store" }),
    ]);
    expect(seen).toEqual([0.25, 0.5, 1]);
    const blob = createUrl.mock.calls[0][0];
    expect(blob.size).toBe(1000);
    expect(blob.type).toBe("image/png");
  });

  it("still works without a content-length, just without progress", async () => {
    const job = startCertificateImage({
      fetchImpl: async () => streamed([10, 20], PNG),
      createUrl: () => "blob:x",
      revokeUrl: vi.fn(),
    });
    expect(await settle(job)).toEqual({ status: "ready", url: "blob:x" });
  });

  it("fails on an expired session (JSON 401) instead of saving the error as an image", async () => {
    const job = startCertificateImage({
      fetchImpl: async () =>
        Response.json({ error: "expired" }, { status: 401 }),
      createUrl: vi.fn(),
      revokeUrl: vi.fn(),
    });
    expect(await settle(job)).toEqual({ status: "failed" });
  });

  it("aborts a transfer that stalls", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const job = startCertificateImage({
      stallMs: 1000,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
      createUrl: vi.fn(),
      revokeUrl: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(1001);
    expect(signal?.aborted).toBe(true);
    expect(job.getState()).toEqual({ status: "failed" });
  });

  it("dispose aborts the request, revokes the blob URL and is idempotent", async () => {
    const revokeUrl = vi.fn();
    const job = startCertificateImage({
      fetchImpl: async () => streamed([5], { ...PNG, "content-length": "5" }),
      createUrl: () => "blob:y",
      revokeUrl,
    });
    await settle(job);
    job.dispose();
    job.dispose();
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith("blob:y");
  });

  it("never creates a blob URL once disposed mid-transfer", async () => {
    let finish!: (response: Response) => void;
    const createUrl = vi.fn();
    const job = startCertificateImage({
      fetchImpl: () => new Promise<Response>((resolve) => (finish = resolve)),
      createUrl,
      revokeUrl: vi.fn(),
    });
    job.dispose();
    finish(streamed([5], PNG));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(createUrl).not.toHaveBeenCalled();
  });
});

describe("BotCheck opt-in appearance", () => {
  it("keeps the default look for registration, reminders and status pages", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
    const markup = renderToStaticMarkup(
      <BotCheck action="registration" onToken={() => {}} />,
    );
    expect(markup).toContain('class="my-4 min-h-16"');
    expect(markup).toContain("Loading the verification check.");
  });

  it("reserves no box and shows no loading line when interaction-only", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
    const markup = renderToStaticMarkup(
      <BotCheck
        action="certificate_code"
        appearance="interaction-only"
        onToken={() => {}}
      />,
    );
    expect(markup).toContain('class="my-4"');
    expect(markup).not.toContain("min-h-16");
    expect(markup).not.toContain("Loading the verification check.");
  });
});

describe("CertificatePortal first paint", () => {
  it("renders the email step with the silent widget and an enabled submit button", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "test-site-key");
    const { default: CertificatePortal } = await import("@/components/certificates/CertificatePortal");
    const markup = renderToStaticMarkup(<CertificatePortal hasSession={false} />);
    expect(markup).toContain("Email me a code");
    expect(markup).not.toContain("Loading the verification check.");
    expect(markup).not.toMatch(/<button type="submit"[^>]*disabled/);
    expect(markup).not.toContain(String.fromCharCode(0x2014));
  });
});
