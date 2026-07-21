"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const CtaOptimizationCurrent = dynamic(
  () => import("./CtaOptimizationCurrent"),
  { ssr: false },
);

/**
 * Downloads the below-fold canvas only as its section approaches the viewport.
 * CTA copy and controls stay server-rendered and immediately usable.
 */
export default function DeferredCtaOptimizationCurrent() {
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const section = sentinelRef.current?.closest("section");
    if (!section || !("IntersectionObserver" in window)) {
      setReady(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setReady(true);
        observer.disconnect();
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span
        ref={sentinelRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      />
      {ready ? <CtaOptimizationCurrent /> : null}
    </>
  );
}

