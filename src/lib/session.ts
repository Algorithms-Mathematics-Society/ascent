import { adminAuth } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE_MAX_AGE_MS } from "@/lib/constants";

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_COOKIE_MAX_AGE_MS,
  });
}

export interface SessionUser {
  uid: string;
  email: string | null;
}

export async function verifySessionCookie(
  cookie: string,
): Promise<SessionUser | null> {
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}
