# Ascent Registration Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AMS Ascent 2026 registration pipeline: Firebase Auth account creation through profile completion, ending at a deterministic `qualification_path` assignment.

**Architecture:** Firestore as source of truth (deny-all client rules except `applications/{own uid}` read and `colleges/*` read), all writes mediated by Next.js App Router Route Handlers using the Admin SDK. Multi-route, server-gated flow (`/register` → `/register/handle` → `/register/profile` → `/register/path`), each route redirecting based on the caller's session + application state so the flow resumes correctly across visits.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS (existing repo stack) + `firebase` (client SDK) + `firebase-admin` (server SDK) + `vitest` (test runner) + `@firebase/rules-unit-testing` (security rules tests) + `tsx` (run TS scripts directly) + `firebase-tools` (emulators, dev dependency).

## Global Constraints

- Firestore is the source of truth (not Postgres), spec deviation #1.
- Edition constant: `"ascent-2026"`.
- Resume upload is in scope now (Stage 2 / profile completion), PDF only, ≤500KB, no transcript field, spec deviation #2.
- Auth is Google OAuth + Firebase email magic-link (not a typed OTP code), spec deviation #3.
- Deny-all Firestore rules by default. Only exceptions: `applications/{uid}` owner-read, `colleges/*` public-read. Everything else (`pii`, `handles`, `phones`, `consent`, `_rate_limits*`, `audit_log`, `unlisted_college_submissions`) is Admin-SDK-only, no client access at all.
- Storage: `resumes/{uid}/{fileName}` is Admin-SDK-only (`allow read, write: if false` for clients).
- Every mutating route: server-side re-validation of all client input (never trust client), structured logging (`reqId`, masked email/actor), fail-open on non-critical externals / fail-closed on integrity checks (dedupe, auth, rate-limit lookups).
- Handle uniqueness via `handles/{edition}_{handleLower}` sentinel doc in the same transaction as `applications/{uid}` creation. Person dedupe via `phones/{edition}_{phoneE164}` sentinel doc at the profile step.
- College verification (OTP/ID review), the admin console, and Access integration are explicitly out of scope, `determinePath` always receives `UNVERIFIED` for now, so every application currently resolves to `QUALIFIER`.
- No placeholder/lorem content; no new UI dependencies beyond what's already in `package.json` (`clsx`, `tailwind-merge`, `lucide-react`) plus the Firebase packages above.

## File structure

```
amsascent/
  .env.local.example          # NEW, documents every required env var
  firebase.json                # NEW, emulator + rules config
  .firebaserc                  # NEW, placeholder project id
  firestore.indexes.json       # NEW, empty index manifest
  firestore.rules              # NEW
  storage.rules                # NEW
  vitest.config.ts             # NEW
  scripts/
    seed-colleges.ts           # NEW, writes dev seed college docs
  src/
    types/
      registration.ts          # NEW, shared TS types
    lib/
      constants.ts              # NEW
      firebaseClient.ts         # NEW, client SDK init
      firebaseAdmin.ts          # NEW, admin SDK init
      logger.ts                 # NEW
      rateLimit.ts               # NEW
      qualificationEngine.ts    # NEW
      validators.ts              # NEW
      collegeSearch.ts           # NEW, search-term generation
      session.ts                 # NEW, session cookie helpers
    app/
      api/
        auth/session/route.ts        # NEW
        colleges/search/route.ts     # NEW
        register/handle/route.ts     # NEW
        register/profile/route.ts    # NEW
      register/
        page.tsx                      # NEW, sign-in (server-gated)
        handle/page.tsx                # NEW
        profile/page.tsx               # NEW
        path/page.tsx                  # NEW
    components/
      register/
        SignInForm.tsx           # NEW
        HandleForm.tsx            # NEW
        CollegeTypeahead.tsx       # NEW
        ProfileForm.tsx             # NEW
  test/
    smoke.test.ts                # NEW
    constants.test.ts             # NEW
    qualificationEngine.test.ts   # NEW
    validators.test.ts             # NEW
    collegeSearch.test.ts          # NEW
    rateLimit.test.ts               # NEW
    rules/
      firestore.test.ts             # NEW
      storage.test.ts                # NEW
```

---

### Task 1: Project setup, Firebase deps, emulator config, test harness

**Files:**

- Modify: `package.json`
- Create: `.env.local.example`
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `firestore.indexes.json`
- Create: `firestore.rules` (deny-all placeholder, Task 3 replaces content)
- Create: `storage.rules` (deny-all placeholder, Task 3 replaces content)
- Create: `vitest.config.ts`
- Create: `test/smoke.test.ts`

**Interfaces:**

- Produces: `npm test`, `npm run test:watch`, `npm run emulators`, `npm run seed:colleges` scripts. `vitest.config.ts` used by every later test file.

- [ ] **Step 1: Install runtime and dev dependencies**

```bash
npm install firebase firebase-admin
npm install -D firebase-tools vitest @firebase/rules-unit-testing tsx
```

- [ ] **Step 2: Create `.env.local.example`**

```bash
# Firebase client SDK (public, safe to expose to the browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
# Set to "true" only in local dev to route the client SDK at the emulators
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false

# Firebase Admin SDK (server-only secrets, never prefix with NEXT_PUBLIC_)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Local dev only, point the Admin SDK at the emulators instead of production.
# Export these in your shell (or a local .env.local, gitignored) before `next dev`.
# FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
# FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
# FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
```

- [ ] **Step 3: Create `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProject": true
  }
}
```

- [ ] **Step 4: Create `.firebaserc`**

```json
{
  "projects": {
    "default": "ascent-2026-dev"
  }
}
```

- [ ] **Step 5: Create `firestore.indexes.json`**

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 6: Create placeholder `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 7: Create placeholder `storage.rules`**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 8: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
});
```

- [ ] **Step 9: Add npm scripts to `package.json`**

Add under `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"emulators": "firebase emulators:start",
"seed:colleges": "tsx scripts/seed-colleges.ts"
```

- [ ] **Step 10: Write the harness smoke test**

`test/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 11: Run the test suite**

Run: `npm test`
Expected: 1 passed (`test harness > runs`)

- [ ] **Step 12: Verify emulators boot**

Run: `npx firebase emulators:start --only firestore,auth,storage` , confirm the Emulator UI logs a listening URL on port 4000, then `Ctrl+C` to stop.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json .env.local.example firebase.json .firebaserc firestore.indexes.json firestore.rules storage.rules vitest.config.ts test/smoke.test.ts
git commit -m "chore: scaffold Firebase deps, emulator config, and vitest harness"
```

---

### Task 2: Shared types and constants

**Files:**

- Create: `src/types/registration.ts`
- Create: `src/lib/constants.ts`
- Create: `test/constants.test.ts`

**Interfaces:**

- Consumes: nothing (foundational).
- Produces: types `ApplicationState`, `CollegeTier`, `QualificationPath`, `CollegeVerificationStatus`, `ApplicantStatus`, `Application`, `Pii`, `College` from `@/types/registration`. Constants `EDITION`, `MAX_RESUME_BYTES`, `IP_RATE_LIMIT_MAX_PER_HOUR`, `IDENTIFIER_RATE_LIMIT_MAX`, `IDENTIFIER_RATE_LIMIT_WINDOW_MS`, `SESSION_COOKIE_MAX_AGE_MS`, `SESSION_COOKIE_NAME` from `@/lib/constants`.

- [ ] **Step 1: Write the failing constants test**

`test/constants.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  EDITION,
  MAX_RESUME_BYTES,
  IP_RATE_LIMIT_MAX_PER_HOUR,
  IDENTIFIER_RATE_LIMIT_MAX,
  IDENTIFIER_RATE_LIMIT_WINDOW_MS,
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from "../src/lib/constants";

describe("constants", () => {
  it("defines the current edition", () => {
    expect(EDITION).toBe("ascent-2026");
  });

  it("caps the resume upload at 500KB", () => {
    expect(MAX_RESUME_BYTES).toBe(500 * 1024);
  });

  it("defines rate limit windows", () => {
    expect(IP_RATE_LIMIT_MAX_PER_HOUR).toBe(10);
    expect(IDENTIFIER_RATE_LIMIT_MAX).toBe(3);
    expect(IDENTIFIER_RATE_LIMIT_WINDOW_MS).toBe(30 * 60 * 1000);
  });

  it("defines the session cookie name and max age", () => {
    expect(SESSION_COOKIE_NAME).toBe("ascent_session");
    expect(SESSION_COOKIE_MAX_AGE_MS).toBe(5 * 24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- constants`
