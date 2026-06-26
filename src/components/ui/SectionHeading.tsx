// src/components/ui/SectionHeading.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Eyebrow from "./Eyebrow";

/**
 * Eyebrow + h2 + optional lede, matching the site's section-header rhythm.
 * `align="center"` centers the block (FAQ, Prizes); default is left.
 */
export default function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" ? "text-center" : "max-w-2xl",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-3 text-3xl font-medium tracking-tight text-ascent-ink sm:text-4xl">
        {title}
      </h2>
      {lede ? (
        <p className="mt-5 text-lg leading-relaxed text-ascent-muted">{lede}</p>
      ) : null}
    </div>
  );
}
