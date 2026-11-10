import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "../firebaseAdmin";
import { SITE_ORIGIN } from "../../content/site";
import { verifyCertificateSession } from "./tokens";
import {
  CERTIFICATE_ISSUED_ON,
  type CertificateSummary,
} from "./shared";

export { CERTIFICATE_ISSUED_ON, type CertificateSummary };

export const CERTIFICATE_RECIPIENTS = "certificate_recipients";
export const CERTIFICATE_FILE_CHUNKS = "certificate_file_chunks";
export const CERTIFICATE_CODES = "certificate_codes";
const MAX_CHUNKS = 8;
// Vercel caps a function response body at 4.5MB; the whole file is one response.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export type CertificateRecipient = {
  name: string;
  rank: number;
  verificationCode: string;
  fileId: string;
  fileBytes: number;
  fileSha256: string;
  chunkCount: number;
};

export class CertificateIntegrityError extends Error {
  constructor(readonly reason: string) {
    super(`certificate_integrity_${reason}`);
  }
}

/** ASCII letters, digits and single hyphens only. Never empty. */
export function certificateNameSlug(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "Participant";
}

export function certificateFilename(name: string) {
  return `Ascent-26-Round-1-Certificate-${certificateNameSlug(name)}.png`;
}

/** Validate a stored recipient document; anything unexpected fails closed. */
export function parseRecipient(
  data: Record<string, unknown> | undefined,
): CertificateRecipient | null {
  if (
    !data ||
    data.edition !== "ascent-2026" ||
    data.round !== 1 ||
    data.content_type !== "image/png"
  )
    return null;
  const {
    name,
    rank,
    verification_code: code,
    file_id: fileId,
    file_bytes: bytes,
    file_sha256: digest,
    chunk_count: chunks,
  } = data;
  if (typeof name !== "string" || !name.trim() || name.length > 200)
    return null;
  if (
    typeof rank !== "number" ||
    !Number.isSafeInteger(rank) ||
    rank < 1 ||
    rank > 10000
  )
    return null;
  if (typeof code !== "string" || !/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code))
    return null;
  if (typeof fileId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(fileId))
    return null;
  if (
    typeof bytes !== "number" ||
    !Number.isSafeInteger(bytes) ||
    bytes < 1 ||
    bytes > MAX_FILE_BYTES
  )
    return null;
  if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) return null;
  if (
    typeof chunks !== "number" ||
    !Number.isSafeInteger(chunks) ||
    chunks < 1 ||
    chunks > MAX_CHUNKS
  )
    return null;
  return {
    name: name.trim(),
    rank,
    verificationCode: code,
    fileId,
    fileBytes: bytes,
    fileSha256: digest,
    chunkCount: chunks,
  };
}

export function buildCertificateSummary(
  recipient: CertificateRecipient,
): CertificateSummary {
  return {
    name: recipient.name,
    rank: recipient.rank,
    verificationCode: recipient.verificationCode,
    verifyUrl: `${SITE_ORIGIN}/v/${recipient.verificationCode}`,
    filename: certificateFilename(recipient.name),
    issuedOn: CERTIFICATE_ISSUED_ON,
  };
}

export async function getCertificateRecipient(
  emailHash: string,
): Promise<CertificateRecipient | null> {
  if (!/^[a-f0-9]{64}$/.test(emailHash)) return null;
  const snapshot = await adminDb
    .collection(CERTIFICATE_RECIPIENTS)
    .doc(emailHash)
    .get();
  return snapshot.exists ? parseRecipient(snapshot.data()) : null;
}

// A signed-in visitor opens the preview, /me and the download within seconds,
// so warm instances keep each parsed recipient briefly. Only valid records are
// kept (never "not found"), keyed by the 64-hex email hash a signed session
// carries. Code issuance and code redemption always read Firestore directly.
const RECIPIENT_CACHE_TTL_MS = 60_000;
const RECIPIENT_CACHE_LIMIT = 500;
const recipientCache = new Map<
  string,
  { recipient: CertificateRecipient; expires: number }
>();
const recipientReads = new Map<string, Promise<CertificateRecipient | null>>();

/** Store a recipient that was just read from Firestore, e.g. inside the verify transaction. */
export function rememberCertificateRecipient(
  emailHash: string,
  recipient: CertificateRecipient,
  now = Date.now(),
) {
  if (!/^[a-f0-9]{64}$/.test(emailHash)) return;
  recipientCache.delete(emailHash);
  recipientCache.set(emailHash, {
    recipient,
    expires: now + RECIPIENT_CACHE_TTL_MS,
  });
  if (recipientCache.size > RECIPIENT_CACHE_LIMIT) {
    const oldest = recipientCache.keys().next().value;
    if (oldest !== undefined) recipientCache.delete(oldest);
  }
}

/**
 * Recipient lookup for signed-in reads (/me and the download). A fresh cached
 * record costs no round trip; concurrent misses for one hash share one read.
 */
