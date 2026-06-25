"use client";

import { useEffect, useState } from "react";

/**
 * Thin "climb" line along the bottom edge of the navbar: fills left→right as
 * you descend the page (reuses the ascent / gradient identity), and ignites
 * the hot accent in the final stretch — summiting. Scroll-linked, not
 * auto-animated, so it's reduced-motion-safe by nature. rAF-throttled.
 */
export default function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setPct(max > 0 ? Math.min(100, (doc.scrollTop / max) * 100) : 0);
    };
    const onScroll = () => {
      if (raf === 0) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const summiting = pct > 92;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
    >
      <div
        className="h-full origin-left transition-transform duration-150 ease-out"
        style={{
          transform: `scaleX(${pct / 100})`,
          background: summiting
            ? "linear-gradient(90deg, rgb(var(--ascent-accent)), rgb(var(--ascent-hot)))"
            : "linear-gradient(90deg, rgb(var(--ascent-accent)), rgb(var(--ascent-cyan)))",
          boxShadow: summiting
            ? "0 0 12px rgb(var(--ascent-hot) / 0.6)"
            : "0 0 10px rgb(var(--ascent-accent) / 0.45)",
        }}
      />
    </div>
  );
}
