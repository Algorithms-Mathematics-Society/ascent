import { FieldValue } from "firebase-admin/firestore";
import { type NextRequest, NextResponse } from "next/server";
import {
  EDITION,
  IP_RATE_LIMIT_MAX_PER_HOUR,
  SESSION_COOKIE_NAME,
} from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import logger, { genReqId, maskEmail } from "@/lib/logger";
import { checkSlidingWindow, sha256 } from "@/lib/rateLimit";
import { verifySessionCookie } from "@/lib/session";
import { validateHandle } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const reqId = genReqId();
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const clientIp =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown";
  const ipHash = sha256(clientIp);
  const ipLimit = await checkSlidingWindow(
    adminDb,
    "_rate_limits",
    ipHash,
    IP_RATE_LIMIT_MAX_PER_HOUR,
    60 * 60 * 1000,
  );
  if (ipLimit.overLimit) {
    logger.warn("register_handle", "ip_soft_throttle", {
      reqId,
      actorId: ipHash,
      status: "blocked",
    });
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const handle = typeof body.handle === "string" ? body.handle : "";
  const collegeId =
    typeof body.college_id === "string" ? body.college_id : null;
  const unlistedName =
    typeof body.unlisted_name === "string" ? body.unlisted_name : null;

  const handleResult = validateHandle(handle);
  if (!handleResult.valid) {
    await ipLimit.recordFailure();
    return NextResponse.json(
      { error: handleResult.error, field: "handle" },
      { status: 400 },
    );
  }
  if (!collegeId && !unlistedName) {
    await ipLimit.recordFailure();
    return NextResponse.json(
      { error: "Select a college or mark it as unlisted.", field: "college" },
      { status: 400 },
    );
  }

  const uid = session.uid;
  const applicationRef = adminDb.collection("applications").doc(uid);
  const existing = await applicationRef.get();
  if (existing.exists) {
    return NextResponse.json({ success: true, state: existing.data()?.state });
  }

  let collegeTier: "AUTO_QUALIFY" | "STANDARD" | "UNLISTED" = "UNLISTED";
  let collegeIdToStore: string | null = null;
  if (collegeId) {
    const collegeSnap = await adminDb
      .collection("colleges")
      .doc(collegeId)
      .get();
    if (!collegeSnap.exists || collegeSnap.data()?.active !== true) {
      await ipLimit.recordFailure();
      return NextResponse.json(
        { error: "Select a valid college from the list.", field: "college" },
        { status: 400 },
      );
    }
    collegeTier = collegeSnap.data()?.tier;
    collegeIdToStore = collegeId;
  }

  const handleLower = handle.trim().toLowerCase();
  const handleRef = adminDb
    .collection("handles")
    .doc(`${EDITION}_${handleLower}`);

  let written = false;
  try {
    written = await adminDb.runTransaction(async (tx) => {
      const handleDoc = await tx.get(handleRef);
      if (handleDoc.exists) {
        return false;
      }
      tx.set(handleRef, { uid, registered_at: FieldValue.serverTimestamp() });
      tx.set(applicationRef, {
        edition: EDITION,
        state: "EMAIL_VERIFIED",
        handle: handle.trim(),
        college_id: collegeIdToStore,
        college_tier: collegeTier,
        year_of_study: null,
        graduation_year: null,
        status: null,
        skills: null,
        qualification_path: "UNDETERMINED",
        qualification_reason: null,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      tx.set(adminDb.collection("pii").doc(uid), {
        legal_name: "",
        email: session.email || "",
        email_masked: session.email ? maskEmail(session.email) : "",
        phone: null,
        resume_ref: null,
        college_email: null,
      });
      return true;
    });
  } catch (error) {
    logger.error(
      "register_handle",
      "transaction_failed",
      { reqId, actorId: uid, status: "failed" },
      error,
    );
    return NextResponse.json(
      { error: "Registration failed. Try again." },
      { status: 500 },
    );
  }

  if (!written) {
    await ipLimit.recordFailure();
    return NextResponse.json(
      { error: "This handle is already taken.", field: "handle" },
      { status: 409 },
    );
  }

  if (collegeTier === "UNLISTED" && unlistedName) {
    await adminDb.collection("unlisted_college_submissions").add({
      uid,
      typed_name: unlistedName.trim(),
      submitted_at: FieldValue.serverTimestamp(),
    });
  }

  logger.info("register_handle", "handle_registered", {
    reqId,
    entityId: uid,
    status: "ok",
  });
  return NextResponse.json({ success: true, state: "EMAIL_VERIFIED" });
}
