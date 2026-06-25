"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

/**
 * The navbar's signature: a live page-performance readout, treated like an
 * IDE / trading-terminal status line. On a contest judged by speed, the bar
 * itself demonstrates speed — the medium is the message.
 *
 * The headline number is a REAL metric — the page's own load time from the
 * Navigation Timing API — so a systems person can't dismiss it as the vsync
 * frame budget. Live fps rides along as secondary render flavor. Sampled on a
 * calm cadence so it stays legible, and paused while the tab is hidden so it
 * costs nothing unwatched. SSR renders a stable placeholder; the client fills
 * it in (no hydration mismatch).
 */
export default function PerfReadout() {
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);

  // Real one-time load metric from Navigation Timing.
  useEffect(() => {
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return;
    const value = nav.domContentLoadedEventEnd || nav.responseEnd;
    if (value > 0) setLoadMs(Math.round(value));
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
      title="Live: this page's own load time (Navigation Timing) and render fps"
      aria-hidden="true"
    >
      <Activity className="h-3.5 w-3.5 text-ascent-accent" />
      <span className="tabular-nums">
        <span className="text-ascent-ink">{loadMs ?? "--"}</span>
        <span className="text-ascent-muted">ms load</span>
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
