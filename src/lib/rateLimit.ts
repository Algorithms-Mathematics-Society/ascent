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

export type SlidingWindowSpec = {
  collection: string;
  key: string;
  /** The whole window's ceiling, across every shard. */
  maxCount: number;
  windowMs: number;
  /**
   * Spread the window over this many documents (`${key}_s${n}`) so a burst
   * from one key does not queue on a single document: Firestore transactions
   * lock what they read. Omit or use 1 for the plain single document.
   */
  shards?: number;
};

/**
 * Slots per shard. Rounded down, so shards * capacity never exceeds maxCount;
 * pick shard counts that divide maxCount to keep the total exact.
 */
export function shardCapacity(window: SlidingWindowSpec): number {
  const shards = window.shards ?? 1;
  return shards > 1 ? Math.floor(window.maxCount / shards) : window.maxCount;
}

/** Document id for one attempt. A sharded window picks a shard at random. */
export function windowDocKey(
  window: SlidingWindowSpec,
  random: () => number = Math.random,
): string {
  const shards = window.shards ?? 1;
  if (shards <= 1) return window.key;
  const shard = Math.min(shards - 1, Math.floor(random() * shards));
  return `${window.key}_s${shard}`;
}

/** Timestamps of a window document that still fall inside the window. */
export function recentTimestamps(
  data: Record<string, unknown> | undefined,
  windowMs: number,
  now: number,
): number[] {
  const timestamps = Array.isArray(data?.timestamps) ? data.timestamps : [];
  return timestamps.filter(
    (timestamp): timestamp is number =>
      typeof timestamp === "number" && timestamp > now - windowMs,
  );
}

/**
 * Reserve a slot in each window, in order, inside one transaction whose reads
 * are a single getAll round trip. Stops at the first full window and returns
 * its index (-1 when every slot was reserved). Slots already reserved in
 * earlier windows stay reserved, exactly as if each window had been consumed
 * by its own sequential consumeSlidingWindow call.
 *
 * Sharded windows pick their shard inside the transaction callback, so every
 * SDK retry after a contention abort re-picks instead of queueing again on
 * the shard that just aborted it.
 */
export async function consumeSlidingWindows(
  db: Firestore,
  windows: SlidingWindowSpec[],
  random: () => number = Math.random,
): Promise<{ overLimitIndex: number }> {
  if (!windows.length) return { overLimitIndex: -1 };
  return db.runTransaction(async (transaction) => {
    const refs = windows.map((window) =>
      db.collection(window.collection).doc(windowDocKey(window, random)),
    );
    const snapshots = await transaction.getAll(...refs);
    const now = Date.now();
    for (let index = 0; index < windows.length; index++) {
      const window = windows[index];
      const recent = recentTimestamps(
        snapshots[index].data(),
        window.windowMs,
        now,
      );
      if (recent.length >= shardCapacity(window))
        return { overLimitIndex: index };
      transaction.set(refs[index], {
        timestamps: [...recent, now],
        expiresAt: new Date(now + window.windowMs + 60 * 60 * 1000),
      });
    }
    return { overLimitIndex: -1 };
  });
}
