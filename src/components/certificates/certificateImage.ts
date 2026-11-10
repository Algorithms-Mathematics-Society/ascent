// The certificate PNG (about 2MB) is fetched once, as early as possible, and
// held as a blob URL that serves both the preview and the download. A job
// starts the moment a session is known (or presumed), so the transfer runs
// while React renders the done card instead of after it.

export const CERTIFICATE_IMAGE_URL =
  "/api/certificates/download?disposition=inline";
/** Abort when no bytes arrive for this long. A slow but moving transfer is never cut off. */
export const CERTIFICATE_IMAGE_STALL_MS = 20_000;

export type CertificateImageState =
  | { status: "loading"; progress: number | null }
  | { status: "ready"; url: string }
  | { status: "failed" };

export type CertificateImageJob = {
  getState(): CertificateImageState;
  subscribe(listener: () => void): () => void;
  /** Aborts the transfer and revokes the blob URL. Safe to call more than once. */
  dispose(): void;
};

type Options = {
  fetchImpl?: typeof fetch;
  createUrl?: (blob: Blob) => string;
  revokeUrl?: (url: string) => void;
  stallMs?: number;
};

export function startCertificateImage({
  fetchImpl = (...args) => fetch(...args),
  createUrl = (blob) => URL.createObjectURL(blob),
  revokeUrl = (url) => URL.revokeObjectURL(url),
  stallMs = CERTIFICATE_IMAGE_STALL_MS,
}: Options = {}): CertificateImageJob {
  const controller = new AbortController();
  const listeners = new Set<() => void>();
  let state: CertificateImageState = { status: "loading", progress: null };
  let disposed = false;
  let stallTimer: ReturnType<typeof setTimeout> | undefined;

  function set(next: CertificateImageState) {
    if (disposed) return;
    state = next;
    listeners.forEach((listener) => listener());
  }
  function armStall() {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => controller.abort(), stallMs);
  }

  async function run() {
    armStall();
    const response = await fetchImpl(CERTIFICATE_IMAGE_URL, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/png")
    )
      throw new Error("preview_unavailable");
    const total = Number(response.headers.get("content-length")) || 0;
    const reader = response.body?.getReader();
    let blob: Blob;
    if (!reader) {
      blob = await response.blob();
    } else {
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      let shownPercent = -1;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        armStall();
        chunks.push(value);
        loaded += value.byteLength;
        if (total) {
          // Whole percents only: about a hundred renders at most, not one per chunk.
          const percent = Math.min(100, Math.floor((loaded / total) * 100));
          if (percent !== shownPercent) {
            shownPercent = percent;
            set({ status: "loading", progress: percent / 100 });
          }
        }
      }
      blob = new Blob(chunks as BlobPart[], { type: "image/png" });
    }
    if (disposed) return;
    set({ status: "ready", url: createUrl(blob) });
  }

  run()
    .catch(() => set({ status: "failed" }))
    .finally(() => clearTimeout(stallTimer));

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      clearTimeout(stallTimer);
      controller.abort();
      if (state.status === "ready") revokeUrl(state.url);
      disposed = true;
      listeners.clear();
    },
  };
}
