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
target account must already exist in Firebase Authentication, and the reason
must be 10–500 characters:

```bash
npm run admin:role -- grant administrator@example.com owner "Emergency owner recovery"
npm run admin:role -- grant reviewer@example.com reviewer "Competition review team"
npm run admin:role -- revoke reviewer@example.com "Review assignment ended"
```

CLI changes are also audited. MFA enrollment is visible at `/admin/team`, but
enforcement must not be enabled until every owner has enrolled and recovery
access has been verified.
