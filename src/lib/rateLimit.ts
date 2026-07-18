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
    // A plain JS Date is used here (rather than firebase-admin's Timestamp
    // class) because it auto-converts to a native Firestore Timestamp on
    // write under both the Admin SDK (production) and the client-compat SDK
    // that @firebase/rules-unit-testing's context.firestore() returns in
    // tests. An admin-SDK Timestamp instance is rejected by the client SDK
    // as an unrecognized "custom Timestamp object" despite identical field
    // shape, so Date is the cross-SDK-safe choice for the `expiresAt` TTL
    // field.
    const expiresAt = new Date(Date.now() + windowMs + 60 * 60 * 1000);
    await ref.set({ timestamps: [...recent, Date.now()], expiresAt });
  };

  return { overLimit, recordFailure };
}
