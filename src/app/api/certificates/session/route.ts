import { NextRequest, NextResponse } from "next/server";
import { requestHasSameOrigin } from "@/lib/adminSecurity";
import { CERTIFICATE_COOKIE } from "@/lib/certificates/tokens";

export const maxDuration = 30;
function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function DELETE(request: NextRequest) {
  if (!requestHasSameOrigin(request)) return reply({ error: "Request not accepted." }, 403);
  const response = reply({ ok: true });
  response.cookies.set(CERTIFICATE_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
