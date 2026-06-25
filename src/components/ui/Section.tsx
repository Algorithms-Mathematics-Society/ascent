// src/components/ui/Section.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Semantic <section> with the shared vertical rhythm. Layout-neutral: it does
 * not impose a Container, so sections compose their own inner width.
 */
export default function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("py-24", className)}>
      {children}
    </section>
  );
}
