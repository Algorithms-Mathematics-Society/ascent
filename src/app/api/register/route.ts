import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { type NextRequest, NextResponse } from "next/server";
import { getEligibleInstitutionById } from "@/content/institutions";
import {
  EDITION,
  IDENTIFIER_RATE_LIMIT_MAX,
  IDENTIFIER_RATE_LIMIT_WINDOW_MS,
  IP_RATE_LIMIT_MAX_PER_HOUR,
} from "@/lib/constants";
import { adminDb } from "@/lib/firebaseAdmin";
import logger, { genReqId, maskEmail } from "@/lib/logger";
import { determinePath } from "@/lib/qualificationEngine";
import { checkSlidingWindow, sha256 } from "@/lib/rateLimit";
import type {
  ApplicantStatus,
  CollegeTier,
  QualificationPath,
} from "@/types/registration";
import {
  normalizeCodeforcesHandle,
  normalizeEmail,
  normalizeGoogleDriveUrl,
  normalizeIndianPhone,
  validateLegalName,
  validateSubmissionToken,
} from "@/lib/validators";

const MAX_FORM_BYTES = 64 * 1024;
const EDUCATION_STATUS = {
  UNIVERSITY: "STUDENT",
  SCHOOL: "STUDENT",
  GRADUATED: "OTHER",
  PROFESSIONAL: "PROFESSIONAL",
} as const satisfies Record<string, ApplicantStatus>;

type EducationStage = keyof typeof EDUCATION_STATUS;

const SCHOOL_GRADES = new Set([
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Other",
]);

interface RegistrationReceipt {
  codeforces_handle: string | null;
  reference: string;
  qualification_path: QualificationPath;
  qualification_reason: string;
  college: string;
}

type DuplicateField = "email" | "phone";

type TransactionResult =
  | { kind: "written" }
  | { kind: "duplicate"; field: DuplicateField }
  | { kind: "idempotent"; receipt: RegistrationReceipt };

function fieldError(field: string, error: string, status = 400) {
  return NextResponse.json({ success: false, error, field }, { status });
}

function textField(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

function normalizeProfileUrl(
  value: string,
  domain: "linkedin.com" | "github.com",
): { valid: boolean; normalized: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true, normalized: null };

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    const hostname = url.hostname.toLowerCase();
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      (hostname !== domain && !hostname.endsWith(`.${domain}`)) ||
      url.pathname === "/" ||
      url.toString().length > 300
    ) {
      return { valid: false, normalized: null };
    }
    url.protocol = "https:";
    url.hash = "";
    return { valid: true, normalized: url.toString() };
  } catch {
    return { valid: false, normalized: null };
  }
}

function requestIsSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;

  const host = req.headers.get("host");
  if (!host) return false;

  try {
    const parsedOrigin = new URL(origin);
    const forwardedProtocol = req.headers
      .get("x-forwarded-proto")
      ?.split(",")[0]
      .trim();
    const expectedProtocol = forwardedProtocol
      ? `${forwardedProtocol}:`
      : req.nextUrl.protocol;
    return (
      parsedOrigin.host === host && parsedOrigin.protocol === expectedProtocol
    );
  } catch {
    return false;
  }
}

function receiptFromData(
  data: Record<string, unknown> | undefined,
): RegistrationReceipt | null {
  const codeforcesHandle =
    typeof data?.codeforces_handle === "string"
      ? data.codeforces_handle
      : typeof data?.handle === "string"
        ? data.handle
        : null;
  if (
    !data ||
    typeof data.reference !== "string" ||
    (data.qualification_path !== "AUTO" &&
      data.qualification_path !== "QUALIFIER") ||
    typeof data.qualification_reason !== "string" ||
    typeof data.college !== "string"
  ) {
    return null;
  }
  return {
    codeforces_handle: codeforcesHandle,
    reference: data.reference,
    qualification_path: data.qualification_path,
    qualification_reason: data.qualification_reason,
    college: data.college,
  };
}

function successResponse(receipt: RegistrationReceipt) {
  return NextResponse.json({ success: true, ...receipt });
}

