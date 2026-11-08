# Ascent

## Administrator access

The admin console uses Firebase email/password accounts plus custom claims. Two
roles are supported:

- `reviewer`: registrations, applicant review, decisions, exports and activity
- `owner`: every reviewer capability plus team and registration settings

An existing legacy account with `ascent_admin: true` and no role remains an
owner. New grants always write an explicit role. Owners manage the roster at
`/admin/team`; access changes require a reason and typed email confirmation,
revoke the target's active sessions when permissions change, and enter the
audit ledger.

The CLI is the break-glass path when no owner can use the web console. The
target account must already exist in Firebase Authentication with a verified
email, and the reason must be 10–500 characters:

```bash
npm run admin:role -- grant administrator@example.com owner "Emergency owner recovery"
npm run admin:role -- grant reviewer@example.com reviewer "Competition review team"
npm run admin:role -- revoke reviewer@example.com "Review assignment ended"
npm run admin:role -- reset-mfa administrator@example.com "Lost authenticator verified by recovery owner"
```

CLI changes are also audited.

TOTP authenticator setup is available to every administrator at
`/admin/security`. Enrollment requires the account password again, binds the
fresh Firebase identity to the active admin session, and records successful
enrollment in the activity ledger. Enrolled accounts complete the TOTP
challenge during fresh login. Server-wide enforcement intentionally remains a
separate rollout step: do not activate it until every owner has enrolled and
the independent recovery login has been tested.

## Mandatory admin MFA

`ADMIN_MFA_ENFORCEMENT=true` makes both new ID-token exchanges and existing
admin session cookies fail closed unless Firebase records `totp` as the sign-in
second factor. Leave the variable unset or `false` during enrollment. Activate
it only in a reviewed production deployment after `/admin/team` reports two
protected owners and every enabled administrator enrolled.

Run `npm run admin:mfa-readiness` immediately before activation. The command
fails unless every enabled administrator has TOTP, every one has completed a
fresh audited TOTP login, and at least two of those tested accounts are owners.

Identity Platform does not issue recovery codes for TOTP. The audited
break-glass procedure is therefore:

1. Confirm that another enabled, verified owner still has working TOTP access.
2. Set `ADMIN_MFA_ENFORCEMENT=false` and redeploy production.
3. Run `npm run admin:role -- reset-mfa <email> "<verified reason>"`.
4. The affected administrator signs in, re-enrols at `/admin/security`, signs
   out, then proves a fresh password + TOTP login.
5. Confirm `/admin/team` is ready, restore `ADMIN_MFA_ENFORCEMENT=true`, and
   redeploy.

The reset command refuses to remove the last protected owner, records an audit
intent before touching Firebase Authentication, removes all factors, and
revokes every target session.

## Registration reminders

Visitors can leave an email using “Remind me” beside the homepage registration
opening date or the locked registration form. `POST /api/reminders` validates and
normalizes the address, deduplicates it in `registration_reminders`, and records
the first request time. Submissions are limited to 120 per IP per hour.

Owners and reviewers can view emails and request times at `/admin/reminders`,
linked from the admin navigation. The list is paginated, newest first. Browser
clients cannot read or write the collection directly. Reminder requests create
durable email jobs and can be scheduled with Resend once sending is configured.

## Transactional email

Resend sends registration confirmations with the entry reference, decision
notifications, and opening reminders. No candidate login is required. The admin
Email page (`/admin/email`) shows queue status and provides an owner-only worker
button. Sending is disabled while environment placeholders are blank.

See [Resend setup and the Vercel Hobby runbook](docs/email-setup.md) for sender
verification, environment variables, the daily retry cron, existing reminders,
and handling ambiguous provider failures.

## Reliability and performance checks

Run `npm test` for unit and route checks. Run `npm run test:concurrency` for
concurrent submissions against an isolated Firestore emulator (Java 21+).
`npm run test:rules` checks database and storage access rules.

Unlimited registration no longer updates a shared accepted-count document on
every submission. Admin counts use Firestore aggregation. If a capacity is needed,
close and save registration first, then set the capacity and reopen it. This lets
the server initialize the counter without racing incoming submissions.

See [the reliability and performance audit](docs/audits/2026-09-14.md) for measured
Lighthouse results, concurrency coverage, and the limits of the local checks.

## Privacy, terms, bot protection and candidate status

The footer links `/privacy`, `/terms` and `/register/status`. Current legal
versions have permanent dated URLs. New registrations store participation
consent and separate terms acceptance in the same transaction as the entry.
Reminder submissions record their limited purpose and policy version. Existing
`v1` records are preserved and explained at `/privacy/v1`; they are not relabelled
as acceptance of a notice that was not available at submission time.

All public email-triggering forms require server-verified Cloudflare Turnstile.
Blank placeholders intentionally disable submission. Status uses an emailed,
one-use link and temporary cookie; candidates do not create accounts. Private
review notes and contact details never appear in the status response.

See [trust and access setup](docs/trust-setup.md) for environment values,
publication checks, security behavior and support procedures. Candidate help,
privacy requests and general questions use **team@amshq.in**. Sponsorship and
partnership enquiries use **partners@amshq.in**.

## Round 1 results

`/results` lets participants enter the exact contest username from Round 1.
Matching ignores capitalization and surrounding spaces. The page shows rank,
selection, solved count, partial credit, penalty and the A–D breakdown, with a
print layout for saving a result as PDF. Published ranks 1–133 advance to Round 2;
the CSV rank is authoritative even where score fields are tied.

The source is `leaderboard/standings-ams-ascent-round-1.csv`. It stays outside
`public/` and client bundles. `POST /api/results` returns one exact match and
omits names and contact details. This is a public username lookup, not identity
verification: anyone with a contest username can retrieve its result. Email
lookup requires a verified contest-username-to-email mapping and is not enabled.

Selected participants also get a short party-popper burst, an optional replay,
a downloadable 1200×627 PNG, an editable/copyable caption and a LinkedIn share
button. The button opens LinkedIn with the public results URL; participants
attach their downloaded image and review/publish their own post. The link
preview is generated at build time. No LinkedIn SDK, OAuth, auto-posting, or
server-side participant-image generation is involved.

The parser rejects malformed rows, missing/nonsequential ranks, duplicate
usernames and inconsistent solved counts. Next explicitly traces the CSV into
the deployment. Include the CSV with the release; changes require a new build
and deployment because the page is prerendered and each server instance caches
the standings. Concurrent first requests share one asynchronous read and parse;
subsequent lookups use the in-memory map. Failed imports can retry. Keep the CSV
out of `public/`.

Run `npx vitest run test/results.test.ts` for import validation and the 133/134
cutoff. `test/browser/results.cjs` checks the production page, error recovery,
printing, narrow screens and reduced motion against a local server; set
`PLAYWRIGHT_MODULE` and optionally `CHROMIUM_EXECUTABLE_PATH` to existing browser
tooling. The default server URL is `http://127.0.0.1:3100`.

Performance regression: after `npm run build`, run
`node scripts/benchmark-results.cjs /tmp/results-benchmark.json`. The script
starts an isolated local production server, verifies 1,000 lookups at concurrency
50 and a 500-concurrent burst, reports latency/response size/process memory, then
stops its server. Add `--cold-burst` to hit a fresh instance with 500 requests
before any lookup. It never targets the production site. See
[the results review](docs/audits/2026-11-08-results.md) for measured limits.

`test/browser/resultsResilience.cjs` additionally verifies that wrong-user
responses are rejected, unavailable optional celebration/sharing chunks preserve
the result, and a failed image download can be retried. It uses the same local
server and Playwright environment variables as the main browser checks.
