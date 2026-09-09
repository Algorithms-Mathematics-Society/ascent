// The registration gate.
//
// `REGISTRATION_OPENS_AT` is the single source of truth for the opening
// instant. The page names that instant to visitors, so the copy is formatted
// from this constant rather than restated alongside it: move the date here and
// every mention of it moves too. A date restated in copy is the thing that goes
// stale silently, which is the failure this shape exists to prevent.
export const REGISTRATION_OPENS_AT = "2026-09-24T06:00:00+05:30";

const REGISTRATION_OPENS_AT_MS = Date.parse(REGISTRATION_OPENS_AT);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const IST_FIELDS = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

function istField(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

/**
 * The opening instant written out in IST, for example
 * "24 September 2026 at 6:00 am IST".
 *
 * Assembled from numeric fields rather than a locale date style so the server
 * and the browser render byte-identical text and hydration stays quiet.
 */
export function registrationOpensAtLabel(): string {
  const parts = IST_FIELDS.formatToParts(REGISTRATION_OPENS_AT_MS);
  const day = Number(istField(parts, "day"));
  const month = MONTHS[Number(istField(parts, "month")) - 1];
  const year = istField(parts, "year");
  const hour24 = Number(istField(parts, "hour"));
  const minute = istField(parts, "minute");
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const period = hour24 < 12 ? "am" : "pm";
  return `${day} ${month} ${year} at ${hour12}:${minute} ${period} IST`;
}

export const REGISTRATION_OPENING_MESSAGE = `Registration opens on ${registrationOpensAtLabel()}.`;

export function registrationHasOpened(now = Date.now()): boolean {
  return now >= REGISTRATION_OPENS_AT_MS;
}

export function millisecondsUntilRegistrationOpens(now = Date.now()): number {
  return Math.max(0, REGISTRATION_OPENS_AT_MS - now);
}
