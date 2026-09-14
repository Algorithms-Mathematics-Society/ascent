import "server-only";

import { unstable_cache } from "next/cache";
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

function hasAcceptedCount(data: Record<string, unknown> | undefined) {
  return (
    typeof data?.accepted_count === "number" &&
    Number.isSafeInteger(data.accepted_count) &&
    data.accepted_count >= 0
  );
}

// Public availability needs only controls, not a collection-wide count.
async function getRegistrationControls(): Promise<RegistrationSettings> {
  const document = await adminDb.collection("admin_config").doc("registration").get();
  const data = document.data();
  const settings = registrationSettingsFromData(data);
  if (settings.capacity !== null && !hasAcceptedCount(data)) {
    settings.acceptedCount = (await adminDb.collection("applications").count().get()).data().count;
  }
  return { ...settings, updatedAt: timestampIso(data?.updated_at) };
}

export async function getRegistrationSettings(): Promise<RegistrationSettings> {
  const settings = await getRegistrationControls();
  // Unlimited registrations do not write a shared counter on every submission.
  // Admin views obtain the authoritative count with an aggregation query.
  if (settings.capacity === null) {
    settings.acceptedCount = (await adminDb.collection("applications").count().get()).data().count;
  }
  return settings;
}

export async function getRegistrationAvailability(): Promise<{
  settings: RegistrationSettings;
  availability: RegistrationAvailability;
}> {
  const settings = await getRegistrationControls();
  return { settings, availability: registrationAvailability(settings) };
}

export const PUBLIC_REGISTRATION_AVAILABILITY_CACHE_TAG =
  "registration-availability";

const getCachedPublicRegistrationSettings = unstable_cache(
  getRegistrationControls,
  ["public-registration-settings-v2"],
  {
    revalidate: 15,
    tags: [PUBLIC_REGISTRATION_AVAILABILITY_CACHE_TAG],
  },
);

export async function getCachedRegistrationAvailability(): Promise<{
  settings: RegistrationSettings;
  availability: RegistrationAvailability;
}> {
  const settings = await getCachedPublicRegistrationSettings();
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
