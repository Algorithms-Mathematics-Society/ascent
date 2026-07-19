export type Edition = string;

export type ApplicationState =
  "DRAFT" | "EMAIL_VERIFIED" | "PROFILE_COMPLETE" | "QUALIFICATION_DETERMINED";

export type CollegeTier = "AUTO_QUALIFY" | "STANDARD" | "UNLISTED";

export type QualificationPath = "AUTO" | "QUALIFIER" | "UNDETERMINED";

export type CollegeVerificationStatus = "VERIFIED" | "UNVERIFIED";

export type ApplicantStatus = "STUDENT" | "PROFESSIONAL" | "OTHER";

export interface Application {
  edition: Edition;
  state: ApplicationState;
  handle: string;
  college_id: string | null;
  college_tier: CollegeTier;
  year_of_study: string | null;
  graduation_year: number | null;
  status: ApplicantStatus | null;
  skills: string[] | null;
  qualification_path: QualificationPath;
  qualification_reason: string | null;
  created_at: unknown;
  updated_at: unknown;
}

export interface Pii {
  legal_name: string;
  email: string;
  email_masked: string;
  phone: string | null;
  resume_ref: string | null;
  college_email: string | null;
}

export interface College {
  canonical_name: string;
  canonical_name_lower: string;
  search_terms: string[];
  aliases: string[];
  campus: string | null;
  tier: "AUTO_QUALIFY" | "STANDARD";
  email_domains: string[];
  active: boolean;
}
