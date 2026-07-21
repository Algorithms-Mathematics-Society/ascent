import "server-only";

import { adminDb } from "@/lib/firebaseAdmin";
import {
  registrationAvailability,
  registrationSettingsFromData,
  type RegistrationAvailability,
  type RegistrationSettings,
} from "@/lib/registrationSettings";

export interface RegistrationRetentionInventory {
  applications: number;
  piiRecords: number;
  consentRecords: number;
  decisionRecords: number;
  auditEvents: number;
  dedupeRecords: number;
  submissionReceipts: number;
  oldestRegistration: string | null;
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

export async function getRegistrationSettings(): Promise<RegistrationSettings> {
  const [settingsDocument, applicationCount] = await Promise.all([
    adminDb.collection("admin_config").doc("registration").get(),
    adminDb.collection("applications").count().get(),
  ]);
  const settings = registrationSettingsFromData(
    settingsDocument.data(),
    applicationCount.data().count,
  );
  return {
    ...settings,
    updatedAt: timestampIso(settingsDocument.data()?.updated_at),
  };
}

export async function getRegistrationAvailability(): Promise<{
  settings: RegistrationSettings;
  availability: RegistrationAvailability;
}> {
  const settings = await getRegistrationSettings();
  return { settings, availability: registrationAvailability(settings) };
}

export async function getRegistrationRetentionInventory(): Promise<RegistrationRetentionInventory> {
  const [
    applications,
    pii,
    consent,
    decisions,
    audit,
    emails,
    phones,
    submissions,
    oldest,
  ] = await Promise.all([
    adminDb.collection("applications").count().get(),
    adminDb.collection("pii").count().get(),
    adminDb.collection("consent").count().get(),
    adminDb.collection("admin_registration_decisions").count().get(),
    adminDb.collection("audit_log").count().get(),
    adminDb.collection("emails").count().get(),
    adminDb.collection("phones").count().get(),
    adminDb.collection("registration_submissions").count().get(),
    adminDb.collection("applications").orderBy("created_at", "asc").limit(1).get(),
  ]);
  return {
    applications: applications.data().count,
    piiRecords: pii.data().count,
    consentRecords: consent.data().count,
    decisionRecords: decisions.data().count,
    auditEvents: audit.data().count,
    dedupeRecords: emails.data().count + phones.data().count,
    submissionReceipts: submissions.data().count,
    oldestRegistration: oldest.empty
      ? null
      : timestampIso(oldest.docs[0].data().created_at),
  };
}
