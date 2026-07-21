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
