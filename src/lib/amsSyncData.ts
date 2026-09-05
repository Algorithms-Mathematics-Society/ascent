import "server-only";

import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Firestore access for the AMS sync. Split from `amsSync.ts` so the payload
 * logic stays pure and testable without the Admin SDK — the same `*Data.ts`
 * split this codebase already uses for registration settings and admin
 * activity.
 */

/** Read the three documents one payload is assembled from.
 *
 * The registrant is deliberately split across three collections by
 * sensitivity — `applications` holds non-PII, `pii` holds the person,
 * `consent` holds the grant — so this is the one place that reads all three.
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
