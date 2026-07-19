import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { createSessionCookie } from "@/lib/session";
import {
  SESSION_COOKIE_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
} from "@/lib/constants";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const idToken = body?.idToken;
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "Missing idToken." }, { status: 400 });
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401 },
    );
  }

  const AUTH_TIME_MAX_AGE_MS = 5 * 60 * 1000;
  const authTimeMs = decodedToken.auth_time * 1000;
  if (Date.now() - authTimeMs > AUTH_TIME_MAX_AGE_MS) {
    return NextResponse.json(
      { error: "Sign-in session too old. Please sign in again." },
      { status: 401 },
    );
  }
  if (!decodedToken.email_verified) {
    return NextResponse.json({ error: "Email not verified." }, { status: 401 });
  }

  let cookie: string;
  try {
    cookie = await createSessionCookie(idToken);
  } catch {
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
