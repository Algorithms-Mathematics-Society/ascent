"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

/**
 * Scarcity cue: a live countdown to the registration close. Driven by a real
 * ISO date from content/site.ts — the parent only renders this when a date is
 * set, so a fake date can never ship. SSR renders a stable placeholder; the
 * client ticks each second. On expiry it collapses to a "closed" + Register
 * fallback rather than negative time.
 */

type Remaining = { d: number; h: number; m: number; s: number };

function remaining(target: number): Remaining | null {
  const diff = target - Date.now();
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function Countdown({ closeISO }: { closeISO: string }) {
  const target = new Date(closeISO).getTime();
  const valid = !Number.isNaN(target);
  const [left, setLeft] = useState<Remaining | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!valid) return;
    setReady(true);
    setLeft(remaining(target));
    const id = setInterval(() => setLeft(remaining(target)), 1000);
    return () => clearInterval(id);
  }, [target, valid]);

  if (!valid) return null;

  // Expired (only after client mount confirms it).
  if (ready && left === null) {
    return (
      <Button href="#register" size="sm">
        Registration closed — see next edition
      </Button>
    );
  }

  const units: { value: number | null; label: string }[] = [
    { value: left?.d ?? null, label: "days" },
    { value: left?.h ?? null, label: "hrs" },
    { value: left?.m ?? null, label: "min" },
    { value: left?.s ?? null, label: "sec" },
  ];

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-wider text-ascent-muted">
        Registration closes in
      </span>
      <div className="flex items-center gap-1.5 font-mono tabular-nums">
        {units.map((u, i) => (
          <span key={u.label} className="flex items-baseline gap-1.5">
            <span className="flex flex-col items-center">
              <span className="text-lg font-semibold text-ascent-ink">
                {u.value === null ? "--" : u.label === "days" ? u.value : pad(u.value)}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-ascent-muted">
                {u.label}
              </span>
            </span>
            {i < units.length - 1 ? (
              <span className="text-ascent-border">:</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}
