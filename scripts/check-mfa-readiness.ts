import type { UserRecord } from "firebase-admin/auth";
import {
  adminMfaReadiness,
  type AdminTeamMember,
} from "../src/lib/adminTeam";
import { adminRoleFromClaims } from "../src/lib/adminSecurity";
import { adminAuth, adminDb } from "../src/lib/firebaseAdmin";

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
  const [users, signInSnapshot] = await Promise.all([
    listAllUsers(),
    adminDb.collection("audit_log").where("event", "==", "ADMIN_SIGN_IN").get(),
  ]);
  const testedUids = new Set(
    signInSnapshot.docs
      .map((document) => document.data())
      .filter((event) => event.second_factor === "totp")
      .map((event) => event.actor_uid)
      .filter((uid): uid is string => typeof uid === "string" && Boolean(uid)),
  );

  const members = users
    .map((user): AdminTeamMember | null => {
      const role = adminRoleFromClaims(user.customClaims ?? {});
      if (!role) return null;
      return {
        uid: user.uid,
        email: user.email?.toLocaleLowerCase() ?? "Email unavailable",
        role,
        disabled: user.disabled,
        emailVerified: user.emailVerified,
        createdAt: user.metadata.creationTime || null,
        lastSignInAt: user.metadata.lastSignInTime || null,
        tokensValidAfter: user.tokensValidAfterTime || null,
        factorCount:
          user.multiFactor?.enrolledFactors.filter(
            (factor) => factor.factorId === "totp",
          ).length ?? 0,
      };
    })
    .filter((member): member is AdminTeamMember => Boolean(member));

  const readiness = adminMfaReadiness(members);
  const enabledMembers = members.filter((member) => !member.disabled);
  const testedMembers = enabledMembers.filter((member) => testedUids.has(member.uid));
  const testedOwners = testedMembers.filter((member) => member.role === "OWNER");

  console.table(
    members.map((member) => ({
      email: member.email,
      role: member.role,
      enabled: !member.disabled,
      totpFactors: member.factorCount,
      freshTotpLogin: testedUids.has(member.uid),
    })),
  );
  console.log(
    JSON.stringify({
      state: readiness.state,
      protectedOwners: `${readiness.enrolledOwners}/2`,
      protectedAdmins: `${readiness.enrolledAdmins}/${readiness.enabledAdmins}`,
      testedOwners: `${testedOwners.length}/2`,
      testedAdmins: `${testedMembers.length}/${enabledMembers.length}`,
    }),
  );

  if (
    readiness.state !== "READY" ||
    testedOwners.length < 2 ||
    testedMembers.length < enabledMembers.length
  ) {
    throw new Error(
      "MFA enforcement is not ready. Enrol and fresh-login-test every enabled administrator, including two owners.",
    );
  }

  console.log("MFA enforcement preflight passed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "MFA readiness check failed.");
  process.exitCode = 1;
});
