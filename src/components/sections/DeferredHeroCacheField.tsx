"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HeroCacheField = dynamic(() => import("./HeroCacheField"), {
  ssr: false,
});

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Keeps decorative canvas work behind first paint and off coarse/mobile
 * pointers. The semantic hero remains entirely server-rendered.
 */
export default function DeferredHeroCacheField() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const capablePointer = window.matchMedia(
      "(min-width: 1024px) and (pointer: fine)",
    );
    const idleWindow = window as IdleWindow;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    const cancelScheduledLoad = () => {
      if (idleHandle !== undefined) {
        idleWindow.cancelIdleCallback?.(idleHandle);
        idleHandle = undefined;
      }
      if (timeoutHandle !== undefined) {
        window.clearTimeout(timeoutHandle);
        timeoutHandle = undefined;
      }
    };

    const scheduleLoad = () => {
      cancelScheduledLoad();
      if (!capablePointer.matches) {
        setReady(false);
        return;
      }

      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(
          () => setReady(true),
          { timeout: 600 },
        );
      } else {
        timeoutHandle = window.setTimeout(() => setReady(true), 160);
      }
    };

    scheduleLoad();
    capablePointer.addEventListener("change", scheduleLoad);

    return () => {
      cancelScheduledLoad();
      capablePointer.removeEventListener("change", scheduleLoad);
    };
  }, []);

  return ready ? <HeroCacheField /> : null;
}

