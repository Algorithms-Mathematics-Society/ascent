import "server-only";

import {
  adminActivityCategory,
  type AdminActivityEntry,
} from "@/lib/adminActivity";
import { adminDb } from "@/lib/firebaseAdmin";
import type { AdminDecision } from "@/lib/adminRegistrationView";

const LATEST_ACTIVITY_LIMIT = 250;

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function decisionValue(value: unknown): AdminDecision | null {
  return value === "PENDING" ||
    value === "APPROVED" ||
    value === "WAITLISTED" ||
    value === "REJECTED"
    ? value
    : null;
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

export async function getLatestAdminActivity(): Promise<AdminActivityEntry[]> {
  const activitySnapshot = await adminDb
    .collection("audit_log")
    .orderBy("timestamp", "desc")
    .limit(LATEST_ACTIVITY_LIMIT)
    .get();

  if (activitySnapshot.empty) return [];

  const subjectIds = [
    ...new Set(
      activitySnapshot.docs
        .map((document) => nullableString(document.data().subject_id))
        .filter((subjectId): subjectId is string => Boolean(subjectId)),
    ),
  ];
  const applicationRefs = subjectIds.map((subjectId) =>
    adminDb.collection("applications").doc(subjectId),
  );
  const piiRefs = subjectIds.map((subjectId) =>
    adminDb.collection("pii").doc(subjectId),
  );
  const joinedDocuments = subjectIds.length
    ? await adminDb.getAll(...applicationRefs, ...piiRefs)
    : [];
  const applicationsById = new Map(
    joinedDocuments
      .slice(0, applicationRefs.length)
      .map((document) => [document.id, document.data() ?? {}]),
  );
  const piiById = new Map(
    joinedDocuments
      .slice(applicationRefs.length)
      .map((document) => [document.id, document.data() ?? {}]),
  );

  return activitySnapshot.docs.map((document) => {
    const activity = document.data();
    const subjectId = nullableString(activity.subject_id);
    const application = subjectId ? applicationsById.get(subjectId) ?? {} : {};
    const pii = subjectId ? piiById.get(subjectId) ?? {} : {};
    const event = stringValue(activity.event, "SYSTEM_EVENT");

    return {
      id: document.id,
      subjectId,
      applicantName: stringValue(pii.legal_name, "Applicant unavailable"),
      reference: stringValue(application.reference, "Reference unavailable"),
      event,
      category: adminActivityCategory(event),
      actor: stringValue(activity.actor, "system"),
      actorEmail: nullableString(activity.actor_email),
      targetEmail: nullableString(activity.target_email),
      previousDecision: decisionValue(activity.previous_decision),
      decision: decisionValue(activity.decision),
      reason: nullableString(activity.reason),
      bulkOperationId: nullableString(activity.bulk_operation_id),
      timestamp: timestampIso(activity.timestamp),
    };
  });
}
