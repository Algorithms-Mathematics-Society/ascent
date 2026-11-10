import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "../firebaseAdmin";
import { SITE_ORIGIN } from "../../content/site";
import { verifyCertificateSession } from "./tokens";

export const CERTIFICATE_RECIPIENTS = "certificate_recipients";
export const CERTIFICATE_FILE_CHUNKS = "certificate_file_chunks";
export const CERTIFICATE_CODES = "certificate_codes";
export const CERTIFICATE_ISSUED_ON = "11 November 2026";
const MAX_CHUNKS = 32;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export type CertificateSummary = {
  name: string;
  rank: number;
  verificationCode: string;
  verifyUrl: string;
  filename: string;
  issuedOn: typeof CERTIFICATE_ISSUED_ON;
};

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

/** Resolve a session cookie value to the holder's certificate summary, or null. */
export async function certificateSummaryForSession(
  token: unknown,
): Promise<CertificateSummary | null> {
  const claims = verifyCertificateSession(token);
  if (!claims) return null;
  const recipient = await getCertificateRecipient(claims.emailHash);
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

export async function loadCertificateFile(
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
