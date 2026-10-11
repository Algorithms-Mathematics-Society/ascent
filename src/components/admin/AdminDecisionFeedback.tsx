"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
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
 * The full queue refresh can finish independently of feedback for a saved row.
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
