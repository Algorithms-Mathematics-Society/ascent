import { type NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import { isAdminDecision } from "@/lib/adminDecision";
import { registrationsCsv } from "@/lib/adminExport";
import { isAdminRegistrationTag } from "@/lib/adminOperations";
import {
  filterAdminRegistrations,
  type AdminRegistrationFilters,
} from "@/lib/adminRegistrationView";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminSecurity";
import { getLatestAdminRegistrations } from "@/lib/adminRegistrations";

function parseFilters(request: NextRequest): AdminRegistrationFilters {
  const decision = request.nextUrl.searchParams.get("decision") || "";
  const path = request.nextUrl.searchParams.get("path") || "";
  const tag = request.nextUrl.searchParams.get("tag") || "";
  return {
    query: request.nextUrl.searchParams.get("q") || "",
    decision: isAdminDecision(decision) ? decision : "ALL",
    path:
      path === "AUTO" || path === "QUALIFIER" || path === "UNDETERMINED"
        ? path
        : "ALL",
    tag: isAdminRegistrationTag(tag) ? tag : "ALL",
  };
}
export async function GET(request: NextRequest) {
  const sessionValue = request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  const session = await verifyAdminSessionValue(sessionValue);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Your admin session has expired." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rows = filterAdminRegistrations(
    await getLatestAdminRegistrations(),
    parseFilters(request),
  );
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  return new NextResponse(`\uFEFF${registrationsCsv(rows)}`, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="ascent-registrations-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
