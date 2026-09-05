/**
 * Drain the AMS Access sync outbox.
 *
 * The decision handler queues a row inside its own transaction; this sends
 * it. Deliberately a separate step — see `lib/amsSync.ts` for why an HTTP call
 * cannot live inside a Firestore transaction without either being re-sent on
 * retry or lost on a crash.
 *
 * Safe to run repeatedly. The AMS side is idempotent on `subject_id`, so a
 * double-drain updates rather than duplicating, and anything already SYNCED is
 * skipped here before it gets that far.
 *
 * `GET` reports what is outstanding without sending anything, so the console
 * can show a backlog without acting on it.
 */

import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  requestHasSameOrigin,
  secureTokenEqual,
} from "@/lib/adminSecurity";
import {
  buildPayload,
  OUTBOX_COLLECTION,
  postToAms,
} from "@/lib/amsSync";
import { loadRegistrant } from "@/lib/amsSyncData";
import { adminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";

/** One drain handles at most this many. A run that never ends is worse than
 * one that leaves a remainder: the remainder is visible and the next run picks
 * it up, whereas a request killed at the platform timeout leaves rows in an
 * unknown state. */
const BATCH_LIMIT = 50;

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function requireAdmin(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return null;
  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  return await verifyAdminSessionValue(sessionValue);
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) {
    return noStoreJson({ success: false, error: "Your admin session has expired." }, 401);
  }

  const snapshot = await adminDb.collection(OUTBOX_COLLECTION).get();
  const counts: Record<string, number> = { PENDING: 0, SYNCED: 0, FAILED: 0 };
  const failures: Array<{ subject_id: string; error: string }> = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const status = typeof data.status === "string" ? data.status : "PENDING";
    counts[status] = (counts[status] ?? 0) + 1;
    if (status === "FAILED") {
      failures.push({
        subject_id: doc.id,
        error: typeof data.last_error === "string" ? data.last_error : "unknown",
      });
    }
  }

  return noStoreJson({ success: true, counts, failures: failures.slice(0, 50) });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) {
    return noStoreJson({ success: false, error: "Your admin session has expired." }, 401);
  }

  const submitted = request.headers.get("x-csrf-token");
  const cookieToken = request.cookies.get(ADMIN_CSRF_COOKIE)?.value;
  if (
    typeof submitted !== "string" ||
    typeof cookieToken !== "string" ||
    !secureTokenEqual(submitted, cookieToken)
  ) {
    return noStoreJson({ success: false, error: "Sync could not be started." }, 403);
  }

  const apiUrl = process.env.AMS_API_URL || "";
  const apiKey = process.env.AMS_INGEST_API_KEY || "";
  if (!apiUrl || !apiKey) {
    // Say which piece is missing rather than failing every row with a network
    // error that points nowhere.
    return noStoreJson(
      { success: false, error: "AMS_API_URL and AMS_INGEST_API_KEY are not configured." },
      503,
    );
  }

  // PENDING and FAILED both: a failure is a thing to retry, not a terminal
  // state. Whatever caused it — AMS down, a bad payload since corrected — is
  // usually fixed by the time somebody presses this again.
  const pending = await adminDb
    .collection(OUTBOX_COLLECTION)
    .where("status", "in", ["PENDING", "FAILED"])
    .limit(BATCH_LIMIT)
    .get();

  let synced = 0;
  let failed = 0;
  const errors: Array<{ subject_id: string; error: string }> = [];

  for (const doc of pending.docs) {
    const subjectId = doc.id;
    try {
      // Assembled now, not when it was queued: a correction made between
      // approval and sync should be picked up rather than frozen into a
      // stale copy.
      const { application, pii, consent } = await loadRegistrant(subjectId);
      const payload = buildPayload(subjectId, application, pii, consent);

      if ("error" in payload) {
        throw new Error(payload.error);
      }

      const result = await postToAms(payload, { apiUrl, apiKey });

      await doc.ref.update({
        status: "SYNCED",
        student_uid: result.student_uid,
        handle: result.handle,
        outcome: result.outcome,
        last_error: null,
        synced_at: adminServerTimestamp(),
      });
      synced += 1;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "unknown error";
      failed += 1;
      errors.push({ subject_id: subjectId, error: message.slice(0, 300) });
      // Recorded, never thrown away. A row that failed silently is a
      // registrant who does not exist on the other side and nobody knows.
      await doc.ref.update({
        status: "FAILED",
        last_error: message.slice(0, 1000),
        attempts:
          (typeof doc.data().attempts === "number" ? doc.data().attempts : 0) + 1,
        last_attempted_at: adminServerTimestamp(),
      });
    }
  }

  return noStoreJson({
    success: true,
    processed: pending.size,
    synced,
    failed,
    remaining: pending.size === BATCH_LIMIT ? "more" : "none",
    errors: errors.slice(0, 20),
  });
}
