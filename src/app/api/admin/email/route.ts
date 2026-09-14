import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import { ADMIN_CSRF_COOKIE, ADMIN_SESSION_COOKIE, requestHasSameOrigin, secureTokenEqual } from "@/lib/adminSecurity";
import { processEmailQueue } from "@/lib/email/worker";

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const session = await verifyAdminSessionValue(request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "");
  if (!session || session.role !== "OWNER") return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  if (!requestHasSameOrigin(request) || !secureTokenEqual(request.headers.get("x-csrf-token") || "", request.cookies.get(ADMIN_CSRF_COOKIE)?.value || "") || !request.headers.get("x-csrf-token")) {
    return NextResponse.json({ error: "Request not accepted." }, { status: 403 });
  }
  try {
    return NextResponse.json(await processEmailQueue(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Email processing failed; queued messages are retained." }, { status: 503 });
  }
}
