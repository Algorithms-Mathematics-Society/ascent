# AMS Derive — System Design Notes

System-design analysis of the **AMS Derive** competition platform (`/home/user/AMS Derive/amsderive`),
recorded here for reference alongside the AMS Access docs. This is a *different* codebase and stack
from AMS Access — it's the public registration + admin/firm/judging platform for the AMS Derive quant
competition (`amsderive.in`).

> Traced from source. Where the code and an in-repo doc disagree, the code wins (noted inline).

---

## 1. Stack & deployment topology

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (Pages Router, `src/pages`), **React 19** |
| Hosting | **Vercel**, region pinned to **`bom1`** (Mumbai) for all functions |
| Data | **Firebase Firestore** (Admin SDK server-side; client SDK only for auth) |
| Files | **Firebase Storage** (resumes, transcripts, broadcast PDFs) |
| Email | **Resend** (batch + single send, webhooks) |
| Queues/aux | **Upstash QStash** dep present; **pako** (compression), **three.js** (hero WebGL), **recharts** (dashboards) |
| Analytics | Vercel Analytics + Speed Insights |

**Function runtime budgets** (`vercel.json`): default API `maxDuration` 30s; `approve-all` 120s;
`send-broadcast` 300s; `upload-broadcast-attachment` 60s. Everything region-locked to `bom1`
(audience is India-based; co-locating compute with users + Firestore region cuts latency).

This is a **serverless, request-driven** architecture: no standing background worker. Long jobs are
driven by the admin browser polling an API until `done: true` (see §5).

---

## 2. Trust model & data access

The defining architectural decision: **Firestore is locked down to the client; all data flows through Admin-SDK API routes.**

- `firestore.rules`: almost every collection is `allow read, write: if false`. Clients literally cannot
  read/write `registrants`, `firms`, `subadmins`, `_rate_limits*`, `stats_inst`, `cfHandles`,
  `_audit_log`, `_webhook_ids`, etc. The Admin SDK bypasses rules entirely, so all access is mediated
  by server code that can enforce auth + validation.
- `registrants` create is `if false` — registration *must* go through `/api/submit-registration`
  (which does the rate-limit, dedupe, CF-check, and cap logic). The one client-allowed write is an
  admin updating *only* the `status` field (`hasOnly(['status'])`).
- `storage.rules`: `registrants/` uploads are server-only (`write: if false`); reads require auth.
  Submission uploads cap at 6 MB and restrict content types (pdf/text/zip).

**Net effect:** the security boundary is the API layer, not Firestore rules. Rules are a deny-all
backstop in case a client SDK path is ever wired up by mistake.

---

## 3. Authentication — three independent tiers

All portals authenticate with **Firebase Auth ID tokens** (Bearer header), verified server-side with
`verifyIdToken(token, true)` (the `true` forces revocation checking). Authorization differs per tier:

| Tier | Helper | Authorization check | Membership managed by |
|---|---|---|---|
| **Admin** | `requireAdmin` (`lib/adminAuth.js`) | custom claim `admin: true` on the token | `setCustomUserClaims(uid, {admin:true})` run once in a trusted script |
| **Subadmin** | `requireSubadmin` (`lib/subadminAuth.js`) | existence of a `subadmins/{uid}` Firestore doc | create/delete the doc — no SDK scripts needed |
| **Firm** | firm API routes | firm account in `firms/{uid}` | Admin-provisioned via `/api/admin/create-firm` |

Design notes:
- **Subadmin membership is cached in-process for 5 min** (`Map` at module scope, survives within a warm
  serverless instance) to avoid a Firestore read per request — but **token revocation is still checked
  every call**. Good latency/security tradeoff.
- **Firm candidate tokens** (`lib/firmCandidateToken.js`): opaque, URL-safe identifiers for candidate
  rows shared with firms. **AES-256-GCM** encryption of the Firestore docId with a **deterministic IV**
  (HMAC of docId) so the same doc always yields the same token (stable links) while the plaintext docId
  stays hidden. Key derived from `FIRM_CANDIDATE_TOKEN_SECRET` (falls back to admin private key).
- The admin/subadmin/firm portals are the only places the **client Firebase SDK** runs (for
  `signInWithEmailAndPassword`) — reflected in their relaxed CSP `connect-src` (§7).

---

## 4. Registration pipeline (`/api/submit-registration`)

The most carefully engineered path. Order of operations and the *why* behind each:

1. **Registration window gate** — hard 403 outside `REGISTRATION_OPENS`/`CLOSES` (`lib/constants.js`,
   stored as UTC instants for IST times).
