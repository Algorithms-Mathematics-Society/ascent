import { randomUUID } from "node:crypto";
import type { UserRecord } from "firebase-admin/auth";
import { adminRoleFromClaims } from "../src/lib/adminSecurity";
import {
  adminAuth,
  adminDb,
  adminServerTimestamp,
} from "../src/lib/firebaseAdmin";

async function listAllUsers() {
  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const result = await adminAuth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  const [action, rawEmail, roleOrReason, ...remainingReason] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  const role = action === "grant" ? roleOrReason?.trim().toLowerCase() : undefined;
  const reason = (
    action === "grant" ? remainingReason : [roleOrReason, ...remainingReason]
  )
    .filter(Boolean)
    .join(" ")
    .trim();

  if (
    (action !== "grant" && action !== "revoke" && action !== "reset-mfa") ||
    !email ||
    (action === "grant" && role !== "owner" && role !== "reviewer") ||
    reason.length < 10 ||
    reason.length > 500
  ) {
    throw new Error(
      "Usage: npm run admin:role -- grant administrator@example.com <owner|reviewer> \"reason for access\"\n       npm run admin:role -- revoke administrator@example.com \"reason for revocation\"\n       npm run admin:role -- reset-mfa administrator@example.com \"verified recovery reason\"",
    );
  }

  const user = await adminAuth.getUserByEmail(email);
  if (action === "grant" && !user.emailVerified) {
    throw new Error(
      `Verify the Firebase Authentication email for ${email} before granting admin access.`,
    );
  }
  const claims: Record<string, unknown> = { ...(user.customClaims ?? {}) };
  const previousClaims = { ...claims };
  const previousRole = adminRoleFromClaims(claims);

  if (action === "reset-mfa") {
    const factors = user.multiFactor?.enrolledFactors ?? [];
    if (!previousRole) {
      throw new Error(`${email} does not have Ascent administrator access.`);
    }
    if (factors.length === 0) {
      throw new Error(`${email} has no enrolled MFA factors to reset.`);
    }

    const recoveryOwners = (await listAllUsers()).filter(
      (candidate) =>
        candidate.uid !== user.uid &&
        !candidate.disabled &&
        candidate.emailVerified &&
        adminRoleFromClaims(candidate.customClaims ?? {}) === "OWNER" &&
        (candidate.multiFactor?.enrolledFactors.length ?? 0) > 0,
    );
    if (recoveryOwners.length === 0) {
      throw new Error(
        "MFA reset refused: another enabled, verified owner with MFA is required.",
      );
    }

    const auditRef = adminDb
      .collection("audit_log")
      .doc(`admin_mfa_reset_${randomUUID()}`);
    await auditRef.create({
      event: "ADMIN_MFA_RESET_REQUESTED",
      actor: "cli:manage-admin",
      target_uid: user.uid,
      target_email: email,
      role: previousRole,
      factor_count: factors.length,
      recovery_owner_count: recoveryOwners.length,
      reason,
      timestamp: adminServerTimestamp(),
    });

    try {
      await adminAuth.updateUser(user.uid, {
        multiFactor: { enrolledFactors: null },
      });
      await adminAuth.revokeRefreshTokens(user.uid);
      await auditRef.update({
        event: "ADMIN_MFA_RESET",
        completed_at: adminServerTimestamp(),
      });
    } catch (error) {
      await auditRef
        .update({
          event: "ADMIN_MFA_RESET_FAILED",
          completed_at: adminServerTimestamp(),
        })
        .catch(() => undefined);
      throw error;
    }

    console.log(`Reset MFA and revoked every session for ${email}.`);
    return;
  }

  if (action === "grant") {
    claims.ascent_admin = true;
    claims.ascent_admin_role = role;
  } else {
    delete claims.ascent_admin;
    delete claims.ascent_admin_role;
  }

  await adminAuth.setCustomUserClaims(user.uid, claims);
  await adminAuth.revokeRefreshTokens(user.uid);

  try {
    await adminDb
      .collection("audit_log")
      .doc(`admin_access_${randomUUID()}`)
      .create({
        event:
          action === "revoke"
            ? "ADMIN_ACCESS_REVOKED"
            : previousRole
              ? "ADMIN_ROLE_CHANGED"
              : "ADMIN_ACCESS_GRANTED",
        actor: "cli:manage-admin",
        target_uid: user.uid,
        target_email: email,
        previous_role: previousRole,
        role: action === "grant" ? role?.toUpperCase() : null,
        reason,
        timestamp: adminServerTimestamp(),
      });
  } catch (error) {
    await adminAuth.setCustomUserClaims(user.uid, previousClaims);
    await adminAuth.revokeRefreshTokens(user.uid);
    throw error;
  }

  console.log(
    action === "grant"
      ? `Granted ${role} access to ${email}.`
      : `Revoked Ascent admin access for ${email}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin role update failed.");
  process.exitCode = 1;
});
