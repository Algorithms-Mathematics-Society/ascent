// src/components/ui/Card.tsx
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Neutral bordered surface. `as` allows semantic list items. */
export default function Card({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: "div" | "li";
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("ascent-card", className)} {...rest}>
      {children}
    </Tag>
  );
}
