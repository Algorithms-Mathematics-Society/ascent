import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { getBytes, ref, uploadBytes } from "firebase/storage";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "ascent-2026-dev",
    storage: { rules: readFileSync("storage.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("resumes/{uid}/{fileName}", () => {
  it("denies client writes", async () => {
    const ownerStorage = testEnv.authenticatedContext("uid-1").storage();
    await assertFails(
      uploadBytes(
        ref(ownerStorage, "resumes/uid-1/resume.pdf"),
        new Uint8Array([1, 2, 3]),
      ),
    );
  });

  it("denies client reads", async () => {
    const ownerStorage = testEnv.authenticatedContext("uid-1").storage();
    await assertFails(getBytes(ref(ownerStorage, "resumes/uid-1/resume.pdf")));
  });
});
