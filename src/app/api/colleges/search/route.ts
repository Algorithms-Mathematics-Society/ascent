import { type NextRequest, NextResponse } from "next/server";
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

  const ipLimit = await checkSlidingWindow(
    adminDb,
    "_rate_limits_search",
    ipHash,
    SEARCH_RATE_LIMIT_MAX_PER_MINUTE,
    SEARCH_RATE_LIMIT_WINDOW_MS,
  );
  // Every request against this public, unauthenticated, high-frequency
  // endpoint counts toward the window (there's no separate "success vs
  // failure" concept here the way there is for a registration write), so
  // record it unconditionally rather than only on the over-limit branch -
  // otherwise the window's timestamp list never grows and the limit can
  // never trip.
  await ipLimit.recordFailure();
  if (ipLimit.overLimit) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }

  const rawQuery = (req.nextUrl.searchParams.get("q") || "")
    .trim()
    .toLowerCase();
  if (rawQuery.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const tokens = rawQuery.split(/[^a-z0-9]+/).filter(Boolean);
  const lastToken = tokens[tokens.length - 1] ?? "";
  if (lastToken.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const snap = await adminDb
      .collection("colleges")
      .where("active", "==", true)
      .where("search_terms", "array-contains", lastToken)
      .limit(10)
      .get();

    const results = snap.docs.map((docSnap) => ({
      college_id: docSnap.id,
      canonical_name: docSnap.data().canonical_name as string,
      campus: (docSnap.data().campus as string | null) ?? null,
      tier: docSnap.data().tier as "AUTO_QUALIFY" | "STANDARD",
    }));

    return NextResponse.json({ results });
  } catch (error) {
    logger.error(
      "colleges_search",
      "query_failed",
      { reqId, actorId: ipHash, status: "degraded" },
      error,
    );
    return NextResponse.json({ results: [] });
  }
}
