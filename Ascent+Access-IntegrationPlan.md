# Ascent ↔ AMS Access — Integration Plan

One identity, from registration to the exam room.

---

## 1. Why

Three systems hold the same people and none of them agree.

| System | Path | Holds |
|---|---|---|
| **Ascent** | `~/ascent` — Next.js + Firestore | Registrations for one edition |
| **AMS API** | `~/ams-api` — FastAPI + Postgres | The central person directory |
| **Org portal** | `~/amsaccess` — Next.js, Vercel | Staff console |
| **Proctor client** | `~/ams-access` — Tauri desktop | The exam room |

An approved Ascent registrant never becomes an AMS person. A returning
competitor becomes a second, unrelated record — the exact outcome
`participants.issue()` warns about in its own docstring: *"one person who sat
three rounds into three unrelated records"*. And the login slip
(`AMS-7K3M-QR9T` + a 12-character password) is unmemorable and undeliverable,
because nothing emails it.

**Outcome.** A person registers on Ascent once, is approved, and becomes
`ayush.s-kqmwd@access` — for life. Staff build a roster from the central
directory, press two buttons, and every candidate receives their handle by
email. They sit any number of contests under one identity, and *"how has this
person progressed"* finally has an answer.

---

## 2. Decisions

Twenty-four, all settled.

### Identity
| # | Decision |
|---|---|
| 1 | Handle is **per person, permanent** — on `identity.users.username` |
| 2 | Derived **first name + surname initial + 5 random letters** → `ayush.s-kqmwd` |
| 3 | Collisions **regenerate the slug**; never a numeric suffix |
| 4 | `@access` is a **login format only** — not a deliverable mailbox |
| 5 | Handles are **never reused**, ever |
| 6 | Reserved-word **blocklist** on the name part, so no handle reads as staff |
| 7 | Concurrency: the **UNIQUE constraint arbitrates**, regenerate and retry |

### Authentication
| # | Decision |
|---|---|
| 8 | Password is a **3-word passphrase**, word list ≥ 2,048 (~33 bits) |
| 9 | Log in, **then pick a contest** from your list |
| 10 | **Migrate everyone**; the `AMS-XXXX-XXXX` slip format is retired |
| 11 | Login UI: one handle field with `@access` as a fixed suffix |
| 12 | Account lockout **unchanged** — safe, because the slug is unguessable |
| 13 | Errors **uniform to candidates**, specific in the invigilator console |

### Sync
| # | Decision |
|---|---|
| 14 | Fires on **admin decision** (APPROVED + WAITLISTED), never on submit |
| 15 | Match order: `external_ref` → **email** → create |
| 16 | PII **is copied** into AMS; a both-stores deletion path ships with it |
| 17 | Ascent gets a **scoped API key**, never `internal_api_secret` |
| 18 | Sync creates the **person**, never the contest entry |

### Mail
| # | Decision |
|---|---|
| 19 | Sender **noreply@mail.amsaccess.com**; copy in **editable SES templates** |
| 20 | **Two emails** — approved, then handle + passphrase at credential issue |
| 21 | Passphrase travels **in the email body** |
| 22 | Bounces: **SES suppression + SNS → inbox** (cheapest that satisfies AWS) |
| 23 | **Issue and send are separate**; issue is instant, send is a job |
| 24 | Issuing is **idempotent**; **per-participant send status**; console at `/org/mails` |

---

## 3. Stage 0 — Start the SES clock

**Not code, and it gates everything mail-related.** Current account state:

```
ProductionAccess : false        ← sandbox: only verified addresses reachable
Max24HourSend    : 200/day
MaxSendRate      : 1/second
Verified identities: none
```

In sandbox you cannot mail one unverified participant. Do first:

1. Verify `mail.amsaccess.com` for sending — DKIM CNAMEs plus its own SPF, all
   on the subdomain. **Not the apex:** `amsaccess.com` already carries Titan
   email, a domain may have exactly one SPF record, and a second is a permanent
   error under RFC 7208 that would break the existing Titan mail as well as
   SES. The subdomain has its own name and its own record, so nothing on the
   apex is edited at all.
2. Create a configuration set publishing bounces/complaints to SNS, with your
   address subscribed.
3. Request production access, describing the suppression handling above.

Everything below is built while this is pending.

---

## 4. Stage 1 — Handles, and a credential that belongs to a person

### The schema change this rests on

Decision 9 — one handle, pick your contest after login — is **incompatible**
with the current model. `ParticipantCredential` carries `contest_id`, and
`login_id` is globally UNIQUE, so one handle physically cannot span two
contests. And *"which passphrase?"* has no answer for someone in three.

`ContestParticipant` already exists and `_participant_contest` already
authorises by it. So each table goes back to meaning one thing:

| Table | Means |
|---|---|
| `identity.users.username` | The handle. Already UNIQUE, indexed, `String(64)` — **no new column** |
| `ParticipantCredential` | **Per person**: one row, one passphrase. `contest_id` dropped |
| `ContestParticipant` | Which contests they may enter — unchanged |

