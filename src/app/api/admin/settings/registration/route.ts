import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  requestHasSameOrigin,
  secureTokenEqual,
} from "@/lib/adminSecurity";
import { adminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import {
  parseRegistrationSettingsInput,
  registrationSettingsFromData,
} from "@/lib/registrationSettings";

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

async function authorize(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return null;
  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  return verifyAdminSessionValue(sessionValue);
}

export async function PATCH(request: NextRequest) {
  const session = await authorize(request);
  if (!session) {
    return noStoreJson(
      { success: false, error: "Your admin session has expired." },
      401,
    );
  }
  if (session.role !== "OWNER") {
    return noStoreJson(
      { success: false, error: "Owner access is required to change settings." },
      403,
    );
  }
  const body = await readJson(request);
  if (!body || !csrfMatches(request, body.csrfToken)) {
    return noStoreJson(
      { success: false, error: "Registration settings could not be saved." },
      403,
    );
  }

  const applicationCount = (
    await adminDb.collection("applications").count().get()
  ).data().count;
  const parsed = parseRegistrationSettingsInput(body, applicationCount);
  if (!parsed.ok) {
    return noStoreJson({ success: false, error: parsed.error }, 422);
  }

  const settingsRef = adminDb.collection("admin_config").doc("registration");
  const auditRef = adminDb
    .collection("audit_log")
    .doc(`admin_registration_settings_${randomUUID()}`);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const settingsDocument = await transaction.get(settingsRef);
      const previous = registrationSettingsFromData(
        settingsDocument.data(),
        applicationCount,
      );
      if (previous.revision !== parsed.value.expectedRevision) {
        return { kind: "conflict" as const };
      }
      const revision = previous.revision + 1;
      const timestamp = adminServerTimestamp();
      transaction.set(settingsRef, {
        is_open: parsed.value.isOpen,
        deadline: parsed.value.deadline,
        capacity: parsed.value.capacity,
        accepted_count: Math.max(previous.acceptedCount, applicationCount),
        retention_days: parsed.value.retentionDays,
        revision,
        updated_at: timestamp,
        updated_by: session.uid,
        updated_by_email: session.email,
      });
      transaction.create(auditRef, {
        event: "ADMIN_REGISTRATION_SETTINGS_UPDATED",
        actor: `admin:${session.uid}`,
        actor_email: session.email,
        reason: parsed.value.reason,
        previous_settings: {
          is_open: previous.isOpen,
          deadline: previous.deadline,
          capacity: previous.capacity,
          retention_days: previous.retentionDays,
        },
        settings: {
          is_open: parsed.value.isOpen,
          deadline: parsed.value.deadline,
          capacity: parsed.value.capacity,
          retention_days: parsed.value.retentionDays,
        },
        timestamp,
      });
      return { kind: "updated" as const, revision };
    });

    if (result.kind === "conflict") {
      return noStoreJson(
        {
          success: false,
          error: "Settings changed in another tab. Refresh and review them again.",
        },
        409,
      );
    }
    revalidatePath("/admin/settings");
    revalidatePath("/admin/activity");
    revalidatePath("/register");
    return noStoreJson({
      success: true,
      revision: result.revision,
      message: parsed.value.isOpen
        ? "Registration controls saved."
        : "Registration is now closed to new submissions.",
    });
  } catch (error) {
    console.error("admin_registration_settings_failed", {
      adminUid: session.uid,
      error,
    });
    return noStoreJson(
      {
        success: false,
        error: "Registration settings could not be saved. Nothing was changed.",
      },
      500,
    );
  }
}
