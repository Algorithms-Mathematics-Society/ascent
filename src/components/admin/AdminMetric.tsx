import type { ReactNode } from "react";

interface AdminMetricProps {
  label: string;
  value: ReactNode;
  detail: string;
  emphasis?: boolean;
}

export default function AdminMetric({
  label,
  value,
  detail,
  emphasis = false,
}: AdminMetricProps) {
  return (
    <div className="bg-ascent-surface p-5 sm:p-6">
      <dt className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-ascent-muted">
        {label}
      </dt>
      <dd
        className={`mt-3 text-3xl font-semibold tabular-nums tracking-tight ${
          emphasis ? "text-ascent-brand" : "text-ascent-ink"
        }`}
      >
        {value}
      </dd>
      <p className="mt-1 text-xs leading-5 text-ascent-muted">{detail}</p>
    </div>
  );
}