### `services/handles.py`

Generation, the reserved blocklist (`admin`, `root`, `staff`, `support`,
`invigilator`, `proctor`, `noreply`, `test`, `ams`), sanitisation, allocation.

**Generation is total — it never raises.** Well-formed names are expected, but
a name that broke generation would reject a registration outright, and failing
closed on a person's name is not a failure anyone would think to look for.

**The slug is what makes the handle safe.** `ayush.s` alone is computable from
a participant list, which exposes a targeted-lockout attack: fail ten logins
against a named rival on contest morning and `locked_until` freezes them out of
their own exam. Five random letters put that out of reach:

```
26⁵ = 11,881,376 slugs
ten guesses before lockout → 1 in 1,188,137 of finding one person's handle
```

The attacker cannot reach the account they want to freeze, so lockout stays
exactly as it is.

**Letters only, no digits** — so no `l`/`1` or `o`/`0` ambiguity when a handle
is read aloud or copied off a screen. This only holds because collisions
regenerate the slug rather than appending a number, which would reintroduce
digits.

Clashes are vanishingly rare — 0.01% among 50 people sharing a name prefix —
but rare is not never: allocation attempts the insert, catches the unique
violation, regenerates, retries. Check-then-insert races under concurrent
approvals and during backfill; only the database can arbitrate.

### Migration

One Alembic revision plus a backfill assigning handles to every existing
participant — **including the `AMS-4UPE-UNA4` test candidate**, whose slip stops
working the moment this lands. It must come out of the migration with a usable
handle, or the test login is lost.

---

## 5. Stage 2 — Login

`participants.authenticate()` resolves `users.username`, not
`credential.login_id`.

- Normalisation becomes **lowercase** (`.upper()` is wrong for handles)
- `@access` stripped if supplied
- The decoy-hash timing equalisation and uniform error text are **kept as-is**

Login returns the person and their contests; the token is issued once a contest
is chosen. `GET /participant/contests` and the home screen's contest list
already exist and already do this.

`SlipForm.tsx` becomes one handle field with `@access` rendered as a fixed
suffix inside the input, plus the passphrase field. The `AMS-XXXX-XXXX` masking
in `slip-format.ts` is replaced by handle normalisation, and its tests with it.

---

## 6. Stage 3 — Ascent → AMS

### `POST /students/ingest` (ams-api)

Reuses `svc.create_student` and the existing `_apply` field-copier. Match order:

1. `external_ref == subject_id` → same registration, update in place
2. `users.email` → **same human, new edition** — update, keep prior refs
3. Otherwise create, allocating a handle

Returns `student_uid` and the handle.

### Fields

Four gain real columns on `user_profiles` — queryable and exportable, unlike
prose in `notes`:

`codeforces_handle` · `education_stage`/`year_of_study` ·
`college_tier` + verification status · `transcript_url`

**Consent crosses too** (version + timestamp): it is the legal basis for
holding any of it.

**Deliberately not copied:** `qualification_path`, `reference`,
`admin_decision`, `state`. Those describe *an application to one edition*, not
a person. They stay in Firestore, reachable by `external_ref`.

### Auth

Wire the **dormant `identity.ApiKey` model** — it exists, stores only a hash,
has `revoked`/`last_used_at`, and nothing reads it. A `require_api_key`
dependency scoped to this one route. If the key leaks, that is the blast
radius.

### The outbox (ascent)

The decision route is already a Firestore transaction. An HTTP call cannot join
one, so it writes an **outbox document inside that transaction** —
`ams_sync_outbox/{subject_id}`, status `PENDING`.

`src/app/api/admin/ams-sync/route.ts` drains it: gather `applications` + `pii` +
`consent`, POST, mark `SYNCED` with the returned uid, or record the failure and
retry with backoff.

The transaction commits or it does not; the sync either happens or is visibly
pending. Nothing is lost to a network blip — the failure that produces a
competitor who registered and does not exist.

New config in `.env.local.example`: `AMS_API_URL`, `AMS_INGEST_API_KEY`. The
file currently has **no outbound API configuration at all**.

---

## 7. Stage 4 — Mail console at `/org/mails`

New section in `~/amsaccess`, following `InvigilationPanel.tsx`'s existing table
idiom and polling. No new design language.

| Piece | Behaviour |
|---|---|
| **Templates** | Create / edit / preview, stored as **SES templates** so copy changes without a deploy |
| **Recipients** | The contest roster, or an uploaded CSV |
| **Send** | Queued through the **existing SQS worker** — already rate-limited, already retries |
| **Status** | Per participant: Not sent / Sent / Failed + reason, with retry-failed |

2,000 emails at SES's 1/sec is **~35 minutes**, so this can never be a blocking
request. Per-participant status matters because the contest-morning question is
*"did **this person** get their handle"*, which a job-level count cannot answer.