Expected: FAIL, `Cannot find module '../src/lib/constants'`

- [ ] **Step 3: Write `src/lib/constants.ts`**

```ts
export const EDITION = "ascent-2026";

export const MAX_RESUME_BYTES = 500 * 1024;

export const IP_RATE_LIMIT_MAX_PER_HOUR = 10;
export const IDENTIFIER_RATE_LIMIT_MAX = 3;
export const IDENTIFIER_RATE_LIMIT_WINDOW_MS = 30 * 60 * 1000;

export const SESSION_COOKIE_NAME = "ascent_session";
export const SESSION_COOKIE_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- constants`
Expected: 4 passed

- [ ] **Step 5: Write `src/types/registration.ts`**

```ts
export type Edition = string;

export type ApplicationState =
  "DRAFT" | "EMAIL_VERIFIED" | "PROFILE_COMPLETE" | "QUALIFICATION_DETERMINED";

export type CollegeTier = "AUTO_QUALIFY" | "STANDARD" | "UNLISTED";

export type QualificationPath = "AUTO" | "QUALIFIER" | "UNDETERMINED";

export type CollegeVerificationStatus = "VERIFIED" | "UNVERIFIED";

export type ApplicantStatus = "STUDENT" | "PROFESSIONAL" | "OTHER";

export interface Application {
  edition: Edition;
  state: ApplicationState;
  handle: string;
  college_id: string | null;
  college_tier: CollegeTier;
  year_of_study: string | null;
  graduation_year: number | null;
  status: ApplicantStatus | null;
  skills: string[] | null;
  qualification_path: QualificationPath;
  qualification_reason: string | null;
  created_at: unknown;
  updated_at: unknown;
}

export interface Pii {
  legal_name: string;
  email: string;
  email_masked: string;
  phone: string | null;
  resume_ref: string | null;
  college_email: string | null;
}

export interface College {
  canonical_name: string;
  canonical_name_lower: string;
  search_terms: string[];
  aliases: string[];
  campus: string | null;
  tier: "AUTO_QUALIFY" | "STANDARD";
  email_domains: string[];
  active: boolean;
}
```

- [ ] **Step 6: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors attributable to `src/types/registration.ts` or `src/lib/constants.ts`

- [ ] **Step 7: Commit**

```bash
git add src/types/registration.ts src/lib/constants.ts test/constants.test.ts
git commit -m "feat: add shared registration types and constants"
```

---

### Task 3: Firestore and Storage security rules

**Files:**

- Modify: `firestore.rules`
- Modify: `storage.rules`
- Create: `test/rules/firestore.test.ts`
- Create: `test/rules/storage.test.ts`
- Modify: `package.json` (add `test:rules` script)

**Interfaces:**

- Consumes: collection names from Task 2's data model (`applications`, `pii`, `colleges`, `handles`, `phones`, `consent`, `unlisted_college_submissions`, `_rate_limits*`, `audit_log`), Storage path `resumes/{uid}/{fileName}`.
- Produces: the deployed rule set every later API-route task relies on for its security model.

- [ ] **Step 1: Add the `test:rules` npm script**

Add to `package.json` `"scripts"`:

```json
"test:rules": "firebase emulators:exec --project=ascent-2026-dev --only firestore,storage \"vitest run test/rules\""
```

- [ ] **Step 2: Write the failing Firestore rules test**

`test/rules/firestore.test.ts`:

```ts
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

describe("pii/{uid}, deny-all, even for the owner", () => {
  it("denies owner read", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "pii/uid-1"), { email: "a@b.com" });
    });
    const ownerDb = testEnv.authenticatedContext("uid-1").firestore();
    await assertFails(getDoc(doc(ownerDb, "pii/uid-1")));
  });
});

describe("handles/{id} and phones/{id}, deny-all", () => {
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
```

