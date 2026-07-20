# Ascent: Registration Pipeline (Firebase) Design

**Date:** 2026-07-18
**Branch:** `ascent-home`
**Type:** New subsystem, first backend/auth surface on this repo (previously pure static marketing).
**Supersedes/scopes:** `ascent-2026-registration-architecture.md` (repo root, untracked), this spec
implements a bounded slice of that document. Section references below (`§N`) point to it.

## Goal

Build the registration pipeline for Ascent 2026: account creation through profile completion,
ending at a deterministic qualification-path assignment (`AUTO` vs `QUALIFIER`). This is the first
piece of a larger system described in the architecture doc; later specs build on the schema and
security rules this one establishes.

## Scope

**In scope:**

- Firebase Auth account creation (Google OAuth + email magic link).
- Handle selection + canonical college typeahead.
- Profile completion: year of study, status, phone, resume upload.
- The qualification engine (pure function) assigning `qualification_path`.
- The Firestore schema, security rules, and Storage rules the rest of the system builds on.
- Rate limiting, dedupe, and bot-protection at the registration boundary.

**Out of scope (separate specs later):**

- College-email OTP verification and the ID-review manual-verification fallback (doc §5).
- The admin review console (doc §10).
- AMS Access qualifier scheduling/integration (doc §6, §9 case 15-16).
- Firm-visibility consent capture (doc §6.5 Stage 4, resume is pulled forward into this spec per
  product decision below, but the _consent_ ask stays deferred to post-results).
- DPDP erasure tooling (doc §8), the schema is erasure-shaped (PII isolated in one collection) but
  the delete/anonymize flow itself is not built here.
