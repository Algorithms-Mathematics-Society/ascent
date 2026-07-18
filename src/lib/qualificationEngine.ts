import type {
  CollegeTier,
  CollegeVerificationStatus,
  QualificationPath,
} from "@/types/registration";

export interface QualificationResult {
  path: QualificationPath;
  reason: string;
}

export function determinePath(
  collegeTier: CollegeTier,
  collegeVerificationStatus: CollegeVerificationStatus,
): QualificationResult {
  if (collegeTier === "UNLISTED") {
    return { path: "QUALIFIER", reason: "unlisted college" };
  }
  if (
    collegeTier === "AUTO_QUALIFY" &&
    collegeVerificationStatus === "VERIFIED"
  ) {
    return { path: "AUTO", reason: "verified tier-1 college" };
  }
  if (
    collegeTier === "AUTO_QUALIFY" &&
    collegeVerificationStatus === "UNVERIFIED"
  ) {
    return { path: "QUALIFIER", reason: "tier-1 claim unverified" };
  }
  return { path: "QUALIFIER", reason: "standard tier" };
}
