import "server-only";
import { randomUUID } from "node:crypto";
import { adminDb } from "../firebaseAdmin";
import { EMAIL_OUTBOX, emailJob, reminderEmailId } from "./messages";
import { getEmailConfig } from "./resend";
import { tryDeliverEmail } from "./delivery";

/** Daily Hobby cron and the admin button share this bounded, leased worker. */
export async function processEmailQueue() {
  if (!getEmailConfig()) return { configured: false, busy: false, processed: 0 };
  const deadline = Date.now() + 40000;
  const stateRef = adminDb.collection("admin_config").doc("email_worker");
  const lease = randomUUID();
  const acquired = await adminDb.runTransaction(async (tx) => {
    const state = await tx.get(stateRef);
    if ((state.data()?.lease_until || 0) > Date.now()) return false;
    tx.set(stateRef, { lease, lease_until: Date.now() + 120000 }, { merge: true });
    return true;
  });
  if (!acquired) return { configured: true, busy: true, processed: 0 };
  let processed = 0;
  const outcomes: Record<string, number> = {};
  try {
    // Catch reminders collected before email support shipped. A stable cursor
    // traverses the old list; new signups enqueue in their own transaction.
    const state = await stateRef.get();
    if (!state.data()?.reminders_backfilled) {
      let query = adminDb.collection("registration_reminders").orderBy("__name__").limit(50);
      const cursor = state.data()?.reminder_cursor;
      if (typeof cursor === "string") query = query.startAfter(cursor);
      const reminders = await query.get();
      if (reminders.size) {
        await adminDb.runTransaction(async (tx) => {
          const refs = reminders.docs.map(doc => adminDb.collection(EMAIL_OUTBOX).doc(reminderEmailId(doc.id)));
          const jobs = await tx.getAll(...refs);
          jobs.forEach((job, index) => {
            if (!job.exists) tx.create(refs[index], emailJob("REGISTRATION_REMINDER", reminders.docs[index].id));
          });
          tx.update(stateRef, { reminder_cursor: reminders.docs[reminders.size - 1].id, reminders_backfilled: reminders.size < 50 });
        });
      } else await stateRef.update({ reminders_backfilled: true });
    }
    const pending = await adminDb.collection(EMAIL_OUTBOX).where("due_at", "<=", Date.now()).orderBy("due_at").limit(50).get();
    for (const job of pending.docs) {
      if (Date.now() >= deadline) break;
      const result = await tryDeliverEmail(job.id);
      outcomes[result] = (outcomes[result] || 0) + 1;
      processed++;
      if (result === "RETRY") break; // Do not hammer an unavailable/rate-limited provider.
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    return { configured: true, busy: false, processed, outcomes };
  } finally {
    await adminDb.runTransaction(async (tx) => {
      const current = await tx.get(stateRef);
      if (current.data()?.lease === lease) tx.update(stateRef, { lease_until: 0, last_run_at: Date.now() });
    });
  }
}
