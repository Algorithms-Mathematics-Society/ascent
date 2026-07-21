import { timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "ascent_admin_session";
export const ADMIN_CSRF_COOKIE = "ascent_admin_csrf";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const ADMIN_CSRF_MAX_AGE_SECONDS = 10 * 60;
export const ADMIN_RECENT_SIGN_IN_SECONDS = 5 * 60;

export type AdminRole = "OWNER" | "REVIEWER";

export function adminRoleFromClaims(
  claims: Record<string, unknown>,
): AdminRole | null {
  if (claims.ascent_admin !== true) return null;
  if (claims.ascent_admin_role === undefined || claims.ascent_admin_role === null) {
    return "OWNER";
  }
  if (claims.ascent_admin_role === "owner") return "OWNER";
  if (claims.ascent_admin_role === "reviewer") return "REVIEWER";
  return null;
}

export function hasAdminClaim(claims: Record<string, unknown>): boolean {
  return adminRoleFromClaims(claims) !== null;
}

export function isRecentAuthentication(
  authTime: unknown,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (typeof authTime !== "number" || !Number.isFinite(authTime)) return false;
  const age = nowSeconds - authTime;
  return age >= -60 && age <= ADMIN_RECENT_SIGN_IN_SECONDS;
}

export function secureTokenEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function requestHasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestUrl = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const expectedHost =
      forwardedHost?.split(",")[0]?.trim() || requestUrl.host;
    const forwardedProtocol = request.headers.get("x-forwarded-proto");
    const expectedProtocol =
      forwardedProtocol?.split(",")[0]?.trim() || requestUrl.protocol.slice(0, -1);
    return new URL(origin).origin === `${expectedProtocol}://${expectedHost}`;
  } catch {
    return false;
  }
}
