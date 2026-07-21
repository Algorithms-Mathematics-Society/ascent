import "server-only";

import { getEligibleInstitutionById } from "@/content/institutions";
import type { AdminAnalyticsRow } from "@/lib/adminAnalytics";
import { adminDb } from "@/lib/firebaseAdmin";
import type { AdminDecision } from "@/lib/adminRegistrationView";

const ANALYTICS_SAFETY_LIMIT = 2000;
const JOIN_BATCH_SIZE = 150;

export interface AdminAnalyticsDataset {
  rows: AdminAnalyticsRow[];
  truncated: boolean;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function decisionValue(value: unknown): AdminDecision {
  return value === "APPROVED" || value === "WAITLISTED" || value === "REJECTED"
    ? value
    : "PENDING";
}

function pathValue(value: unknown): AdminAnalyticsRow["qualificationPath"] {
  return value === "AUTO" || value === "QUALIFIER" ? value : "UNDETERMINED";
}

function timestampIso(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }
  return null;
}

function listedInstitutionLabel(collegeId: unknown) {
  if (typeof collegeId !== "string" || !collegeId) return null;
  const institution = getEligibleInstitutionById(collegeId);
  if (!institution) return null;
  return institution.campus
    ? `${institution.canonical_name}, ${institution.campus}`
    : institution.canonical_name;
}

export async function getAdminAnalyticsDataset(): Promise<AdminAnalyticsDataset> {
  const applicationsSnapshot = await adminDb
    .collection("applications")
    .orderBy("created_at", "desc")
    .limit(ANALYTICS_SAFETY_LIMIT + 1)
    .get();
  if (applicationsSnapshot.empty) return { rows: [], truncated: false };

  const applicationDocuments = applicationsSnapshot.docs.slice(0, ANALYTICS_SAFETY_LIMIT);
  const joinedSnapshots = [];
  for (let start = 0; start < applicationDocuments.length; start += JOIN_BATCH_SIZE) {
    const documents = applicationDocuments.slice(start, start + JOIN_BATCH_SIZE);
    const references = documents.flatMap((document) => [
      adminDb.collection("pii").doc(document.id),
      adminDb.collection("unlisted_college_submissions").doc(document.id),
      adminDb.collection("admin_registration_decisions").doc(document.id),
    ]);
    joinedSnapshots.push(...(await adminDb.getAll(...references)));
  }

  const piiById = new Map<string, Record<string, unknown>>();
  const unlistedById = new Map<string, Record<string, unknown>>();
  const decisionsById = new Map<string, Record<string, unknown>>();
  joinedSnapshots.forEach((snapshot, index) => {
    const target = [piiById, unlistedById, decisionsById][index % 3];
    target.set(snapshot.id, snapshot.data() ?? {});
  });

  return {
    rows: applicationDocuments.map((document) => {
      const application = document.data();
      const pii = piiById.get(document.id) ?? {};
      const unlisted = unlistedById.get(document.id) ?? {};
      const decision = decisionsById.get(document.id) ?? {};
      return {
        id: document.id,
        institution:
          listedInstitutionLabel(application.college_id) ??
          stringValue(unlisted.typed_name, "Institution not recorded"),
        educationStage: stringValue(application.education_stage, "NOT_RECORDED"),
        codeforcesHandle: nullableString(application.codeforces_handle),
        qualificationPath: pathValue(application.qualification_path),
        decision: decisionValue(application.admin_decision),
        decidedAt: timestampIso(decision.decided_at),
        decidedBy: nullableString(decision.actor_email),
        submittedAt: timestampIso(application.created_at),
        resumeUrl: stringValue(pii.resume_url),
        transcriptUrl: nullableString(pii.transcript_url),
        linkedInUrl: nullableString(pii.linkedin_url),
        githubUrl: nullableString(pii.github_url),
      };
    }),
    truncated: applicationsSnapshot.size > ANALYTICS_SAFETY_LIMIT,
  };
}
