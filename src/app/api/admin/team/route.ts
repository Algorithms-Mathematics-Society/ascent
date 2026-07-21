import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  adminRoleFromClaims,
  requestHasSameOrigin,
  secureTokenEqual,
  type AdminRole,
} from "@/lib/adminSecurity";
import { adminAuth, adminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import { activeOwnerCount, parseAdminTeamMutation } from "@/lib/adminTeam";
import { getAdminTeamMembers } from "@/lib/adminTeamData";

const MAX_REQUEST_BYTES = 20 * 1024;

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
    const body = (await request.json()) as unknown;
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function csrfMatches(request: NextRequest, submittedToken: unknown) {
  const cookieToken = request.cookies.get(ADMIN_CSRF_COOKIE)?.value;
  return (
    typeof submittedToken === "string" &&
    typeof cookieToken === "string" &&
    secureTokenEqual(submittedToken, cookieToken)
  );
}

function authErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return typeof error.code === "string" ? error.code : "";
}

async function createAccessAudit(
  event: string,
  actor: { uid: string; email: string },
  target: { uid: string; email: string },
  fields: Record<string, unknown>,
) {
  const reference = adminDb
    .collection("audit_log")
    .doc(`admin_access_${randomUUID()}`);
  await reference.create({
    event,
    actor: `admin:${actor.uid}`,
    actor_email: actor.email,
    target_uid: target.uid,
    target_email: target.email,
    timestamp: adminServerTimestamp(),
    ...fields,
  });
  return reference;
}

async function authorize(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return null;
  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  return verifyAdminSessionValue(sessionValue);
}

