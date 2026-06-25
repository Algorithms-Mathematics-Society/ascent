"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

/**
 * The navbar's signature: a live, real micro-benchmark treated like an IDE /
 * trading-terminal status line — the bar itself demonstrates the speed the
 * contest judges. We measure sequential-sum throughput on the visitor's machine
 * and surface it as **GB/s** (memory bandwidth), which reads as a real,
 * credible, impressive number to a systems audience — unlike a sub-nanosecond
 * "ns/op" figure, which parses as ~2 clock cycles and reads as fabricated on a
 * site whose whole brand is honest measurement.
 *
 * Re-measured every few seconds (so the "live" dot is truthful), tiny (~ms,
 * can't jank), paused while hidden. SSR renders a placeholder; client fills in.
 */
const N = 1 << 18; // 262,144 Float64 = 2 MB scanned per pass
const REPS = 20;
const BYTES = N * 8 * REPS;

function measureGbps(): number | null {
  try {
    const a = new Float64Array(N);
    for (let i = 0; i < N; i++) a[i] = i * 1.000001;
    let s = 0;
    for (let i = 0; i < N; i++) s += a[i]; // warm up
    const t0 = performance.now();
    for (let r = 0; r < REPS; r++) for (let i = 0; i < N; i++) s += a[i];
    const t = performance.now() - t0;
    if (s === -1 || t <= 0) return null; // defeat DCE / guard
    return Math.round((BYTES / (t / 1000) / 1e9) * 10) / 10;
  } catch {
    return null;
  }
}

export default function PerfReadout() {
  const [gbps, setGbps] = useState<number | null>(null);

  useEffect(() => {
    const run = () => {
      if (!document.hidden) setGbps(measureGbps());
    };
    run();
    const id = window.setInterval(run, 3000);
    const onVis = () => !document.hidden && run();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      className="hidden items-center gap-2 font-mono text-xs text-ascent-muted sm:flex"
      title="Live: sequential memory-scan throughput, measured on your machine"
      aria-hidden="true"
    >
      <Activity className="h-3.5 w-3.5 text-ascent-accent" />
      <span className="tabular-nums">
        <span className="text-ascent-ink">{gbps ?? "--"}</span>
        <span className="text-ascent-muted"> GB/s scan</span>
      </span>
      <span
        className="h-1.5 w-1.5 rounded-full bg-ascent-accent"
        style={{ boxShadow: "0 0 8px rgb(var(--ascent-accent) / 0.8)" }}
      />
    </div>
  );
}
