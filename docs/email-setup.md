# Resend email setup

Candidates do not need accounts or a login. Registration receipts include the
`ASC-` reference; approval, waitlist and rejection decisions generate emails.
Reminder addresses remain visible at `/admin/reminders`. `/admin/email` shows
queue status and lets owners process due messages.

## Activate sending

Placeholders are in `.env.local` and `.env.local.example`. Sending remains
disabled until both the API key and sender address are present and valid.

1. Verify a sending domain in Resend and create an API key. Set
   `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, for example
   `Ascent <notifications@amshq.in>`, using your verified domain.
   [Resend sender requirements](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend).
2. Check `RESEND_REPLY_TO` (default `team@amshq.in`) and `SITE_URL`
   (default `https://ascent.amshq.in`). Use a monitored reply mailbox and the
   canonical HTTPS site origin.
3. Set `CRON_SECRET` to a randomly generated secret of at least 32 characters.
   The retry endpoint rejects requests without the matching bearer token.
4. Add these values to the **Vercel production environment**, then redeploy.
   Editing `.env.local` only configures local runs. Deploy the Firestore rules
   with the application release; browser clients must not access `email_outbox`.
5. Sign in as an owner and open `/admin/email`. Click **Process due email** to
   schedule existing reminder requests and send pending messages. Each run scans
   up to 50 legacy reminders and processes up to 50 due jobs within a time budget.
   Repeat until the backlog is processed. A failure can end a batch early.
   Check the Resend dashboard and a controlled test inbox before launch.

Copy exactly one Resend API-key value into `RESEND_API_KEY`. Repeated keys,
embedded whitespace and copied placeholder values disable sending before the
SDK constructs request headers. Application diagnostics contain allowlisted
error codes only, never raw SDK exception messages. `provider_transport_error`
indicates an uncertain transport failure; check Resend before manually resending.

Adding real configuration enables actual emails on new submissions and admin
decisions. No real email was sent during implementation or automated testing.

## Vercel Hobby scheduling

New registration confirmations and decision notifications get a best-effort send
attempt after their database transaction commits. The email job is part of that
transaction, so email failure does not discard the registration or decision.
Bulk decisions attempt delivery for a bounded period and leave the remainder queued.

Before registration opens, reminder jobs schedule email with Resend for
**24 September 2026, 06:00 IST**. Resend permits scheduling up to 30 days ahead;
this worker begins scheduling within 29 days. Requests made after opening send
when processed. The reminder points to the registration page for its live status.
Changing the opening date in code does not change messages already scheduled in
Resend; reschedule or cancel those in its dashboard before a date change.
[Resend scheduling](https://resend.com/docs/dashboard/emails/schedule-email).

`vercel.json` schedules `/api/cron/email` daily at `30 0 * * *` (06:00 IST).
Hobby permits one daily invocation per cron and may invoke it anywhere within
that hour. This is a fallback for retries and backlog processing; timely opening
reminders depend on scheduling them with Resend in advance. Large backlogs need
additional owner-triggered runs. Cron runs on production deployments, not local
`next dev`. Vercel supplies `Authorization: Bearer <CRON_SECRET>` automatically.
[Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

The email cron does not drain the separate AMS Access sync outbox; that retains
its existing `/api/admin/ams-sync` operation. A rejection cancels any queued
transfer from an earlier approval or waitlist decision. The drain also rechecks
current eligibility and does not overwrite a newer job when an older request
finishes. Each request has a time budget; run again when the response reports
remaining work. Data already sent to AMS Access requires handling in that system.

## Retries and status

Workers use Firestore leases and deterministic job IDs. Provider retries reuse
an immutable message and idempotency key. Known rejections (such as a 429 rate
limit) retry with exponential backoff and can recover on the next daily run.
Permanent message rejections (HTTP 400, 404 or 422) move to **Needs review** so
one invalid message does not block later messages in the daily batch.
An ambiguous timeout or server failure retains its original key and payload.
Resend retains idempotency keys for 24 hours; this implementation stops automatic
retries after 23 hours to avoid duplicate messages.
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

Because Hobby retries only daily, an ambiguous failure may reach **Needs review**
before the next cron. Owners can retry due jobs earlier from `/admin/email`.
For a review job, check Resend logs/provider IDs and recipient history before any
manual resend. Do not reset an ambiguous job blindly: the provider may already
have accepted it. Missing recipients also require review. The app intentionally
has no force-resend button that bypasses this check.

**Accepted by Resend** is provider acceptance, not proof of inbox delivery.
**Scheduled with Resend** records scheduling acceptance and remains that status
after the scheduled time; it is not refreshed by webhooks. Use the provider
dashboard for delivery, bounce, complaint and cancellation details.

Every email attempt rechecks the current application, recipient and decision.
Deleted applications, removed reminder records and superseded decisions
stop further attempts. Withdrawn entries receive no new confirmation or decision
emails; their registered mailbox can still request status access. Frozen recipient data is cleared when the source becomes
unavailable. A prior ambiguous attempt stays visible as **Needs review**, since
it may already have reached Resend. These checks cannot retract email already in flight or
accepted by the provider; scheduled cancellations still require its dashboard.
Internal decision notes are never included. Existing reminders are backfilled;
registrations and decisions made before this integration are not automatically
backfilled. Queued payloads contain recipient data and must be included in future
erasure/retention handling, together with any scheduled message in Resend.

## Private status links

`/register/status` accepts only an email address and a successful Turnstile check.
It gives the same response for existing and unknown entries. The durable job is
created before responding; Vercel `waitUntil` keeps the delivery attempt running
in the background. Unknown recipients are skipped without sending mail. A
five-minute job bucket prevents duplicate sends; limits also apply per IP,
mailbox and across the service. Access requests expire after 15 minutes in the
queue, so a daily retry cannot send an unexpected next-day login link.

Delivered links expire after 20 minutes. The token is in the URL fragment, which
is removed before loading Turnstile. A user must press **View my status** to
consume it; merely fetching the link does not use it. Firestore atomically marks
the token used and issues a separate 20-minute HTTP-only, Secure, SameSite cookie.
Only hashed one-use tokens are stored in the access collection. Email payloads
necessarily contain the emailed link and remain private to the server.

`CANDIDATE_STATUS_SECRET` must contain at least 32 random characters, separate
from the cron secret. Rotating it invalidates existing links and sessions. A
changed registered email or deleted application also invalidates access. See
[trust and access setup](trust-setup.md) for configuration and manual rights requests.

## Verification

- `npm test`: templates, configuration, SDK contract, authorization and routes.
- `npm run test:concurrency`: actual Firestore transactions with synthetic data;
  the Resend SDK is mocked, including concurrency, retry and scheduling cases.
- `npm run test:rules`: browser access restrictions.
- `npm run build`: production compilation and type/lint checks.

Tests never call the real Resend API. Domain ownership, deliverability and the
production Vercel cron require verification after credentials are configured.