export async function getCachedCertificateRecipient(
  emailHash: string,
): Promise<CertificateRecipient | null> {
  if (!/^[a-f0-9]{64}$/.test(emailHash)) return null;
  const cached = recipientCache.get(emailHash);
  if (cached && cached.expires > Date.now()) return cached.recipient;
  if (cached) recipientCache.delete(emailHash);
  const pending = recipientReads.get(emailHash);
  if (pending) return pending;
  const read = getCertificateRecipient(emailHash)
    .then((recipient) => {
      if (recipient) rememberCertificateRecipient(emailHash, recipient);
      return recipient;
    })
    .finally(() => {
      if (recipientReads.get(emailHash) === read) recipientReads.delete(emailHash);
    });
  recipientReads.set(emailHash, read);
  return read;
}

/** Resolve a session cookie value to the holder's certificate summary, or null. */
export async function certificateSummaryForSession(
  token: unknown,
): Promise<CertificateSummary | null> {
  const claims = verifyCertificateSession(token);
  if (!claims) return null;
  const recipient = await getCachedCertificateRecipient(claims.emailHash);
  return recipient ? buildCertificateSummary(recipient) : null;
}

/** Firestore bytes arrive as Buffer, Uint8Array or a Bytes-like object depending on the SDK. */
export function chunkBytes(data: unknown): Buffer | null {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array)
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (
    data &&
    typeof (data as { toUint8Array?: unknown }).toUint8Array === "function"
  ) {
    const value = (data as { toUint8Array: () => unknown }).toUint8Array();
    return value instanceof Uint8Array
      ? Buffer.from(value.buffer, value.byteOffset, value.byteLength)
      : null;
  }
  return null;
}

type ChunkDoc = {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
};

/** Concatenate chunks in order and check the stored length and sha256. Throws on any mismatch. */
export function assembleCertificateFile(
  recipient: CertificateRecipient,
  chunks: ChunkDoc[],
): Buffer {
  if (chunks.length !== recipient.chunkCount)
    throw new CertificateIntegrityError("chunk_count");
  const parts = chunks.map((chunk, index) => {
    const data = chunk.exists ? chunk.data() : undefined;
    if (!data || data.file_id !== recipient.fileId || data.index !== index)
      throw new CertificateIntegrityError("chunk_missing");
    const bytes = chunkBytes(data.data);
    if (!bytes) throw new CertificateIntegrityError("chunk_type");
    return bytes;
  });
  const file = Buffer.concat(parts);
  if (file.byteLength !== recipient.fileBytes)
    throw new CertificateIntegrityError("length");
  if (createHash("sha256").update(file).digest("hex") !== recipient.fileSha256)
    throw new CertificateIntegrityError("sha256");
  return file;
}

// Warm instances keep recently served files, keyed by content hash, so a
// repeat download skips the Firestore chunk reads. About 2MB each, so bounded.
// Concurrent misses for one file share a single in-flight chunk read.
const FILE_CACHE_LIMIT = 16;
const fileCache = new Map<string, Buffer>();
const fileLoads = new Map<string, Promise<Buffer>>();

/** Tests rewrite chunks in place under one id; production ids are content-addressed. */
export function clearCertificateFileCache() {
  fileCache.clear();
  fileLoads.clear();
}

/** Drop every warm-instance cache (files and recipients). */
export function clearCertificateCaches() {
  clearCertificateFileCache();
  recipientCache.clear();
  recipientReads.clear();
}

async function readCertificateFile(
  recipient: CertificateRecipient,
): Promise<Buffer> {
  const collection = adminDb.collection(CERTIFICATE_FILE_CHUNKS);
  const refs = Array.from({ length: recipient.chunkCount }, (_, index) =>
    collection.doc(`${recipient.fileId}_${index}`),
  );
  const [first, ...rest] = refs;
  const chunks = await adminDb.getAll(first, ...rest);
  return assembleCertificateFile(recipient, chunks);
}

export async function loadCertificateFile(
  recipient: CertificateRecipient,
): Promise<Buffer> {
  const cacheKey = `${recipient.fileId}:${recipient.fileSha256}`;
  const cached = fileCache.get(cacheKey);
  if (cached) {
    fileCache.delete(cacheKey);
    fileCache.set(cacheKey, cached);
    return cached;
  }
  const pending = fileLoads.get(cacheKey);
  if (pending) return pending;
  // Only a file that passed the length and sha256 checks is shared or cached;
  // a failed load is forgotten so the next request reads again.
  const load = readCertificateFile(recipient)
    .then((file) => {
      fileCache.set(cacheKey, file);
      if (fileCache.size > FILE_CACHE_LIMIT) {
        const oldest = fileCache.keys().next().value;
        if (oldest !== undefined) fileCache.delete(oldest);
      }
      return file;
    })
    .finally(() => {
      if (fileLoads.get(cacheKey) === load) fileLoads.delete(cacheKey);
    });
  fileLoads.set(cacheKey, load);
  return load;
}
