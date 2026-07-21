import { randomBytes, randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_MAX_AGE_SECONDS,
  ADMIN_RECENT_SIGN_IN_SECONDS,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  adminSessionMeetsMfaPolicy,
  hasAdminClaim,
  isRecentAuthentication,
  requestHasSameOrigin,
  secureTokenEqual,
} from "@/lib/adminSecurity";
import { checkSlidingWindow, sha256 } from "@/lib/rateLimit";

const MAX_REQUEST_BYTES = 16 * 1024;
const ADMIN_AUTH_LIMIT = 10;
const ADMIN_AUTH_WINDOW_MS = 15 * 60 * 1000;

function secureCookie() {
  return process.env.NODE_ENV === "production";
}

function noStoreJson(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function csrfMatches(request: NextRequest, submittedToken: unknown) {
  const cookieToken = request.cookies.get(ADMIN_CSRF_COOKIE)?.value;
  return (
    typeof submittedToken === "string" &&
    typeof cookieToken === "string" &&
    secureTokenEqual(submittedToken, cookieToken)
  );
}

async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
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

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set({
    name,
    value: "",
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET() {
  const csrfToken = randomBytes(32).toString("hex");
  const response = noStoreJson({ csrfToken });
  response.cookies.set({
    name: ADMIN_CSRF_COOKIE,
    value: csrfToken,
    httpOnly: true,
    secure: secureCookie(),
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_CSRF_MAX_AGE_SECONDS,
  });
  return response;
}

export async function POST(request: NextRequest) {
  if (!requestHasSameOrigin(request)) {
    return noStoreJson({ success: false, error: "Sign-in failed." }, 403);
  }

  const body = await readJson(request);
  if (!body || !csrfMatches(request, body.csrfToken)) {
    return noStoreJson({ success: false, error: "Sign-in failed." }, 403);
  }

  const idToken = body.idToken;
  if (
    typeof idToken !== "string" ||
    idToken.length < 100 ||
    idToken.length > 12_000
  ) {
    return noStoreJson({ success: false, error: "Sign-in failed." }, 401);
  }

  let attemptLimit: Awaited<ReturnType<typeof checkSlidingWindow>>;
  try {
    attemptLimit = await checkSlidingWindow(
      adminDb,
      "_rate_limits_admin_auth",
      sha256(clientIp(request)),
      ADMIN_AUTH_LIMIT,
      ADMIN_AUTH_WINDOW_MS,
    );
  } catch {
    return noStoreJson(
      { success: false, error: "Authentication is temporarily unavailable." },
      503,
    );
  }

  if (attemptLimit.overLimit) {
    return noStoreJson(
      { success: false, error: "Too many sign-in attempts. Try again later." },
      429,
    );
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    if (
      !hasAdminClaim(decoded) ||
      !isRecentAuthentication(
        decoded.auth_time,
        Math.floor(Date.now() / 1000),
      )
    ) {
      await attemptLimit.recordFailure().catch(() => undefined);
      return noStoreJson({ success: false, error: "Sign-in failed." }, 401);
    }

    if (!adminSessionMeetsMfaPolicy(decoded)) {
      await attemptLimit.recordFailure().catch(() => undefined);
      return noStoreJson({ success: false, error: "Authenticator verification is required." }, 403);
    }

    await adminDb
      .collection("audit_log")
      .doc(`admin_sign_in_${randomUUID()}`)
      .create({
        event: "ADMIN_SIGN_IN",
        actor_uid: decoded.uid,
        actor_email: typeof decoded.email === "string" ? decoded.email : null,
        second_factor: decoded.firebase.sign_in_second_factor ?? null,
        timestamp: adminServerTimestamp(),
      });


    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
    });
    const response = noStoreJson({
      success: true,
      expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS,
      recentSignInWindow: ADMIN_RECENT_SIGN_IN_SECONDS,
    });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: sessionCookie,
      httpOnly: true,
      secure: secureCookie(),
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    clearCookie(response, ADMIN_CSRF_COOKIE);
    return response;
  } catch {
    await attemptLimit.recordFailure().catch(() => undefined);
    return noStoreJson({ success: false, error: "Sign-in failed." }, 401);
  }
}

export async function DELETE(request: NextRequest) {
  if (!requestHasSameOrigin(request)) {
    return noStoreJson({ success: false, error: "Sign-out failed." }, 403);
  }

  const body = await readJson(request);
  if (!body || !csrfMatches(request, body.csrfToken)) {
    return noStoreJson({ success: false, error: "Sign-out failed." }, 403);
  }

  const response = noStoreJson({ success: true });
  clearCookie(response, ADMIN_SESSION_COOKIE);
  clearCookie(response, ADMIN_CSRF_COOKIE);
  return response;
}