- **Firebase App Check** (bot protection on the client SDK surface, doc §7's "Bot protection" line)
  and **disposable-email domain blocking** (doc §7's "Rate limiting" line) were named in this spec's
  original anti-abuse design but did not make it into the implementation plan; found missing during
  the final whole-branch review of the registration-pipeline implementation. Explicitly deferred,
  not a silent gap: App Check requires a real Firebase project plus reCAPTCHA site keys, which don't
  exist yet (everything built so far runs against the local emulators only) and can't be meaningfully
  configured until that infrastructure is provisioned. Disposable-email blocking is code-feasible
  without new infra but wasn't scoped as a task; revisit both once a real Firebase project exists,
  as a fast-follow spec or as an addition to whichever spec first stands up production credentials.

**Deviations from the architecture doc, decided during brainstorming:**

1. **Firestore is the source of truth**, not Postgres-primary-with-Firestore-projection (doc §3).
   Mirrors the proven AMS Derive pattern: Admin SDK-mediated writes, deny-all client rules, dedupe
   enforced via Firestore transactions. Revisit if the qualification engine's logic later outgrows
   what Firestore transactions can cleanly enforce.
2. **Resume upload moves to Stage 2** (profile completion), not doc §6.5's deferred Stage 4. Matches
   AMS Derive's proven one-visit collection. Firm-visibility _consent_ still defers to post-results,
   only the file itself moves earlier.
3. **"Email + OTP" (doc §6.5 Stage 1) is implemented as Firebase email magic-link sign-in**, not a
   typed 6-digit code. Same passwordless security property, no custom code-generation/verification
   infra to build and operate.

## Why Firebase Derive-style, not Postgres

AMS Derive's `/api/submit-registration` (`AMS Derive/amsderive/src/pages/api/submit-registration.js`)
is a proven reference: atomic-transaction dedupe, write-on-failure-only rate limiting, fail-open on
non-critical externals (stats, ambassador counts) / fail-closed on integrity (dedupe, auth), deny-all
Firestore rules with all access mediated through Admin-SDK API routes. That pattern is reused wholesale
here. The one structural addition Ascent needs beyond Derive: Derive is a single-shot anonymous form
(no candidate accounts; status checked by re-entering name+email). Ascent's flow is inherently
multi-visit (college verification, later qualifier scheduling, later firm-consent), so it needs real
Firebase Auth accounts with server-verified sessions, Derive doesn't need this and doesn't have it.

## Data model

Firebase Auth's `uid` **is** `subject_id` from doc §3, no separate mapping collection needed.

### Firestore collections

```
applications/{uid}
  edition: string                          # "ascent-2026"
  state: string                            # see State machine below
  handle: string
  college_id: string | null                # FK into colleges/, null only if UNLISTED not yet resolved
  college_tier: "AUTO_QUALIFY" | "STANDARD" | "UNLISTED"
  year_of_study: string | null
  graduation_year: number | null
  status: "STUDENT" | "PROFESSIONAL" | "OTHER" | null
  skills: string[] | null
  qualification_path: "AUTO" | "QUALIFIER" | "UNDETERMINED"
  qualification_reason: string | null       # immutable once set (doc §4)
  created_at, updated_at: Timestamp

pii/{uid}                                   # never client-readable, even by owner
  legal_name: string
  email: string
  email_masked: string                      # denormalized, safe to expose in API responses
  phone: string                             # E.164
  resume_ref: string | null                 # Storage path
  college_email: string | null

colleges/{college_id}                       # public read, admin-sdk write only
  canonical_name: string
  aliases: string[]
  campus: string | null
  tier: "AUTO_QUALIFY" | "STANDARD"
  email_domains: string[]
  active: boolean

unlisted_college_submissions/{id}           # deny-all; admin-sdk only
  uid: string
  typed_name: string
  submitted_at: Timestamp

handles/{edition}_{handleLower}             # sentinel doc, deny-all
  uid: string
  registered_at: Timestamp

phones/{edition}_{phoneE164}                # sentinel doc, deny-all, person-dedupe
  uid: string
  registered_at: Timestamp

consent/{uid}                               # deny-all; admin-sdk only
  CONTEST_PARTICIPATION: { granted: bool, policy_version: string, granted_at: Timestamp }

_rate_limits/{ipHash}                       # deny-all, mirrors AMS Derive exactly
_rate_limits_email/{emailHash}
_rate_limits_phone/{phoneHash}

audit_log/{id}                              # append-only, deny-all
  subject_id, event, actor, reason, evidence_ref, timestamp
```

### Firestore security rules (summary)

```
match /applications/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false;   // all transitions via Admin SDK route handlers
}
match /colleges/{id} {
  allow read: if true;
  allow write: if false;
}
match /pii/{uid} { allow read, write: if false; }
match /handles/{id} { allow read, write: if false; }
match /phones/{id} { allow read, write: if false; }
match /consent/{uid} { allow read, write: if false; }
match /unlisted_college_submissions/{id} { allow read, write: if false; }
match /_rate_limits{suffix=**} { allow read, write: if false; }
match /audit_log/{id} { allow read, write: if false; }
```

Only `applications/{own uid}` (read) and `colleges/*` (read) are client-reachable. Everything else is
Admin-SDK-only, matching AMS Derive's `firestore.rules` structure exactly.

### Storage rules

```
match /resumes/{uid}/{fileName} {
  allow read, write: if false;   // Admin SDK only, same as AMS Derive's registrants/ path
}
```

## Auth strategy

Firebase Auth, two sign-in methods:

- **Google OAuth** (primary), one tap, verified email, bot resistance for free.
- **Email magic link** (fallback), Firebase's native passwordless sign-in.

After client-side sign-in, the client exchanges its ID token for a **session cookie**
(`POST /api/auth/session`, using `Admin SDK auth.createSessionCookie`), stored httpOnly, ~5-day
expiry (re-exchanged on visit if near expiry). This is what lets server components gate routes without
a client-side auth flash, and is required here, unlike Derive, because users return across multiple
sessions.

`GET /api/auth/session` (or middleware) verifies the cookie server-side on every protected route via
`Admin SDK auth.verifySessionCookie(cookie, true)` (the `true` forces revocation checking, matching
AMS Access's `requireAdmin` pattern).

## Route structure (Next.js App Router)

Multi-route, server-gated, not a single client-managed wizard. Each route's server component reads
the session cookie + `applications/{uid}` and redirects to whichever step isn't complete, so closing
the tab and returning later resumes correctly.

```
/register                → sign-in screen (Google / email link). Redirects to /register/handle
                            once authenticated and no application exists yet.
/register/handle         → handle + college typeahead. On submit, creates the applications/{uid}
                            doc (state: DRAFT → EMAIL_VERIFIED, since Firebase Auth already
                            verified the email/Google identity, doc §4's EMAIL_VERIFIED gate is
                            satisfied by auth itself, not a separate step).
/register/profile        → year of study, status, phone, resume upload. On submit:
                            state → PROFILE_COMPLETE, then immediately → QUALIFICATION_DETERMINED
                            (the engine is a pure function, runs synchronously).
/register/path           → shows the AUTO or QUALIFIER outcome. AUTO-tier shows a "you'll verify
                            your college email next" stub (verification spec, not built here).
                            QUALIFIER-tier shows a "qualifier scheduling opens [date]" stub (Access
                            integration spec, not built here).
```

Each route is a server component that does the redirect-if-wrong-step check; the interactive form
itself is a client component within it.

## API routes (Route Handlers, Admin-SDK mediated)

```
POST /api/auth/session          exchange ID token → session cookie
DELETE /api/auth/session        sign out (clear cookie)

POST /api/register/handle       body: { handle, college_id | unlisted_name }
                                 → creates applications/{uid} + pii/{uid} (email from auth token)
                                 → transaction: handles/{edition}_{handleLower} sentinel
                                 → state: DRAFT → EMAIL_VERIFIED

POST /api/register/profile      body: { year_of_study, status, phone, graduation_year, skills? }
                                 + multipart resume file
                                 → validates resume (PDF magic bytes, ≤500KB) server-side,
                                   uploads to Storage via Admin SDK
                                 → transaction: phones/{edition}_{phoneE164} sentinel
                                 → writes pii/{uid}.phone, pii/{uid}.resume_ref
                                 → writes applications/{uid} profile fields
                                 → state: EMAIL_VERIFIED → PROFILE_COMPLETE
                                 → runs qualification engine synchronously
                                 → writes qualification_path, qualification_reason (immutable)
                                 → state: PROFILE_COMPLETE → QUALIFICATION_DETERMINED
                                 → writes consent/{uid}.CONTEST_PARTICIPATION = granted (implicit
                                   in registering, per doc §8)
                                 → audit_log entry for the state transition

GET /api/colleges/search?q=     server-side search backing the typeahead. Required, not optional:
                                 per doc §5 every college a candidate might attend must be in this
                                 table (thousands of institutions, not just the ~30 auto-qualify
                                 ones), so fetching the full collection client-side doesn't scale.
                                 Query strategy: a lowercased `search_terms` array field on each
                                 college doc (canonical name + aliases, tokenized), queried via
                                 Firestore `array-contains` + a prefix range on `canonical_name_lower`,
                                 debounced client-side. `colleges/*` stays public-read for the (rare)
                                 case a client already has a `college_id` and needs to re-fetch one
                                 doc directly, the typeahead itself always goes through this route.
```

Every write route follows the AMS Derive shape: server-side re-validation of everything the client
sent (never trust client), IP + per-identifier rate limiting (write-on-failure-only), an atomic
transaction closing the TOCTOU window on the relevant sentinel doc, structured logging with a request
ID and masked email, and `Promise.allSettled` for non-critical side effects (audit log write can be
best-effort logged-and-retried, not a hard dependency of the response).

## Qualification engine

Ports doc §6 as a pure function:

```
function determinePath(collegeTier: Tier, collegeVerificationStatus: VerificationStatus):
  { path: "AUTO" | "QUALIFIER", reason: string }
```

Because college verification (doc §5) is out of scope for this spec, `collegeVerificationStatus` is
always `UNVERIFIED` here, meaning every application resolves to `QUALIFIER` for now, regardless of
`college_tier`. `AUTO` becomes reachable once the verification spec lands and starts passing a real
verification status into this function. The function itself, and its full branch coverage, is built
now so the verification spec only has to wire a new input, not touch the engine.

## Dedupe & anti-abuse

Directly ported from AMS Derive:

- **Handle uniqueness**, `handles/{edition}_{handleLower}` sentinel, written in the same transaction
  as `applications/{uid}` creation.
- **Person dedupe**, `phones/{edition}_{phoneE164}` sentinel at the profile step. (Doc §7's dedupe
  key is phone + gov_id_hash; gov_id isn't captured until Access proctoring, so phone alone carries
  this at registration time.)
- **One account = one application**, trivial, since `applications/{uid}` is keyed by the Firebase Auth
  uid directly.
- **Rate limiting**, IP soft-throttle (10/hr, write-on-failure-only) + per-email/per-phone sliding
  window (3 failures/30min), identical structure to Derive's `_rate_limits*` collections, including
  `expiresAt` for Firestore TTL cleanup.
- **Bot protection**, Firebase App Check (reCAPTCHA Enterprise or v3) enforced on Firestore/Storage/
  Auth calls, rather than a bespoke CAPTCHA widget, covers the client SDK surface directly.
- Disposable-email domain block on the magic-link path.

## Error handling

- Client-side validation is a UX convenience only; every field is re-validated server-side (mirrors
  Derive exactly, client validation never trusted).
- Fail **open** on non-critical externals: if `colleges` alias-search degrades, fall back to raw
  prefix match rather than blocking the form.
- Fail **closed** on integrity: handle/phone dedupe transactions, auth verification, and rate-limit
  checks that error must reject the request (Derive's identifier rate-limit check does this, a
  Firestore error there returns 500 rather than silently allowing through, unlike the IP-only soft
  throttle which fails open since it's informational).
- Resume upload validates magic bytes (not just the `Content-Type` header, which is client-supplied
  and spoofable) before accepting.
- Every mutating route logs with a generated `reqId` and a masked email, tagged `ok`/`degraded`/
  `blocked`/`failed`, matching Derive's `logger` utility shape.

## Testing

- **Firebase Local Emulator Suite** (Auth + Firestore + Storage) for local dev and for the dedupe-
  transaction tests (handle collision, phone collision, concurrent double-submit).
- **Qualification engine**: exhaustive unit tests over every `(tier, verificationStatus)` combination
  , cheap since it's a pure function.
- **Manual test plan** across the 4 routes (fresh sign-in → handle → profile → path, for both AUTO-
  and STANDARD-tier colleges, plus the UNLISTED "my college isn't listed" branch) before merge, no
  E2E framework currently in this repo; add Playwright here only if this flow's manual-test burden
  becomes recurring.

## Open decisions carried forward from the architecture doc (§11)

Unchanged by this spec, still block a full launch, don't block building this pipeline:
registration open/close dates, qualifier date/format/cutoff N, student-only vs open, international
colleges in/out, registration fee, age floor, post-deadline waitlist behavior, final tier-1 college
list (needed as real seed data for `colleges/` before this ships, even though the verification that
uses it is a later spec).
