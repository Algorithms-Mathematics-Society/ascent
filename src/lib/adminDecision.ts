import type { AdminDecision } from "@/lib/adminRegistrationView";

export const ADMIN_DECISION_REASON_MAX_LENGTH = 500;
export const ADMIN_REQUIRED_REASON_MIN_LENGTH = 10;
export const ADMIN_REJECTION_REASON_MIN_LENGTH =
  ADMIN_REQUIRED_REASON_MIN_LENGTH;

export type ActionableAdminDecision = Extract<
  AdminDecision,
  "APPROVED" | "WAITLISTED" | "REJECTED"
>;

export interface AdminDecisionInput {
  decision: ActionableAdminDecision;
  expectedDecision: AdminDecision;
  reason: string | null;
}

export type AdminDecisionValidationResult =
  | { ok: true; value: AdminDecisionInput }
  | { ok: false; error: string };

function normalizeReason(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

export function isAdminDecision(value: unknown): value is AdminDecision {
  return (
    value === "PENDING" ||
    value === "APPROVED" ||
    value === "WAITLISTED" ||
    value === "REJECTED"
  );
}

export function parseAdminDecisionInput(
  body: unknown,
): AdminDecisionValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Decision details are required." };
  }

  const candidate = body as Record<string, unknown>;
  if (
    candidate.decision !== "APPROVED" &&
    candidate.decision !== "WAITLISTED" &&
    candidate.decision !== "REJECTED"
  ) {
    return { ok: false, error: "Choose approve, waitlist or reject." };
  }
  if (!isAdminDecision(candidate.expectedDecision)) {
    return { ok: false, error: "Refresh this registration before deciding." };
  }
  if (candidate.decision === candidate.expectedDecision) {
    return { ok: false, error: "Choose a different decision." };
  }

  const reason = normalizeReason(candidate.reason);
  if (reason.length > ADMIN_DECISION_REASON_MAX_LENGTH) {
    return {
      ok: false,
      error: `Keep the decision note within ${ADMIN_DECISION_REASON_MAX_LENGTH} characters.`,
    };
  }
  const isCorrection = candidate.expectedDecision !== "PENDING";
  const reasonRequired = candidate.decision !== "APPROVED" || isCorrection;
  if (reasonRequired && reason.length < ADMIN_REQUIRED_REASON_MIN_LENGTH) {
    const actionLabel = isCorrection
      ? "changing this decision"
      : candidate.decision === "WAITLISTED"
        ? "waitlisting this registration"
        : "rejecting this registration";
    return {
      ok: false,
      error: `Add a clear reason for ${actionLabel} of at least ${ADMIN_REQUIRED_REASON_MIN_LENGTH} characters.`,
    };
  }

  return {
    ok: true,
    value: {
      decision: candidate.decision,
      expectedDecision: candidate.expectedDecision,
      reason: reason || null,
    },
  };
}

export function isSafeApplicationId(value: string) {
  return (
    value.length >= 20 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}
