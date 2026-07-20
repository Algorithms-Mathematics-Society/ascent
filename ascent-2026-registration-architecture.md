# Ascent 2026 — Registration Architecture

**Purpose:** Design and implementation brief for the registration + qualification system for Ascent 2026 (a C++ / optimization contest). This document is the spec; implement against it. Where you see `[DECISION NEEDED]`, do not guess — stub it, flag it, and leave it configurable.

**Context you must respect:**
- AMS runs a proctored exam desktop app (AMS Access: Tauri + Next.js frontend, Go backend) and a Firebase/Firestore firm-facing talent portal (signal/PII document split, consent-gated PII reveal, per-firm tenant isolation).
- The qualifier round for this contest runs **on AMS Access** (dogfooding + real data). Registration must hand off cleanly to it.
- AMS's brand is rigor, integrity, and data-as-sacred. Two non-negotiables drive this design: (1) contest fairness must be defensible, (2) the signal/PII split exists from the first field captured, not bolted on later.
- Jurisdiction is India. Design for **DPDP Act 2023** (consent, purpose limitation, deletion rights) from the start.

---

## 1. Design principles

1. **Open door, merit gate.** Anyone can register. Selectivity comes from a qualifier cutoff and contest performance, not from a pedigree wall. College tier only decides *whether* someone skips the qualifier, never *whether* they can enter.
2. **Signal/PII split at ingestion.** The moment data is captured it is written to two logically separate stores: a **Signal Profile** (performance, handle, college tier, skills — the firm-visible surface) and a **PII Vault** (legal name, email, phone, government ID, resume — consent-gated, never firm-visible without explicit reveal). They are linked only by an internal opaque `subject_id`.
3. **A claim is not a fact.** Any self-asserted attribute that grants an advantage (college tier, student status) must be *verified* before it takes effect. Unverified claims default to the lower-privilege path.
4. **Every privileged transition is audited.** Auto-qualification, verification, disqualification, and deletion each write an immutable audit record with actor, timestamp, reason, and evidence reference.
5. **Edition-scoped, reusable.** Model everything under an `edition` (e.g. `ascent-2026`) so the same system runs Ascent '27, Derive, etc. without a rewrite.
6. **Fail safe, not open.** On any ambiguity (verification unclear, dedupe collision, tie at cutoff), the default is the *more conservative* outcome plus a review flag — never silent auto-advance.

---

## 2. High-level flow

```
Register ──▶ Verify email ──▶ Complete profile ──▶ Select college
                                                        │
                                            ┌───────────┴───────────┐
                                   AUTO_QUALIFY tier          STANDARD tier / "Other"
                                            │                       │
                                   Verify college claim      (no college verification
                                   (institutional email             needed to enter)
                                    OTP, else ID review)            │
                                            │                       ▼
                                   ┌────────┴────────┐        Qualifier on AMS Access
                                   ▼                 ▼        (proctored, scored)
                              VERIFIED          UNVERIFIED           │
                                   │            → falls to      ┌────┴────┐
                                   ▼              qualifier      ▼         ▼
                            Seeded into                     ≥ cutoff    < cutoff
                            main contest                    ADVANCED   ELIMINATED
                                   │                            │
                                   └──────────────┬─────────────┘
                                                  ▼
                                         Main contest rounds
                                         (identity re-verified at proctoring)
                                                  ▼
                                              Finalists
```

---

## 3. Data model

Store the transactional core in a **relational DB (Postgres)** as the source of truth. Project the Signal Profile into the existing **Firestore talent portal** for firm-facing views (one-way sync, Postgres → Firestore). Do **not** make Firestore the source of truth for registration state — the qualification logic is relational and transactional and needs constraints Firestore can't enforce cleanly.

### Core entities

**`subject`** — the opaque link between the two stores.
- `subject_id` (uuid, PK)
- `edition` (text, e.g. `ascent-2026`)
- `created_at`, `updated_at`

**`signal_profile`** (firm-visible surface; no direct PII)
- `subject_id` (FK)
- `codeforces_handle` (optional; not reserved as an Ascent identity and not
  required to be unique)
