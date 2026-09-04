// The registration gate.
//
// `REGISTRATION_OPENS_AT` is a gate, not display copy: nothing renders it, and
// nothing should. The message is deliberately separate and deliberately vague,
// so the date can move without a promise on the page going stale — which is
// the failure this shape exists to prevent.
export const REGISTRATION_OPENS_AT = "2026-09-24T00:00:00+05:30";
export const REGISTRATION_OPENING_MESSAGE = "Registration opens soon.";

const REGISTRATION_OPENS_AT_MS = Date.parse(REGISTRATION_OPENS_AT);

export function registrationHasOpened(now = Date.now()): boolean {
  return now >= REGISTRATION_OPENS_AT_MS;
}

export function millisecondsUntilRegistrationOpens(now = Date.now()): number {
  return Math.max(0, REGISTRATION_OPENS_AT_MS - now);
}
