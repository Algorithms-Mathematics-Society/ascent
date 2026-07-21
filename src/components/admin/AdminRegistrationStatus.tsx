import type { AdminDecision } from "@/lib/adminRegistrationView";

const STATUS_LABEL: Record<AdminDecision, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  WAITLISTED: "Waitlisted",
  REJECTED: "Not approved",
};

const STATUS_CLASS: Record<AdminDecision, string> = {
  PENDING: "border-ascent-border bg-ascent-canvas text-ascent-ink",
  APPROVED: "border-emerald-700/30 bg-emerald-50 text-emerald-900",
  WAITLISTED: "border-amber-700/30 bg-amber-50 text-amber-900",
  REJECTED: "border-red-700/25 bg-red-50 text-red-900",
};

export default function AdminRegistrationStatus({
  decision,
}: {
  decision: AdminDecision;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center border px-2.5 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.1em] ${STATUS_CLASS[decision]}`}
    >
      {STATUS_LABEL[decision]}
    </span>
  );
}