- `college_id` (FK, nullable if "Other")
- `college_tier` (enum: `AUTO_QUALIFY`, `STANDARD`, `UNLISTED`)
- `year_of_study`, `graduation_year`
- `status` (enum: `STUDENT`, `PROFESSIONAL`, `OTHER`)
- `skills` (structured; optional at registration)
- performance fields populated later (qualifier score, round results, rank)

**`pii_vault`** (consent-gated; strict access control; encrypted at rest)
- `subject_id` (FK)
- `legal_name`
- `email` (unique constraint across active applications — see dedupe)
- `phone` (E.164; normalized)
- `gov_id_hash` (hashed, not raw, for dedupe/identity; raw ID only captured at proctoring if required, never stored beyond retention window)
- `resume_url` (required Google Drive sharing URL)
- `transcript_url` (optional Google Drive sharing URL)
- `college_email` (nullable; used for verification)

**`college`** (reference table — canonical, not free text)
- `college_id` (PK)
- `canonical_name`
- `aliases` (array — "IITB", "IIT Bombay", "Indian Institute of Technology Bombay")
- `campus` (disambiguates BITS Pilani/Goa/Hyderabad, IIIT variants, NIT branches)
- `tier` (enum: `AUTO_QUALIFY`, `STANDARD`)
- `email_domains` (array — `iitb.ac.in`, etc.; used for college verification)
- `active` (bool)

**`application`** (one active per subject per edition)
- `application_id` (PK)
- `subject_id` (FK)
- `edition`
- `state` (see state machine)
- `qualification_path` (enum: `AUTO`, `QUALIFIER`, `UNDETERMINED`)
- `qualification_reason` (text — why AUTO or QUALIFIER; immutable once set)
- `created_at`, state timestamps

**`verification`** (one row per verification attempt)
- `verification_id` (PK)
- `subject_id` (FK)
- `type` (enum: `EMAIL`, `COLLEGE_EMAIL`, `COLLEGE_ID_MANUAL`, `IDENTITY_PROCTOR`)
- `status` (enum: `PENDING`, `VERIFIED`, `FAILED`, `MANUAL_REVIEW`)
- `evidence_ref` (nullable — uploaded ID card, OTP metadata)
- `reviewed_by`, `reviewed_at` (for manual)

**`consent`** (DPDP — granular, versioned, revocable)
- `consent_id` (PK)
- `subject_id` (FK)
- `purpose` (enum: `CONTEST_PARTICIPATION`, `FIRM_PROFILE_VISIBILITY`, `MARKETING`)
- `granted` (bool)
- `policy_version`, `granted_at`, `revoked_at` (nullable)

**`exam_attempt`** (qualifier on AMS Access)
- `attempt_id` (PK)
- `subject_id` (FK)
- `state` (enum: `SCHEDULED`, `IN_PROGRESS`, `SUBMITTED`, `NO_SHOW`, `VOIDED`)
- `score`, `submitted_at`
- `integrity_flags` (array — proctoring anomalies, plagiarism hits)

**`audit_log`** (append-only)
- `subject_id`, `event`, `actor`, `reason`, `evidence_ref`, `timestamp`

---

## 4. Application state machine

```
DRAFT
  → EMAIL_VERIFIED            (email OTP passes)
  → PROFILE_COMPLETE          (required fields + college selected)
  → QUALIFICATION_DETERMINED  (engine sets path: AUTO | QUALIFIER)
       ├─ AUTO branch:
       │    → COLLEGE_VERIFICATION_PENDING
       │    → SEEDED           (college verified → into main contest)
       │    (verification fails/expires → drops to QUALIFIER path)
       └─ QUALIFIER branch:
            → QUALIFIER_SCHEDULED
            → QUALIFIER_IN_PROGRESS
            → QUALIFIER_SUBMITTED
            → ADVANCED | ELIMINATED   (vs cutoff, after integrity clear)
  → (SEEDED | ADVANCED) → IN_CONTEST → FINALIST
Terminal side-states from most states:
  WITHDRAWN, DISQUALIFIED, DELETED (DPDP erasure), WAITLISTED (post-deadline)
```