export async function POST(req: NextRequest) {
  const reqId = genReqId();
  const startedAt = Date.now();

  if (!requestIsSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: "Registration request was not accepted." },
      { status: 403 },
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json(
      { success: false, error: "Invalid registration request." },
      { status: 415 },
    );
  }

  const rawContentLength = req.headers.get("content-length");
  const contentLength = rawContentLength
    ? Number.parseInt(rawContentLength, 10)
    : null;
  if (
    contentLength !== null &&
    (!Number.isFinite(contentLength) || contentLength > MAX_FORM_BYTES)
  ) {
    return NextResponse.json(
      { success: false, error: "Registration request is too large." },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid registration request." },
      { status: 400 },
    );
  }

  const honeypot = formData.get("website");
  if (
    honeypot !== null &&
    (typeof honeypot !== "string" || honeypot.trim().length > 0)
  ) {
    return NextResponse.json(
      { success: false, error: "Registration request was not accepted." },
      { status: 400 },
    );
  }

  const submissionToken = textField(formData, "submission_token")?.trim() ?? "";
  if (!validateSubmissionToken(submissionToken)) {
    return fieldError(
      "submission_token",
      "Refresh the page and try the registration again.",
    );
  }

  const receiptRef = adminDb
    .collection("registration_submissions")
    .doc(`${EDITION}_${sha256(submissionToken)}`);

  try {
    const existingReceipt = await receiptRef.get();
    if (existingReceipt.exists) {
      const receipt = receiptFromData(existingReceipt.data());
      if (!receipt) {
        throw new Error("Stored registration receipt is invalid.");
      }
      return successResponse(receipt);
    }
  } catch (error) {
    logger.error(
      "direct_registration",
      "idempotency_preflight_failed",
      { reqId, status: "failed" },
      error,
    );
    return NextResponse.json(
      { success: false, error: "Registration could not be checked. Try again." },
      { status: 500 },
    );
  }

  const legalName = textField(formData, "legal_name") ?? "";
  const nameResult = validateLegalName(legalName);
  if (!nameResult.valid || !nameResult.normalized) {
    return fieldError(
      "legal_name",
      nameResult.error ?? "Enter a valid name.",
    );
  }

  const emailResult = normalizeEmail(textField(formData, "email") ?? "");
  if (!emailResult.valid || !emailResult.normalized) {
    return fieldError("email", emailResult.error ?? "Enter a valid email.");
  }

  const codeforcesResult = normalizeCodeforcesHandle(
    textField(formData, "codeforces_handle") ?? "",
  );
  if (!codeforcesResult.valid) {
    return fieldError(
      "codeforces_handle",
      codeforcesResult.error ?? "Enter a valid Codeforces handle.",
    );
  }

  const phoneResult = normalizeIndianPhone(textField(formData, "phone") ?? "");
  if (!phoneResult.valid || !phoneResult.e164) {
    return fieldError(
      "phone",
      phoneResult.error ?? "Enter a valid phone number.",
    );
  }

  const normalizedEmail = emailResult.normalized;
  const normalizedPhone = phoneResult.e164;
  type LimitResult = Awaited<ReturnType<typeof checkSlidingWindow>>;
  const noOpLimit: LimitResult = {
    overLimit: false,
    recordFailure: async () => {},
  };
  let ipLimit = noOpLimit;
  const clientIp =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown";
  const ipHash = sha256(clientIp);

  try {
    ipLimit = await checkSlidingWindow(
      adminDb,
      "_rate_limits",
      `direct_registration_${ipHash}`,
      IP_RATE_LIMIT_MAX_PER_HOUR,
      60 * 60 * 1000,
    );
    if (ipLimit.overLimit) {
      logger.warn("direct_registration", "ip_soft_throttle", {
        reqId,
        actorId: ipHash,
        status: "degraded",
      });
    }
  } catch (error) {
    logger.warn("direct_registration", "ip_rate_limit_degraded", {
      reqId,
      actorId: ipHash,
      detail: {
        message: error instanceof Error ? error.message : "unknown error",
      },
      status: "degraded",
    });
  }

  let emailLimit: LimitResult;
  let phoneLimit: LimitResult;
  try {
    [emailLimit, phoneLimit] = await Promise.all([
      checkSlidingWindow(
        adminDb,
        "_rate_limits_email",
        sha256(normalizedEmail),
        IDENTIFIER_RATE_LIMIT_MAX,
        IDENTIFIER_RATE_LIMIT_WINDOW_MS,
      ),
      checkSlidingWindow(
        adminDb,
        "_rate_limits_phone",
        sha256(normalizedPhone),
        IDENTIFIER_RATE_LIMIT_MAX,
        IDENTIFIER_RATE_LIMIT_WINDOW_MS,
      ),
    ]);
  } catch (error) {
    logger.error(
      "direct_registration",
      "identifier_rate_limit_failed",
      { reqId, actorId: ipHash, status: "failed" },
      error,
    );
    return NextResponse.json(
      { success: false, error: "Registration could not be checked. Try again." },
      { status: 500 },
    );
  }

  if (emailLimit.overLimit || phoneLimit.overLimit) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many attempts for these details. Try again in 30 minutes.",
      },
      { status: 429 },
    );
  }

  async function recordFailedAttempt() {
    const results = await Promise.allSettled([
      ipLimit.recordFailure(),
      emailLimit.recordFailure(),
      phoneLimit.recordFailure(),
    ]);
    if (results.some((result) => result.status === "rejected")) {
      logger.warn("direct_registration", "failure_limit_record_degraded", {
        reqId,
        actorId: ipHash,
        status: "degraded",
      });
    }
  }

  const rawEducationStage = (
    textField(formData, "education_stage") ?? ""
  ).trim();
  if (!(rawEducationStage in EDUCATION_STATUS)) {
    return fieldError(
      "education_stage",
      "Choose the option that best describes you.",
    );
  }
  const educationStage = rawEducationStage as EducationStage;
  const status = EDUCATION_STATUS[educationStage];

  const currentStudyLevel =
    (textField(formData, "current_study_level") ?? "").trim() || null;
  if (educationStage === "SCHOOL" && !currentStudyLevel) {
    return fieldError(
      "current_study_level",
      "Select your current grade.",
    );
  }
  if (
    currentStudyLevel &&
    (educationStage !== "SCHOOL" || !SCHOOL_GRADES.has(currentStudyLevel))
  ) {
    return fieldError("current_study_level", "Select a valid current grade.");
  }

  const graduationYearText = (
    textField(formData, "graduation_year") ?? ""
  ).trim();
  let graduationYear: number | null = null;
  if (graduationYearText) {
    if (!/^\d{4}$/.test(graduationYearText)) {
      return fieldError("graduation_year", "Enter a valid graduation year.");
    }
    graduationYear = Number.parseInt(graduationYearText, 10);
    if (graduationYear < 1980 || graduationYear > 2100) {
      return fieldError("graduation_year", "Enter a valid graduation year.");
    }
  }
  if (
    educationStage !== "PROFESSIONAL" &&
    graduationYear === null
  ) {
    return fieldError(
      "graduation_year",
      "Enter the relevant graduation year.",
    );
  }

  const linkedInResult = normalizeProfileUrl(
    textField(formData, "linkedin_url") ?? "",
    "linkedin.com",
  );
  if (!linkedInResult.valid) {
    return fieldError("linkedin_url", "Enter a valid LinkedIn profile URL.");
  }
  const githubResult = normalizeProfileUrl(
    textField(formData, "github_url") ?? "",
    "github.com",
  );
  if (!githubResult.valid) {
    return fieldError("github_url", "Enter a valid GitHub profile URL.");
  }

  if (textField(formData, "contest_consent") !== "true") {
    return fieldError(
      "contest_consent",
      "Consent is required to complete registration.",
    );
  }

  const collegeId = (textField(formData, "college_id") ?? "").trim();
  const unlistedName = (textField(formData, "unlisted_name") ?? "")
    .trim()
    .replace(/\s+/gu, " ");
  if (Boolean(collegeId) === Boolean(unlistedName)) {
    return fieldError(
      "college",
      "Select one college or enter an unlisted college.",
    );
  }
  if (collegeId.length > 200) {
    return fieldError("college", "Select a valid college.");
  }
  if (unlistedName && (unlistedName.length < 2 || unlistedName.length > 200)) {
    return fieldError(
      "college",
      "College name must be 2-200 characters.",
    );
  }

  const resumeResult = normalizeGoogleDriveUrl(
    textField(formData, "resume_url") ?? "",
    true,
  );
  if (!resumeResult.valid || !resumeResult.normalized) {
    return fieldError(
      "resume_url",
      resumeResult.error ?? "Paste a valid Google Drive resume link.",
    );
  }

  const transcriptResult = normalizeGoogleDriveUrl(
    textField(formData, "transcript_url") ?? "",
  );
  if (!transcriptResult.valid) {
    return fieldError(
      "transcript_url",
      transcriptResult.error ?? "Paste a valid Google Drive transcript link.",
    );
  }

  let collegeTier: CollegeTier;
  let resolvedCollegeId: string | null;
  let collegeLabel: string;

  if (collegeId) {
    const college = getEligibleInstitutionById(collegeId);
    if (!college) {
      return fieldError("college", "Select a valid college from the list.");
    }
    collegeTier = college.tier;
    resolvedCollegeId = college.id;
    const campus = college.campus ? `, ${college.campus}` : "";
    collegeLabel = `${college.canonical_name}${campus}`;
  } else {
    collegeTier = "UNLISTED";
    resolvedCollegeId = null;
    collegeLabel = unlistedName;
  }

  const qualification = determinePath(collegeTier, "UNVERIFIED");
  const emailRef = adminDb
    .collection("emails")
    .doc(`${EDITION}_${sha256(normalizedEmail)}`);
  const phoneRef = adminDb
    .collection("phones")
    .doc(`${EDITION}_${normalizedPhone}`);

  try {
    const [emailSnap, phoneSnap] = await Promise.all([
      emailRef.get(),
      phoneRef.get(),
    ]);
    if (emailSnap.exists) {
      await recordFailedAttempt();
      return fieldError("email", "This email is already registered.", 409);
    }
    if (phoneSnap.exists) {
      await recordFailedAttempt();
      return fieldError("phone", "This phone number is already registered.", 409);
    }
  } catch (error) {
    logger.error(
      "direct_registration",
      "duplicate_preflight_failed",
      { reqId, status: "failed" },
      error,
    );
    return NextResponse.json(
      { success: false, error: "Registration could not be checked. Try again." },
      { status: 500 },
    );
  }

  const subjectId = randomUUID();
  const reference = `ASC-${sha256(subjectId).slice(0, 10).toUpperCase()}`;
  const receipt: RegistrationReceipt = {
    codeforces_handle: codeforcesResult.normalized,
    reference,
    qualification_path: qualification.path,
    qualification_reason: qualification.reason,
    college: collegeLabel,
  };

  let transactionResult: TransactionResult;
  try {
    transactionResult = await adminDb.runTransaction(async (tx) => {
      const receiptSnap = await tx.get(receiptRef);
      if (receiptSnap.exists) {
        const existingReceipt = receiptFromData(receiptSnap.data());
        if (!existingReceipt) {
          throw new Error("Stored registration receipt is invalid.");
        }
        return { kind: "idempotent", receipt: existingReceipt };
      }

      const [emailSnap, phoneSnap] = await Promise.all([
        tx.get(emailRef),
        tx.get(phoneRef),
      ]);
      if (emailSnap.exists) return { kind: "duplicate", field: "email" };
      if (phoneSnap.exists) return { kind: "duplicate", field: "phone" };

      const applicationRef = adminDb.collection("applications").doc(subjectId);
      const piiRef = adminDb.collection("pii").doc(subjectId);
      const consentRef = adminDb.collection("consent").doc(subjectId);
      const auditRef = adminDb
        .collection("audit_log")
        .doc(`registration_${subjectId}`);

      tx.set(emailRef, {
        subject_id: subjectId,
        registered_at: FieldValue.serverTimestamp(),
      });
      tx.set(phoneRef, {
        uid: subjectId,
        subject_id: subjectId,
        registered_at: FieldValue.serverTimestamp(),
      });
      tx.set(applicationRef, {
        edition: EDITION,
        state: "QUALIFICATION_DETERMINED",
        codeforces_handle: codeforcesResult.normalized,
        college_id: resolvedCollegeId,
        college_tier: collegeTier,
        college_verification_status: "UNVERIFIED",
        email_verified: false,
        education_stage: educationStage,
        current_study_level: currentStudyLevel,
        year_of_study: currentStudyLevel,
        graduation_year: graduationYear,
        status,
        skills: null,
        qualification_path: qualification.path,
        qualification_reason: qualification.reason,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      tx.set(piiRef, {
        legal_name: nameResult.normalized,
        email: normalizedEmail,
        email_masked: maskEmail(normalizedEmail),
        phone: normalizedPhone,
        resume_url: resumeResult.normalized,
        transcript_url: transcriptResult.normalized,
        college_email: null,
        linkedin_url: linkedInResult.normalized,
        github_url: githubResult.normalized,
      });
      tx.set(consentRef, {
        CONTEST_PARTICIPATION: {
          granted: true,
          policy_version: "v1",
          granted_at: FieldValue.serverTimestamp(),
        },
      });
      tx.set(auditRef, {
        subject_id: subjectId,
        event: "QUALIFICATION_DETERMINED",
        actor: "system",
        reason: qualification.reason,
        evidence_ref: null,
        timestamp: FieldValue.serverTimestamp(),
      });
      if (unlistedName) {
        tx.set(
          adminDb.collection("unlisted_college_submissions").doc(subjectId),
          {
            subject_id: subjectId,
            typed_name: unlistedName,
            submitted_at: FieldValue.serverTimestamp(),
          },
        );
      }
      tx.set(receiptRef, {
        subject_id: subjectId,
        state: "COMMITTED",
        ...receipt,
        created_at: FieldValue.serverTimestamp(),
      });
      return { kind: "written" };
    });
  } catch (error) {
    let outcomeChecked = false;

    try {
      const recoveredSnap = await receiptRef.get();
      const recoveredData = recoveredSnap.data();
      const recoveredReceipt =
        recoveredSnap.exists ? receiptFromData(recoveredData) : null;
      outcomeChecked = true;

      if (recoveredReceipt) {
        const sameSubject = recoveredData?.subject_id === subjectId;
        logger.warn(
          "direct_registration",
          "transaction_outcome_recovered",
          {
            reqId,
            entityId: subjectId,
            detail: { sameSubject },
            status: "degraded",
          },
        );
        return successResponse(recoveredReceipt);
      }
    } catch (recoveryError) {
      logger.error(
        "direct_registration",
        "transaction_outcome_check_failed",
        { reqId, entityId: subjectId, status: "degraded" },
        recoveryError,
      );
    }

    if (outcomeChecked) {
      await recordFailedAttempt();
    }

    logger.error(
      "direct_registration",
      "registration_transaction_failed",
      {
        reqId,
        entityId: subjectId,
        detail: { outcomeChecked },
        status: outcomeChecked ? "failed" : "degraded",
      },
      error,
    );
    return NextResponse.json(
      {
        success: false,
        error: outcomeChecked
          ? "Registration failed. Try again."
          : "Registration status could not be confirmed. Try again—the same entry reference will be checked safely.",
      },
      { status: 500 },
    );
  }

  if (transactionResult.kind === "idempotent") {
    return successResponse(transactionResult.receipt);
  }

  if (transactionResult.kind === "duplicate") {
    await recordFailedAttempt();
    const messages: Record<DuplicateField, string> = {
      email: "This email is already registered.",
      phone: "This phone number is already registered.",
    };
    return fieldError(
      transactionResult.field,
      messages[transactionResult.field],
      409,
    );
  }

  logger.info("direct_registration", "registration_completed", {
    reqId,
    entityId: subjectId,
    status: "ok",
    durationMs: Date.now() - startedAt,
  });
  return successResponse(receipt);
}
