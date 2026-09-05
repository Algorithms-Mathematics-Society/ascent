/**
 * Pushing approved registrants into the AMS Access student directory.
 *
 * AMS Access is the central record of everyone who competes: one row per
 * person, not per contest, so that "how has this person progressed" is a
 * question with an answer. A registrant who is approved here has to become a
 * person there, or they get re-keyed by hand at contest time and a competitor
 * who returns next year becomes a second, unrelated record.
 *
 * **Why an outbox rather than an HTTP call in the decision handler.** The
 * decision is a Firestore transaction. An HTTP call cannot join one: if it is
 * made inside, a retry re-sends it, and if it is made after, a crash or a
 * network blip between the commit and the call loses the registrant silently —
 * approved here, absent there, and nothing anywhere says so. So the decision
 * writes an outbox document *in the same transaction* as the decision itself.
 * Either both land or neither does, and a sync that has not happened yet is
 * visibly PENDING rather than forgotten.
 *
 * The drain is separate and idempotent on the AMS side (it matches on
 * `subject_id`), so running it twice, or running it over a backlog, is safe.
 */

/** Decisions that put someone into the directory.
 *
 * WAITLISTED is included deliberately: someone promoted on contest morning
 * must already exist, and provisioning under time pressure is how mistakes
 * happen. REJECTED never crosses — there is no reason to copy the personal
 * data of somebody who will not compete. */
export const SYNCABLE_DECISIONS = ["APPROVED", "WAITLISTED"] as const;

export type SyncStatus = "PENDING" | "SYNCED" | "FAILED";

export const OUTBOX_COLLECTION = "ams_sync_outbox";

export type AmsIngestPayload = {
  subject_id: string;
  display_name: string;
  email: string;
  phone?: string;
  college?: string;
  branch?: string;
  graduation_year?: number | null;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  resume_url?: string;
  transcript_url?: string;
  codeforces_handle?: string;
  education_stage?: string;
  year_of_study?: string;
  college_tier?: string;
  college_verification_status?: string;
  consent_version?: string;
  consent_granted_at?: string | null;
};

export type AmsIngestResult = {
  student_uid: string;
  handle: string;
  outcome: string;
};

export function shouldSync(decision: unknown): boolean {
  return (
    typeof decision === "string" &&
    (SYNCABLE_DECISIONS as readonly string[]).includes(decision)
  );
}

/** What the decision transaction writes. Kept tiny on purpose: the payload is
 * assembled at drain time from whatever the collections hold *then*, so a
 * correction made between approval and sync is picked up rather than frozen
 * into a queued copy. */
export function outboxEntry(subjectId: string, decision: string, queuedAt: unknown) {
  return {
    subject_id: subjectId,
    decision,
    status: "PENDING" as SyncStatus,
    attempts: 0,
    last_error: null as string | null,
    student_uid: null as string | null,
    queued_at: queuedAt,
  };
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** Firestore timestamps come back as Timestamp, Date, or an ISO string
 * depending on how they were written and by which SDK. */
function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate === "function") return maybe.toDate().toISOString();
  return null;
}

/**
 * Assemble one payload from the three collections the registrant is split
 * across.
 *
 * The split is deliberate here — `applications` holds non-PII, `pii` holds the
 * person, `consent` holds the grant — so this is the one place that has to
 * know all three. What crosses is facts about a *person*. Facts about their
 * application to one edition (qualification path, reference, the admin's
 * decision) stay where they were decided; AMS keys back to them by subject id.
 */
export function buildPayload(
  subjectId: string,
  application: Record<string, unknown> | undefined,
  pii: Record<string, unknown> | undefined,
  consent: Record<string, unknown> | undefined,
): AmsIngestPayload | { error: string } {
  const app = application ?? {};
  const person = pii ?? {};

  const email = firstString(person.email, person.college_email).toLowerCase();
  const displayName = firstString(person.legal_name);

  // Both are required by the far side, and neither is recoverable here. Fail
  // loudly rather than posting a payload that will 422 — a validation error
  // from a remote service is a much worse way to learn a record is incomplete.
  if (!email) return { error: "no email on the pii record" };
  if (!displayName) return { error: "no legal_name on the pii record" };

  const grant = (consent?.CONTEST_PARTICIPATION ?? {}) as Record<string, unknown>;

  const gradYear = app.graduation_year;

  return {
    subject_id: subjectId,
    display_name: displayName,
    email,
    phone: firstString(person.phone),
    college: firstString(app.college_name, app.college_id),
    branch: firstString(app.branch),
    graduation_year: typeof gradYear === "number" ? gradYear : null,
    location: firstString(person.location),
    linkedin_url: firstString(person.linkedin_url),
    github_url: firstString(person.github_url),
    resume_url: firstString(person.resume_url),
    transcript_url: firstString(person.transcript_url),
    codeforces_handle: firstString(app.codeforces_handle),
    education_stage: firstString(app.education_stage),
    // `year_of_study` and `current_study_level` are written as the same value
    // at registration; read both so a change to either keeps working.
    year_of_study: firstString(app.year_of_study, app.current_study_level),
    college_tier: firstString(app.college_tier),
    college_verification_status: firstString(app.college_verification_status),
    consent_version: firstString(grant.policy_version),
    consent_granted_at: toIso(grant.granted_at),
  };
}

/** POST one payload to AMS Access.
 *
 * The key is scoped to ingest and nothing else, so a compromise of this app
 * cannot reach the rest of the contest API. */
export async function postToAms(
  payload: AmsIngestPayload,
  { apiUrl, apiKey }: { apiUrl: string; apiKey: string },
): Promise<AmsIngestResult> {
  const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/students/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AMS ingest ${response.status}: ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as AmsIngestResult;
}