Rules:
- A subject holds **exactly one** active `application` per edition. Re-registration attempts resolve to the existing application, never a second one.
- `qualification_reason` is written once and is immutable. If path changes (AUTO → QUALIFIER on failed verification), that is a new audited transition, not an overwrite.
- No state may skip verification gates. `SEEDED` is unreachable without a `VERIFIED` `COLLEGE_EMAIL` or `COLLEGE_ID_MANUAL`.

---

## 5. College selection, tiering, and verification

### Selection
- College is chosen from a **canonical typeahead**, backed by the `college` table with alias matching. **No free-text college for tier purposes.** Free text is the single biggest source of both dirty data and spoofing.
- If the college isn't in the list: an explicit **"My college isn't listed"** option → sets `college_tier = UNLISTED`, `qualification_path = QUALIFIER`, and captures the typed name in a separate `unlisted_college_submissions` table for later list curation. UNLISTED never auto-qualifies.

### Tiering
- `AUTO_QUALIFY` tier: the published tier-1 institution set (all IITs; ISI/CMI; IIIT-H, IIIT-D, IIIT-B; BITS campuses; DTU/NSUT; IISc; the named top NITs; optional IISERs). Store the exact set as data, not code, so it's editable without a deploy.
- Everyone else: `STANDARD`.

### Verification (this is the load-bearing part)
Auto-qualification must be **earned by proof**, never by selection. When `college_tier = AUTO_QUALIFY`:

