// src/components/ui/Container.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Centered page-width wrapper with the shared responsive gutters. */
export default function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
