# Legal publication, bot protection and status access

## Production configuration

Environment placeholders are in `.env.local.example` and the ignored local env
file. `.env.local` does not change Vercel production settings.

1. Create a managed Cloudflare Turnstile widget for the actual site hostname.
   Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in Vercel.
   Keep the secret server-side. Set `TURNSTILE_ALLOWED_HOSTNAMES` to an explicit
   comma-separated list of allowed hostnames, without schemes or paths.
   Use a separate widget/configuration for previews or localhost.
2. Generate an independent random `CANDIDATE_STATUS_SECRET`, at least 32
   characters. For example, `openssl rand -hex 32`; store its result privately.
3. Complete [Resend setup](email-setup.md), including verified sender,
   `SITE_URL`, reply mailbox and `CRON_SECRET`. Candidate replies use
   `team@amshq.in`; sponsor and partnership enquiries use `partners@amshq.in`.
4. Redeploy after setting environment variables. `NEXT_PUBLIC_` values are
   compiled into browser bundles. Deploy `firestore.rules` with the release.
   Access tokens, rate counters, personal data and outboxes deny all browser
   access, including admin browser SDK access. The server uses Admin SDK IAM.
5. Check `/privacy`, `/privacy/2026-09-14`, `/privacy/v1`, `/terms`,
   `/terms/2026-09-14` and the footer in production. Try the reminder form and
   status link using a controlled mailbox, then check the provider dashboard.
   Test registration after the configured opening time, without changing the
   public launch time just to run a production smoke test.

Missing Turnstile settings fail closed. Missing Resend settings keep durable
confirmation/reminder jobs pending and disable new status-link requests. No real
provider calls are made by the automated tests. Official Cloudflare test keys
are rejected in production; mock verification in isolated tests instead.

Server validation checks success, action and hostname; Cloudflare enforces token
expiry and one-use semantics. Application rate limits run before verifier calls.
Status requests also have per-mailbox limits and a service-wide 1,000-request
rolling daily ceiling. The ceiling protects email spend but can deny requests
when exhausted; support remains available. Shared campus IP limits deliberately
allow more registration/reminder activity than status-link requests.

Sources: [Cloudflare server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
[explicit widget rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/),
[Vercel background work](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).

## Consent and legal versions

The dated legal pages are the published text referenced by new consent records.
Keep historical versions unchanged when creating a new version. Registration
requires separate unchecked participation and terms checkboxes. The saved
participation notice is the same constant displayed by the form. Reminder
consent is the notice beside its explicit Notify me action, with no marketing
or sponsor permission. Do not backfill current consent onto older records.

`/privacy/v1` explains the previous checkbox and the absence of a full published
notice under that label. It does not claim that entrants accepted today's
policy earlier. Before broadening any use of existing data, obtain the required
permission using a current notice. Do not use registration/reminder consent for
sponsor marketing. The site does not implement sponsor consent collection.

The policy describes manual retention review, not automatic erasure. Its normal
review point is 365 days after registration. Organisers need to carry out that
review and remove records no longer needed. For applicants under 18, support
must arrange appropriate guardian permission before personal data is submitted.
The website does not yet automate guardian verification.

## Status and support procedures

The status page shows received, under review, approved, waitlisted, rejected or
withdrawn. Review starts when an operational change is recorded or the explicit
`review_started_at` field is set. Only verified institutions can show the direct
qualification path. The published Round 1 date is not a personal booking. Slot
booking, exam credentials and score/rank publication are separate future work.

Corrections, withdrawal, data access, deletion and appeals currently use
`team@amshq.in` from the registered mailbox, optionally including the reference.
There is no automated withdrawal/erasure button. Verify the request before
acting and aim to respond within the policy's 30-day target. Do not request
identity documents through the public registration form.

For a verified withdrawal, mark the application `WITHDRAWN` and handle any AMS
Access transfer or already scheduled email separately. For deletion, include
PII, application/consent/review records, uniqueness indexes, submission receipts,
reminders, token records, email payloads and external copies as appropriate;
explain any legally required retention. Marking an application `DELETED` blocks
status access and further sends but does not erase these records on its own.
Messages already accepted by Resend require provider-side cancellation where
possible. A separate operator procedure is needed for data already in AMS Access.

Access records include an `expiresAt` timestamp suitable for a Firestore TTL
policy on `candidate_access_tokens`. Enable that TTL policy for automatic
cleanup, or include these records in manual retention review. Token validation
enforces expiry regardless of cleanup. Expired status requests are skipped by
the worker; their raw request email is cleared on completion or skip.
