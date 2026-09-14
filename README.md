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