2. **IP soft throttle** — 10/hour per SHA-256(IP). *Read-only here;* the timestamp is written **only on
   failure** so legitimate classmates behind one campus NAT IP don't burn each other's budget. Never
   hard-blocks alone — sets an `ipOverLimit` flag for combined-abuse signals. Fails **open** on
   Firestore error (informational only).
3. **Field validation** — server-side, never trusts client. Strict **LinkedIn host allow-list** and
   **file-URL host allow-list** (`firebasestorage.googleapis.com` / `storage.googleapis.com`) to block
   domain spoofing.
4. **Per-identifier rate limit** — 3 failures / 30 min per **email** and per **CF handle** (hashed),
   defense-in-depth against IP rotation/enumeration. Also write-on-failure-only.
5. **Codeforces handle validation** — calls CF `user.info` with a **2s AbortController timeout**;
   **fails open** if CF is slow/down (degraded, not rejected).
6. **Soft cap pre-check** — `registrants.count()` aggregate query vs `MAX_REGISTRATIONS = 10000`.
   Deliberately *outside* the write transaction to avoid a single-doc counter hotspot (Firestore
   throttles >1 write/s/doc); may overshoot by a few under burst — accepted at 10k scale.
7. **Atomic transaction** — reads `registrants/{emailLower}` + `cfHandles/{handle}` and writes both,
   closing the TOCTOU window on duplicate email/handle. The **email-as-docId** pattern gives free
   uniqueness; a **`cfHandles/{handleLower}` sentinel doc** enforces handle uniqueness.
8. **Post-write side effects** — `Promise.allSettled` of institution-stats increment and ambassador
   referral count, each wrapped in a 3s `withTimeout`; failures are logged but **never fail the
   registration** (the registrant is already durably written).

Cross-cutting: structured request logging with a generated `reqId`, **masked email** in logs, and
`status` tags (`ok`/`degraded`/`blocked`/`failed`). Rate-limit docs carry `expiresAt` for Firestore
**TTL auto-cleanup**.

---

## 5. Bulk email engine (queue-backed, browser-driven)

Both **Approve-All** and **Broadcasts** use the same reliability pattern (`MAIL_SENDING_ARCHITECTURE.md`):

**Queue model** — a run/broadcast doc + a `recipients` subcollection (one row per recipient, state
machine: `queued → sending → email_sent → sent`, or `failed`/`paused`).

**Processing loop** — the admin dashboard creates a `runId`/`broadcastId` and **polls the API until
`done: true`**. Each call:
1. resets stale `sending` rows older than **10 min** (crash recovery);
2. acquires a **Firestore processing lease** (~6 min) so two workers/tabs don't double-send;
3. claims up to **100** recipients;
4. sends via Resend **`batch.send`** (or single-send for attachments);
5. advances row states and updates run counters.

**Idempotency** is layered:
- Resend **idempotency keys** scoped per operation, e.g. `registrant-status/{docId}/{status}`,
  `approve-all/{runId}/batch/{hashOfIds}`, `broadcast/{id}/batch/{hashOfEmails}`.
- **Email-before-DB ordering** for status changes: the approval email must be *accepted by Resend
  before* the Firestore status flips. So an "approved" row can't exist without the email having been
  sent; if email fails → 502 and no state change.
- Crash mid-run: rows in `email_sent` are *not* re-emailed on resume; only the DB flip is retried.

**Attachment broadcasts** are intentionally slower: single-send, max **4 recipients/loop**, a fresh
**30-min signed Storage URL** per email passed to Resend as the attachment, with a safe inter-send
delay. PDF-only, magic-byte (`%PDF`) checked, ≤3 MB.

**Known limitation (by design):** no independent worker — if the admin browser closes mid-run, a manual
resume (reusing the same run id) is required.

---

## 6. Email deliverability & lifecycle

