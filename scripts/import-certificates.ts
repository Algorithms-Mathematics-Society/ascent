/**
 * Imports Ascent '26 Round 1 certificate PNGs into Firestore for the
 * certificate download portal.
 *
 * Usage (dry run is the default, nothing is written):
 *   npm run certificates:import -- [--dir <path>] [--csv <path>] [--overrides <json>]
 *   npm run certificates:import -- --commit --project <firebase-project-id>
 *   npm run certificates:import -- --verify
 *
 * Inputs stay local. Participant emails and phone numbers are never printed:
 * output carries ranks and names only, plus masked emails in error messages.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { CERTIFICATE_VERIFICATIONS } from "../src/content/certificateVerifications";
import { ROUND_ONE_SELECTION_COUNT } from "../src/lib/results";
import { normalizeEmail } from "../src/lib/validators";

export const EDITION = "ascent-2026";
export const ROUND = 1;
export const CHUNK_SIZE = 1_000_000;
/** Chunks per write batch: keeps each batch near 4MB, well under the 10MB request cap. */
export const CHUNKS_PER_BATCH = 4;
export const RECIPIENTS_COLLECTION = "certificate_recipients";
export const CHUNKS_COLLECTION = "certificate_file_chunks";

const DEFAULT_DIR = join(homedir(), "Downloads", "Ascent certificates r1");
const DEFAULT_CSV = join(
  homedir(),
  "Downloads",
  "AMS Ascent Round 1 - Qualified - top-133-PROVISIONAL-review.csv",
);
const DEFAULT_STANDINGS = resolve(
  process.cwd(),
  "leaderboard",
  "standings-ams-ascent-round-1.csv",
);

// ---------------------------------------------------------------------------
// Pure helpers (unit tested in test/importCertificates.test.ts)
// ---------------------------------------------------------------------------

/** RFC 4180-ish CSV parser: quoted commas, escaped quotes, CRLF, quoted newlines, BOM. */
export function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  const csv = source.replace(/^﻿/, "");
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else field += char;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(field);
      field = "";
      closedQuote = false;
      if (char !== ",") {
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        if (char === "\r" && csv[i + 1] === "\n") i++;
      }
    } else if (char === '"' && field === "" && !closedQuote) quoted = true;
    else {
      if (closedQuote || char === '"') throw new Error("Malformed CSV.");
      field += char;
    }
  }
  if (quoted) throw new Error("Unclosed CSV field.");
  if (field || row.length || closedQuote) {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  return rows;
}

