import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { checkSlidingWindow, sha256 } from "../src/lib/rateLimit";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "ascent-2026-dev",
    firestore: {
      rules:
        "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }",
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("sha256", () => {
  it("hashes deterministically", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abd"));
  });
});

describe("checkSlidingWindow", () => {
  it("is not over limit with no prior attempts", async () => {
    const db = testEnv
      .unauthenticatedContext()
      .firestore() as unknown as FirebaseFirestore.Firestore;
    const result = await checkSlidingWindow(
      db,
      "_rate_limits",
      "key-1",
      3,
      60_000,
    );
    expect(result.overLimit).toBe(false);
  });

  it("trips over limit once maxCount failures are recorded", async () => {
    const db = testEnv
      .unauthenticatedContext()
      .firestore() as unknown as FirebaseFirestore.Firestore;
    for (let i = 0; i < 3; i++) {
      const check = await checkSlidingWindow(
        db,
        "_rate_limits",
        "key-2",
        3,
        60_000,
      );
      await check.recordFailure();
    }
    const result = await checkSlidingWindow(
      db,
      "_rate_limits",
      "key-2",
      3,
      60_000,
    );
    expect(result.overLimit).toBe(true);
  });

  it("does not count timestamps outside the window", async () => {
    const db = testEnv
      .unauthenticatedContext()
      .firestore() as unknown as FirebaseFirestore.Firestore;
    const check = await checkSlidingWindow(db, "_rate_limits", "key-3", 1, 1);
    await check.recordFailure();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const result = await checkSlidingWindow(db, "_rate_limits", "key-3", 1, 1);
    expect(result.overLimit).toBe(false);
  });
});
