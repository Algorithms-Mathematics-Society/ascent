import type { CollegeTier, QualificationPath } from "@/types/registration";

export interface QualificationResult {
  path: QualificationPath;
  reason: string;
}

/**
 * Membership of the eligible-institution list is the whole test.
 *
 * A listed institution takes the direct path: the entry is accepted on
 * submission and goes into Round 1. Everything else takes the qualifier path,
 * where the team accepts or rejects the entry. There is no separate
 * institution-verification step, so nothing here waits on one.
 */
export function determinePath(collegeTier: CollegeTier): QualificationResult {
  if (collegeTier === "AUTO_QUALIFY") {
    return { path: "AUTO", reason: "listed institution" };
  }
  if (collegeTier === "UNLISTED") {
    return { path: "QUALIFIER", reason: "unlisted institution" };
  }
  return { path: "QUALIFIER", reason: "standard tier" };
}
