"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Card } from "@/components/ui";

/**
 * The hero's focal artifact: a live "watch it get faster" reveal. A naive
 * O(n²) solution Times-Out, then the optimized O(1) closed form drops the
 * runtime — the number counts down and "Nx faster" ignites in the hot accent.
 * This is the screenshot, the dopamine, and the clearest one-glance answer to
 * "what is Ascent". Plays once on mount; replayable. Reduced-motion → final
 * state, no ticking.
 */

const NAIVE_MS = 1240;
const FAST_MS = 12;
const LIMIT_MS = 1000;
const SPEEDUP = Math.round(NAIVE_MS / FAST_MS); // 103

type Phase = "naive" | "optimizing" | "done";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function SpeedupConsole() {
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

  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      setPhase("done");
      setMs(FAST_MS);
      return;
    }
    play();
    return clearAll;
    // play/clearAll are stable; run the sequence once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const optimized = phase !== "naive";
  const overLimit = ms > LIMIT_MS;
  const barPct = Math.max(2, (ms / NAIVE_MS) * 100);

  return (
    <Card className="overflow-hidden font-mono text-[13px] leading-relaxed">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-ascent-border bg-ascent-bg/40 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400/80" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/80" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-green-400/80" aria-hidden="true" />
        <span className="ml-2 text-xs text-ascent-muted">sum.cpp</span>
        <span
          className={`ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors duration-300 ${
            optimized
              ? "bg-ascent-accent/12 text-ascent-accent"
              : "bg-ascent-muted/10 text-ascent-muted"
          }`}
        >
          {optimized ? "O(1)" : "O(n²)"}
        </span>
      </div>

      {/* Source */}
      <pre className="overflow-x-auto px-4 py-4 text-ascent-ink" aria-live="off">
        <code>
          <span className="text-ascent-muted">{"// "}∑ i(i+1)/2 for i = 1..n</span>
          {"\n"}
          <span className="text-ascent-accent">long long</span> solve(
          <span className="text-ascent-accent">long long</span> n) {"{"}
          {"\n"}
          {optimized ? (
            <>
              {"  "}
              <span className="text-ascent-cyan">return</span> n * (n + 1) * (n + 2) / 6;
              {"\n"}
              <span className="text-ascent-muted">{"  // closed form — no loop"}</span>
              {"\n"}
            </>
          ) : (
            <>
              {"  "}
              <span className="text-ascent-accent">long long</span> s = 0;
              {"\n"}
              {"  "}
              <span className="text-ascent-cyan">for</span> (
              <span className="text-ascent-accent">int</span> i = 1; i &lt;= n; ++i)
              {"\n"}
              {"    "}
              <span className="text-ascent-cyan">for</span> (
              <span className="text-ascent-accent">int</span> j = 1; j &lt;= i; ++j)
              {"\n"}
              {"      "}s += j;
              {"\n"}
              {"  "}
              <span className="text-ascent-cyan">return</span> s;
              {"\n"}
            </>
          )}
          {"}"}
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
              <span className="ml-2 text-xs text-ascent-muted">/ {LIMIT_MS} limit</span>
            </div>
          </div>

          {phase === "done" ? (
            <div
              className="text-right text-2xl font-bold text-ascent-hot"
              style={{ textShadow: "0 0 22px rgb(var(--ascent-hot) / 0.55)" }}
            >
              {SPEEDUP}× faster
            </div>
          ) : (
            <div className="text-right text-xs text-ascent-muted">
              {phase === "naive" ? "running…" : "optimizing…"}
            </div>
          )}
        </div>

        {/* Time bar */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ascent-border/60">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ease-out ${
              overLimit ? "bg-red-400/80" : "bg-ascent-accent"
            }`}
            style={{ width: `${barPct}%` }}
          />
        </div>

        {/* Verdict + replay */}
        <div className="mt-3 flex items-center justify-between">
          {overLimit ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300">
              Time Limit Exceeded
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              Accepted ✓
              <span className="font-normal text-ascent-muted">· {FAST_MS} ms · 3.1 MB</span>
            </span>
          )}

          <button
            type="button"
            onClick={play}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ascent-muted transition-colors duration-150 hover:text-ascent-accent focus-visible:text-ascent-accent"
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            replay
          </button>
        </div>
      </div>
    </Card>
  );
}
