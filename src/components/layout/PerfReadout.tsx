"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

/**
 * The navbar's signature: a live, real micro-benchmark treated like an IDE /
 * trading-terminal status line — the bar itself demonstrates the speed the
 * contest judges. We measure sequential-sum throughput on the visitor's own
 * machine and surface ns/op: real, instrument-flavored, and — unlike a network
 * load time — always genuinely fast and independent of hosting, so the number
 * on the most-seen pixel never undercuts the thesis.
 *
 * The micro-bench is tiny (a few ms, run once on mount) so it can't jank. Live
 * fps rides along as secondary render flavor, paused while the tab is hidden.
 * SSR renders a stable placeholder; the client fills it in.
 */
export default function PerfReadout() {
  const [nsPerOp, setNsPerOp] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);

  // One-shot real micro-benchmark: sequential Float64 sum throughput.
  useEffect(() => {
    try {
      const n = 1 << 18; // 262,144
      const a = new Float64Array(n);
      for (let i = 0; i < n; i++) a[i] = i * 1.000001;
      let s = 0;
      for (let i = 0; i < n; i++) s += a[i]; // warm up
      const reps = 20;
      const t0 = performance.now();
      for (let r = 0; r < reps; r++) for (let i = 0; i < n; i++) s += a[i];
      const t = performance.now() - t0;
      if (s === -1) return; // defeat dead-code elimination
      const ns = (t * 1e6) / (n * reps);
      setNsPerOp(Math.round(ns * 100) / 100);
    } catch {
      /* leave as placeholder */
    }
  }, []);

  // Live fps, calm cadence, paused when hidden.
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();

    const loop = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 1000) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (raf === 0) {
        frames = 0;
        windowStart = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      className="hidden items-center gap-2 font-mono text-xs text-ascent-muted sm:flex"
      title="Live: a real sequential-sum micro-benchmark on your machine, plus render fps"
      aria-hidden="true"
    >
      <Activity className="h-3.5 w-3.5 text-ascent-accent" />
      <span className="tabular-nums">
        <span className="text-ascent-ink">{nsPerOp ?? "--"}</span>
        <span className="text-ascent-muted">ns/op</span>
        <span className="mx-1.5 text-ascent-border">·</span>
        <span className="text-ascent-ink">{fps ?? "--"}</span>
        <span className="text-ascent-muted">fps</span>
      </span>
      <span
        className="h-1.5 w-1.5 rounded-full bg-ascent-accent"
        style={{ boxShadow: "0 0 8px rgb(var(--ascent-accent) / 0.8)" }}
      />
    </div>
  );
}
