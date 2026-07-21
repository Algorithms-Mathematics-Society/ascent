import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import { adminAuth, adminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import {
  ADMIN_SESSION_COOKIE,
  hasAdminClaim,
  isRecentAuthentication,
  requestHasSameOrigin,
} from "@/lib/adminSecurity";

const MAX_REQUEST_BYTES = 16 * 1024;

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readJson(request: NextRequest) {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_REQUEST_BYTES) return null;
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return null;
  }
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!requestHasSameOrigin(request)) {
    return noStoreJson({ success: false, error: "MFA setup failed." }, 403);
  }

  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = sessionValue
    ? await verifyAdminSessionValue(sessionValue)
    : null;
  if (!session) {
    return noStoreJson({ success: false, error: "Your admin session expired." }, 401);
  }

  const body = await readJson(request);
  const action = body?.action;
  const idToken = body?.idToken;
  if (
    (action !== "AUTHORIZE" && action !== "COMPLETE") ||
    typeof idToken !== "string" ||
    idToken.length < 100 ||
    idToken.length > 12_000
  ) {
    return noStoreJson({ success: false, error: "MFA setup failed." }, 400);
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    if (
      decoded.uid !== session.uid ||
      decoded.email_verified !== true ||
      !hasAdminClaim(decoded) ||
      !isRecentAuthentication(decoded.auth_time)
    ) {
      return noStoreJson({ success: false, error: "Re-authentication failed." }, 403);
    }

    const user = await adminAuth.getUser(decoded.uid);
    const totpFactors =
      user.multiFactor?.enrolledFactors.filter((factor) => factor.factorId === "totp") ?? [];

    if (action === "AUTHORIZE") {
      if (totpFactors.length > 0) {
        return noStoreJson(
          { success: false, error: "An authenticator is already enrolled." },
          409,
        );
      }
      return noStoreJson({ success: true });
    }

    if (totpFactors.length === 0) {
      return noStoreJson(
        { success: false, error: "Firebase has not confirmed the authenticator yet." },
        409,
      );
    }

    await adminDb.collection("audit_log").doc(`admin_mfa_${randomUUID()}`).create({
      event: "ADMIN_MFA_ENROLLED",
      actor_uid: session.uid,
      actor_email: session.email,
      target_uid: session.uid,
      target_email: session.email,
      factor: "TOTP",
      factor_count: totpFactors.length,
      timestamp: adminServerTimestamp(),
    });

    return noStoreJson({ success: true });
  } catch {
    return noStoreJson({ success: false, error: "MFA setup failed." }, 401);
  }
}