- **Sender layer** (`lib/emailSender.js`): wraps Resend with 15s timeout, 3 retries, and returns
  `{sent, failed}` instead of throwing. Constants: batch limit 100, safe RPS 4 (of Resend's 5).
- **Outreach suppression**: external `outreach_contacts` are skipped once
  `unsubscribed` or `deliveryStatus ∈ {sent, delivered, bounced, complained}` — prevents re-contacting.
  Status is written optimistically to `sent` right after send.
- **Unsubscribe**: HMAC-SHA256 token over lowercase email, **timing-safe** compared; secret resolution
  has a documented fallback chain.
- **Resend webhooks** (`/api/webhooks/resend`): manual **Svix HMAC** verification over
  `{svix-id}.{svix-timestamp}.{rawBody}`, **±5 min replay window**, and **idempotency via
  `_webhook_ids/{svixId}`** (TTL 7 days). Maps `delivered/bounced/complained/delivery_delayed` onto
  `registrants` and `outreach_contacts` by `emailLower`; **terminal statuses (bounced/complained) are
  never overwritten**; bounces/complaints also write `_audit_log`.

---

## 7. Edge config, caching & security headers (`next.config.js`)

A deliberately tiered **Cache-Control** strategy (browser vs Vercel CDN via `s-maxage`):

- Static assets (images/pdf/icons): 30-day cache + SWR. Homepage `s-maxage=21600` (6h);
  `/syllabus` and other static pages 24h; `/rank/:slug` and `/api/registration-count` 60s CDN cache.
- **Auth pages** (`/admin|/subadmin|/firm`) and **all other API routes**: `no-store`. The only
  CDN-cached API is the explicit `registration-count` (regex catch-all excludes it).

**Security headers**: `X-Frame-Options: DENY`, `nosniff`, `X-XSS-Protection`, `Referrer-Policy`, plus
**route-scoped CSP**:
- `/register` — locked down, `connect-src 'self'`, `frame-src 'none'`, no external JS.
- `/admin|/subadmin|/firm` — same base but `connect-src` opens the **Firebase Auth/Firestore/Realtime
  endpoints** the client SDK needs for login.

Other build hardening: `poweredByHeader: false`, `removeConsole` in prod, Recharts tree-shaking via
`modularizeImports`, `optimizeCss` (critters), AVIF/WebP image pipeline. `reactStrictMode` is
**intentionally off** — Strict Mode's double-`useEffect` spun up two WebGL contexts + RAF loops on the
three.js hero (documented in the config).

---

## 8. Firestore data model & indexing

**Key collections:** `registrants` (source of truth, docId = `emailLower`), `cfHandles` (uniqueness
sentinels), `stats_inst` (per-university counters — sharded by slug to avoid a single hot counter),
`ambassadors` (referral counts), `outreach_contacts`, `firms`, `subadmins`, `_broadcasts` +
`_bulk_approvals` (with `recipients` subcollections), `_audit_log`, `_webhook_ids`, `_rate_limits*`.

**Indexing** (`firestore.indexes.json`): ~16 composite indexes on `registrants` supporting admin/firm
dashboard filters — `status×round`, `round×dataConsent×status×submittedAt`, plus
`university/branch/graduationYear/status/round × submittedAt` in both directions (asc/desc for
pagination both ways). The mail queues use **`recipients` collection-group indexes**
(`status×sortKey`, `status×startedAt`, `status×lastAttemptAt`, `targetKind×status`) to claim/retry rows
efficiently.

**Hotspot avoidance** is a recurring theme: aggregate `count()` instead of a counter doc; per-slug
institution counters; rate-limit windows stored as timestamp arrays with TTL.

---

## 9. Recurring design principles (transferable to AMS Access)

1. **Server-mediated everything** — deny-all client rules; the API layer is the security boundary.
2. **Fail open on non-critical external deps** (CF API, stats, ambassador counts), **fail closed on
   integrity** (duplicate checks, auth, email-before-status).
3. **Idempotency at every layer** — Resend keys, webhook dedupe, transaction sentinels, write-on-failure
   rate limits.
4. **Write-on-failure rate limiting** so success doesn't penalize shared-NAT users.
5. **Hotspot-aware Firestore usage** — aggregate counts, sharded counters, TTL cleanup.
6. **Resumable, lease-guarded queues** instead of fire-and-forget bulk sends — but currently
   browser-driven, which is the main scaling gap (a real worker/QStash consumer would close it; the
   QStash dependency suggests this is the intended direction).
7. **Region pinning + tiered CDN caching + route-scoped CSP** for latency and a tight attack surface.

---

## 10. Notable gaps / risks (from code + `vulner.md` context)

- **No background worker** — bulk jobs depend on the admin tab staying open; resume is manual.
- **Registration confirmation email is not actually sent** — the template exists but
  `/api/submit-registration` never calls Resend (doc explicitly flags this).
- **Soft cap can overshoot** the 10k limit under burst (accepted tradeoff).
- **Webhook-dependent delivery truth** — if Resend isn't pointed at the webhook with the right secret,
  delivery statuses stay at the locally-written `sent`.
- **Secret fallback chains** (unsubscribe, firm-token) fall back to the Firebase private key or a dev
  string if the dedicated secret is unset — fine in prod with vars set, fragile if misconfigured.
