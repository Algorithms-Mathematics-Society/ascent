import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

export interface SpinnerProps
  extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: "sm" | "md";
  label?: string;
}

/** Add `label` only when no adjacent loading text describes the spinner. */
export default function Spinner({
  size = "sm",
  label,
  className,
  ...props
}: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("animate-spin", size === "sm" ? "size-4" : "size-5", className)}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
