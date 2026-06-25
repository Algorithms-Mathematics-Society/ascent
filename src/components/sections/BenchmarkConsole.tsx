"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui";

/**
 * The hero's focal artifact — a REAL cache-locality benchmark run on the
 * visitor's own machine. They click; a web worker sums an N×N matrix
 * column-major (cache-hostile) then row-major (cache-friendly); the runtime
 * they actually get climbs, the code rewrites itself, the number drops, and
 * "your machine · Nx faster" lands in the hot accent. Same code, same result —
 * only the memory access changed. Numbers are measured, never faked.
 *
 * Rules honoured: real compute; off the main thread (no jank); a static
 * fallback for no-worker / reduced-motion / low-core / timeout so a weak device
 * never stutters on a page about speed.
 */

const N = 1024; // 1M Int32 ≈ 4MB — comfortably past L2, so strided access thrashes
const REPS = 24;
const RUN_TIMEOUT_MS = 8000;

type Phase = "idle" | "naive" | "rewrite" | "opt" | "done" | "fallback";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function BenchmarkConsole() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [display, setDisplay] = useState(0);
  const [naiveMs, setNaiveMs] = useState<number | null>(null);
  const [optMs, setOptMs] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const displayRef = useRef(0);
  const naiveMsRef = useRef<number | null>(null);

  // Keep a ref alongside the display state so worker callbacks read the live
  // value, not a stale render-time closure.
  const setDisp = useCallback((v: number) => {
    displayRef.current = v;
    setDisplay(v);
  }, []);

  const clearTimers = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const after = useCallback((ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  // Animate the displayed number from → to.
  const animate = useCallback(
    (from: number, to: number, dur: number, done?: () => void) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        setDisp(Math.round(from + (to - from) * easeOutCubic(t)));
        if (t < 1) rafRef.current = requestAnimationFrame(step);
        else {
          setDisp(to);
          done?.();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [setDisp],
  );

  // Indeterminate "climb" while the worker is busy with the naive run.
  const climb = useCallback(() => {
    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / 1400;
      // ease toward a soft ceiling; the real measured value replaces this on arrival
      setDisp(Math.round(1400 * easeOutCubic(Math.min(1, t))));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [setDisp]);

  // Capability gate.
  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const cores = navigator.hardwareConcurrency ?? 4;
    if (typeof Worker === "undefined" || reduce || cores < 4) {
      setPhase("fallback");
    }
    return clearTimers;
  }, [clearTimers]);

  const run = useCallback(() => {
    clearTimers();
    setNaiveMs(null);
    setOptMs(null);
    let worker: Worker;
    try {
      worker = new Worker(new URL("./bench.worker.ts", import.meta.url));
    } catch {
      setPhase("fallback");
      return;
    }
    workerRef.current?.terminate();
    workerRef.current = worker;

    const fail = window.setTimeout(() => {
      worker.terminate();
      setPhase("fallback");
    }, RUN_TIMEOUT_MS);
    timersRef.current.push(fail);

    worker.onerror = () => {
      clearTimeout(fail);
      worker.terminate();
      setPhase("fallback");
    };

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data as { kind: string; ms?: number };
      if (data.kind === "naive" && typeof data.ms === "number") {
        const ms = Math.max(1, Math.round(data.ms));
        naiveMsRef.current = ms;
        setNaiveMs(ms);
        animate(displayRef.current, ms, 350); // snap the climb to the real value
        after(700, () => {
          setPhase("rewrite");
          after(650, () => {
            setPhase("opt");
            worker.postMessage({ cmd: "opt", n: N, reps: REPS });
          });
        });
      } else if (data.kind === "opt" && typeof data.ms === "number") {
        clearTimeout(fail);
        const ms = Math.max(1, Math.round(data.ms));
        setOptMs(ms);
        animate(naiveMsRef.current ?? ms, ms, 1000, () => setPhase("done"));
        worker.terminate();
      }
    };

    setPhase("naive");
    climb();
    worker.postMessage({ cmd: "naive", n: N, reps: REPS });
  }, [after, animate, clearTimers, climb]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const optimized = phase === "opt" || phase === "done" || phase === "rewrite";
  const speedup =
    naiveMs && optMs ? Math.max(1, Math.round(naiveMs / optMs)) : null;
  const heat = phase === "naive"; // warm while cache-hostile, cool once optimized

  return (
    <Card
      className="overflow-hidden font-mono text-[13px] leading-relaxed transition-shadow duration-500"
      style={
        heat
          ? { boxShadow: "0 0 0 1px rgb(var(--ascent-hot) / 0.18), 0 0 48px -10px rgb(var(--ascent-hot) / 0.3)" }
          : undefined
      }
    >
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
          <span className="text-ascent-muted">{"// sum an N×N matrix (N = 1024)"}</span>
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

      {/* Metrics / control */}
      <div className="border-t border-ascent-border bg-ascent-bg/40 px-4 py-4">
        {phase === "fallback" ? (
          <FallbackBody />
        ) : phase === "idle" ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-ascent-muted">
              Same code, same result — only the memory access order changes.
            </p>
            <button
              type="button"
              onClick={run}
              className="ascent-pulse inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ascent-accent/40 bg-ascent-accent/10 px-3 py-1.5 text-xs font-semibold text-ascent-accent transition-colors duration-150 hover:bg-ascent-accent/20"
            >
              <Play aria-hidden="true" className="h-3.5 w-3.5" />
              Run on your machine
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ascent-muted">
                  {phase === "done" ? "Your machine" : "Runtime"}
                </div>
                <div className="mt-0.5 tabular-nums">
                  <span className="text-3xl font-semibold text-ascent-ink">
                    {display}
                  </span>
                  <span className="ml-1 text-sm text-ascent-muted">ms</span>
                </div>
                {phase === "done" && naiveMs && optMs ? (
                  <div className="mt-1 text-xs tabular-nums text-ascent-muted">
                    {naiveMs} ms → {optMs} ms · real measurement
                  </div>
                ) : null}
              </div>

              {phase === "done" && speedup ? (
                <div
                  className="text-right text-2xl font-bold text-ascent-hot"
                  style={{ textShadow: "0 0 22px rgb(var(--ascent-hot) / 0.55)" }}
                >
                  {speedup}× faster
                </div>
              ) : (
                <div className="text-right text-xs text-ascent-muted">
                  {phase === "naive"
                    ? "running column-major…"
                    : phase === "rewrite"
                      ? "rewriting → row-major…"
                      : "running row-major…"}
                </div>
              )}
            </div>

            {phase === "done" ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-ascent-muted">
                  That was the warm-up. The finals are a real codebase.
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <Button href="#register" size="sm">
                    Register
                  </Button>
                  <button
                    type="button"
                    onClick={run}
                    aria-label="Run again"
                    className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-ascent-muted transition-colors duration-150 hover:text-ascent-accent"
                  >
                    <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                    again
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

/** Static, honest fallback — no live measurement claimed. */
function FallbackBody() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs leading-relaxed text-ascent-muted">
        Row-major is several × faster than column-major here — same result,
        purely from cache locality. That gap is the contest.
      </p>
      <Button href="#register" size="sm">
        Register
      </Button>
    </div>
  );
}
