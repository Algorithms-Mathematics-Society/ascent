import "server-only";

import { getEligibleInstitutionById } from "@/content/institutions";
import { adminDb } from "@/lib/firebaseAdmin";
import type {
  AdminDecision,
  AdminRegistrationRow,
} from "@/lib/adminRegistrationView";

const LATEST_REGISTRATIONS_LIMIT = 100;

export interface AdminRegistrationStats {
  total: number;
  pending: number;
  approved: number;
  waitlisted: number;
  rejected: number;
  unlistedInstitutions: number;
}

export interface AdminRegistrationAuditEvent {
  id: string;
  event: string;
  actor: string;
  actorEmail: string | null;
  previousDecision: AdminDecision | null;
  decision: AdminDecision | null;
  reason: string | null;
  timestamp: string | null;
}

export interface AdminRegistrationDetail extends AdminRegistrationRow {
  edition: string;
  applicationState: string;
  applicantStatus: string;
  collegeId: string | null;
  collegeTier: string;
  collegeVerificationStatus: string;
  collegeEmail: string | null;
  qualificationReason: string;
  emailVerified: boolean;
  updatedAt: string | null;
  decisionRevision: number;
  consentGranted: boolean;
  consentPolicyVersion: string | null;
  consentGrantedAt: string | null;
  auditEvents: AdminRegistrationAuditEvent[];
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function booleanValue(value: unknown) {
  return value === true;
}

function decisionValue(value: unknown): AdminDecision {
  return value === "APPROVED" || value === "WAITLISTED" || value === "REJECTED"
    ? value
    : "PENDING";
}

function pathValue(value: unknown): AdminRegistrationRow["qualificationPath"] {
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

export async function getAdminRegistrationStats(): Promise<AdminRegistrationStats> {
  const applications = adminDb.collection("applications");
  const [total, approved, waitlisted, rejected, unlisted] = await Promise.all([
    applications.count().get(),
    applications.where("admin_decision", "==", "APPROVED").count().get(),
    applications.where("admin_decision", "==", "WAITLISTED").count().get(),
    applications.where("admin_decision", "==", "REJECTED").count().get(),
    applications.where("college_tier", "==", "UNLISTED").count().get(),
  ]);

  const totalCount = total.data().count;
  const approvedCount = approved.data().count;
  const waitlistedCount = waitlisted.data().count;
  const rejectedCount = rejected.data().count;

  return {
    total: totalCount,
    pending: Math.max(
      0,
      totalCount - approvedCount - waitlistedCount - rejectedCount,
    ),
    approved: approvedCount,
    waitlisted: waitlistedCount,
    rejected: rejectedCount,
    unlistedInstitutions: unlisted.data().count,
  };
}

export async function getLatestAdminRegistrations(): Promise<
  AdminRegistrationRow[]
> {
  const applicationsSnapshot = await adminDb
    .collection("applications")
    .orderBy("created_at", "desc")
    .limit(LATEST_REGISTRATIONS_LIMIT)
    .get();

  if (applicationsSnapshot.empty) return [];

  const piiRefs = applicationsSnapshot.docs.map((doc) =>
    adminDb.collection("pii").doc(doc.id),
  );
  const unlistedRefs = applicationsSnapshot.docs.map((doc) =>
    adminDb.collection("unlisted_college_submissions").doc(doc.id),
  );
  const decisionRefs = applicationsSnapshot.docs.map((doc) =>
    adminDb.collection("admin_registration_decisions").doc(doc.id),
  );
  const joinedSnapshots = await adminDb.getAll(
    ...piiRefs,
    ...unlistedRefs,
    ...decisionRefs,
  );
  const piiById = new Map(
    joinedSnapshots
      .slice(0, piiRefs.length)
      .map((snapshot) => [snapshot.id, snapshot.data() ?? {}]),
  );
  const unlistedById = new Map(
    joinedSnapshots
      .slice(piiRefs.length)
      .slice(0, unlistedRefs.length)
      .map((snapshot) => [snapshot.id, snapshot.data() ?? {}]),
  );
  const decisionsById = new Map(
    joinedSnapshots
      .slice(piiRefs.length + unlistedRefs.length)
      .map((snapshot) => [snapshot.id, snapshot.data() ?? {}]),
  );

  return applicationsSnapshot.docs.map((applicationDocument) => {
    const application = applicationDocument.data();
    const pii = piiById.get(applicationDocument.id) ?? {};
    const unlisted = unlistedById.get(applicationDocument.id) ?? {};
    const decision = decisionsById.get(applicationDocument.id) ?? {};
    const institution =
      listedInstitutionLabel(application.college_id) ??
      stringValue(unlisted.typed_name, "Institution not recorded");

    return {
      id: applicationDocument.id,
      reference: stringValue(application.reference, "Reference pending"),
      legalName: stringValue(pii.legal_name, "Name unavailable"),
      email: stringValue(pii.email, stringValue(pii.email_masked, "—")),
      phone: stringValue(pii.phone, "—"),
      institution,
      educationStage: stringValue(application.education_stage, "—"),
      studyLevel: stringValue(application.current_study_level, "—"),
      graduationYear:
        typeof application.graduation_year === "number"
          ? application.graduation_year
          : null,
      codeforcesHandle: nullableString(application.codeforces_handle),
      qualificationPath: pathValue(application.qualification_path),
      decision: decisionValue(application.admin_decision),
      decisionReason: nullableString(decision.reason),
      decidedAt: timestampIso(decision.decided_at),
      decidedBy: nullableString(decision.actor_email),
      submittedAt: timestampIso(application.created_at),
      resumeUrl: stringValue(pii.resume_url),
      transcriptUrl: nullableString(pii.transcript_url),
      linkedInUrl: nullableString(pii.linkedin_url),
      githubUrl: nullableString(pii.github_url),
    };
  });
}

export async function getAdminRegistrationDetail(
  applicationId: string,
): Promise<AdminRegistrationDetail | null> {
  const applicationRef = adminDb.collection("applications").doc(applicationId);
  const piiRef = adminDb.collection("pii").doc(applicationId);
  const unlistedRef = adminDb
    .collection("unlisted_college_submissions")
    .doc(applicationId);
  const decisionRef = adminDb
    .collection("admin_registration_decisions")
    .doc(applicationId);
  const consentRef = adminDb.collection("consent").doc(applicationId);

  const [documents, auditSnapshot] = await Promise.all([
    adminDb.getAll(
      applicationRef,
      piiRef,
      unlistedRef,
      decisionRef,
      consentRef,
    ),
    adminDb
      .collection("audit_log")
      .where("subject_id", "==", applicationId)
      .get(),
  ]);

  const [applicationDocument, piiDocument, unlistedDocument, decisionDocument, consentDocument] =
    documents;
  if (!applicationDocument.exists) return null;

  const application = applicationDocument.data() ?? {};
  const pii = piiDocument.data() ?? {};
  const unlisted = unlistedDocument.data() ?? {};
  const decision = decisionDocument.data() ?? {};
  const consent = consentDocument.data() ?? {};
  const participationConsent =
    consent.CONTEST_PARTICIPATION &&
    typeof consent.CONTEST_PARTICIPATION === "object"
      ? (consent.CONTEST_PARTICIPATION as Record<string, unknown>)
      : {};
  const institution =
    listedInstitutionLabel(application.college_id) ??
    stringValue(unlisted.typed_name, "Institution not recorded");

  const auditEvents = auditSnapshot.docs
    .map((document): AdminRegistrationAuditEvent => {
      const event = document.data();
      return {
        id: document.id,
        event: stringValue(event.event, "ADMIN_EVENT"),
        actor: stringValue(event.actor, "system"),
        actorEmail: nullableString(event.actor_email),
        previousDecision: event.previous_decision
          ? decisionValue(event.previous_decision)
          : null,
        decision: event.decision ? decisionValue(event.decision) : null,
        reason: nullableString(event.reason),
        timestamp: timestampIso(event.timestamp),
      };
    })
    .sort((left, right) =>
      (right.timestamp ?? "").localeCompare(left.timestamp ?? ""),
    );

  return {
    id: applicationDocument.id,
    reference: stringValue(application.reference, "Reference pending"),
    legalName: stringValue(pii.legal_name, "Name unavailable"),
    email: stringValue(pii.email, stringValue(pii.email_masked, "—")),
    phone: stringValue(pii.phone, "—"),
    institution,
    educationStage: stringValue(application.education_stage, "—"),
    studyLevel: stringValue(application.current_study_level, "—"),
    graduationYear:
      typeof application.graduation_year === "number"
        ? application.graduation_year
        : null,
    codeforcesHandle: nullableString(application.codeforces_handle),
    qualificationPath: pathValue(application.qualification_path),
    decision: decisionValue(application.admin_decision),
    decisionReason: nullableString(decision.reason),
    decidedAt: timestampIso(decision.decided_at),
    decidedBy: nullableString(decision.actor_email),
    submittedAt: timestampIso(application.created_at),
    resumeUrl: stringValue(pii.resume_url),
    transcriptUrl: nullableString(pii.transcript_url),
    linkedInUrl: nullableString(pii.linkedin_url),
    githubUrl: nullableString(pii.github_url),
    edition: stringValue(application.edition, "—"),
    applicationState: stringValue(application.state, "—"),
    applicantStatus: stringValue(application.status, "—"),
    collegeId: nullableString(application.college_id),
    collegeTier: stringValue(application.college_tier, "—"),
    collegeVerificationStatus: stringValue(
      application.college_verification_status,
      "UNVERIFIED",
    ),
    collegeEmail: nullableString(pii.college_email),
    qualificationReason: stringValue(
      application.qualification_reason,
      "Qualification reason not recorded.",
    ),
    emailVerified: booleanValue(application.email_verified),
    updatedAt: timestampIso(application.updated_at),
    decisionRevision:
      typeof decision.revision === "number" ? decision.revision : 0,
    consentGranted: booleanValue(participationConsent.granted),
    consentPolicyVersion: nullableString(participationConsent.policy_version),
    consentGrantedAt: timestampIso(participationConsent.granted_at),
    auditEvents,
  };
}
