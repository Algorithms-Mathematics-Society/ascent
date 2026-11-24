/**
 * Adds one certificate for a qualifier outside the published top 133 (for
 * example rank 135). The main importer only manages ranks 1 to 133, so its
 * reruns never touch what this script writes.
 *
 *   npm run certificates:import-additional -- --file "<NNN · Name.png>" --email <address>
 *   ... --commit --project <FIREBASE_PROJECT_ID>   (writes, then verifies)
 *
 * The verification code must already be listed in src/content/certificateVerifications.ts.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { CERTIFICATE_VERIFICATIONS } from "../src/content/certificateVerifications";
import { normalizeEmail } from "../src/lib/validators";
import {
  CHUNKS_COLLECTION,
  RECIPIENTS_COLLECTION,
  chunkBuffer,
  chunkDocId,
  emailHash,
  fileIdForContent,
  fileIdForRank,
  maskEmail,
  parseCertificateFilename,
  recipientDoc,
  sha256Hex,
} from "./import-certificates";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const file = arg("file");
  const rawEmail = arg("email");
  const commit = process.argv.includes("--commit");
  if (!file || !rawEmail) throw new Error("--file and --email are required.");

  const parsed = parseCertificateFilename(basename(file));
  if (!parsed)
    throw new Error(
      `File name must look like "NNN · Full Name.png": ${basename(file)}`,
    );
  const { rank, name } = parsed;
  const verification = CERTIFICATE_VERIFICATIONS.find(
    (entry) => entry.rank === rank,
  );
  if (!verification?.additional) {
    throw new Error(
      `Rank ${rank} is not listed as an additional qualifier in certificateVerifications.ts.`,
    );
  }
  const email = normalizeEmail(rawEmail);
  if (!email.valid || !email.normalized) throw new Error("Invalid email.");

  const data = readFileSync(file);
  if (
    !data
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    throw new Error("File is not a PNG.");
  }
  const fileId = fileIdForContent(rank, sha256Hex(data));
  const doc = recipientDoc(
    {
      rank,
      name,
      verificationCode: verification.code,
      fileId,
      path: file,
      emails: [email.normalized],
      emailSource: "override",
    },
    data,
  );
  console.log(
    `rank ${rank} · ${name} · ${verification.code} · ${maskEmail(email.normalized)} · ${data.length} bytes, ${doc.chunk_count} chunk(s)`,
  );
  if (!commit)
    return console.log("Dry run only. Add --commit --project <id> to write.");

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId || arg("project") !== projectId)
    throw new Error("--project must equal FIREBASE_PROJECT_ID.");
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  initializeApp(
    process.env.FIRESTORE_EMULATOR_HOST
      ? { projectId }
      : {
          projectId,
          credential: cert({
            projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(
              /\\n/g,
              "\n",
            ),
          }),
        },
  );
  const db = getFirestore();
  const recipients = db.collection(RECIPIENTS_COLLECTION);
  const chunks = db.collection(CHUNKS_COLLECTION);
  const hash = emailHash(email.normalized);

  const existing = await recipients.doc(hash).get();
  if (existing.exists && existing.get("rank") !== rank) {
    throw new Error(
      `${maskEmail(email.normalized)} already maps to rank ${existing.get("rank")}.`,
    );
  }

  // Chunks first, then the recipient, then remove chunks of earlier imports.
  const batch = db.batch();
  chunkBuffer(data).forEach((chunk, index) =>
    batch.set(chunks.doc(chunkDocId(fileId, index)), {
      file_id: fileId,
      index,
      data: chunk,
    }),
  );
  await batch.commit();
  await recipients
    .doc(hash)
    .set({ ...doc, imported_at: FieldValue.serverTimestamp() });
  const prefix = fileIdForRank(rank);
  const old = await chunks
    .where("file_id", ">=", prefix)
    .where("file_id", "<=", `${prefix}`)
    .select("file_id")
    .get();
  const orphaned = old.docs.filter((snap) => snap.get("file_id") !== fileId);
  if (orphaned.length) {
    const cleanup = db.batch();
    orphaned.forEach((snap) => cleanup.delete(snap.ref));
    await cleanup.commit();
  }

  // Verify by reading everything back.
  const stored = (await recipients.doc(hash).get()).data();
  const parts = await db.getAll(
    ...Array.from({ length: doc.chunk_count }, (_, index) =>
      chunks.doc(chunkDocId(fileId, index)),
    ),
  );
  const bytes = Buffer.concat(
    parts.map((part) => Buffer.from(part.get("data"))),
  );
  const ok =
    stored?.file_sha256 === doc.file_sha256 &&
    sha256Hex(bytes) === doc.file_sha256 &&
    bytes.length === data.length;
  console.log(
    `Wrote rank ${rank}${orphaned.length ? `, removed ${orphaned.length} old chunk(s)` : ""}. Verify: ${ok ? "OK" : "FAIL"}`,
  );
  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
