"use client";

import {
  createContext,
  useContext,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";

/**
 * Shares the benchmark's phase with the WebGL flow field without re-rendering
 * either: the phase lives in a ref the field reads each frame. BenchmarkConsole
 * pushes its phase; HeroFlowField maps it to target speed/heat. Safe to consume
 * without a provider (no-op), so the benchmark works standalone too.
 */
export type FlowPhase =
  | "idle"
  | "naive"
  | "rewrite"
  | "opt"
  | "done"
  | "fallback";

type FlowCtx = {
  phaseRef: MutableRefObject<FlowPhase>;
  setFlowPhase: (p: FlowPhase) => void;
};

const HeroFlowContext = createContext<FlowCtx>({
  phaseRef: { current: "idle" },
  setFlowPhase: () => {},
});

export function HeroFlowProvider({ children }: { children: ReactNode }) {
  const phaseRef = useRef<FlowPhase>("idle");
  const valueRef = useRef<FlowCtx>({
    phaseRef,
    setFlowPhase: (p: FlowPhase) => {
      phaseRef.current = p;
    },
  });
  return (
    <HeroFlowContext.Provider value={valueRef.current}>
      {children}
    </HeroFlowContext.Provider>
  );
}

export function useHeroFlow() {
  return useContext(HeroFlowContext);
}
