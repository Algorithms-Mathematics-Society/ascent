import { randomUUID } from "node:crypto";
import { adminRoleFromClaims } from "../src/lib/adminSecurity";
import {
  adminAuth,
  adminDb,
  adminServerTimestamp,
} from "../src/lib/firebaseAdmin";

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
    (action !== "grant" && action !== "revoke") ||
    !email ||
    (action === "grant" && role !== "owner" && role !== "reviewer") ||
    reason.length < 10 ||
    reason.length > 500
  ) {
    throw new Error(
      "Usage: npm run admin:role -- grant administrator@example.com <owner|reviewer> \"reason for access\"\n       npm run admin:role -- revoke administrator@example.com \"reason for revocation\"",
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
