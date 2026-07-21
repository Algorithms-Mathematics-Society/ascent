import { isSafeApplicationId } from "./adminDecision";

export const ADMIN_BULK_MAX_APPLICATIONS = 25;
export const ADMIN_BULK_REASON_MIN_LENGTH = 10;
export const ADMIN_BULK_REASON_MAX_LENGTH = 500;

export type AdminBulkDecision = "APPROVED" | "WAITLISTED";

type AdminBulkDecisionResult =
  | {
      ok: true;
      value: {
        applicationIds: string[];
        decision: AdminBulkDecision;
        reason: string;
      };
    }
  | { ok: false; error: string };

export function parseAdminBulkDecisionInput(
  body: unknown,
): AdminBulkDecisionResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Batch decision details are required." };
  }
  const candidate = body as Record<string, unknown>;
  if (candidate.decision !== "APPROVED" && candidate.decision !== "WAITLISTED") {
    return {
      ok: false,
      error: "Batch review supports approval or waitlisting only.",
    };
  }
  if (!Array.isArray(candidate.applicationIds)) {
    return { ok: false, error: "Select registrations for batch review." };
  }
  const applicationIds = [...new Set(candidate.applicationIds)];
  if (
    applicationIds.length < 1 ||
    applicationIds.length > ADMIN_BULK_MAX_APPLICATIONS ||
    applicationIds.some(
      (id) => typeof id !== "string" || !isSafeApplicationId(id),
    )
  ) {
    return {
      ok: false,
      error: `Select between 1 and ${ADMIN_BULK_MAX_APPLICATIONS} valid registrations.`,
    };
  }
  const reason =
    typeof candidate.reason === "string"
      ? candidate.reason.trim().replace(/\s+/g, " ")
      : "";
  if (reason.length < ADMIN_BULK_REASON_MIN_LENGTH) {
    return {
      ok: false,
      error: `Add a batch reason of at least ${ADMIN_BULK_REASON_MIN_LENGTH} characters.`,
    };
  }
  if (reason.length > ADMIN_BULK_REASON_MAX_LENGTH) {
    return {
      ok: false,
      error: `Keep the batch reason within ${ADMIN_BULK_REASON_MAX_LENGTH} characters.`,
    };
  }
  return {
    ok: true,
    value: {
      applicationIds: applicationIds as string[],
      decision: candidate.decision,
      reason,
    },
  };
}
