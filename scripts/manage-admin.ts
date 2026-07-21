import { adminAuth } from "../src/lib/firebaseAdmin";

async function main() {
  const [action, rawEmail] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();

  if ((action !== "grant" && action !== "revoke") || !email) {
    throw new Error(
      "Usage: npm run admin:role -- <grant|revoke> administrator@example.com",
    );
  }

  const user = await adminAuth.getUserByEmail(email);
  const claims: Record<string, unknown> = { ...(user.customClaims ?? {}) };

  if (action === "grant") claims.ascent_admin = true;
  else delete claims.ascent_admin;

  await adminAuth.setCustomUserClaims(user.uid, claims);
  await adminAuth.revokeRefreshTokens(user.uid);

  console.log(
    `${action === "grant" ? "Granted" : "Revoked"} Ascent admin access for ${email}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin role update failed.");
  process.exitCode = 1;
});
