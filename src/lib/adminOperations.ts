export const ADMIN_NOTE_MAX_LENGTH = 1000;
export const ADMIN_NOTE_MIN_LENGTH = 2;

export const ADMIN_REGISTRATION_TAGS = [
  "HIGH_PRIORITY",
  "DOCUMENT_CHECK",
  "INSTITUTION_CHECK",
  "NEEDS_FOLLOW_UP",
  "DUPLICATE_RISK",
] as const;

export type AdminRegistrationTag = (typeof ADMIN_REGISTRATION_TAGS)[number];

export const ADMIN_REGISTRATION_TAG_LABEL: Record<
  AdminRegistrationTag,
  string
> = {
  HIGH_PRIORITY: "High priority",
  DOCUMENT_CHECK: "Document check",
  INSTITUTION_CHECK: "Institution check",
  NEEDS_FOLLOW_UP: "Needs follow-up",
  DUPLICATE_RISK: "Possible duplicate",
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function isAdminRegistrationTag(
  value: unknown,
): value is AdminRegistrationTag {
  return ADMIN_REGISTRATION_TAGS.includes(value as AdminRegistrationTag);
}
export function normalizeAdminTags(value: unknown): AdminRegistrationTag[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isAdminRegistrationTag))].sort();
}

function parseExpectedRevision(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

export function parseAdminNoteInput(
  body: unknown,
): ValidationResult<{ note: string; expectedRevision: number }> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Note details are required." };
  }
  const candidate = body as Record<string, unknown>;
  const expectedRevision = parseExpectedRevision(candidate.expectedRevision);
  if (expectedRevision === null) {
    return { ok: false, error: "Refresh this registration before adding a note." };
  }
  if (typeof candidate.note !== "string") {
    return { ok: false, error: "Write a private note before saving." };
  }
  const note = candidate.note.replace(/\r\n?/g, "\n").trim();
  if (note.length < ADMIN_NOTE_MIN_LENGTH) {
    return {
      ok: false,
      error: `Write at least ${ADMIN_NOTE_MIN_LENGTH} characters before saving.`,
    };
  }
  if (note.length > ADMIN_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Keep the private note within ${ADMIN_NOTE_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, value: { note, expectedRevision } };
}

export function parseAdminTagsInput(
  body: unknown,
): ValidationResult<{
  tags: AdminRegistrationTag[];
  expectedRevision: number;
}> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Tag details are required." };
  }
  const candidate = body as Record<string, unknown>;
  const expectedRevision = parseExpectedRevision(candidate.expectedRevision);
  if (expectedRevision === null) {
    return { ok: false, error: "Refresh this registration before saving tags." };
  }
  if (!Array.isArray(candidate.tags)) {
    return { ok: false, error: "Choose valid operational tags." };
  }
  if (candidate.tags.some((tag) => !isAdminRegistrationTag(tag))) {
    return { ok: false, error: "Choose valid operational tags." };
  }
  return {
    ok: true,
    value: {
      tags: normalizeAdminTags(candidate.tags),
      expectedRevision,
    },
  };
}