---

## 8. Stage 5 — Issue, then send

Two separate actions on the contest roster.

**Issue credentials** — instant, just database rows. Idempotent: provisions only
people who have none, so pressing it again after adding 50 to a 500-person
roster does the right thing. **Never regenerates an existing passphrase** —
someone holding a credential from last week must not have it invalidated.

**Send credentials** — hands the roster to the mail console. Separate so a
roster can be built weeks early, checked, and released on your schedule.

Printable per-participant slips remain the fallback for when email does not
arrive — which, at 2,000 people, it will for someone.

---

## 9. Edge cases

| Case | Behaviour |
|---|---|
| Mononym ("Madonna") | No surname initial; `madonna-kqmwd` |
| Non-ASCII name | Romanise; if nothing usable survives, fall back to email local-part. Never raises |
| Apostrophe / hyphen ("O'Brien") | Stripped to `obrien` |
| Very long name | Name part truncated; slug always intact |
| Name sanitises to empty | Falls back to email local-part, then to a slug-only handle |
| Name hits the blocklist | Treated as unusable; falls back as above |
| Two identical names | Different slugs — no queue position, no one-keystroke neighbour |
| Slug collides | Unique violation caught, regenerate, retry |
| Backfill races live approvals | Same constraint arbitrates; both succeed with distinct handles |
| Handle typed with `@access` | Stripped and normalised |
| Handle typed in mixed case | Lowercased |
| Unknown handle | Uniform error + decoy hash; console shows the real reason |
| Revoked / locked credential | Existing behaviour, unchanged |
| Candidate in **zero** contests | Signed in, shown an empty list — not an error |
| Candidate in **one** contest | Straight in |
| Candidate in **several** | Picker |
| Contest ended | Listed, not enterable |
| Re-approval after rejection | Idempotent on `subject_id` — updates, no duplicate |
| Email changed between editions | `external_ref` matches first, so still one person |
| Two people share an email | Exact normalised match only; anything ambiguous creates a new person and is flagged |
| AMS down at approval time | Outbox stays `PENDING`; drain retries |
| Outbox drain dies mid-batch | Per-document status; unfinished entries stay `PENDING` |
| Bounced address | SES suppression stops retries; SNS notifies; row shows Failed |
| SES throttles | Queue respects 1/sec; retries are the worker's existing behaviour |
| Issue pressed twice | Only un-issued people provisioned |
| Send pressed twice | Per-participant status prevents double-send |
| Person deleted in Ascent | Both-stores deletion by `subject_id`; handle retired, never reused |

---

## 10. Verification

**Unit — `ams-api`.** Handle derivation; blocklist; lowercase normalisation;
`@access` stripping; slug is exactly 5 letters with no digits; two identical
names get different slugs; generation never raises on an awkward name; a forced
slug collision regenerates rather than erroring; two concurrent inserts both
succeed. Ingest: creates, idempotent on repeat `subject_id`, updates rather than
duplicates on email match, refuses a revoked API key and every other route.
Issue: idempotent, never regenerates.

**Unit — `ascent`.** Payload assembly from the three collections; outbox drain
marks `SYNCED`/`FAILED` correctly.

**The one that matters.** On a scratch database: register through the real form
→ approve → confirm one AMS person with handle and full profile → register a
**second edition with the same email** → confirm it updates the same human and
preserves the first `external_ref`. That is the entire point of the design and
the first thing to break if anything is wrong.

**End to end.** Add that person to a contest → issue → send → receive the email
→ log into the desktop client with `ayush.s-kqmwd@access` and the passphrase →
sit the contest.

**Never on production.** `ams-api` uses `AMS_TEST_DATABASE_URL` (refuses a
database whose name lacks "test"); Ascent uses the Firebase emulators.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Migration breaks live logins, including the test credential | Backfill assigns handles in the same migration; verified before deploy |
| Credential moving off the contest is a real schema change | Removes a duplicated meaning — `ContestParticipant` already carried membership |
| SES sandbox blocks the whole mail feature | Stage 0 runs first, in parallel with development |
| Passphrase sits in an inbox indefinitely | Reissue is one action; handles are never reused, so a compromised passphrase cannot become someone else's |
| Two PII stores, one deletion request | Both-stores deletion ships in Stage 3, not later |
| Handle longer to type under exam stress | Arrives by email, pasteable; `@access` fixed in the input — still shorter than the two-field slip |

---

## 12. Sequencing

```
Stage 0  SES verification + production access   ← start now, not code, ~1 day wait
Stage 1  Handles + credential-per-person        ← foundation; everything sits on it
Stage 2  Login + proctor UI                     ← depends on 1
Stage 3  Ascent → AMS ingest + outbox           ← independent of 2
Stage 4  Mail console                           ← needs Stage 0 complete
Stage 5  Issue / send buttons                   ← needs 1 and 4
```

Stages 0 and 1 start together: one is waiting on AWS, the other is the
foundation.
