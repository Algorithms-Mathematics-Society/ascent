# Code review — 14 September 2026

Reviewed the pending registration, reminder, email, admin and concurrency changes,
including their AMS Access handoff. Fixed the following reproducible issues.

| Priority | Finding | Fix |
| --- | --- | --- |
| P1 | A failed decision email reused its frozen payload after an admin corrected the decision. | Recheck the decision revision before every attempt; stop stale retries and flag ambiguous prior attempts for review. |
| P1 | Email retries bypassed deleted/withdrawn application and missing-recipient checks. | Recheck source records on every attempt and clear the saved payload when the source is unavailable. Changed recipient addresses also require review. |
| P1 | Changing approval to rejection left the AMS Access transfer pending. | Cancel that queue entry in the decision transaction; the drain also checks current eligibility for legacy entries. |
| P2 | An older AMS transfer could overwrite the queue state written by a newer correction. | Record success or failure only if the captured job's Firestore update time still matches. |
| P2 | Permanently invalid email caused the worker to end its batch repeatedly, delaying valid messages behind it. | Move permanent message rejections to review and continue processing other messages. Account and rate-limit errors remain retryable. |
| P2 | A delayed confirmation claimed the candidate was awaiting review even after a decision. | Describe receipt status at submission and explain that subsequent decisions take precedence. |

Also bounded AMS network requests and drain work, replaced its whole-outbox status
read with aggregate counts and a limited failure query, and included reminder
backfill time in the email worker's processing budget.

Verification: 147 unit/route tests and 33 Firestore emulator tests passed. The
new regression cases reproduced failures before the fixes. Production build,
TypeScript and lint checks passed. External Resend and AMS APIs were mocked;
no real messages, transfers or deployment occurred. Browser/Lighthouse checks
were not repeated for these server-side fixes.

Existing limitations: checks cannot retract a message or transfer already in
flight or accepted by the remote provider. Ambiguous sends require reconciliation,
and already scheduled emails require cancellation in Resend when appropriate.
See [the email runbook](../email-setup.md). Production credentials, delivery and
cron execution still require verification after setup.
