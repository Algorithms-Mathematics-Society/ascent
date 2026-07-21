import { type NextRequest, NextResponse } from "next/server";
import { searchEligibleInstitutions } from "@/content/institutions";
import {
  SEARCH_RATE_LIMIT_MAX_PER_MINUTE,
  SEARCH_RATE_LIMIT_WINDOW_MS,
} from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import logger, { genReqId } from "@/lib/logger";
import { checkSlidingWindow, sha256 } from "@/lib/rateLimit";

export async function GET(req: NextRequest) {
  const reqId = genReqId();
  const clientIp =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";
  const ipHash = sha256(clientIp);

  const hasRateLimitStore = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT,
  );

  if (hasRateLimitStore) {
    try {
      const ipLimit = await checkSlidingWindow(
        adminDb,
        "_rate_limits_search",
        ipHash,
        SEARCH_RATE_LIMIT_MAX_PER_MINUTE,
        SEARCH_RATE_LIMIT_WINDOW_MS,
      );
      // Every request to this public endpoint counts toward the window.
      await ipLimit.recordFailure();
      if (ipLimit.overLimit) {
        return NextResponse.json(
          { results: [] },
          {
            status: 429,
            headers: {
              "Cache-Control": "private, no-store",
              "Retry-After": "60",
            },
          },
        );
      }
    } catch (error) {
      // Institution reference data is local and safe to serve if the
      // non-critical distributed limiter is temporarily unavailable.
      logger.error(
        "colleges_search",
        "rate_limit_unavailable",
        { reqId, actorId: ipHash, status: "degraded" },
        error,
      );
    }
  }

  const rawQuery = (req.nextUrl.searchParams.get("q") || "").trim();
  if (rawQuery.length < 2) {
    return NextResponse.json(
      { results: [] },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  }

  const results = searchEligibleInstitutions(rawQuery, 10).map(
    (institutionEntry) => ({
      college_id: institutionEntry.id,
      canonical_name: institutionEntry.canonical_name,
      campus: institutionEntry.campus,
      tier: institutionEntry.tier,
    }),
  );

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
