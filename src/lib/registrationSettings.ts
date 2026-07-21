export const REGISTRATION_SETTINGS_REASON_MIN_LENGTH = 10;
export const REGISTRATION_SETTINGS_REASON_MAX_LENGTH = 500;
export const REGISTRATION_RETENTION_MIN_DAYS = 30;
export const REGISTRATION_RETENTION_MAX_DAYS = 3650;

export interface RegistrationSettings {
  isOpen: boolean;
  deadline: string | null;
  capacity: number | null;
  acceptedCount: number;
  retentionDays: number;
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export type RegistrationAvailabilityReason =
  | "OPEN"
  | "MANUALLY_CLOSED"
  | "DEADLINE_PASSED"
  | "CAPACITY_REACHED";

export interface RegistrationAvailability {
  acceptsRegistrations: boolean;
  reason: RegistrationAvailabilityReason;
  message: string;
}

export interface RegistrationSettingsInput {
  isOpen: boolean;
  deadline: string | null;
  capacity: number | null;
  retentionDays: number;
  reason: string;
  expectedRevision: number;
}

type ValidationResult =
  | { ok: true; value: RegistrationSettingsInput }
  | { ok: false; error: string };

function nonNegativeInteger(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

export function registrationSettingsFromData(
  data: Record<string, unknown> | undefined,
  acceptedCountFallback = 0,
): RegistrationSettings {
  const capacity =
    typeof data?.capacity === "number" &&
    Number.isSafeInteger(data.capacity) &&
    data.capacity > 0
      ? data.capacity
      : null;
  const deadline =
    typeof data?.deadline === "string" &&
    Number.isFinite(Date.parse(data.deadline))
      ? new Date(data.deadline).toISOString()
      : null;
  const retentionDays = nonNegativeInteger(data?.retention_days, 365);
  return {
    isOpen: data?.is_open !== false,
    deadline,
    capacity,
    acceptedCount: nonNegativeInteger(data?.accepted_count, acceptedCountFallback),
    retentionDays:
      retentionDays >= REGISTRATION_RETENTION_MIN_DAYS &&
      retentionDays <= REGISTRATION_RETENTION_MAX_DAYS
        ? retentionDays
        : 365,
    revision: nonNegativeInteger(data?.revision),
    updatedAt: null,
    updatedBy:
      typeof data?.updated_by_email === "string" ? data.updated_by_email : null,
  };
}

export function registrationAvailability(
  settings: RegistrationSettings,
  now = Date.now(),
): RegistrationAvailability {
  if (!settings.isOpen) {
    return {
      acceptsRegistrations: false,
      reason: "MANUALLY_CLOSED",
      message: "Registration is currently closed by the Ascent team.",
    };
  }
  if (settings.deadline && Date.parse(settings.deadline) <= now) {
    return {
      acceptsRegistrations: false,
      reason: "DEADLINE_PASSED",
      message: "The registration deadline has passed.",
    };
  }
  if (
    settings.capacity !== null &&
    settings.acceptedCount >= settings.capacity
  ) {
    return {
      acceptsRegistrations: false,
      reason: "CAPACITY_REACHED",
      message: "Registration has reached its current capacity.",
    };
  }
  return {
    acceptsRegistrations: true,
    reason: "OPEN",
    message: "Registration is open.",
  };
}

export function parseRegistrationSettingsInput(
  body: unknown,
  currentRegistrationCount: number,
  now = Date.now(),
): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Registration settings are required." };
  }
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.isOpen !== "boolean") {
    return { ok: false, error: "Choose whether registration is open or closed." };
  }
  if (
    typeof candidate.expectedRevision !== "number" ||
    !Number.isSafeInteger(candidate.expectedRevision) ||
    candidate.expectedRevision < 0
  ) {
    return { ok: false, error: "Refresh settings before saving changes." };
  }
  const reason =
    typeof candidate.reason === "string"
      ? candidate.reason.trim().replace(/\s+/g, " ")
      : "";
  if (reason.length < REGISTRATION_SETTINGS_REASON_MIN_LENGTH) {
    return {
      ok: false,
      error: `Explain this change in at least ${REGISTRATION_SETTINGS_REASON_MIN_LENGTH} characters.`,
    };
  }
  if (reason.length > REGISTRATION_SETTINGS_REASON_MAX_LENGTH) {
    return {
      ok: false,
      error: `Keep the change reason within ${REGISTRATION_SETTINGS_REASON_MAX_LENGTH} characters.`,
    };
  }
  if (!candidate.isOpen && candidate.confirmation !== "CLOSE_REGISTRATION") {
    return {
      ok: false,
      error: "Confirm that new submissions will be blocked before closing registration.",
    };
  }

  let deadline: string | null = null;
  if (candidate.deadline !== null && candidate.deadline !== "") {
    if (
      typeof candidate.deadline !== "string" ||
      !Number.isFinite(Date.parse(candidate.deadline))
    ) {
      return { ok: false, error: "Enter a valid registration deadline." };
    }
    deadline = new Date(candidate.deadline).toISOString();
    if (candidate.isOpen && Date.parse(deadline) <= now) {
      return {
        ok: false,
        error: "Choose a future deadline or close registration manually.",
      };
    }
  }

  let capacity: number | null = null;
  if (candidate.capacity !== null && candidate.capacity !== "") {
    if (
      typeof candidate.capacity !== "number" ||
      !Number.isSafeInteger(candidate.capacity) ||
      candidate.capacity < 1 ||
      candidate.capacity > 100000
    ) {
      return { ok: false, error: "Capacity must be a whole number from 1 to 100,000." };
    }
    capacity = candidate.capacity;
    if (capacity < currentRegistrationCount) {
      return {
        ok: false,
        error: `Capacity cannot be below the ${currentRegistrationCount} registrations already received.`,
      };
    }
  }

  if (
    typeof candidate.retentionDays !== "number" ||
    !Number.isSafeInteger(candidate.retentionDays) ||
    candidate.retentionDays < REGISTRATION_RETENTION_MIN_DAYS ||
    candidate.retentionDays > REGISTRATION_RETENTION_MAX_DAYS
  ) {
    return {
      ok: false,
      error: `Retention review must be between ${REGISTRATION_RETENTION_MIN_DAYS} and ${REGISTRATION_RETENTION_MAX_DAYS} days.`,
    };
  }

  return {
    ok: true,
    value: {
      isOpen: candidate.isOpen,
      deadline,
      capacity,
      retentionDays: candidate.retentionDays,
      reason,
      expectedRevision: candidate.expectedRevision,
    },
  };
}
