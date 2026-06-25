// src/components/ui/Card.tsx
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Surface wrapper over the .glass-card class. `as` allows <li> for lists. */
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
    <Tag className={cn("glass-card", className)} {...rest}>
      {children}
    </Tag>
  );
}
