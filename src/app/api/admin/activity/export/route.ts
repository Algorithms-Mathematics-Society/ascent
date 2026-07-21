import { type NextRequest, NextResponse } from "next/server";
import {
  adminActivityCsv,
  filterAdminActivity,
  type AdminActivityCategory,
  type AdminActivityFilters,
  type AdminActivityRange,
} from "@/lib/adminActivity";
import { getLatestAdminActivity } from "@/lib/adminActivityData";
import { verifyAdminSessionValue } from "@/lib/adminAuth";
import { ADMIN_SESSION_COOKIE } from "@/lib/adminSecurity";

function activityCategory(value: string): AdminActivityCategory {
  return value === "DECISIONS" || value === "OPERATIONS" || value === "SYSTEM"
    ? value
    : "ALL";
}

function activityRange(value: string): AdminActivityRange {
  return value === "24H" || value === "7D" || value === "30D"
    ? value
    : "ALL";
}

function parseFilters(request: NextRequest): AdminActivityFilters {
  return {
    query: request.nextUrl.searchParams.get("q") || "",
    category: activityCategory(
      request.nextUrl.searchParams.get("category") || "",
    ),
    range: activityRange(request.nextUrl.searchParams.get("range") || ""),
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

  const activity = filterAdminActivity(
    await getLatestAdminActivity(),
    parseFilters(request),
  );
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return new NextResponse(`\uFEFF${adminActivityCsv(activity)}`, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="ascent-admin-activity-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
