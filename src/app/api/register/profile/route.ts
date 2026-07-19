import { FieldValue } from "firebase-admin/firestore";
import { type NextRequest, NextResponse } from "next/server";
import {
  EDITION,
  MAX_RESUME_BYTES,
  SESSION_COOKIE_NAME,
} from "@/lib/constants";
import { adminDb, adminStorage } from "@/lib/firebaseAdmin";
import logger, { genReqId } from "@/lib/logger";
import {
  determinePath,
  type QualificationResult,
} from "@/lib/qualificationEngine";
import { checkSlidingWindow, sha256 } from "@/lib/rateLimit";
import { verifySessionCookie } from "@/lib/session";
import { normalizeIndianPhone, validateResumeBuffer } from "@/lib/validators";

const VALID_STATUSES = ["STUDENT", "PROFESSIONAL", "OTHER"];

export async function POST(req: NextRequest) {
  const reqId = genReqId();
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = cookie ? await verifySessionCookie(cookie) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const uid = session.uid;

  const applicationRef = adminDb.collection("applications").doc(uid);
  const applicationSnap = await applicationRef.get();
  if (!applicationSnap.exists) {
    return NextResponse.json(
      { error: "Complete the handle step first." },
      { status: 400 },
    );
  }
  const application = applicationSnap.data()!;
  if (application.state === "QUALIFICATION_DETERMINED") {
    return NextResponse.json({
      success: true,
      state: application.state,
      qualification_path: application.qualification_path,
    });
  }

  const formData = await req.formData();
  const yearOfStudy = formData.get("year_of_study");
  const status = formData.get("status");
  const phoneRaw = formData.get("phone");
  const graduationYearRaw = formData.get("graduation_year");
  const resumeFile = formData.get("resume");

  if (typeof phoneRaw !== "string") {
    return NextResponse.json(
      { error: "Phone number is required.", field: "phone" },
      { status: 400 },
    );
  }
  const phoneResult = normalizeIndianPhone(phoneRaw);
  if (!phoneResult.valid || !phoneResult.e164) {
    return NextResponse.json(
      { error: phoneResult.error, field: "phone" },
      { status: 400 },
    );
  }
  if (typeof status !== "string" || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Select a valid status.", field: "status" },
      { status: 400 },
    );
  }
  if (!(resumeFile instanceof File)) {
    return NextResponse.json(
      { error: "Resume is required.", field: "resume" },
      { status: 400 },
    );
  }
  const resumeBuffer = Buffer.from(await resumeFile.arrayBuffer());
  const resumeResult = validateResumeBuffer(resumeBuffer, MAX_RESUME_BYTES);
  if (!resumeResult.valid) {
    return NextResponse.json(
      { error: resumeResult.error, field: "resume" },
      { status: 400 },
    );
  }
  const graduationYear = graduationYearRaw
    ? parseInt(graduationYearRaw.toString(), 10)
    : NaN;

  const phoneHash = sha256(phoneResult.e164);
  const phoneRateLimit = await checkSlidingWindow(
    adminDb,
    "_rate_limits_phone",
    phoneHash,
    3,
    30 * 60 * 1000,
  );
  if (phoneRateLimit.overLimit) {
    return NextResponse.json(
      { error: "Too many attempts for this phone number. Try again later." },
      { status: 429 },
    );
  }

  const phoneRef = adminDb
    .collection("phones")
    .doc(`${EDITION}_${phoneResult.e164}`);
  let written = false;
  try {
    written = await adminDb.runTransaction(async (tx) => {
      const phoneDoc = await tx.get(phoneRef);
      if (phoneDoc.exists && phoneDoc.data()?.uid !== uid) {
        return false;
      }
      tx.set(phoneRef, { uid, registered_at: FieldValue.serverTimestamp() });
      return true;
    });
  } catch (error) {
    logger.error(
      "register_profile",
      "phone_transaction_failed",
      { reqId, actorId: uid, status: "failed" },
      error,
    );
    return NextResponse.json(
      { error: "Registration failed. Try again." },
      { status: 500 },
    );
  }

  if (!written) {
    await phoneRateLimit.recordFailure();
    return NextResponse.json(
      { error: "This phone number is already registered.", field: "phone" },
      { status: 409 },
    );
  }

  let qualification: QualificationResult;
  try {
    const storagePath = `resumes/${uid}/resume.pdf`;
    await adminStorage
      .bucket()
      .file(storagePath)
      .save(resumeBuffer, { contentType: "application/pdf" });

    await adminDb
      .collection("pii")
      .doc(uid)
      .set(
        { phone: phoneResult.e164, resume_ref: storagePath },
        { merge: true },
      );

    await applicationRef.set(
      {
        year_of_study: yearOfStudy ? yearOfStudy.toString() : null,
        graduation_year: Number.isNaN(graduationYear) ? null : graduationYear,
        status,
        state: "PROFILE_COMPLETE",
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    qualification = determinePath(application.college_tier, "UNVERIFIED");

    await applicationRef.set(
      {
        qualification_path: qualification.path,
        qualification_reason: qualification.reason,
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await adminDb
      .collection("consent")
      .doc(uid)
      .set(
        {
          CONTEST_PARTICIPATION: {
            granted: true,
            policy_version: "v1",
            granted_at: FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      );

    await adminDb.collection("audit_log").add({
      subject_id: uid,
      event: "QUALIFICATION_DETERMINED",
      actor: "system",
      reason: qualification.reason,
      evidence_ref: null,
      timestamp: FieldValue.serverTimestamp(),
    });

    await applicationRef.set(
      {
        state: "QUALIFICATION_DETERMINED",
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    logger.error(
      "register_profile",
      "post_transaction_failed",
      { reqId, actorId: uid, status: "failed" },
      error,
    );
    return NextResponse.json(
      { error: "Registration failed. Try again." },
      { status: 500 },
    );
  }

  logger.info("register_profile", "profile_completed", {
    reqId,
    entityId: uid,
    status: "ok",
  });
  return NextResponse.json({
    success: true,
    state: "QUALIFICATION_DETERMINED",
    qualification_path: qualification.path,
  });
}
