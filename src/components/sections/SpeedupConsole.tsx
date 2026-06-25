"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Card } from "@/components/ui";

/**
 * The hero's focal artifact: a live "watch it get faster" reveal. The SAME
 * computation — summing an N×N matrix — runs cache-hostile (column-major) then
 * cache-friendly (row-major). Same result, ~8× the speed, purely from memory
 * access order. That's Ascent's identity: systems performance (cache, layout,
 * latency), not just the right algorithm.
 *
 * Plays once on mount; a Before|After toggle lets you inspect either side, and
 * replay re-runs it. Reduced-motion → settled "after" state, no ticking.
 */

const NAIVE_MS = 1180; // column-major: cache misses, over the 1000ms limit
const FAST_MS = 148; // row-major: contiguous, comfortably under the limit
const LIMIT_MS = 1000;
const SPEEDUP = Math.round(NAIVE_MS / FAST_MS); // 8

type Phase = "naive" | "optimizing" | "done";
type Mode = "playing" | "before" | "after";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function SpeedupConsole() {
  const [mode, setMode] = useState<Mode>("playing");
  const [phase, setPhase] = useState<Phase>("naive");
  const [ms, setMs] = useState(NAIVE_MS);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearAll = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    rafRef.current = null;
    timerRef.current = null;
  }, []);

  const play = useCallback(() => {
    clearAll();
    setMode("playing");
    setPhase("naive");
    setMs(NAIVE_MS);
    timerRef.current = window.setTimeout(() => {
      setPhase("optimizing");
      const start = performance.now();
      const dur = 1100;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        setMs(Math.round(NAIVE_MS + (FAST_MS - NAIVE_MS) * easeOutCubic(t)));
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setMs(FAST_MS);
          setPhase("done");
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }, 950);
  }, [clearAll]);

  const show = useCallback(
    (next: "before" | "after") => {
      clearAll();
      setMode(next);
      setMs(next === "before" ? NAIVE_MS : FAST_MS);
    },
    [clearAll],
  );

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setMode("after");
      setMs(FAST_MS);
      return;
    }
    play();
    return clearAll;
    // run the sequence once on mount; play/clearAll are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived display state.
  const optimized =
    mode === "after" || (mode === "playing" && phase !== "naive");
  const done = mode === "after" || (mode === "playing" && phase === "done");
  const overLimit = ms > LIMIT_MS;
  // Fill grows as the code gets faster — fuller = better. Empty/red while over
  // the cap, turning accent and filling up as it wins (not a near-empty bar on
  // a success). 0 at the cache-hostile baseline → ~87% at the optimized result.
  const barPct = Math.max(0, Math.min(100, (1 - ms / NAIVE_MS) * 100));
  const status =
    mode === "playing" && phase === "naive"
      ? "running…"
      : mode === "playing" && phase === "optimizing"
        ? "optimizing…"
        : null;

  return (
    <Card className="overflow-hidden font-mono text-[13px] leading-relaxed">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-ascent-border bg-ascent-bg/40 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/80" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/80" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-green-400/80" aria-hidden="true" />
        <span className="ml-2 text-xs text-ascent-muted">matrix_sum.cpp</span>
        <span
          className={`ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors duration-300 ${
            optimized
              ? "bg-ascent-accent/12 text-ascent-accent"
              : "bg-ascent-muted/10 text-ascent-muted"
          }`}
        >
          {optimized ? "row-major" : "column-major"}
        </span>
      </div>

      {/* Source — same result, different memory access order */}
      <pre className="overflow-x-auto px-4 py-4 text-ascent-ink" aria-live="off">
        <code>
          <span className="text-ascent-muted">{"// sum an N×N matrix (N = 8192)"}</span>
          {"\n"}
          <span className="text-ascent-accent">long long</span> s = 0;
          {"\n"}
          {optimized ? (
            <>
              <span className="text-ascent-cyan">for</span> (
              <span className="text-ascent-accent">int</span> i = 0; i &lt; N; ++i)
              {"\n"}
              {"  "}
              <span className="text-ascent-cyan">for</span> (
              <span className="text-ascent-accent">int</span> j = 0; j &lt; N; ++j)
              {"\n"}
              {"    "}s += a[i][j];{" "}
              <span className="text-ascent-muted">{"// contiguous → cache hit"}</span>
              {"\n"}
            </>
          ) : (
            <>
              <span className="text-ascent-cyan">for</span> (
              <span className="text-ascent-accent">int</span> j = 0; j &lt; N; ++j)
              {"\n"}
              {"  "}
              <span className="text-ascent-cyan">for</span> (
              <span className="text-ascent-accent">int</span> i = 0; i &lt; N; ++i)
              {"\n"}
              {"    "}s += a[i][j];{" "}
              <span className="text-ascent-muted">{"// strided → cache miss"}</span>
              {"\n"}
            </>
          )}
          <span className="text-ascent-cyan">return</span> s;
        </code>
      </pre>

      {/* Metrics */}
      <div className="border-t border-ascent-border bg-ascent-bg/40 px-4 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ascent-muted">
              Runtime
            </div>
            <div className="mt-0.5 tabular-nums">
              <span className="text-3xl font-semibold text-ascent-ink">{ms}</span>
              <span className="ml-1 text-sm text-ascent-muted">ms</span>
            </div>
            {done ? (
              <div className="mt-1 text-xs tabular-nums text-ascent-muted">
                baseline {NAIVE_MS} ms → {FAST_MS} ms
              </div>
            ) : null}
          </div>

          {done ? (
            <div
              className="text-right text-2xl font-bold text-ascent-hot"
              style={{ textShadow: "0 0 22px rgb(var(--ascent-hot) / 0.55)" }}
            >
              {SPEEDUP}× faster
            </div>
          ) : (
            <div className="text-right text-xs text-ascent-muted">{status}</div>
          )}
        </div>

        {/* Time bar (relative to the cache-hostile baseline) */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ascent-border/60">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ease-out ${
              overLimit ? "bg-red-400/80" : "bg-ascent-accent"
            }`}
            style={{ width: `${barPct}%` }}
          />
        </div>

        {/* Verdict + controls */}
        <div className="mt-3 flex items-center justify-between gap-3">
          {overLimit ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300">
              Time Limit Exceeded
              <span className="font-normal text-ascent-muted">· {LIMIT_MS} ms cap</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              Accepted ✓
              <span className="font-normal text-ascent-muted">· under {LIMIT_MS} ms cap</span>
            </span>
          )}

          <div className="flex items-center gap-1 text-xs text-ascent-muted">
            {/* Before | After toggle */}
            <button
              type="button"
              onClick={() => show("before")}
              aria-pressed={mode === "before"}
              className={`rounded px-1.5 py-1 transition-colors duration-150 hover:text-ascent-ink ${
                mode === "before" ? "text-ascent-ink" : ""
              }`}
            >
              before
            </button>
            <span className="text-ascent-border">|</span>
            <button
              type="button"
              onClick={() => show("after")}
              aria-pressed={mode === "after"}
              className={`rounded px-1.5 py-1 transition-colors duration-150 hover:text-ascent-ink ${
                mode === "after" ? "text-ascent-ink" : ""
              }`}
            >
              after
            </button>
            <button
              type="button"
              onClick={play}
              aria-label="Replay"
              className="ml-1 inline-flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors duration-150 hover:text-ascent-accent focus-visible:text-ascent-accent"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              replay
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
