import { NextRequest, NextResponse } from "next/server";
import { STATUS_COOKIE } from "@/lib/candidate/tokens";
import { getCandidateStatus } from "@/lib/candidate/status";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
  try {
    const status = await getCandidateStatus(request.cookies.get(STATUS_COOKIE)?.value);
    return NextResponse.json(status ? { ok: true, entry: status } : { error: "Your status session has expired. Request a new email link." }, { status: status ? 200 : 401, headers });
  } catch { return NextResponse.json({ error: "Status is temporarily unavailable. Please try again later." }, { status: 503, headers }); }
}
