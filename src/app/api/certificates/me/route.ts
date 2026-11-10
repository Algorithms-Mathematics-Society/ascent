import { NextRequest, NextResponse } from "next/server";
import { certificateSummaryForSession } from "@/lib/certificates/data";
import { CERTIFICATE_COOKIE } from "@/lib/certificates/tokens";

export const dynamic = "force-dynamic";
function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function GET(request: NextRequest) {
  try {
    const certificate = await certificateSummaryForSession(request.cookies.get(CERTIFICATE_COOKIE)?.value);
    if (!certificate) {
      const response = reply({ error: "Your session has expired. Request a new code." }, 401);
      if (request.cookies.has(CERTIFICATE_COOKIE)) response.cookies.set(CERTIFICATE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
      return response;
    }
    return reply({ ok: true, certificate });
  } catch { return reply({ error: "Could not load your certificate. Please try again." }, 503); }
}