export async function POST(request: NextRequest) {
  const session = await authorize(request);
  if (!session) {
    return noStoreJson(
      { success: false, error: "Your admin session has expired." },
      401,
    );
  }
  if (session.role !== "OWNER") {
    return noStoreJson(
      { success: false, error: "Owner access is required to manage administrators." },
      403,
    );
  }

  const body = await readJson(request);
  if (!body || !csrfMatches(request, body.csrfToken)) {
    return noStoreJson(
      { success: false, error: "Administrator access could not be changed." },
      403,
    );
  }
  const parsed = parseAdminTeamMutation(body);
  if (!parsed.ok) return noStoreJson({ success: false, error: parsed.error }, 422);

  try {
    if (parsed.value.action === "GRANT_ACCESS") {
      let target;
      try {
        target = await adminAuth.getUserByEmail(parsed.value.email);
      } catch (error) {
        if (authErrorCode(error) === "auth/user-not-found") {
          return noStoreJson(
            {
              success: false,
              error:
                "No Firebase account uses that email. Create the account first, then grant access here.",
            },
            404,
          );
        }
        throw error;
      }
      const previousClaims = { ...(target.customClaims ?? {}) };
      if (target.disabled) {
        return noStoreJson(
          {
            success: false,
            error: "That Firebase account is disabled. Enable it before granting access.",
          },
          409,
        );
      }
      if (adminRoleFromClaims(previousClaims)) {
        return noStoreJson(
          { success: false, error: "That account already has administrator access." },
          409,
        );
      }
      const nextClaims = {
        ...previousClaims,
        ascent_admin: true,
        ascent_admin_role: parsed.value.role.toLocaleLowerCase(),
      };
      await adminAuth.setCustomUserClaims(target.uid, nextClaims);
      await adminAuth.revokeRefreshTokens(target.uid);
      try {
        await createAccessAudit(
          "ADMIN_ACCESS_GRANTED",
          session,
          { uid: target.uid, email: parsed.value.email },
          { role: parsed.value.role, reason: parsed.value.reason },
        );
      } catch (error) {
        await adminAuth.setCustomUserClaims(target.uid, previousClaims);
        await adminAuth.revokeRefreshTokens(target.uid);
        throw error;
      }
      revalidatePath("/admin/team");
      revalidatePath("/admin/activity");
      return noStoreJson({
        success: true,
        message: `${parsed.value.role === "OWNER" ? "Owner" : "Reviewer"} access granted to ${parsed.value.email}.`,
      });
    }

    const target = await adminAuth.getUser(parsed.value.targetUid);
    const targetEmail = target.email?.toLocaleLowerCase() ?? "";
    const currentRole = adminRoleFromClaims(target.customClaims ?? {});
    if (targetEmail !== parsed.value.targetEmail || !currentRole) {
      return noStoreJson(
        { success: false, error: "Administrator details changed. Refresh this page." },
        409,
      );
    }
    if (currentRole !== parsed.value.expectedRole) {
      return noStoreJson(
        { success: false, error: "Administrator role changed. Refresh this page." },
        409,
      );
    }
    if (target.uid === session.uid) {
      return noStoreJson(
        {
          success: false,
          error:
            "You cannot change or revoke your own access here. Ask another owner to do it.",
        },
        409,
      );
    }

    if (
      currentRole === "OWNER" &&
      (parsed.value.action === "REVOKE_ACCESS" ||
        (parsed.value.action === "CHANGE_ROLE" && parsed.value.role === "REVIEWER"))
    ) {
      const members = await getAdminTeamMembers();
      if (activeOwnerCount(members) <= 1) {
        return noStoreJson(
          {
            success: false,
            error: "Keep at least one enabled owner before removing owner access.",
          },
          409,
        );
      }
    }

    if (parsed.value.action === "REVOKE_SESSIONS") {
      const audit = await createAccessAudit(
        "ADMIN_SESSIONS_REVOKED",
        session,
        { uid: target.uid, email: targetEmail },
        { role: currentRole, reason: parsed.value.reason },
      );
      try {
        await adminAuth.revokeRefreshTokens(target.uid);
      } catch (error) {
        await audit.delete().catch(() => undefined);
        throw error;
      }
      revalidatePath("/admin/team");
      revalidatePath("/admin/activity");
      return noStoreJson({
        success: true,
        message: `Every active session for ${targetEmail} has been revoked.`,
      });
    }

    const previousClaims = { ...(target.customClaims ?? {}) };
    const nextClaims: Record<string, unknown> = { ...previousClaims };
    let event: string;
    let nextRole: AdminRole | null;
    if (parsed.value.action === "CHANGE_ROLE") {
      nextRole = parsed.value.role;
      nextClaims.ascent_admin = true;
      nextClaims.ascent_admin_role = nextRole.toLocaleLowerCase();
      event = "ADMIN_ROLE_CHANGED";
    } else {
      nextRole = null;
      delete nextClaims.ascent_admin;
      delete nextClaims.ascent_admin_role;
      event = "ADMIN_ACCESS_REVOKED";
    }

    await adminAuth.setCustomUserClaims(target.uid, nextClaims);
    await adminAuth.revokeRefreshTokens(target.uid);
    try {
      await createAccessAudit(
        event,
        session,
        { uid: target.uid, email: targetEmail },
        {
          previous_role: currentRole,
          role: nextRole,
          reason: parsed.value.reason,
        },
      );
    } catch (error) {
      await adminAuth.setCustomUserClaims(target.uid, previousClaims);
      await adminAuth.revokeRefreshTokens(target.uid);
      throw error;
    }

    revalidatePath("/admin/team");
    revalidatePath("/admin/activity");
    return noStoreJson({
      success: true,
      message:
        parsed.value.action === "CHANGE_ROLE"
          ? `${targetEmail} is now a ${nextRole === "OWNER" ? "competition owner" : "reviewer"}.`
          : `Administrator access revoked for ${targetEmail}.`,
    });
  } catch (error) {
    console.error("admin_team_operation_failed", {
      adminUid: session.uid,
      action: parsed.value.action,
      error,
    });
    return noStoreJson(
      {
        success: false,
        error: "The administrator change could not be completed. Refresh and try again.",
      },
      500,
    );
  }
}
