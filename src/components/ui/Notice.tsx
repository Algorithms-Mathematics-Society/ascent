import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NoticeTone = "danger" | "success" | "info";

const TONE_CLASS: Record<NoticeTone, string> = {
  danger: "ascent-notice-danger",
  success: "ascent-notice-success",
  info: "ascent-notice-info",
};

export interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: NoticeTone;
  heading?: ReactNode;
}

/** Form feedback with restrained colour and appropriate live-region roles. */
export default function Notice({
  tone = "info",
  heading,
  className,
  children,
  role,
  ...props
}: NoticeProps) {
  return (
    <div
      className={cn("ascent-notice", TONE_CLASS[tone], className)}
      role={role ?? (tone === "danger" ? "alert" : "status")}
      {...props}
    >
      {heading ? <p className="font-semibold text-current">{heading}</p> : null}
      <div className={cn(Boolean(heading) && "mt-1", "text-ascent-ink")}>
        {children}
      </div>
    </div>
  );
}