/** Parses a CSV into header-keyed records. Throws if any required column is missing. */
export function csvRecords(
  source: string,
  required: readonly string[],
): Record<string, string>[] {
  const [header, ...rows] = parseCsv(source);
  if (!header) throw new Error("CSV is empty.");
  const keys = header.map((h) => h.trim().toLowerCase());
  for (const column of required) {
    if (!keys.includes(column))
      throw new Error(`CSV is missing column "${column}".`);
  }
  return rows.map((cells) => {
    const record: Record<string, string> = {};
    keys.forEach((key, index) => {
      record[key] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

/** Display form: NFC, trimmed, internal whitespace collapsed to single spaces. */
export function cleanName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Comparison key: cleanName, lowercased. */
export function nameKey(name: string): string {
  return cleanName(name).toLowerCase();
}

/** Masks an email for logs: a***@domain. Never log the raw value. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Doc id for certificate_recipients: sha256 hex of the normalized email. */
export function emailHash(normalizedEmail: string): string {
  return sha256Hex(normalizedEmail);
}

export function fileIdForRank(rank: number): string {
  return `${EDITION}-r${ROUND}-${String(rank).padStart(3, "0")}`;
}

export function chunkDocId(fileId: string, index: number): string {
  return `${fileId}_${index}`;
}

/** Matches "NNN · Full Name.png" (middle dot U+00B7). Returns null for anything else. */
export function parseCertificateFilename(
  filename: string,
): { rank: number; name: string } | null {
  const match = /^(\d{3})\s*·\s*(.+?)\.png$/i.exec(filename.normalize("NFC"));
  if (!match) return null;
  const rank = Number(match[1]);
  const name = cleanName(match[2]);
  if (!Number.isInteger(rank) || rank < 1 || !name) return null;
  return { rank, name };
}

/** Splits bytes into consecutive views of at most `size` bytes. Empty input yields no chunks. */
export function chunkBuffer(data: Buffer, size = CHUNK_SIZE): Buffer[] {
  if (!Number.isInteger(size) || size <= 0)
    throw new Error("Chunk size must be a positive integer.");
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < data.length; offset += size) {
    chunks.push(data.subarray(offset, Math.min(offset + size, data.length)));
  }
  return chunks;
}

/** Groups items into arrays of at most `size`. */
export function groupsOf<T>(items: readonly T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    groups.push(items.slice(i, i + size));
  return groups;
}

/** Parses the overrides JSON: { "<rank>": ["email", ...] }. Each listed rank's emails REPLACE the CSV ones. */
export function parseOverrides(source: string): Map<number, string[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    throw new Error("Overrides file is not valid JSON.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(
      'Overrides must be an object like { "22": ["name@example.com"] }.',
    );
  }
  const overrides = new Map<number, string[]>();
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const rank = Number(key);
    if (
      !/^\d+$/.test(key) ||
      !Number.isInteger(rank) ||
      rank < 1 ||
      rank > ROUND_ONE_SELECTION_COUNT
    ) {
      throw new Error(
        `Overrides: "${key}" is not a rank between 1 and ${ROUND_ONE_SELECTION_COUNT}.`,
      );
    }
    if (
      !Array.isArray(value) ||
      value.some((entry) => typeof entry !== "string")
    ) {
      throw new Error(
        `Overrides: rank ${rank} must map to an array of email strings.`,
      );
    }
    overrides.set(rank, value as string[]);
  }
  return overrides;
}

export type CertificateFile = { rank: number; name: string; path: string };

export type PlanEntry = {
  rank: number;
  name: string;
  verificationCode: string;
  fileId: string;
  path: string;
  /** Normalized emails mapped to this rank. Empty means unmapped (skipped). */
  emails: string[];
  emailSource: "csv" | "override" | "none";
};

export type PlanInput = {
  files: readonly CertificateFile[];
  csvSource: string;
  standingsSource: string;
  overrides?: Map<number, string[]>;
  verifications?: readonly { rank: number; code: string }[];
  expectedCount?: number;
};

/**
 * Cross-checks every input and builds one entry per rank. Collects every
 * problem and throws a single error listing them all, so nothing is written
 * when anything is off.
 */
export function buildImportPlan(input: PlanInput): PlanEntry[] {
  const expectedCount = input.expectedCount ?? ROUND_ONE_SELECTION_COUNT;
  const verifications = input.verifications ?? CERTIFICATE_VERIFICATIONS;
  const overrides = input.overrides ?? new Map<number, string[]>();
  const problems: string[] = [];

  const filesByRank = new Map<number, CertificateFile[]>();
  for (const file of input.files) {
    const list = filesByRank.get(file.rank) ?? [];
    list.push(file);
    filesByRank.set(file.rank, list);
    if (file.rank > expectedCount)
      problems.push(
        `File for rank ${file.rank} is outside 1..${expectedCount}.`,
      );
  }

  const csvByRank = new Map<number, Record<string, string>>();
  for (const record of csvRecords(input.csvSource, [
    "rank",
    "full_name",
    "email",
  ])) {
    const rank = Number(record.rank);
    if (!Number.isInteger(rank) || rank < 1) {
      problems.push(`CSV has a row with invalid rank "${record.rank}".`);
      continue;
    }
    if (csvByRank.has(rank))
      problems.push(`CSV has rank ${rank} more than once.`);
    csvByRank.set(rank, record);
    if (rank > expectedCount)
      problems.push(`CSV rank ${rank} is outside 1..${expectedCount}.`);
  }

  const standingsByRank = new Map<number, string>();
  for (const record of csvRecords(input.standingsSource, ["rank", "name"])) {
    const rank = Number(record.rank);
    if (!Number.isInteger(rank) || rank < 1 || rank > expectedCount) continue;
    if (standingsByRank.has(rank))
      problems.push(`Standings have rank ${rank} more than once.`);
    standingsByRank.set(rank, record.name);
  }

  const codeByRank = new Map<number, string>();
  for (const entry of verifications) codeByRank.set(entry.rank, entry.code);

  const plan: PlanEntry[] = [];
  const ownerByHash = new Map<string, number>();

  for (let rank = 1; rank <= expectedCount; rank++) {
    const files = filesByRank.get(rank) ?? [];
    if (files.length !== 1) {
      problems.push(
        `Rank ${rank}: expected exactly one certificate file, found ${files.length}.`,
      );
      continue;
    }
    const file = files[0];
    const csv = csvByRank.get(rank);
    if (!csv) {
      problems.push(`Rank ${rank}: missing from the qualifier CSV.`);
      continue;
    }
    if (nameKey(csv.full_name) !== nameKey(file.name)) {
      problems.push(
        `Rank ${rank}: CSV name "${cleanName(csv.full_name)}" does not match file name "${file.name}".`,
      );
    }
    const standingsName = standingsByRank.get(rank);
    if (standingsName === undefined) {
      problems.push(`Rank ${rank}: missing from the standings.`);
    } else if (nameKey(standingsName) !== nameKey(file.name)) {
      problems.push(
        `Rank ${rank}: standings name "${cleanName(standingsName)}" does not match file name "${file.name}".`,
      );
    }
    const verificationCode = codeByRank.get(rank);
    if (!verificationCode) {
      problems.push(`Rank ${rank}: no verification code.`);
      continue;
    }

    const override = overrides.get(rank);
    const rawEmails = override ?? (csv.email ? [csv.email] : []);
    const emails: string[] = [];
    for (const raw of rawEmails) {
      const result = normalizeEmail(raw);
      if (!result.valid || !result.normalized) {
        problems.push(`Rank ${rank}: invalid email ${maskEmail(raw.trim())}.`);
        continue;
      }
      const normalized = result.normalized;
      if (emails.includes(normalized)) continue;
      const hash = emailHash(normalized);
      const owner = ownerByHash.get(hash);
      if (owner !== undefined) {
        problems.push(
          `Duplicate email ${maskEmail(normalized)} on ranks ${owner} and ${rank}.`,
        );
        continue;
      }
      ownerByHash.set(hash, rank);
      emails.push(normalized);
    }

    plan.push({
      rank,
      name: file.name,
      verificationCode,
      fileId: fileIdForRank(rank),
      path: file.path,
      emails,
      emailSource: override ? "override" : emails.length ? "csv" : "none",
    });
  }

  if (problems.length) {
    throw new Error(
      `Import aborted, ${problems.length} problem(s):\n  - ${problems.join("\n  - ")}`,
    );
  }
  return plan;
}

export type RecipientDoc = {
  edition: typeof EDITION;
  round: typeof ROUND;
  rank: number;
  name: string;
  verification_code: string;
  file_id: string;
  file_bytes: number;
  file_sha256: string;
  chunk_count: number;
  content_type: "image/png";
};

export function recipientDoc(entry: PlanEntry, data: Buffer): RecipientDoc {
  return {
    edition: EDITION,
    round: ROUND,
    rank: entry.rank,
    name: entry.name,
    verification_code: entry.verificationCode,
    file_id: entry.fileId,
    file_bytes: data.length,
    file_sha256: sha256Hex(data),
    chunk_count: Math.ceil(data.length / CHUNK_SIZE),
    content_type: "image/png",
  };
}

/** Checks reassembled chunk bytes against a recipient doc. Returns a reason string on failure. */
export function checkReassembled(
  doc: Pick<RecipientDoc, "file_bytes" | "file_sha256" | "chunk_count">,
  chunks: readonly (Buffer | null)[],
): string | null {
  if (chunks.length !== doc.chunk_count)
    return `expected ${doc.chunk_count} chunks, got ${chunks.length}`;
  const missing = chunks.findIndex((chunk) => chunk === null);
  if (missing >= 0) return `chunk ${missing} missing`;
  const oversize = chunks.findIndex(
    (chunk) => (chunk as Buffer).length > CHUNK_SIZE,
  );
  if (oversize >= 0) return `chunk ${oversize} exceeds ${CHUNK_SIZE} bytes`;
  const data = Buffer.concat(chunks as Buffer[]);
  if (data.length !== doc.file_bytes)
    return `length ${data.length} != ${doc.file_bytes}`;
  if (sha256Hex(data) !== doc.file_sha256) return "sha256 mismatch";
  return null;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

type CliOptions = {
  dir: string;
  csv: string;
  standings: string;
  overrides?: string;
  commit: boolean;
  verify: boolean;
  project?: string;
};

function expandHome(path: string): string {
  return path === "~" || path.startsWith("~/")
    ? join(homedir(), path.slice(1))
    : path;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    dir: DEFAULT_DIR,
    csv: DEFAULT_CSV,
    standings: DEFAULT_STANDINGS,
    commit: false,
    verify: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined || next.startsWith("--"))
        throw new Error(`${arg} needs a value.`);
      return next;
    };
    switch (arg) {
      case "--dir":
        options.dir = resolve(expandHome(value()));
        break;
      case "--csv":
        options.csv = resolve(expandHome(value()));
        break;
      case "--standings":
        options.standings = resolve(expandHome(value()));
        break;
      case "--overrides":
        options.overrides = resolve(expandHome(value()));
        break;
      case "--project":
        options.project = value();
        break;
      case "--commit":
        options.commit = true;
        break;
      case "--dry-run":
        options.commit = false;
        break;
      case "--verify":
        options.verify = true;
        break;
      default:
        throw new Error(`Unknown argument ${arg}.`);
    }
  }
  return options;
}

