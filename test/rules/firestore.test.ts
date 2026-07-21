import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "ascent-2026-dev",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("applications/{uid}", () => {
  it("lets the owner read their own application", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "applications/uid-1"), {
        handle: "abc",
      });
    });
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    await assertSucceeds(getDoc(doc(ownerDb, "applications/uid-1")));
  });

  it("denies reading someone else's application", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "applications/uid-1"), {
        handle: "abc",
      });
    });
    const otherDb = testEnv.authenticatedContext("uid-2").firestore();
    await assertFails(getDoc(doc(otherDb, "applications/uid-1")));
  });

  it("denies unauthenticated reads", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "applications/uid-1"), {
        handle: "abc",
      });
    });
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, "applications/uid-1")));
  });

  it("denies client writes even from the owner", async () => {
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    await assertFails(
      setDoc(doc(ownerDb, "applications/uid-1"), { handle: "hacked" }),
    );
  });
});

describe("colleges/{id}", () => {
  it("allows public read", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "colleges/iitb"), {
        canonical_name: "IIT Bombay",
      });
    });
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anonDb, "colleges/iitb")));
  });

  it("denies client writes", async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      setDoc(doc(anonDb, "colleges/iitb"), { canonical_name: "x" }),
    );
  });
});

describe("pii/{uid}: deny-all, even for the owner", () => {
  it("denies owner read", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "pii/uid-1"), { email: "a@b.com" });
    });
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    await assertFails(getDoc(doc(ownerDb, "pii/uid-1")));
  });
});

describe("admin_registration_decisions/{uid}: deny-all", () => {
  it("denies applicant reads and writes", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "admin_registration_decisions/uid-1"),
        { decision: "REJECTED", reason: "Internal review note" },
      );
    });
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    await assertFails(
      getDoc(doc(ownerDb, "admin_registration_decisions/uid-1")),
    );
    await assertFails(
      setDoc(doc(ownerDb, "admin_registration_decisions/uid-1"), {
        decision: "APPROVED",
      }),
    );
  });
});

describe("handles/{id} and phones/{id}: deny-all", () => {
  it("denies client read on handles", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "handles/ascent-2026_foo"), {
        uid: "uid-1",
      });
    });
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    await assertFails(getDoc(doc(ownerDb, "handles/ascent-2026_foo")));
  });

  it("denies client read on phones", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "phones/ascent-2026_+919999999999"), {
        uid: "uid-1",
      });
    });
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    await assertFails(getDoc(doc(ownerDb, "phones/ascent-2026_+919999999999")));
  });
});