- [ ] **Step 3: Run the rules test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL, every `assertSucceeds`/`assertFails` on `applications` and `colleges` fails against the current deny-all placeholder rules (the owner-read and public-read cases don't succeed yet)

- [ ] **Step 4: Write the real `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /applications/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }

    match /colleges/{id} {
      allow read: if true;
      allow write: if false;
    }

    match /pii/{uid} {
      allow read, write: if false;
    }

    match /handles/{id} {
      allow read, write: if false;
    }

    match /phones/{id} {
      allow read, write: if false;
    }

    match /consent/{uid} {
      allow read, write: if false;
    }

    match /unlisted_college_submissions/{id} {
      allow read, write: if false;
    }

    match /_rate_limits/{id} {
      allow read, write: if false;
    }

    match /_rate_limits_email/{id} {
      allow read, write: if false;
    }

    match /_rate_limits_phone/{id} {
      allow read, write: if false;
    }

    match /audit_log/{id} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 5: Run the rules test to verify it passes**

Run: `npm run test:rules`
Expected: 8 passed

- [ ] **Step 6: Write the failing Storage rules test**

`test/rules/storage.test.ts`:

```ts
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
```

- [ ] **Step 7: Run to verify it currently passes (placeholder is already deny-all)**

Run: `npm run test:rules`
Expected: 2 passed (the storage placeholder from Task 1 is already deny-all, matching the spec)

- [ ] **Step 8: Write the real `storage.rules` (same deny-all shape, scoped to the actual path)**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /resumes/{uid}/{fileName} {
      allow read, write: if false;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 9: Run all rules tests once more**

Run: `npm run test:rules`
Expected: 10 passed total (8 Firestore + 2 Storage)

- [ ] **Step 10: Commit**

```bash
git add firestore.rules storage.rules test/rules package.json
git commit -m "feat: add Firestore and Storage security rules with rules-unit-tests"
```

---

### Task 4: Qualification engine

**Files:**

- Create: `src/lib/qualificationEngine.ts`
- Create: `test/qualificationEngine.test.ts`

**Interfaces:**

- Consumes: types `CollegeTier`, `CollegeVerificationStatus`, `QualificationPath` from `@/types/registration` (Task 2).
- Produces: `determinePath(collegeTier: CollegeTier, collegeVerificationStatus: CollegeVerificationStatus): { path: QualificationPath; reason: string }` from `@/lib/qualificationEngine`, consumed by Task 11's profile route.

- [ ] **Step 1: Write the failing tests**

`test/qualificationEngine.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { determinePath } from "../src/lib/qualificationEngine";

describe("determinePath", () => {
  it("AUTO_QUALIFY + VERIFIED -> AUTO", () => {
    expect(determinePath("AUTO_QUALIFY", "VERIFIED")).toEqual({
      path: "AUTO",
      reason: "verified tier-1 college",
    });
  });

  it("AUTO_QUALIFY + UNVERIFIED -> QUALIFIER, tier-1 claim unverified", () => {
    expect(determinePath("AUTO_QUALIFY", "UNVERIFIED")).toEqual({
      path: "QUALIFIER",
      reason: "tier-1 claim unverified",
    });
  });

  it("STANDARD + VERIFIED -> QUALIFIER, standard tier", () => {
    expect(determinePath("STANDARD", "VERIFIED")).toEqual({
      path: "QUALIFIER",
      reason: "standard tier",
    });
  });

  it("STANDARD + UNVERIFIED -> QUALIFIER, standard tier", () => {
    expect(determinePath("STANDARD", "UNVERIFIED")).toEqual({
      path: "QUALIFIER",
      reason: "standard tier",
    });
  });

  it("UNLISTED + UNVERIFIED -> QUALIFIER, unlisted college", () => {
    expect(determinePath("UNLISTED", "UNVERIFIED")).toEqual({
      path: "QUALIFIER",
      reason: "unlisted college",
    });
  });

  it("UNLISTED + VERIFIED -> QUALIFIER, unlisted college (verification is meaningless without a college)", () => {
    expect(determinePath("UNLISTED", "VERIFIED")).toEqual({
      path: "QUALIFIER",
      reason: "unlisted college",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- qualificationEngine`
Expected: FAIL, `Cannot find module '../src/lib/qualificationEngine'`

- [ ] **Step 3: Write the implementation**

`src/lib/qualificationEngine.ts`:

```ts
import type {
  CollegeTier,
  CollegeVerificationStatus,
  QualificationPath,
} from "@/types/registration";

export interface QualificationResult {
  path: QualificationPath;
  reason: string;
}

export function determinePath(
  collegeTier: CollegeTier,
  collegeVerificationStatus: CollegeVerificationStatus,
): QualificationResult {
  if (collegeTier === "UNLISTED") {
    return { path: "QUALIFIER", reason: "unlisted college" };
  }
  if (
    collegeTier === "AUTO_QUALIFY" &&
    collegeVerificationStatus === "VERIFIED"
  ) {
    return { path: "AUTO", reason: "verified tier-1 college" };
  }
  if (
    collegeTier === "AUTO_QUALIFY" &&
    collegeVerificationStatus === "UNVERIFIED"
  ) {
    return { path: "QUALIFIER", reason: "tier-1 claim unverified" };
  }
  return { path: "QUALIFIER", reason: "standard tier" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- qualificationEngine`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/qualificationEngine.ts test/qualificationEngine.test.ts
git commit -m "feat: add qualification engine as a pure function"
```

---

### Task 5: Validators (handle, phone, resume)

**Files:**

- Create: `src/lib/validators.ts`
- Create: `test/validators.test.ts`

**Interfaces:**

- Consumes: nothing beyond Node's built-in `Buffer`.
- Produces: `validateHandle(handle: string): { valid: boolean; error?: string }`, `normalizeIndianPhone(phone: string): { valid: boolean; e164?: string; error?: string }`, `validateResumeBuffer(buffer: Buffer, maxBytes: number): { valid: boolean; error?: string }` from `@/lib/validators`, consumed by Task 10 (handle) and Task 11 (phone, resume).

- [ ] **Step 1: Write the failing tests**

`test/validators.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  validateHandle,
  normalizeIndianPhone,
  validateResumeBuffer,
} from "../src/lib/validators";

describe("validateHandle", () => {
  it("accepts a well-formed handle", () => {
    expect(validateHandle("tilak_j").valid).toBe(true);
  });

  it("rejects handles under 3 characters", () => {
    const result = validateHandle("ab");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/3-24 characters/);
  });

  it("rejects handles over 24 characters", () => {
    const result = validateHandle("a".repeat(25));
    expect(result.valid).toBe(false);
  });

  it("rejects a handle starting with a digit", () => {
    const result = validateHandle("1tilak");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/start with a letter/);
  });

  it("rejects handles with spaces or symbols", () => {
    expect(validateHandle("til ak").valid).toBe(false);
    expect(validateHandle("til@ak").valid).toBe(false);
  });
});

describe("normalizeIndianPhone", () => {
  it("normalizes a bare 10-digit number to E.164", () => {
    expect(normalizeIndianPhone("9876543210")).toEqual({
      valid: true,
      e164: "+919876543210",
    });
  });

  it("strips a leading 0", () => {
    expect(normalizeIndianPhone("09876543210")).toEqual({
      valid: true,
      e164: "+919876543210",
    });
  });

  it("strips a leading country code", () => {
    expect(normalizeIndianPhone("919876543210")).toEqual({
      valid: true,
      e164: "+919876543210",
    });
  });

  it("rejects a number not starting with 6-9", () => {
    const result = normalizeIndianPhone("5876543210");
    expect(result.valid).toBe(false);
  });

  it("rejects a too-short number", () => {
    const result = normalizeIndianPhone("98765");
    expect(result.valid).toBe(false);
  });
});

describe("validateResumeBuffer", () => {
  const pdfBuffer = Buffer.concat([
    Buffer.from("%PDF-1.4\n"),
    Buffer.alloc(100),
  ]);

  it("accepts a small valid PDF", () => {
    expect(validateResumeBuffer(pdfBuffer, 500 * 1024)).toEqual({
      valid: true,
    });
  });

  it("rejects an empty buffer", () => {
    const result = validateResumeBuffer(Buffer.alloc(0), 500 * 1024);
    expect(result.valid).toBe(false);
  });

  it("rejects a buffer over the size cap", () => {
    const result = validateResumeBuffer(pdfBuffer, 50);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/under/);
  });

  it("rejects a buffer without the PDF magic bytes", () => {
    const result = validateResumeBuffer(Buffer.from("not a pdf"), 500 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/valid PDF/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- validators`
Expected: FAIL, `Cannot find module '../src/lib/validators'`

- [ ] **Step 3: Write the implementation**

`src/lib/validators.ts`:

```ts
export function validateHandle(handle: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = handle.trim();
  if (trimmed.length < 3 || trimmed.length > 24) {
    return { valid: false, error: "Handle must be 3-24 characters." };
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
    return {
      valid: false,
      error:
        "Handle must start with a letter and contain only letters, numbers, and underscores.",
    };
  }
  return { valid: true };
}

export function normalizeIndianPhone(phone: string): {
  valid: boolean;
  e164?: string;
  error?: string;
} {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return {
      valid: false,
      error: "Enter a valid 10-digit Indian phone number.",
    };
  }
  return { valid: true, e164: `+91${digits}` };
}

const PDF_MAGIC_BYTES = Buffer.from("%PDF");

export function validateResumeBuffer(
  buffer: Buffer,
  maxBytes: number,
): { valid: boolean; error?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: "Resume file is empty." };
  }
  if (buffer.length > maxBytes) {
    return {
      valid: false,
      error: `Resume must be under ${Math.floor(maxBytes / 1024)}KB.`,
    };
  }
  if (!buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)) {
    return { valid: false, error: "Resume must be a valid PDF file." };
  }
  return { valid: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- validators`
Expected: 14 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators.ts test/validators.test.ts
git commit -m "feat: add handle, phone, and resume validators"
```

---

### Task 6: Firebase client and Admin SDK init modules

**Files:**

- Create: `src/lib/firebaseClient.ts`
- Create: `src/lib/firebaseAdmin.ts`

**Interfaces:**

- Consumes: `NEXT_PUBLIC_FIREBASE_*` env vars (client), `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` env vars (admin), emulator-host env vars when set.
- Produces: `auth`, `db`, `googleProvider`, `firebaseApp` from `@/lib/firebaseClient`. `adminAuth`, `adminDb`, `adminStorage` from `@/lib/firebaseAdmin`, consumed by every API route task (8-11) and every server-component page task (12-15).

This task has no independent unit-testable behavior of its own (it's SDK configuration); it's verified by the tasks that consume it. Steps below create the modules and verify the project still builds.

- [ ] **Step 1: Write `src/lib/firebaseClient.ts`**

```ts
"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

declare global {
  // eslint-disable-next-line no-var
  var __ascentEmulatorsConnected: boolean | undefined;
}

if (
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" &&
  !globalThis.__ascentEmulatorsConnected
) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  globalThis.__ascentEmulatorsConnected = true;
}
```

- [ ] **Step 2: Write `src/lib/firebaseAdmin.ts`**

```ts
import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function buildAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const usingEmulator =
    Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

  if (usingEmulator) {
    return initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "ascent-2026-dev",
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n",
  );
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const adminApp = buildAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
```

- [ ] **Step 3: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors attributable to `src/lib/firebaseClient.ts` or `src/lib/firebaseAdmin.ts`

- [ ] **Step 4: Verify the Next.js build still passes**

Run: `npm run build`
Expected: build succeeds (these modules aren't imported anywhere yet, so this mainly confirms no syntax/type errors)

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebaseClient.ts src/lib/firebaseAdmin.ts
git commit -m "feat: add Firebase client and Admin SDK init modules"
```

---

### Task 7: Structured logging and rate limiting

**Files:**

- Create: `src/lib/logger.ts`
- Create: `src/lib/rateLimit.ts`
- Create: `test/rateLimit.test.ts`

**Interfaces:**

- Consumes: `adminDb` type shape (`Firestore` from `firebase-admin/firestore`), Task 6.
- Produces: `genReqId(): string`, `maskEmail(email: string): string`, default export `logger` with `.info/.warn/.error(scope, event, fields, error?)` from `@/lib/logger`. `sha256(value: string): string` and `checkSlidingWindow(db, collection, key, maxCount, windowMs): Promise<{ overLimit: boolean; recordFailure: () => Promise<void> }>` from `@/lib/rateLimit`, both consumed by Task 9 (session), Task 10 (handle route), Task 11 (profile route).

- [ ] **Step 1: Write `src/lib/logger.ts` (no test, thin formatting utility, exercised end-to-end by the routes that use it in later tasks)**

```ts
import crypto from "node:crypto";

export function genReqId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

type LogStatus = "ok" | "degraded" | "blocked" | "failed";

interface LogFields {
  reqId: string;
  entityId?: string;
  actorId?: string;
  detail?: Record<string, unknown>;
  status: LogStatus;
  durationMs?: number;
}

function log(
  level: "info" | "warn" | "error",
  scope: string,
  event: string,
  fields: LogFields,
  error?: unknown,
) {
  const payload = {
    level,
    scope,
    event,
    ...fields,
    error: error instanceof Error ? error.message : undefined,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

const logger = {
  info: (scope: string, event: string, fields: LogFields) =>
    log("info", scope, event, fields),
  warn: (scope: string, event: string, fields: LogFields) =>
    log("warn", scope, event, fields),
  error: (scope: string, event: string, fields: LogFields, error?: unknown) =>
    log("error", scope, event, fields, error),
};

export default logger;
```

- [ ] **Step 2: Write the failing rate limit test (runs against the Firestore emulator)**

`test/rateLimit.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `firebase emulators:exec --project=ascent-2026-dev --only firestore "vitest run test/rateLimit.test.ts"`
Expected: FAIL, `Cannot find module '../src/lib/rateLimit'`

- [ ] **Step 4: Write `src/lib/rateLimit.ts`**

```ts
import crypto from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function checkSlidingWindow(
  db: Firestore,
  collection: string,
  key: string,
  maxCount: number,
  windowMs: number,
): Promise<{ overLimit: boolean; recordFailure: () => Promise<void> }> {
  const ref = db.collection(collection).doc(key);
  const snap = await ref.get();
  const windowStart = Date.now() - windowMs;
  const timestamps: number[] = snap.exists
    ? (snap.data()?.timestamps ?? [])
    : [];
  const recent = timestamps.filter((ts) => ts > windowStart);
  const overLimit = recent.length >= maxCount;

  const recordFailure = async () => {
    const expiresAt = Timestamp.fromMillis(
      Date.now() + windowMs + 60 * 60 * 1000,
    );
    await ref.set({ timestamps: [...recent, Date.now()], expiresAt });
  };

  return { overLimit, recordFailure };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `firebase emulators:exec --project=ascent-2026-dev --only firestore "vitest run test/rateLimit.test.ts"`
Expected: 4 passed

- [ ] **Step 6: Add a `test:emulated` npm script bundling emulator-dependent unit tests**

Add to `package.json` `"scripts"`:

```json
"test:emulated": "firebase emulators:exec --project=ascent-2026-dev --only firestore,auth,storage \"vitest run test/rateLimit.test.ts test/rules\""
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/logger.ts src/lib/rateLimit.ts test/rateLimit.test.ts package.json
git commit -m "feat: add structured logger and Firestore-backed sliding-window rate limiting"
```

---

### Task 8: College reference data, search terms, seed script, search API

**Files:**

- Create: `src/lib/collegeSearch.ts`
- Create: `test/collegeSearch.test.ts`
- Create: `scripts/seed-colleges.ts`
- Create: `src/app/api/colleges/search/route.ts`

**Interfaces:**

- Consumes: `adminDb` from `@/lib/firebaseAdmin` (Task 6), type `College` from `@/types/registration` (Task 2).
- Produces: `buildSearchTerms(canonicalName: string, aliases: string[]): string[]` from `@/lib/collegeSearch`, used by the seed script and, later, any admin college-management tooling. The `GET /api/colleges/search?q=` endpoint, consumed by Task 13's `CollegeTypeahead` component.

- [ ] **Step 1: Write the failing search-terms test**

`test/collegeSearch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSearchTerms } from "../src/lib/collegeSearch";

describe("buildSearchTerms", () => {
  it("generates prefixes of at least length 2 for each word", () => {
    const terms = buildSearchTerms("IIT Bombay", []);
    expect(terms).toContain("ii");
    expect(terms).toContain("iit");
    expect(terms).toContain("bo");
    expect(terms).toContain("bom");
    expect(terms).toContain("bombay");
  });

  it("includes prefixes from aliases too", () => {
    const terms = buildSearchTerms("Indian Institute of Technology Bombay", [
      "IITB",
      "IIT Bombay",
    ]);
    expect(terms).toContain("iitb");
  });

  it("lowercases everything", () => {
    const terms = buildSearchTerms("BITS Pilani", []);
    expect(terms.every((t) => t === t.toLowerCase())).toBe(true);
  });

  it("does not include single-character prefixes", () => {
    const terms = buildSearchTerms("IIT Bombay", []);
    expect(terms).not.toContain("i");
    expect(terms).not.toContain("b");
  });

  it("deduplicates repeated prefixes across words/aliases", () => {
    const terms = buildSearchTerms("IIT Bombay", ["IIT Bombay"]);
    expect(terms.filter((t) => t === "iit").length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- collegeSearch`
Expected: FAIL, `Cannot find module '../src/lib/collegeSearch'`

- [ ] **Step 3: Write `src/lib/collegeSearch.ts`**

```ts
export function buildSearchTerms(
  canonicalName: string,
  aliases: string[],
): string[] {
  const words = [canonicalName, ...aliases]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const terms = new Set<string>();
  for (const word of words) {
    for (let end = 2; end <= word.length; end++) {
      terms.add(word.slice(0, end));
    }
  }
  return Array.from(terms);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- collegeSearch`
Expected: 5 passed

- [ ] **Step 5: Write the seed script**

`scripts/seed-colleges.ts`:

```ts
import { adminDb } from "../src/lib/firebaseAdmin";
import { buildSearchTerms } from "../src/lib/collegeSearch";

interface SeedCollege {
  id: string;
  canonical_name: string;
  aliases: string[];
  campus: string | null;
  tier: "AUTO_QUALIFY" | "STANDARD";
  email_domains: string[];
}

const SEED_COLLEGES: SeedCollege[] = [
  {
    id: "iit-bombay",
    canonical_name: "IIT Bombay",
    aliases: ["Indian Institute of Technology Bombay", "IITB"],
    campus: "Mumbai",
    tier: "AUTO_QUALIFY",
    email_domains: ["iitb.ac.in"],
  },
  {
    id: "iit-delhi",
    canonical_name: "IIT Delhi",
    aliases: ["Indian Institute of Technology Delhi", "IITD"],
    campus: "Delhi",
    tier: "AUTO_QUALIFY",
    email_domains: ["iitd.ac.in"],
  },
  {
    id: "bits-pilani",
    canonical_name: "BITS Pilani",
    aliases: ["Birla Institute of Technology and Science, Pilani"],
    campus: "Pilani",
    tier: "AUTO_QUALIFY",
    email_domains: ["pilani.bits-pilani.ac.in"],
  },
  {
    id: "iiit-hyderabad",
    canonical_name: "IIIT Hyderabad",
    aliases: [
      "International Institute of Information Technology Hyderabad",
      "IIITH",
    ],
    campus: "Hyderabad",
    tier: "AUTO_QUALIFY",
    email_domains: ["students.iiit.ac.in"],
  },
  {
    id: "vit-vellore",
    canonical_name: "VIT Vellore",
    aliases: ["Vellore Institute of Technology"],
    campus: "Vellore",
    tier: "STANDARD",
    email_domains: ["vitstudent.ac.in"],
  },
  {
    id: "thapar-institute",
    canonical_name: "Thapar Institute of Engineering and Technology",
    aliases: ["Thapar University", "TIET"],
    campus: "Patiala",
    tier: "STANDARD",
    email_domains: ["thapar.edu"],
  },
];

async function seed() {
  const batch = adminDb.batch();
  for (const college of SEED_COLLEGES) {
    const ref = adminDb.collection("colleges").doc(college.id);
    batch.set(ref, {
      canonical_name: college.canonical_name,
      canonical_name_lower: college.canonical_name.toLowerCase(),
      search_terms: buildSearchTerms(college.canonical_name, college.aliases),
      aliases: college.aliases,
      campus: college.campus,
      tier: college.tier,
      email_domains: college.email_domains,
      active: true,
    });
  }
  await batch.commit();
  console.log(`Seeded ${SEED_COLLEGES.length} colleges.`);
}

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
```

- [ ] **Step 6: Verify the seed script runs against the emulator**

In one terminal: `npx firebase emulators:start --only firestore`
In another terminal: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed:colleges`
Expected: `Seeded 6 colleges.` printed, no errors

- [ ] **Step 7: Write the search API route**

`src/app/api/colleges/search/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const snap = await adminDb
    .collection("colleges")
    .where("active", "==", true)
    .where("search_terms", "array-contains", q)
    .limit(10)
    .get();

  const results = snap.docs.map((docSnap) => ({
    college_id: docSnap.id,
    canonical_name: docSnap.data().canonical_name as string,
    campus: (docSnap.data().campus as string | null) ?? null,
    tier: docSnap.data().tier as "AUTO_QUALIFY" | "STANDARD",
  }));

  return NextResponse.json({ results });
}
```

- [ ] **Step 8: Verify the route against the emulator manually**

With the Firestore emulator still running and seeded (Step 6), start the dev server pointed at the emulator:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run dev
```

Then: `curl "http://localhost:3000/api/colleges/search?q=iit"`
Expected: JSON with `results` containing IIT Bombay and IIT Delhi

- [ ] **Step 9: Commit**

```bash
git add src/lib/collegeSearch.ts test/collegeSearch.test.ts scripts/seed-colleges.ts src/app/api/colleges/search/route.ts
git commit -m "feat: add college search-term generation, seed script, and search API"
```

---

### Task 9: Session auth, cookie helpers and `/api/auth/session`

**Files:**

- Create: `src/lib/session.ts`
- Create: `src/app/api/auth/session/route.ts`

**Interfaces:**

- Consumes: `adminAuth` from `@/lib/firebaseAdmin` (Task 6), `SESSION_COOKIE_NAME`/`SESSION_COOKIE_MAX_AGE_MS` from `@/lib/constants` (Task 2).
- Produces: `createSessionCookie(idToken: string): Promise<string>`, `verifySessionCookie(cookie: string): Promise<SessionUser | null>` with `interface SessionUser { uid: string; email: string | null }` from `@/lib/session`, consumed by every server component page task (12-15) and by Task 10/11's routes.

- [ ] **Step 1: Write `src/lib/session.ts`**

```ts
import { adminAuth } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE_MAX_AGE_MS } from "@/lib/constants";

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_COOKIE_MAX_AGE_MS,
  });
}

export interface SessionUser {
  uid: string;
  email: string | null;
}

export async function verifySessionCookie(
  cookie: string,
): Promise<SessionUser | null> {
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write the session API route**

`src/app/api/auth/session/route.ts`:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/session";
import {
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from "@/lib/constants";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const idToken = body?.idToken;
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken." }, { status: 400 });
  }

  let cookie: string;
  try {
    cookie = await createSessionCookie(idToken);
  } catch {
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
```

- [ ] **Step 3: Verify against the Auth emulator manually**

Start the Auth emulator: `npx firebase emulators:start --only auth`

Create a test user and get an ID token via the emulator's REST API:

```bash
curl -s -X POST \
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","returnSecureToken":true}'
```

Copy the `idToken` from the response, then with the dev server running against the emulator (`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run dev`):

```bash
curl -i -X POST http://localhost:3000/api/auth/session \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<paste idToken here>"}'
```

Expected: `HTTP/1.1 200`, response includes a `Set-Cookie: ascent_session=...; HttpOnly; ...` header

- [ ] **Step 4: Verify DELETE clears the cookie**

Run: `curl -i -X DELETE http://localhost:3000/api/auth/session`
Expected: `HTTP/1.1 200`, `Set-Cookie` header clearing `ascent_session`

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/app/api/auth/session/route.ts
git commit -m "feat: add session cookie helpers and /api/auth/session route"
```

---

### Task 10: `/api/register/handle` route

**Files:**

- Create: `src/app/api/register/handle/route.ts`

**Interfaces:**

- Consumes: `adminDb` (Task 6), `verifySessionCookie` (Task 9), `validateHandle` (Task 5), `checkSlidingWindow`/`sha256` (Task 7), `logger`/`genReqId`/`maskEmail` (Task 7), `EDITION`/`IP_RATE_LIMIT_MAX_PER_HOUR`/`SESSION_COOKIE_NAME` (Task 2).
- Produces: `POST /api/register/handle`, consumed by Task 13's `HandleForm`. On success, creates `applications/{uid}` (state `EMAIL_VERIFIED`) and `pii/{uid}`, and a `handles/{edition}_{handleLower}` sentinel doc.

- [ ] **Step 1: Write the route**

`src/app/api/register/handle/route.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore";
import { type NextRequest, NextResponse } from "next/server";
import {
  EDITION,
  IP_RATE_LIMIT_MAX_PER_HOUR,
  SESSION_COOKIE_NAME,
} from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import logger, { genReqId, maskEmail } from "@/lib/logger";
import { checkSlidingWindow, sha256 } from "@/lib/rateLimit";
import { verifySessionCookie } from "@/lib/session";
import { validateHandle } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const reqId = genReqId();
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const clientIp =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";
  const ipHash = sha256(clientIp);
  const ipLimit = await checkSlidingWindow(
    adminDb,
    "_rate_limits",
    ipHash,
    IP_RATE_LIMIT_MAX_PER_HOUR,
    60 * 60 * 1000,
  );
  if (ipLimit.overLimit) {
    logger.warn("register_handle", "ip_soft_throttle", {
      reqId,
      actorId: ipHash,
      status: "blocked",
    });
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const handle = typeof body.handle === "string" ? body.handle : "";
  const collegeId =
    typeof body.college_id === "string" ? body.college_id : null;
  const unlistedName =
    typeof body.unlisted_name === "string" ? body.unlisted_name : null;

  const handleResult = validateHandle(handle);
  if (!handleResult.valid) {
    await ipLimit.recordFailure();
    return NextResponse.json(
      { error: handleResult.error, field: "handle" },
      { status: 400 },
    );
  }
  if (!collegeId && !unlistedName) {
    await ipLimit.recordFailure();
    return NextResponse.json(
      { error: "Select a college or mark it as unlisted.", field: "college" },
      { status: 400 },
    );
  }

  const uid = session.uid;
  const applicationRef = adminDb.collection("applications").doc(uid);
  const existing = await applicationRef.get();
  if (existing.exists) {
    return NextResponse.json({ success: true, state: existing.data()?.state });
  }

  let collegeTier: "AUTO_QUALIFY" | "STANDARD" | "UNLISTED" = "UNLISTED";
  let collegeIdToStore: string | null = null;
  if (collegeId) {
    const collegeSnap = await adminDb
      .collection("colleges")
      .doc(collegeId)
      .get();
    if (!collegeSnap.exists || collegeSnap.data()?.active !== true) {
      await ipLimit.recordFailure();
      return NextResponse.json(
        { error: "Select a valid college from the list.", field: "college" },
        { status: 400 },
      );
    }
    collegeTier = collegeSnap.data()?.tier;
    collegeIdToStore = collegeId;
  }

  const handleLower = handle.trim().toLowerCase();
  const handleRef = adminDb
    .collection("handles")
    .doc(`${EDITION}_${handleLower}`);

  let written = false;
  try {
    written = await adminDb.runTransaction(async (tx) => {
      const handleDoc = await tx.get(handleRef);
      if (handleDoc.exists) {
        return false;
      }
      tx.set(handleRef, { uid, registered_at: FieldValue.serverTimestamp() });
      tx.set(applicationRef, {
        edition: EDITION,
        state: "EMAIL_VERIFIED",
        handle: handle.trim(),
        college_id: collegeIdToStore,
        college_tier: collegeTier,
        year_of_study: null,
        graduation_year: null,
        status: null,
        skills: null,
        qualification_path: "UNDETERMINED",
        qualification_reason: null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      tx.set(adminDb.collection("pii").doc(uid), {
        legal_name: "",
        email: session.email || "",
        email_masked: session.email ? maskEmail(session.email) : "",
        phone: null,
        resume_ref: null,
        college_email: null,
      });
      return true;
    });
  } catch (error) {
    logger.error(
      "register_handle",
      "transaction_failed",
      { reqId, actorId: uid, status: "failed" },
      error,
    );
    return NextResponse.json(
      { error: "Registration failed. Try again." },
      { status: 500 },
    );
  }

  if (!written) {
    await ipLimit.recordFailure();
    return NextResponse.json(
      { error: "This handle is already taken.", field: "handle" },
      { status: 409 },
    );
  }

  if (collegeTier === "UNLISTED" && unlistedName) {
    await adminDb.collection("unlisted_college_submissions").add({
      uid,
      typed_name: unlistedName.trim(),
      submitted_at: FieldValue.serverTimestamp(),
    });
  }

  logger.info("register_handle", "handle_registered", {
    reqId,
    entityId: uid,
    status: "ok",
  });
  return NextResponse.json({ success: true, state: "EMAIL_VERIFIED" });
}
```

- [ ] **Step 2: Verify against the emulators manually**

With Firestore + Auth emulators running and seeded (Task 8), obtain a session cookie for a test user (Task 9, Steps 3-4), then:

```bash
curl -i -X POST http://localhost:3000/api/register/handle \
  -H "Content-Type: application/json" \
  -H "Cookie: ascent_session=<paste cookie value here>" \
  -d '{"handle":"tilak_j","college_id":"iit-bombay"}'
```

Expected: `HTTP/1.1 200`, `{"success":true,"state":"EMAIL_VERIFIED"}`

- [ ] **Step 3: Verify handle-collision rejection**

Repeat the same request with a different session cookie (sign up a second test user) but the same `"handle":"tilak_j"`.
Expected: `HTTP/1.1 409`, `{"error":"This handle is already taken.","field":"handle"}`

- [ ] **Step 4: Verify unauthenticated rejection**

Run: `curl -i -X POST http://localhost:3000/api/register/handle -H "Content-Type: application/json" -d '{"handle":"someone"}'`
Expected: `HTTP/1.1 401`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/register/handle/route.ts
git commit -m "feat: add /api/register/handle route with handle-dedupe transaction"
```

---

### Task 11: `/api/register/profile` route

**Files:**

- Create: `src/app/api/register/profile/route.ts`

**Interfaces:**

- Consumes: `adminDb`/`adminStorage` (Task 6), `verifySessionCookie` (Task 9), `normalizeIndianPhone`/`validateResumeBuffer` (Task 5), `determinePath` (Task 4), `checkSlidingWindow`/`sha256` (Task 7), `logger`/`genReqId` (Task 7), `EDITION`/`MAX_RESUME_BYTES`/`SESSION_COOKIE_NAME` (Task 2).
- Produces: `POST /api/register/profile` (multipart/form-data), consumed by Task 14's `ProfileForm`. On success: writes `pii/{uid}.phone`/`resume_ref`, `applications/{uid}` profile fields + `state: PROFILE_COMPLETE` then `qualification_path`/`qualification_reason` + `state: QUALIFICATION_DETERMINED`, `phones/{edition}_{phoneE164}` sentinel, `consent/{uid}.CONTEST_PARTICIPATION`, and an `audit_log` entry. Uploads the resume to Storage at `resumes/{uid}/resume.pdf`.

- [ ] **Step 1: Write the route**

`src/app/api/register/profile/route.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore";
import { type NextRequest, NextResponse } from "next/server";
import {
  EDITION,
  MAX_RESUME_BYTES,
  SESSION_COOKIE_NAME,
} from "@/lib/constants";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import logger, { genReqId } from "@/lib/logger";
import { determinePath } from "@/lib/qualificationEngine";
import { checkSlidingWindow, sha256 } from "@/lib/rateLimit";
import { verifySessionCookie } from "@/lib/session";
import { normalizeIndianPhone, validateResumeBuffer } from "@/lib/validators";

const VALID_STATUSES = ["STUDENT", "PROFESSIONAL", "OTHER"];

export async function POST(req: NextRequest) {
  const reqId = genReqId();
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const uid = session.uid;

  const applicationRef = adminDb.collection("applications").doc(uid);
  const applicationSnap = await applicationRef.get();
  if (!applicationSnap.exists) {
    return NextResponse.json(
      { error: "Complete the handle step first." },
      { status: 400 },
    );
  }
  const application = applicationSnap.data()!;
  if (application.state === "QUALIFICATION_DETERMINED") {
    return NextResponse.json({
      success: true,
      state: application.state,
      qualification_path: application.qualification_path,
    });
  }

  const formData = await req.formData();
  const yearOfStudy = formData.get("year_of_study");
  const status = formData.get("status");
  const phoneRaw = formData.get("phone");
  const graduationYearRaw = formData.get("graduation_year");
  const resumeFile = formData.get("resume");

  if (typeof phoneRaw !== "string") {
    return NextResponse.json(
      { error: "Phone number is required.", field: "phone" },
      { status: 400 },
    );
  }
  const phoneResult = normalizeIndianPhone(phoneRaw);
  if (!phoneResult.valid || !phoneResult.e164) {
    return NextResponse.json(
      { error: phoneResult.error, field: "phone" },
      { status: 400 },
    );
  }
  if (typeof status !== "string" || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Select a valid status.", field: "status" },
      { status: 400 },
    );
  }
  if (!(resumeFile instanceof File)) {
    return NextResponse.json(
      { error: "Resume is required.", field: "resume" },
      { status: 400 },
    );
  }
  const resumeBuffer = Buffer.from(await resumeFile.arrayBuffer());
  const resumeResult = validateResumeBuffer(resumeBuffer, MAX_RESUME_BYTES);
  if (!resumeResult.valid) {
    return NextResponse.json(
      { error: resumeResult.error, field: "resume" },
      { status: 400 },
    );
  }
  const graduationYear = graduationYearRaw
    ? parseInt(graduationYearRaw.toString(), 10)
    : NaN;

  const phoneHash = sha256(phoneResult.e164);
  const phoneRateLimit = await checkSlidingWindow(
    adminDb,
    "_rate_limits_phone",
    phoneHash,
    3,
    30 * 60 * 1000,
  );
  if (phoneRateLimit.overLimit) {
    return NextResponse.json(
      { error: "Too many attempts for this phone number. Try again later." },
      { status: 429 },
    );
  }

  const phoneRef = adminDb
    .collection("phones")
    .doc(`${EDITION}_${phoneResult.e164}`);
  let written = false;
  try {
    written = await adminDb.runTransaction(async (tx) => {
      const phoneDoc = await tx.get(phoneRef);
      if (phoneDoc.exists && phoneDoc.data()?.uid !== uid) {
        return false;
      }
      tx.set(phoneRef, { uid, registered_at: FieldValue.serverTimestamp() });
      return true;
    });
  } catch (error) {
    logger.error(
      "register_profile",
      "phone_transaction_failed",
      { reqId, actorId: uid, status: "failed" },
      error,
    );
    return NextResponse.json(
      { error: "Registration failed. Try again." },
      { status: 500 },
    );
  }

  if (!written) {
    await phoneRateLimit.recordFailure();
    return NextResponse.json(
      { error: "This phone number is already registered.", field: "phone" },
      { status: 409 },
    );
  }

  const storagePath = `resumes/${uid}/resume.pdf`;
  await adminStorage
    .bucket()
    .file(storagePath)
    .save(resumeBuffer, { contentType: "application/pdf" });

  await adminDb
    .collection("pii")
    .doc(uid)
    .set({ phone: phoneResult.e164, resume_ref: storagePath }, { merge: true });

  await applicationRef.set(
    {
      year_of_study: yearOfStudy ? yearOfStudy.toString() : null,
      graduation_year: Number.isNaN(graduationYear) ? null : graduationYear,
      status,
      state: "PROFILE_COMPLETE",
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const qualification = determinePath(application.college_tier, "UNVERIFIED");

  await applicationRef.set(
    {
      qualification_path: qualification.path,
      qualification_reason: qualification.reason,
      state: "QUALIFICATION_DETERMINED",
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await adminDb
    .collection("consent")
    .doc(uid)
    .set(
      {
        CONTEST_PARTICIPATION: {
          granted: true,
          policy_version: "v1",
          granted_at: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

  await adminDb.collection("audit_log").add({
    subject_id: uid,
    event: "QUALIFICATION_DETERMINED",
    actor: "system",
    reason: qualification.reason,
    evidence_ref: null,
    timestamp: FieldValue.serverTimestamp(),
  });

  logger.info("register_profile", "profile_completed", {
    reqId,
    entityId: uid,
    status: "ok",
  });
  return NextResponse.json({
    success: true,
    state: "QUALIFICATION_DETERMINED",
    qualification_path: qualification.path,
  });
}
```

Note on idempotency: resubmitting this route with the same phone number and uid succeeds again cleanly, the phone-sentinel transaction only rejects when the sentinel belongs to a _different_ uid, so a retried request (e.g., after a network drop) doesn't get wrongly blocked by the caller's own prior attempt.

- [ ] **Step 2: Verify against the emulators manually**

With Firestore + Auth + Storage emulators running, a session cookie for a user who has completed Task 10's handle step, and a small test PDF file (`printf '%%PDF-1.4\n' > /tmp/resume.pdf`):

```bash
curl -i -X POST http://localhost:3000/api/register/profile \
  -H "Cookie: ascent_session=<paste cookie value here>" \
  -F "year_of_study=3" \
  -F "status=STUDENT" \
  -F "phone=9876543210" \
  -F "graduation_year=2027" \
  -F "resume=@/tmp/resume.pdf;type=application/pdf"
```

Expected: `HTTP/1.1 200`, `{"success":true,"state":"QUALIFICATION_DETERMINED","qualification_path":"QUALIFIER"}` (`QUALIFIER` because college verification is out of scope, see Global Constraints)

- [ ] **Step 3: Verify phone-collision rejection**

Repeat the same request for a _different_ signed-in user with the same `phone=9876543210`.
Expected: `HTTP/1.1 409`, `{"error":"This phone number is already registered.","field":"phone"}`

- [ ] **Step 4: Verify resume rejection for a non-PDF file**

Run the same request but with a non-PDF file (`echo "not a pdf" > /tmp/fake.pdf`) for a fresh test user.
Expected: `HTTP/1.1 400`, `{"error":"Resume must be a valid PDF file.","field":"resume"}`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/register/profile/route.ts
git commit -m "feat: add /api/register/profile route with resume upload and qualification engine wiring"
```

---

### Task 12: Sign-in page (`/register`)

**Files:**

- Create: `src/components/register/SignInForm.tsx`
- Create: `src/app/register/page.tsx`

**Interfaces:**

- Consumes: `auth`/`googleProvider` from `@/lib/firebaseClient` (Task 6), `verifySessionCookie` from `@/lib/session` (Task 9), `adminDb` from `@/lib/firebaseAdmin` (Task 6), `POST /api/auth/session` (Task 9).
- Produces: the `/register` route, the entry point linked from the marketing site's "Register" CTA (already present in `Navbar`/`Footer` per `docs/ascent-home-plan.md`, currently pointing at `#`; wiring that link is a one-line follow-up, not part of this task).

- [ ] **Step 1: Write the client sign-in component**

`src/components/register/SignInForm.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebaseClient";

const EMAIL_STORAGE_KEY = "ascent_email_for_link";

async function exchangeSession(idToken: string) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Sign-in failed.");
}

export default function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    const storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    if (!storedEmail) {
      setError(
        "Open the sign-in link on the same device/browser you requested it from.",
      );
      return;
    }
    signInWithEmailLink(auth, storedEmail, window.location.href)
      .then(async (result) => {
        const idToken = await result.user.getIdToken();
        await exchangeSession(idToken);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        router.push("/register/handle");
      })
      .catch(() => setError("Sign-in link is invalid or expired."));
  }, [router]);

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      await exchangeSession(idToken);
      router.push("/register/handle");
    } catch {
      setError("Google sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/register`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
      setLinkSent(true);
    } catch {
      setError(
        "Could not send the sign-in link. Check the email and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold text-white">
        Register for AMS Ascent
      </h1>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="ascent-btn ascent-btn-primary"
      >
        Continue with Google
      </button>
      <div className="text-center text-sm text-ascent-muted">or</div>
      {linkSent ? (
        <p className="text-sm text-ascent-muted">
          Check {email} for a sign-in link.
        </p>
      ) : (
        <form onSubmit={handleSendLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="ascent-btn ascent-btn-secondary"
          >
            Email me a sign-in link
          </button>
        </form>
      )}
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Write the server-gated page**

`src/app/register/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SignInForm from "@/components/register/SignInForm";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionCookie } from "@/lib/session";

export default async function RegisterPage() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;

  if (session) {
    const appSnap = await adminDb
      .collection("applications")
      .doc(session.uid)
      .get();
    if (!appSnap.exists) {
      redirect("/register/handle");
    }
    const state = appSnap.data()?.state;
    redirect(
      state === "QUALIFICATION_DETERMINED"
        ? "/register/path"
        : "/register/profile",
    );
  }

  return <SignInForm />;
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds, `/register` listed as a route

- [ ] **Step 4: Verify manually in the browser**

With emulators running and `.env.local` pointed at them (`NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`), run `npm run dev`, open `http://localhost:3000/register`, click "Continue with Google" (the Auth emulator shows a fake account picker), confirm you land on `/register/handle` afterward.

- [ ] **Step 5: Commit**

```bash
git add src/components/register/SignInForm.tsx src/app/register/page.tsx
git commit -m "feat: add /register sign-in page (Google OAuth + email magic link)"
```

---

### Task 13: Handle page (`/register/handle`)

**Files:**

- Create: `src/components/register/CollegeTypeahead.tsx`
- Create: `src/components/register/HandleForm.tsx`
- Create: `src/app/register/handle/page.tsx`

**Interfaces:**

- Consumes: `GET /api/colleges/search?q=` (Task 8), `POST /api/register/handle` (Task 10), `verifySessionCookie` (Task 9), `adminDb` (Task 6).
- Produces: the `/register/handle` route. `CollegeTypeahead` emits `onSelect(college: { college_id: string; canonical_name: string } | null)` and `onUnlisted(typedName: string)`, self-contained, only consumed by `HandleForm` within this task.

- [ ] **Step 1: Write the college typeahead component**

`src/components/register/CollegeTypeahead.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface CollegeResult {
  college_id: string;
  canonical_name: string;
  campus: string | null;
  tier: "AUTO_QUALIFY" | "STANDARD";
}

interface CollegeTypeaheadProps {
  onSelect: (college: CollegeResult | null) => void;
  onUnlisted: (typedName: string) => void;
}

export default function CollegeTypeahead({
  onSelect,
  onUnlisted,
}: CollegeTypeaheadProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CollegeResult[]>([]);
  const [selected, setSelected] = useState<CollegeResult | null>(null);
  const [markedUnlisted, setMarkedUnlisted] = useState(false);

  useEffect(() => {
    if (selected || markedUnlisted || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(
        `/api/colleges/search?q=${encodeURIComponent(query.trim())}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setResults(data.results ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, selected, markedUnlisted]);

  function handlePick(college: CollegeResult) {
    setSelected(college);
    setQuery(college.canonical_name);
    setResults([]);
    onSelect(college);
  }

  function handleUnlistedClick() {
    setMarkedUnlisted(true);
    setSelected(null);
    setResults([]);
    onSelect(null);
    onUnlisted(query.trim());
  }

  function handleChange(value: string) {
    setQuery(value);
    setSelected(null);
    setMarkedUnlisted(false);
    onSelect(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="college" className="text-sm text-ascent-muted">
        College / Institution
      </label>
      <input
        id="college"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Start typing your college name"
        className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
        autoComplete="off"
      />
      {results.length > 0 && (
        <ul className="rounded-lg border border-white/10 bg-ascent-panel">
          {results.map((college) => (
            <li key={college.college_id}>
              <button
                type="button"
                onClick={() => handlePick(college)}
                className="w-full px-4 py-2 text-left text-white hover:bg-white/5"
              >
                {college.canonical_name}
                {college.campus ? `, ${college.campus}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!selected && !markedUnlisted && query.trim().length >= 2 && (
        <button
          type="button"
          onClick={handleUnlistedClick}
          className="self-start text-sm text-ascent-accent underline"
        >
          My college isn&apos;t listed
        </button>
      )}
      {markedUnlisted && (
        <p className="text-sm text-ascent-muted">
          Noted, &quot;{query.trim()}&quot; will be reviewed for the college
          list.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the handle form**

`src/components/register/HandleForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CollegeTypeahead from "@/components/register/CollegeTypeahead";

interface SelectedCollege {
  college_id: string;
  canonical_name: string;
}

export default function HandleForm() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [selectedCollege, setSelectedCollege] =
    useState<SelectedCollege | null>(null);
  const [unlistedName, setUnlistedName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedCollege && !unlistedName) {
      setError("Select your college or mark it as unlisted.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          college_id: selectedCollege?.college_id ?? null,
          unlisted_name: selectedCollege ? null : unlistedName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.push("/register/profile");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold text-white">Pick your handle</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="handle" className="text-sm text-ascent-muted">
            Handle (shown on the ranklist)
          </label>
          <input
            id="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="e.g. tilak_j"
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
            required
          />
        </div>
        <CollegeTypeahead
          onSelect={setSelectedCollege}
          onUnlisted={setUnlistedName}
        />
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="ascent-btn ascent-btn-primary"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Write the server-gated page**

`src/app/register/handle/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HandleForm from "@/components/register/HandleForm";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionCookie } from "@/lib/session";

export default async function HandlePage() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) {
    redirect("/register");
  }

  const appSnap = await adminDb
    .collection("applications")
    .doc(session.uid)
    .get();
  if (appSnap.exists) {
    const state = appSnap.data()?.state;
    redirect(
      state === "QUALIFICATION_DETERMINED"
        ? "/register/path"
        : "/register/profile",
    );
  }

  return <HandleForm />;
}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds, `/register/handle` listed as a route

- [ ] **Step 5: Verify manually in the browser**

With emulators seeded and running, sign in via `/register`, land on `/register/handle`, type "iit" into the college field, confirm the seeded IIT results appear, pick one, enter a handle, submit, confirm redirect to `/register/profile`. Reload `/register/handle` directly afterward and confirm it redirects straight to `/register/profile` (resumption works).

- [ ] **Step 6: Commit**

```bash
git add src/components/register/CollegeTypeahead.tsx src/components/register/HandleForm.tsx src/app/register/handle/page.tsx
git commit -m "feat: add /register/handle page with college typeahead"
```

---

### Task 14: Profile page (`/register/profile`)

**Files:**

- Create: `src/components/register/ProfileForm.tsx`
- Create: `src/app/register/profile/page.tsx`

**Interfaces:**

- Consumes: `POST /api/register/profile` (Task 11), `verifySessionCookie` (Task 9), `adminDb` (Task 6).
- Produces: the `/register/profile` route.

- [ ] **Step 1: Write the profile form**

`src/components/register/ProfileForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "STUDENT", label: "Student" },
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "OTHER", label: "Other" },
];

export default function ProfileForm() {
  const router = useRouter();
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [status, setStatus] = useState("STUDENT");
  const [phone, setPhone] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!resumeFile) {
      setError("Attach your resume as a PDF.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("year_of_study", yearOfStudy);
      formData.set("status", status);
      formData.set("phone", phone);
      formData.set("graduation_year", graduationYear);
      formData.set("resume", resumeFile);

      const res = await fetch("/api/register/profile", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.push("/register/path");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold text-white">
        Complete your profile
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="status" className="text-sm text-ascent-muted">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="yearOfStudy" className="text-sm text-ascent-muted">
            Year of study
          </label>
          <input
            id="yearOfStudy"
            value={yearOfStudy}
            onChange={(e) => setYearOfStudy(e.target.value)}
            placeholder="e.g. 3rd year"
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="graduationYear" className="text-sm text-ascent-muted">
            Graduation year
          </label>
          <input
            id="graduationYear"
            type="number"
            value={graduationYear}
            onChange={(e) => setGraduationYear(e.target.value)}
            placeholder="e.g. 2027"
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className="text-sm text-ascent-muted">
            Phone number
          </label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit Indian number"
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="resume" className="text-sm text-ascent-muted">
            Resume (PDF, under 500KB)
          </label>
          <input
            id="resume"
            type="file"
            accept="application/pdf"
            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
            className="text-white"
            required
          />
        </div>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="ascent-btn ascent-btn-primary"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Write the server-gated page**

`src/app/register/profile/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/register/ProfileForm";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionCookie } from "@/lib/session";

export default async function ProfilePage() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) {
    redirect("/register");
  }

  const appSnap = await adminDb
    .collection("applications")
    .doc(session.uid)
    .get();
  if (!appSnap.exists) {
    redirect("/register/handle");
  }
  if (appSnap.data()?.state === "QUALIFICATION_DETERMINED") {
    redirect("/register/path");
  }

  return <ProfileForm />;
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds, `/register/profile` listed as a route

- [ ] **Step 4: Verify manually in the browser**

Continuing the Task 13 manual flow, fill in the profile form with a valid 10-digit phone and a small PDF resume, submit, confirm redirect to `/register/path`.

- [ ] **Step 5: Commit**

```bash
git add src/components/register/ProfileForm.tsx src/app/register/profile/page.tsx
git commit -m "feat: add /register/profile page with resume upload"
```

---

### Task 15: Path result page (`/register/path`)

**Files:**

- Create: `src/app/register/path/page.tsx`

**Interfaces:**

- Consumes: `verifySessionCookie` (Task 9), `adminDb` (Task 6), type `Application` (Task 2).
- Produces: the `/register/path` route, the terminal page of this spec's scope. AUTO/QUALIFIER-specific messaging here is an explicit stub; the verification flow and Access scheduling it describes are out of scope (see spec's "Out of scope").

- [ ] **Step 1: Write the page**

`src/app/register/path/page.tsx`:

```tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifySessionCookie } from "@/lib/session";
import type { Application } from "@/types/registration";

export default async function PathPage() {
  const cookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) {
    redirect("/register");
  }

  const appSnap = await adminDb
    .collection("applications")
    .doc(session.uid)
    .get();
  if (!appSnap.exists) {
    redirect("/register/handle");
  }
  const application = appSnap.data() as Application;
  if (application.state !== "QUALIFICATION_DETERMINED") {
    redirect("/register/profile");
  }

  const isAutoTier = application.college_tier === "AUTO_QUALIFY";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-white">
        You&apos;re registered, {application.handle}.
      </h1>
      {isAutoTier ? (
        <p className="text-ascent-muted">
          Your college is on the auto-qualify list. College email verification
          opens soon, you&apos;ll get an email when it&apos;s ready. Verifying
          skips the qualifier; if you don&apos;t verify in time, you&apos;ll
          compete in the qualifier instead.
        </p>
      ) : (
        <p className="text-ascent-muted">
          You&apos;ll compete in the qualifier round on AMS Access. Scheduling
          opens soon, you&apos;ll get an email when it&apos;s ready.
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds, `/register/path` listed as a route

- [ ] **Step 3: Verify manually in the browser, both branches**

Continuing the Task 14 manual flow: for a user registered under an `AUTO_QUALIFY` college (e.g. IIT Bombay from the seed data), confirm `/register/path` shows the auto-qualify message. Register a second test user under a `STANDARD` college (e.g. VIT Vellore) through the full flow and confirm `/register/path` shows the qualifier message instead.

- [ ] **Step 4: Commit**

```bash
git add src/app/register/path/page.tsx
git commit -m "feat: add /register/path result page"
```

---

## Self-review

**Spec coverage:** Auth (Task 6, 9, 12) ✓. Handle + college typeahead (Task 5, 8, 10, 13) ✓. Profile + resume (Task 5, 11, 14) ✓. Qualification engine (Task 4) ✓. Firestore schema + security rules (Task 2, 3) ✓. Rate limiting + dedupe (Task 7, 10, 11) ✓. Multi-route server-gated resumable flow (Task 12-15) ✓. Out-of-scope items (verification, admin console, Access integration, DPDP erasure) are deliberately not tasked, matches the spec.

**Placeholder scan:** No TBD/TODO; every code block is complete and runnable. The one open item, production tier-1 college seed data, is explicitly named as a follow-up in the spec's carried-forward open decisions, not hidden as a placeholder here; Task 8's seed script ships a small real dev/test set instead.

**Type consistency:** `determinePath(collegeTier, collegeVerificationStatus)` signature matches between Task 4's definition and Task 11's call site (`determinePath(application.college_tier, 'UNVERIFIED')`). `checkSlidingWindow` returns `{ overLimit, recordFailure }` consistently across Task 7's definition and Tasks 10-11's call sites. `verifySessionCookie` returns `SessionUser | null` consistently across Tasks 9, 10, 11, 12, 13, 14, 15. `SESSION_COOKIE_NAME` is read the same way (`req.cookies.get(...)` in routes, `cookies().get(...)` in server components) throughout.

---

## Execution options

Plan complete and saved to `docs/superpowers/plans/2026-07-18-registration-pipeline.md`. Two execution options:

**1. Subagent-Driven (recommended)**, I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution**, Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
