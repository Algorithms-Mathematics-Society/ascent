"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@/components/ui";
import type { ActionableAdminDecision } from "@/lib/adminDecision";

interface ConfirmedDecision {
  decision: ActionableAdminDecision;
  reason: string | null;
}

const DecisionFeedbackContext = createContext<{
  confirmed: Record<string, ConfirmedDecision>;
  record: (ids: string[], result: ConfirmedDecision) => void;
} | null>(null);

/** Share server-confirmed outcomes across desktop, mobile, and batch controls.
 * Reload the full queue only when requested, rather than after every decision.
 * Nothing is persisted or assumed before the decision endpoint responds.
 */
export default function AdminDecisionFeedback({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState<Record<string, ConfirmedDecision>>({});
  function record(ids: string[], result: ConfirmedDecision) {
    setConfirmed((previous) => {
      const next = { ...previous };
      for (const id of ids) next[id] = result;
      return next;
    });
  }
  return (
    <DecisionFeedbackContext.Provider value={{ confirmed, record }}>
      {children}
    </DecisionFeedbackContext.Provider>
  );
}

export function useAdminDecisionFeedback() {
  const feedback = useContext(DecisionFeedbackContext);
  if (!feedback) throw new Error("Admin decisions require a feedback provider.");
  return feedback;
}

/** Totals and filters are a server snapshot; make refreshing that snapshot explicit. */
export function AdminQueueRefresh() {
  const { confirmed } = useAdminDecisionFeedback();
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const count = Object.keys(confirmed).length;
  if (!count) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ascent-border bg-ascent-canvas/45 px-5 py-3">
      <p className="text-xs leading-5 text-ascent-muted" role="status">
        {count} {count === 1 ? "decision recorded" : "decisions recorded"}. Refresh the list to update totals and filters.
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={refreshing}
        onClick={() => startTransition(() => router.refresh())}
      >
        {refreshing ? <span className="inline-flex items-center gap-2"><Spinner /> Refreshing…</span> : "Refresh list"}
      </Button>
    </div>
  );
}
