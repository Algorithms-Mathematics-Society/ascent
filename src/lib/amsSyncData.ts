import "server-only";

import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Firestore access for the AMS sync. Split from `amsSync.ts` so the payload
 * logic stays pure and testable without the Admin SDK. Registration settings
 * and admin activity use the same `*Data.ts` separation.
 */

/** Read the three documents one payload is assembled from.
 *
 * Registrant data spans three collections: `applications` for non-PII,
 * `pii` for personal details, and `consent` for the grant. Read them together
 * when assembling a transfer.
 */
export async function loadRegistrant(subjectId: string) {
  const [application, pii, consent] = await adminDb.getAll(
    adminDb.collection("applications").doc(subjectId),
    adminDb.collection("pii").doc(subjectId),
    adminDb.collection("consent").doc(subjectId),
  );
  return {
    application: application.data(),
    pii: pii.data(),
    consent: consent.data(),
  };
}