function listCertificateFiles(dir: string): CertificateFile[] {
  if (!existsSync(dir))
    throw new Error(`Certificate directory not found: ${dir}`);
  const files: CertificateFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const parsed = parseCertificateFilename(entry.name);
    if (parsed) files.push({ ...parsed, path: join(dir, entry.name) });
  }
  return files;
}

async function initDb() {
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not set.");
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (!getApps().length) {
    if (emulator) {
      initializeApp({ projectId });
    } else {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(
        /\\n/g,
        "\n",
      );
      if (!clientEmail || !privateKey) {
        throw new Error(
          "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are required outside the emulator.",
        );
      }
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
    }
  }
  return {
    db: getFirestore(),
    serverTimestamp: () => FieldValue.serverTimestamp(),
    projectId,
    emulator,
  };
}

function pad(value: string | number, width: number, right = false) {
  const text = String(value);
  return right ? text.padStart(width) : text.padEnd(width);
}

function printSummary(plan: PlanEntry[], sizes: Map<number, number>) {
  console.log(
    `${pad("rank", 4, true)}  ${pad("name", 34)} ${pad("chunks", 6, true)} ${pad("bytes", 10, true)}  mapped`,
  );
  for (const entry of plan) {
    const bytes = sizes.get(entry.rank) ?? 0;
    const mapped = entry.emails.length
      ? `yes${entry.emails.length > 1 ? ` (${entry.emails.length} emails)` : ""}${entry.emailSource === "override" ? " [override]" : ""}`
      : "NO (unmapped, skipped)";
    console.log(
      `${pad(entry.rank, 4, true)}  ${pad(entry.name.slice(0, 34), 34)} ${pad(Math.ceil(bytes / CHUNK_SIZE), 6, true)} ${pad(bytes, 10, true)}  ${mapped}`,
    );
  }
  const mapped = plan.filter((entry) => entry.emails.length);
  const unmapped = plan.filter((entry) => !entry.emails.length);
  const totalBytes = mapped.reduce(
    (sum, entry) => sum + (sizes.get(entry.rank) ?? 0),
    0,
  );
  const totalChunks = mapped.reduce(
    (sum, entry) => sum + Math.ceil((sizes.get(entry.rank) ?? 0) / CHUNK_SIZE),
    0,
  );
  console.log("");
  console.log(`Certificates: ${plan.length}`);
  console.log(
    `Mapped ranks: ${mapped.length} (recipient docs: ${mapped.reduce((sum, entry) => sum + entry.emails.length, 0)})`,
  );
  console.log(
    `Unmapped ranks (skipped): ${unmapped.length}${unmapped.length ? ` [${unmapped.map((entry) => entry.rank).join(", ")}]` : ""}`,
  );
  console.log(`Chunks to write: ${totalChunks}, bytes to write: ${totalBytes}`);
}

