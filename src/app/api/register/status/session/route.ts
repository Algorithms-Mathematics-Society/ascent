import { NextRequest, NextResponse } from "next/server";
import { requestHasSameOrigin } from "@/lib/adminSecurity";
import { readBoundedJson, RequestBodyTooLarge } from "@/lib/requestBody";
import { adminDb } from "@/lib/firebaseAdmin";
import { sha256, consumeSlidingWindow } from "@/lib/rateLimit";
import { clientIp } from "@/lib/botProtection";
import { verifyStatusToken, signStatusToken, STATUS_COOKIE, STATUS_TTL_SECONDS } from "@/lib/candidate/tokens";
import { normalizeEmail } from "@/lib/validators";

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
export async function POST(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return reply({ error: "Request not accepted." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return reply({ error: "Invalid request." }, 415);
  try {
    const limit = await consumeSlidingWindow(adminDb, "_rate_limits_status_exchange", sha256(clientIp(request)), 60, 3600000);
    if (limit.overLimit) return reply({ error: "Too many attempts. Please try again later." }, 429);
    const body = await readBoundedJson(request, 2048) as { token?: unknown };
    const claims = verifyStatusToken(body?.token, "link");
    if (!claims) return reply({ error: "This link is invalid or expired. Request a new email below." }, 401);
    const ref = adminDb.collection("candidate_access_tokens").doc(sha256(body.token as string));
    const consumed = await adminDb.runTransaction(async tx => {
      const [token, application, pii] = await tx.getAll(ref, adminDb.collection("applications").doc(claims.subject), adminDb.collection("pii").doc(claims.subject));
      const address = pii.data()?.email;
      const email = normalizeEmail(typeof address === "string" ? address : "");
      if (!token.exists || token.data()?.used_at || token.data()?.subject_id !== claims.subject || token.data()?.expires_at <= Date.now() ||
        !application.exists || application.data()?.state === "DELETED" || !email.normalized || sha256(email.normalized) !== claims.emailHash) return false;
      tx.update(ref, { used_at: Date.now() });
      return true;
    });
    if (!consumed) return reply({ error: "This link is invalid, expired or already used. Request a new email below." }, 401);
    const session = signStatusToken("session", claims.subject, claims.emailHash);
    const response = reply({ ok: true });
    response.cookies.set(STATUS_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: STATUS_TTL_SECONDS });
    return response;
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) return reply({ error: "The request is too large." }, 413);
    if (error instanceof SyntaxError) return reply({ error: "Invalid request." }, 400);
    return reply({ error: "Could not open this status link. Please try again." }, 503);
  }
}
export async function DELETE(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return reply({ error: "Request not accepted." }, 403);
  const response = reply({ ok: true });
  response.cookies.set(STATUS_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
