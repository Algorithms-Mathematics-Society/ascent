import { describe, expect, it } from "vitest";
import {
  millisecondsUntilRegistrationOpens,
  REGISTRATION_OPENS_AT,
  registrationHasOpened,
} from "../src/lib/registrationLaunch";

describe("registration launch gate", () => {
  const openingTime = Date.parse(REGISTRATION_OPENS_AT);

  it("stays closed immediately before the configured opening", () => {
    expect(registrationHasOpened(openingTime - 1)).toBe(false);
    expect(millisecondsUntilRegistrationOpens(openingTime - 1)).toBe(1);
  });

  it("opens at the configured instant", () => {
    expect(registrationHasOpened(openingTime)).toBe(true);
    expect(millisecondsUntilRegistrationOpens(openingTime)).toBe(0);
  });
});
