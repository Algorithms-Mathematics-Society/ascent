/// <reference lib="webworker" />
/**
 * Real cache-locality benchmark, run on the visitor's own machine. Sums an
 * N×N Int32 matrix two ways: column-major (strided → cache-hostile) and
 * row-major (contiguous → cache-friendly). Same arithmetic, same result — only
 * the memory access order differs, which is exactly the effect Ascent is about.
 *
 * Runs off the main thread so it never janks the page. Returns real measured
 * milliseconds; nothing here is faked.
 */

function buildMatrix(n: number): Int32Array {
  const a = new Int32Array(n * n);
  for (let k = 0; k < a.length; k++) a[k] = k & 255;
  return a;
}

function sumColMajor(a: Int32Array, n: number, reps: number): number {
  let sum = 0;
  const t0 = performance.now();
  for (let r = 0; r < reps; r++)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) sum += a[i * n + j];
  const t = performance.now() - t0;
  if (sum === -1) self.postMessage({ kind: "noise", sum }); // defeat DCE
  return t;
}

function sumRowMajor(a: Int32Array, n: number, reps: number): number {
  let sum = 0;
  const t0 = performance.now();
  for (let r = 0; r < reps; r++)
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sum += a[i * n + j];
  const t = performance.now() - t0;
  if (sum === -1) self.postMessage({ kind: "noise", sum });
  return t;
}

self.onmessage = (e: MessageEvent) => {
  const { cmd, n, reps } = e.data as { cmd: string; n: number; reps: number };
  const a = buildMatrix(n);
  if (cmd === "naive") {
    sumColMajor(a, n, 1); // warm up
    self.postMessage({ kind: "naive", ms: sumColMajor(a, n, reps) });
  } else if (cmd === "opt") {
    sumRowMajor(a, n, 1);
    self.postMessage({ kind: "opt", ms: sumRowMajor(a, n, reps) });
  }
};

export {};
