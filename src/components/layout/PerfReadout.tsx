"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

/**
 * The navbar's signature: a live page-performance readout, treated like an
 * IDE / trading-terminal status line. On a contest judged by speed, the bar
 * itself demonstrates speed — the medium is the message.
 *
 * Real, measured frame time + fps via requestAnimationFrame, sampled on a calm
 * ~1s cadence so it stays legible (not a flickering counter) and survives
 * being seen a hundred times. Paused while the tab is hidden, so it costs
 * nothing when unwatched. SSR renders a stable placeholder to avoid hydration
 * mismatch; the client fills it in.
 */
export default function PerfReadout() {
  const [reading, setReading] = useState<{ ms: number; fps: number } | null>(
    null,
  );

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();

    const loop = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 1000) {
        const fps = Math.round((frames * 1000) / elapsed);
        setReading({ fps, ms: Math.round((elapsed / frames) * 10) / 10 });
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
    const onVisibility = () =>
      document.hidden ? stop() : start();

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
      title="Live page frame time — this site practises what it judges"
      aria-hidden="true"
    >
      <Activity className="h-3.5 w-3.5 text-ascent-accent" />
      <span className="tabular-nums">
        {reading ? (
          <>
            <span className="text-ascent-ink">{reading.ms.toFixed(1)}</span>
            <span className="text-ascent-muted">ms</span>
            <span className="mx-1.5 text-ascent-border">·</span>
            <span className="text-ascent-ink">{reading.fps}</span>
            <span className="text-ascent-muted">fps</span>
          </>
        ) : (
          <span className="text-ascent-muted">-- ms · -- fps</span>
        )}
      </span>
      <span
        className="h-1.5 w-1.5 rounded-full bg-ascent-accent"
        style={{ boxShadow: "0 0 8px rgb(var(--ascent-accent) / 0.8)" }}
      />
    </div>
  );
}