1. **Primary: institutional email OTP.** If the college has `email_domains`, require an OTP to `name@domain`. Pass → `COLLEGE_EMAIL VERIFIED` → `SEEDED`.
2. **Fallback: ID review.** No institutional email (some students don't have one early, or use personal mail)? Allow upload of a college ID card → `COLLEGE_ID_MANUAL` → admin review queue. Approved → `SEEDED`. This path must exist or you'll wrongly exclude legitimate tier-1 students.
3. **Verification not completed by deadline / fails:** application **drops to the QUALIFIER path** (audited). It does not sit in limbo, and it does not auto-qualify on an unverified claim.

Second-order note for implementation: the fallback ID-review queue is where fraud concentrates. Rate-limit it, watermark-check, and require the reviewed name to match the PII-vault legal name before approval.

---

## 6. Qualification engine

A deterministic function over a completed profile:

```
determine_path(application):
  if college_tier == AUTO_QUALIFY and college_verification == VERIFIED:
      path = AUTO ; reason = "verified tier-1: <college_id>"
  else:
      path = QUALIFIER
      reason = one of {"standard tier", "unlisted college",
                       "tier-1 claim unverified", "verification expired"}
```

- Cutoff for QUALIFIER advancement is `top N by score`, where N and the score model are `[DECISION NEEDED]`.
- **Tie at the cutoff:** define the tie-break up front and publish it. Recommended: (1) higher score, (2) earlier final-correct-submission time, (3) fewer attempts. Never resolve ties by registration time (rewards bots) or college (breaks fairness).
- Guard against double-path: a subject cannot both be `SEEDED` and hold a scored `exam_attempt` that advances them a second time.

---

## 6.5 Registration UX — progressive capture (conversion design)

**Principle: collect each field at the moment of maximum motivation for that field, not all at once.** The full data model in §3 is still captured — but staged, so the *commitment point* asks for almost nothing. Perceived length is what kills forms, not total field count: three short screens beat one long screen at equal fields. Staging also improves data quality, because a motivated user at the right moment gives better data than a fatigued user grinding a wall.

**Ethical boundary (brand non-negotiable):** friction-reduction and honest framing only, never manipulation. No fake scarcity, no countdown theatrics, no pre-ticked consent, no confirmshaming, no forced continuity. AMS's moat is trust; a dark pattern that lifts conversion a few points and costs one credibility story is a net loss. Every lever below is legitimate.

### Staged capture

**Stage 1 — Register (target: < 60 seconds, 3 fields).** The commitment point. Ask only what creates the account + application:
- Google OAuth (preferred — one tap yields a verified email + name + bot resistance) OR email + OTP.
- Handle.
- College (canonical typeahead).

Nothing else. State → `EMAIL_VERIFIED`. Optimize everything here for crossing this line.

**Stage 2 — Complete profile (after they're in).** Year of study, status, phone. Show a progress indicator. Commitment-consistency + completion bias (Zeigarnik) carry them; people finish what they've started.

**Stage 3 — Path-specific, benefit-framed friction.**
- Auto-qualify tier: college verification presented as a reward — "Confirm your college email to skip the qualifier." The user opts into the friction because it buys something. This is how heavy verification (§5) coexists with low friction: defer it to the moment it's worth it to them.
- Standard tier: schedule the qualifier. No heavy data required to enter.

**Stage 4 — Just-in-time, only when relevant.**
- Government ID: captured at proctoring, not registration.
- Resume + firm-visibility consent: deferred, and best offered *after* a strong result — "You placed in the top N. Opt in to let firms see your profile." Motivation to share peaks here, and consent given at this point is more considered and more DPDP-defensible.

### Psychological levers (all legitimate)
- **Progressive disclosure** — split into short stages; perceived effort drops even at equal total fields.
- **Goal-gradient** — a progress bar that starts partially filled ("40% there") accelerates completion.
- **Friction where it signals quality** — effort lives in the qualifier (the product), not the form. "Registration takes a minute; the contest is where it gets hard" turns selectivity into a feature and keeps entry frictionless.
- **Anxiety-reducing honesty** — at any PII step, one true line ("Your details are never shown to firms without your explicit permission") cuts privacy drop-off. The only kind of persuasion AMS uses.
- **Honest urgency** — a real "registration closes [date]" is fine and effective; a fabricated countdown is not.
- **Smart defaults / autofill** — OAuth prefill, phone formatting, college alias matching. Every inferred field is a field not asked.

### Field budget
Minimum at commitment: **3** (identity, handle, college). Everything else in §3 defers to Stage 2–4. Rule: if a field can't be justified as blocking *the current stage*, it moves later.

---

## 7. Integrity & anti-fraud controls

- **Dedupe:** one identity = one application. Enforce on `phone` + `gov_id_hash` at the PII layer (email alone is trivially multiplied). On collision, block the second registration and surface an account-recovery path, not a duplicate.
- **Bot/spam registration:** rate-limit by IP + device, CAPTCHA on registration, block disposable-email domains, throttle OTP resends.
- **College spoofing:** handled by §5 verification. The auto-qualify list is worthless without it — do not ship auto-qualification before college verification works.
- **Qualifier integrity:** runs proctored on Access. Autosave + resumable attempts (there is prior history of a submit/autosave decoupling bug — treat submission as the highest-integrity path, idempotent, server-confirmed). Plagiarism/similarity checks on submissions → `integrity_flags` → review queue → `DISQUALIFIED` only via audited human decision, never silently.
- **Identity at proctoring:** government ID + photo match at exam time. Name mismatch vs registration → flag, not auto-reject; resolve in review.
- **Appeals:** every automated elimination or disqualification needs an appeal window and a record. Rigor means AMS is harder on its own process than any participant would be.

---

## 8. Consent & data protection (DPDP Act 2023)

- Consent is **granular and separate from registration.** Registering grants `CONTEST_PARTICIPATION` only. `FIRM_PROFILE_VISIBILITY` (the thing that surfaces a candidate to firms in the talent portal) is a **distinct, explicit, revocable** opt-in. A registrant who never opts in still competes; their profile is simply never firm-visible.
- Purpose limitation: data captured for the contest is not repurposed without fresh consent.
- **Right to erasure:** `DELETED` state must anonymize the Signal Profile and purge the PII Vault (retain only a hashed tombstone for dedupe/audit integrity). Propagate deletion to the Firestore projection.
- Retention: raw government ID (if captured at proctoring) has a short, defined retention window and is then purged; only the hash persists.
- Minors / age: capture `graduation_year`; if any eligibility age floor applies `[DECISION NEEDED]`, enforce and handle guardian-consent implications.

---

## 9. Edge cases the implementation must handle

| # | Case | Required behavior |
|---|------|-------------------|
| 1 | Same person, multiple emails | Dedupe on phone + gov_id_hash; resolve to single application |
| 2 | College not in list | "Other" → UNLISTED → QUALIFIER; capture typed name separately |
| 3 | Claims tier-1, no institutional email | ID-upload fallback → manual review; not auto-qualified on claim |
| 4 | Tier-1 verification never completed | Drop to QUALIFIER at deadline (audited); no limbo |
| 5 | Multi-campus institution (BITS, IIIT, NIT) | Canonical list disambiguates campus; tier is per-campus |
| 6 | Typo'd / aliased college name | Alias matching in typeahead; no free-text tiering |
| 7 | OTP not received / email bounce | Resend limits, alternate-email path, support fallback |
| 8 | Non-student (professional, alumnus) | Capture status; if student-only `[DECISION NEEDED]`, gate; else STANDARD |
| 9 | International / non-Indian college | `[DECISION NEEDED]`: STANDARD tier or excluded; flag explicitly |
| 10 | Name mismatch at proctoring vs registration | Flag for review, not auto-reject |
| 11 | No firm-visibility consent | Competes normally; excluded from talent portal |
| 12 | Registration after deadline | `WAITLISTED` or hard-closed `[DECISION NEEDED]` |
| 13 | Withdrawal / deletion request | `WITHDRAWN` / `DELETED` with DPDP-compliant purge |
| 14 | Qualifier no-show | `NO_SHOW` → `ELIMINATED`; never stuck in scheduled |
| 15 | Qualifier crash / network drop | Resumable attempt, autosave, server-confirmed idempotent submit |
| 16 | Cheating detected in qualifier | Integrity flag → review → audited disqualification + appeal |
| 17 | Tie at cutoff | Published deterministic tie-break |
| 18 | Auto-qualified subject also sits qualifier | Blocked; single advancement path enforced |
| 19 | Lost account access | Recovery via verified phone/email |
| 20 | Bulk bot registrations | Rate limit + CAPTCHA + disposable-email block |
| 21 | Payment (if a fee exists) | `[DECISION NEEDED]`: optional module, gate state on payment if enabled |
| 22 | Duplicate handle | Unique constraint per edition; suggest alternatives |

---

## 10. Service surface (suggested)

- **Registration service** — application lifecycle, state machine, dedupe.
- **Verification service** — email/college/identity OTP + manual-review queue.
- **College reference service** — canonical list, alias matching, tier lookup (data-driven, hot-editable).
- **Qualification engine** — deterministic path assignment; cutoff evaluation.
- **Access integration** — schedule/launch qualifier, ingest scores + integrity flags.
- **Consent service** — granular consent, versioning, revocation, erasure propagation.
- **Admin console** — review queues (ID verification, integrity flags, appeals), audit log viewer, tier-list editor, cutoff config.

---

## 11. Open decisions to lock before build (do not invent these)

1. Registration open/close dates.
2. Qualifier date(s), format, scoring model, and advancement N (cutoff).
3. Main-contest round structure (Round 1 / Round 2 / Finals specifics).
4. Student-only vs open to professionals/alumni.
5. International colleges: included (STANDARD) or excluded.
6. Registration fee: yes/no (drives the payment module).
7. Age floor, if any.
8. Post-deadline behavior: waitlist vs hard close.
9. Exact final tier-1 institution list (data seed).

---

*Build order recommendation: (1) core data model + signal/PII split, (2) registration + email verification + dedupe, (3) canonical college list + tiering, (4) college verification (this gates auto-qualify — do not ship auto-qualify without it), (5) qualification engine, (6) Access qualifier integration, (7) consent + DPDP erasure, (8) admin/review console. Ship nothing that auto-qualifies on an unverified claim.*
