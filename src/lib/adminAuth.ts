import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebaseAdmin";
import {
  ADMIN_SESSION_COOKIE,
  hasAdminClaim,
} from "@/lib/adminSecurity";

export interface AdminSession {
  uid: string;
  email: string;
}

export async function verifyAdminSessionValue(
  sessionCookie: string,
): Promise<AdminSession | null> {
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (!hasAdminClaim(decoded)) return null;

    return {
      uid: decoded.uid,
      email:
        typeof decoded.email === "string" ? decoded.email : "Administrator",
    };
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const value = cookies().get(ADMIN_SESSION_COOKIE)?.value;
  return value ? verifyAdminSessionValue(value) : null;
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin-page-login");
  return session;
}
