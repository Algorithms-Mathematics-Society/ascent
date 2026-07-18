import { type NextRequest, NextResponse } from "next/server";
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
