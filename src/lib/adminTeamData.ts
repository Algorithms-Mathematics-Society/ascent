import "server-only";

import { adminAuth } from "@/lib/firebaseAdmin";
import { adminRoleFromClaims } from "@/lib/adminSecurity";
import type { AdminTeamMember } from "@/lib/adminTeam";

export async function getAdminTeamMembers(): Promise<AdminTeamMember[]> {
  const members: AdminTeamMember[] = [];
  let pageToken: string | undefined;

  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const role = adminRoleFromClaims(user.customClaims ?? {});
      if (!role) continue;
      members.push({
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
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return members.sort((left, right) => {
    if (left.role !== right.role) return left.role === "OWNER" ? -1 : 1;
    return left.email.localeCompare(right.email);
  });
}
