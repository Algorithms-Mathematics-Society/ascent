import crypto from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function checkSlidingWindow(
  db: Firestore,
  collection: string,
  key: string,
  maxCount: number,
  windowMs: number,
): Promise<{ overLimit: boolean; recordFailure: () => Promise<void> }> {
  const ref = db.collection(collection).doc(key);
  const snap = await ref.get();
  const windowStart = Date.now() - windowMs;
  const timestamps: number[] = snap.exists
    ? (snap.data()?.timestamps ?? [])
    : [];
  const recent = timestamps.filter((ts) => ts > windowStart);
  const overLimit = recent.length >= maxCount;

  const recordFailure = async () => {
    // Read again inside the transaction: callers may have checked the same
    // snapshot concurrently. Never overwrite another request's recorded failure.
    await db.runTransaction(async (transaction) => {
      const latest = await transaction.get(ref);
      const now = Date.now();
      const timestamps: number[] = latest.data()?.timestamps ?? [];
      const recent = timestamps.filter((timestamp) => timestamp > now - windowMs);
      transaction.set(ref, {
        timestamps: [...recent, now].slice(-maxCount),
        expiresAt: new Date(now + windowMs + 60 * 60 * 1000),
      });
    });
  };

  return { overLimit, recordFailure };
}

/** Atomically reserves a request slot; use when every attempt must count. */
export async function consumeSlidingWindow(
  db: Firestore,
  collection: string,
  key: string,
  maxCount: number,
  windowMs: number,
): Promise<{ overLimit: boolean }> {
  const ref = db.collection(collection).doc(key);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const now = Date.now();
    const timestamps: number[] = snapshot.data()?.timestamps ?? [];
    const recent = timestamps.filter((timestamp) => timestamp > now - windowMs);
    if (recent.length >= maxCount) return { overLimit: true };
    transaction.set(ref, {
      timestamps: [...recent, now],
      expiresAt: new Date(now + windowMs + 60 * 60 * 1000),
    });
    return { overLimit: false };
  });
}
