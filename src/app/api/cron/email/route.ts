import { NextRequest, NextResponse } from "next/server";
import { secureTokenEqual } from "@/lib/adminSecurity";
import { processEmailQueue } from "@/lib/email/worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !secureTokenEqual(request.headers.get("authorization") || "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    return NextResponse.json(await processEmailQueue(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Email processing failed; queued messages are retained." }, { status: 503 });
  }
}
