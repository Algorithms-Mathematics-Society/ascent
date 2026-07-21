import "server-only";

import { getEligibleInstitutionById } from "@/content/institutions";
import {
  normalizeAdminTags,
  type AdminRegistrationTag,
} from "@/lib/adminOperations";
import { adminDb } from "@/lib/firebaseAdmin";
import type {
  AdminDecision,
  AdminRegistrationRow,
} from "@/lib/adminRegistrationView";

const ADMIN_REGISTRATIONS_SAFETY_LIMIT = 2000;
const ADMIN_JOIN_BATCH_SIZE = 100;

export interface AdminRegistrationDataset {
  rows: AdminRegistrationRow[];
  truncated: boolean;
}

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

export interface AdminRegistrationNote {
  id: string;
  body: string;
  actorEmail: string;
  createdAt: string | null;
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
  operationsRevision: number;
  consentGranted: boolean;
  consentPolicyVersion: string | null;
  consentGrantedAt: string | null;
  auditEvents: AdminRegistrationAuditEvent[];
  notes: AdminRegistrationNote[];
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

function nonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
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

export async function getAllAdminRegistrations(): Promise<AdminRegistrationDataset> {
  const applicationsSnapshot = await adminDb
    .collection("applications")
    .orderBy("created_at", "desc")
    .limit(ADMIN_REGISTRATIONS_SAFETY_LIMIT + 1)
    .get();

  if (applicationsSnapshot.empty) return { rows: [], truncated: false };

  const applicationDocuments = applicationsSnapshot.docs.slice(
    0,
    ADMIN_REGISTRATIONS_SAFETY_LIMIT,
  );
  const joinedSnapshots = [];
  for (let start = 0; start < applicationDocuments.length; start += ADMIN_JOIN_BATCH_SIZE) {
    const documents = applicationDocuments.slice(start, start + ADMIN_JOIN_BATCH_SIZE);
    const refs = documents.flatMap((doc) => [
      adminDb.collection("pii").doc(doc.id),
      adminDb.collection("unlisted_college_submissions").doc(doc.id),
      adminDb.collection("admin_registration_decisions").doc(doc.id),
      adminDb.collection("admin_registration_operations").doc(doc.id),
    ]);
    joinedSnapshots.push(...(await adminDb.getAll(...refs)));
  }

  const piiById = new Map<string, Record<string, unknown>>();
  const unlistedById = new Map<string, Record<string, unknown>>();
  const decisionsById = new Map<string, Record<string, unknown>>();
  const operationsById = new Map<string, Record<string, unknown>>();
  joinedSnapshots.forEach((snapshot, index) => {
    const target = [piiById, unlistedById, decisionsById, operationsById][index % 4];
    target.set(snapshot.id, snapshot.data() ?? {});
  });

  const rows = applicationDocuments.map((applicationDocument) => {
    const application = applicationDocument.data();
    const pii = piiById.get(applicationDocument.id) ?? {};
    const unlisted = unlistedById.get(applicationDocument.id) ?? {};
    const decision = decisionsById.get(applicationDocument.id) ?? {};
    const operations = operationsById.get(applicationDocument.id) ?? {};
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
      tags: normalizeAdminTags(operations.tags),
    };
  });
  return {
    rows,
    truncated: applicationsSnapshot.size > ADMIN_REGISTRATIONS_SAFETY_LIMIT,
  };
}

export async function getLatestAdminRegistrations(): Promise<AdminRegistrationRow[]> {
  return (await getAllAdminRegistrations()).rows.slice(0, 100);
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
  const operationsRef = adminDb
    .collection("admin_registration_operations")
    .doc(applicationId);

  const [documents, auditSnapshot, notesSnapshot] = await Promise.all([
    adminDb.getAll(
      applicationRef,
      piiRef,
      unlistedRef,
      decisionRef,
      consentRef,
      operationsRef,
    ),
    adminDb
      .collection("audit_log")
      .where("subject_id", "==", applicationId)
      .get(),
    operationsRef.collection("notes").get(),
  ]);

  const [
    applicationDocument,
    piiDocument,
    unlistedDocument,
    decisionDocument,
    consentDocument,
    operationsDocument,
  ] = documents;
  if (!applicationDocument.exists) return null;

  const application = applicationDocument.data() ?? {};
  const pii = piiDocument.data() ?? {};
  const unlisted = unlistedDocument.data() ?? {};
  const decision = decisionDocument.data() ?? {};
  const consent = consentDocument.data() ?? {};
  const operations = operationsDocument.data() ?? {};
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

  const notes = notesSnapshot.docs
    .map((document): AdminRegistrationNote => {
      const note = document.data();
      return {
        id: document.id,
        body: stringValue(note.body, "Private note unavailable."),
        actorEmail: stringValue(note.actor_email, "Administrator"),
        createdAt: timestampIso(note.created_at),
      };
    })
    .sort((left, right) =>
      (right.createdAt ?? "").localeCompare(left.createdAt ?? ""),
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
    tags: normalizeAdminTags(operations.tags) as AdminRegistrationTag[],
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
      nonNegativeInteger(decision.revision),
    operationsRevision: nonNegativeInteger(operations.revision),
    consentGranted: booleanValue(participationConsent.granted),
    consentPolicyVersion: nullableString(participationConsent.policy_version),
    consentGrantedAt: timestampIso(participationConsent.granted_at),
    auditEvents,
    notes,
  };
}
