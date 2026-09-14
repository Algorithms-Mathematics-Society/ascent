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
  it("denies candidate reads because applications are server-managed", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "applications/uid-1"), {
        handle: "abc",
      });
    });
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    await assertFails(getDoc(doc(ownerDb, "applications/uid-1")));
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

describe("admin_registration_operations/{uid}: deny-all", () => {
  it("denies applicant access to operations and nested notes", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), "admin_registration_operations/uid-1"),
        { tags: ["HIGH_PRIORITY"] },
      );
      await setDoc(
        doc(
          ctx.firestore(),
          "admin_registration_operations/uid-1/notes/note-1",
        ),
        { body: "Private operational note" },
      );
    });
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    await assertFails(
      getDoc(doc(ownerDb, "admin_registration_operations/uid-1")),
    );
    await assertFails(
      getDoc(
        doc(
          ownerDb,
          "admin_registration_operations/uid-1/notes/note-1",
        ),
      ),
    );
    await assertFails(
      setDoc(doc(ownerDb, "admin_registration_operations/uid-1"), {
        tags: [],
      }),
    );
  });
});

describe("admin_bulk_operations/{id}: deny-all", () => {
  it("denies applicant reads and writes", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admin_bulk_operations/batch-1"), {
        decision: "APPROVED",
        count: 2,
      });
    });
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    await assertFails(getDoc(doc(ownerDb, "admin_bulk_operations/batch-1")));
    await assertFails(
      setDoc(doc(ownerDb, "admin_bulk_operations/batch-1"), { count: 0 }),
    );
  });
});

describe("admin_config/{id}: deny-all", () => {
  it("denies applicants and unauthenticated clients", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admin_config/registration"), {
        is_open: false,
        capacity: 100,
      });
    });
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(ownerDb, "admin_config/registration")));
    await assertFails(getDoc(doc(anonDb, "admin_config/registration")));
    await assertFails(
      setDoc(doc(ownerDb, "admin_config/registration"), { is_open: true }),
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

describe("registration_reminders: private server-managed email list", () => {
  it("denies direct reads and writes to anonymous users, applicants and admin clients", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "registration_reminders/test-email"), { email: "private@example.test" });
    });
    for (const context of [testEnv.unauthenticatedContext(), testEnv.authenticatedContext("applicant"), testEnv.authenticatedContext("admin", { ascent_admin: true })]) {
      await assertFails(getDoc(doc(context.firestore(), "registration_reminders/test-email")));
      await assertFails(setDoc(doc(context.firestore(), "registration_reminders/test-email"), { email: "changed@example.test" }));
      await assertFails(setDoc(doc(context.firestore(), "_rate_limits_reminders/test-ip"), { timestamps: [] }));
    }
  });
});


describe("email_outbox: private server-managed messages", () => {
  it("denies anonymous, candidate and admin browser access", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "email_outbox/message"), { payload: { to: "private@example.test" } });
    });
    for (const context of [testEnv.unauthenticatedContext(), testEnv.authenticatedContext("applicant"), testEnv.authenticatedContext("admin", { ascent_admin: true })]) {
      await assertFails(getDoc(doc(context.firestore(), "email_outbox/message")));
      await assertFails(setDoc(doc(context.firestore(), "email_outbox/message"), { status: "SENT" }));
    }
  });
});

describe("status capabilities and abuse counters are server-only", () => {
  it.each(["candidate_access_tokens", "_rate_limits_bot", "_rate_limits_status_email", "_rate_limits_status_daily", "_rate_limits_status_exchange"])("denies all browser access to %s", async collection => {
    await testEnv.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), `${collection}/private`), { subject_id: "student" }); });
    for (const context of [testEnv.unauthenticatedContext(), testEnv.authenticatedContext("student"), testEnv.authenticatedContext("admin", { ascent_admin: true })]) {
      await assertFails(getDoc(doc(context.firestore(), `${collection}/private`)));
      await assertFails(setDoc(doc(context.firestore(), `${collection}/private`), { used_at: null }));
    }
  });
});