async function commitPlan(plan: PlanEntry[], options: CliOptions) {
  const { db, serverTimestamp, projectId, emulator } = await initDb();
  if (!options.project) throw new Error("--commit requires --project <id>.");
  if (options.project !== projectId) {
    throw new Error(
      `--project ${options.project} does not match FIREBASE_PROJECT_ID ${projectId}.`,
    );
  }
  console.log(
    `\nCommitting to project ${projectId}${emulator ? " (EMULATOR)" : " (PRODUCTION)"}.`,
  );
  const recipients = db.collection(RECIPIENTS_COLLECTION);
  const chunksCollection = db.collection(CHUNKS_COLLECTION);

  // Pre-flight: no planned email hash may already belong to another rank.
  const planned = plan.flatMap((entry) =>
    entry.emails.map((email) => ({ hash: emailHash(email), entry, email })),
  );
  const conflicts: string[] = [];
  for (const group of groupsOf(planned, 100)) {
    const snaps = await db.getAll(
      ...group.map((item) => recipients.doc(item.hash)),
    );
    snaps.forEach((snap, index) => {
      const item = group[index];
      if (snap.exists && snap.get("rank") !== item.entry.rank) {
        conflicts.push(
          `${maskEmail(item.email)} already maps to rank ${snap.get("rank")}, planned rank ${item.entry.rank}.`,
        );
      }
    });
  }
  if (conflicts.length) {
    throw new Error(
      `Commit aborted, existing recipient conflicts:\n  - ${conflicts.join("\n  - ")}`,
    );
  }

  let writtenRecipients = 0;
  let removedRecipients = 0;
  let writtenChunks = 0;
  for (const entry of plan) {
    const keep = new Set(entry.emails.map(emailHash));

    if (entry.emails.length) {
      const data = readFileSync(entry.path);
      const doc = recipientDoc(entry, data);
      const chunks = chunkBuffer(data);
      for (const group of groupsOf(
        chunks.map((chunk, index) => ({ chunk, index })),
        CHUNKS_PER_BATCH,
      )) {
        const batch = db.batch();
        for (const { chunk, index } of group) {
          batch.set(chunksCollection.doc(chunkDocId(entry.fileId, index)), {
            file_id: entry.fileId,
            index,
            data: chunk,
          });
        }
        await batch.commit();
        writtenChunks += group.length;
      }
      // Drop chunks beyond the current count left by an earlier, larger import.
      const extra = await chunksCollection
        .where("file_id", "==", entry.fileId)
        .select("index")
        .get();
      const stale = extra.docs.filter(
        (snap) => Number(snap.get("index")) >= doc.chunk_count,
      );
      if (stale.length) {
        const batch = db.batch();
        stale.forEach((snap) => batch.delete(snap.ref));
        await batch.commit();
      }

      const batch = db.batch();
      for (const email of entry.emails) {
        batch.set(recipients.doc(emailHash(email)), {
          ...doc,
          imported_at: serverTimestamp(),
        });
      }
      await batch.commit();
      writtenRecipients += entry.emails.length;
    }

    // Remove recipient docs for this rank whose email is no longer mapped (override changes).
    const existing = await recipients.where("rank", "==", entry.rank).get();
    const staleRecipients = existing.docs.filter(
      (snap) =>
        snap.get("edition") === EDITION &&
        snap.get("round") === ROUND &&
        !keep.has(snap.id),
    );
    if (staleRecipients.length) {
      const batch = db.batch();
      staleRecipients.forEach((snap) => batch.delete(snap.ref));
      await batch.commit();
      removedRecipients += staleRecipients.length;
    }
    console.log(
      `rank ${pad(entry.rank, 3, true)}  ${entry.emails.length ? `wrote ${entry.emails.length} recipient(s)` : "skipped (unmapped)"}${staleRecipients.length ? `, removed ${staleRecipients.length} stale` : ""}`,
    );
  }
  console.log(
    `\nCommit done: ${writtenChunks} chunks, ${writtenRecipients} recipient docs written, ${removedRecipients} stale recipient docs removed.`,
  );
}

