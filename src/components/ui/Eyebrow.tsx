// src/components/ui/Eyebrow.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Mono uppercase accent label that sits above a section heading. */
export default function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono text-xs font-semibold uppercase tracking-wider text-ascent-accent",
        className,
      )}
    >
      {children}
    </p>
  );
}
