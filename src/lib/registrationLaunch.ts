export const REGISTRATION_OPENS_AT = "2026-08-17T00:00:00+05:30";
export const REGISTRATION_OPENING_MESSAGE =
  "Registration opens in the third week of August.";

const REGISTRATION_OPENS_AT_MS = Date.parse(REGISTRATION_OPENS_AT);

export function registrationHasOpened(now = Date.now()): boolean {
  return now >= REGISTRATION_OPENS_AT_MS;
}

export function millisecondsUntilRegistrationOpens(now = Date.now()): number {
  return Math.max(0, REGISTRATION_OPENS_AT_MS - now);
}