async function verifyAll(options: CliOptions): Promise<boolean> {
  const { db, projectId, emulator } = await initDb();
  console.log(
    `\nVerifying project ${projectId}${emulator ? " (EMULATOR)" : ""}.`,
  );
  const snapshot = await db
    .collection(RECIPIENTS_COLLECTION)
    .where("edition", "==", EDITION)
    .get();
  const byRank = new Map<number, QueryDocumentSnapshot[]>();
  for (const snap of snapshot.docs) {
    if (snap.get("round") !== ROUND) continue;
    const rank = Number(snap.get("rank"));
    const list = byRank.get(rank) ?? [];
    list.push(snap);
    byRank.set(rank, list);
  }

  const localFiles = new Map<number, string>();
  if (existsSync(options.dir)) {
    for (const file of listCertificateFiles(options.dir))
      localFiles.set(file.rank, file.path);
  }
  const codeByRank = new Map(
    CERTIFICATE_VERIFICATIONS.map((entry) => [entry.rank, entry.code]),
  );

  let ok = 0;
  let failed = 0;
  const missing: number[] = [];
  for (let rank = 1; rank <= ROUND_ONE_SELECTION_COUNT; rank++) {
    const docs = byRank.get(rank);
    if (!docs?.length) {
      missing.push(rank);
      continue;
    }
    const reasons: string[] = [];
    for (const snap of docs) {
      const doc = snap.data() as RecipientDoc;
      if (doc.file_id !== fileIdForRank(rank))
        reasons.push(`file_id ${doc.file_id}`);
      if (doc.verification_code !== codeByRank.get(rank))
        reasons.push("verification code mismatch");
      if (doc.content_type !== "image/png") reasons.push("content_type");
      if (!doc.chunk_count || doc.chunk_count < 1) {
        reasons.push("chunk_count");
        continue;
      }
      const refs = Array.from({ length: doc.chunk_count }, (_, index) =>
        db.collection(CHUNKS_COLLECTION).doc(chunkDocId(doc.file_id, index)),
      );
      const chunkSnaps = await db.getAll(...refs);
      const chunks = chunkSnaps.map((chunkSnap) => {
        if (!chunkSnap.exists) return null;
        const data = chunkSnap.get("data");
        return data ? Buffer.from(data) : null;
      });
      const reason = checkReassembled(doc, chunks);
      if (reason) reasons.push(reason);
      const local = localFiles.get(rank);
      if (local && sha256Hex(readFileSync(local)) !== doc.file_sha256)
        reasons.push("differs from local file");
    }
    const unique = [...new Set(reasons)];
    if (unique.length) failed++;
    else ok++;
    const name = String(docs[0].get("name"));
    console.log(
      `rank ${pad(rank, 3, true)}  ${pad(name.slice(0, 34), 34)} ${docs.length} recipient(s)  ${unique.length ? `FAIL: ${unique.join("; ")}` : "OK"}`,
    );
  }
  console.log(
    `\nVerify: ${ok} OK, ${failed} FAIL, ${missing.length} rank(s) with no recipient doc${missing.length ? ` [${missing.join(", ")}]` : ""}.`,
  );
  return failed === 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.verify && !options.commit) {
    const passed = await verifyAll(options);
    if (!passed) process.exitCode = 1;
    return;
  }

  const files = listCertificateFiles(options.dir);
  const plan = buildImportPlan({
    files,
    csvSource: readFileSync(options.csv, "utf8"),
    standingsSource: readFileSync(options.standings, "utf8"),
    overrides: options.overrides
      ? parseOverrides(readFileSync(options.overrides, "utf8"))
      : undefined,
  });
  const sizes = new Map<number, number>();
  for (const entry of plan) {
    const bytes = readFileSync(entry.path);
    if (bytes.length === 0)
      throw new Error(`Rank ${entry.rank}: certificate file is empty.`);
    if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
      throw new Error(`Rank ${entry.rank}: certificate file is not a PNG.`);
    }
    sizes.set(entry.rank, bytes.length);
  }
  printSummary(plan, sizes);

  if (!options.commit) {
    console.log(
      "\nDry run only. Re-run with --commit --project <id> to write.",
    );
    return;
  }
  await commitPlan(plan, options);
  if (options.verify) {
    const passed = await verifyAll(options);
    if (!passed) process.exitCode = 1;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
