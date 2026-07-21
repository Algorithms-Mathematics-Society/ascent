"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { CheckCircle2 } from "lucide-react";
import CollegeTypeahead, {
  type CollegeResult,
} from "@/components/register/CollegeTypeahead";
import {
  Button,
  FormField,
  Input,
  Notice,
  Select,
  Spinner,
} from "@/components/ui";
import {
  APAC_PHONE_COUNTRIES,
  normalizeApacPhone,
  normalizeCodeforcesHandle,
  normalizeGoogleDriveUrl,
} from "@/lib/validators";

const SUBMIT_TIMEOUT_MS = 20_000;
const CURRENT_YEAR = new Date().getFullYear();

const EDUCATION_OPTIONS = [
  { value: "UNIVERSITY", label: "University / college student" },
  { value: "SCHOOL", label: "School student" },
  { value: "GRADUATED", label: "Graduated" },
  { value: "PROFESSIONAL", label: "Working professional" },
] as const;

const SCHOOL_GRADES = [
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Other",
] as const;

type RegistrationStep = 1 | 2 | 3;
type EducationStage = (typeof EDUCATION_OPTIONS)[number]["value"];

type FieldName =
  | "legal_name"
  | "email"
  | "phone"
  | "college"
  | "education_stage"
  | "current_study_level"
  | "graduation_year"
  | "linkedin_url"
  | "github_url"
  | "codeforces_handle"
  | "resume_url"
  | "transcript_url"
  | "contest_consent";

interface FormValues {
  legalName: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  educationStage: "" | EducationStage;
  currentStudyLevel: string;
  graduationYear: string;
  linkedinUrl: string;
  githubUrl: string;
  codeforcesHandle: string;
  resumeUrl: string;
  transcriptUrl: string;
  contestConsent: boolean;
}

interface RegistrationReceipt {
  codeforcesHandle: string | null;
  reference: string;
  qualificationPath: "AUTO" | "QUALIFIER";
  qualificationReason: string;
  college: string;
}

interface RegisterResponse {
  success?: boolean;
  error?: string;
  field?: string;
  codeforces_handle?: string | null;
  reference?: string;
  qualification_path?: string;
  qualification_reason?: string;
  college?: string;
}

const INITIAL_VALUES: FormValues = {
  legalName: "",
  email: "",
  phone: "",
  phoneCountryCode: "91",
  educationStage: "",
  currentStudyLevel: "",
  graduationYear: "",
  linkedinUrl: "",
  githubUrl: "",
  codeforcesHandle: "",
  resumeUrl: "",
  transcriptUrl: "",
  contestConsent: false,
};

const STEP_FIELDS: Record<RegistrationStep, FieldName[]> = {
  1: ["legal_name", "email", "phone"],
  2: [
    "college",
    "education_stage",
    "current_study_level",
    "graduation_year",
    "linkedin_url",
    "github_url",
  ],
  3: [
    "codeforces_handle",
    "resume_url",
    "transcript_url",
    "contest_consent",
  ],
};

const SERVER_FIELD_MAP: Record<string, FieldName> = {
  legal_name: "legal_name",
  email: "email",
  phone: "phone",
  college: "college",
  college_id: "college",
  unlisted_name: "college",
  education_stage: "education_stage",
  current_study_level: "current_study_level",
  graduation_year: "graduation_year",
  linkedin_url: "linkedin_url",
  github_url: "github_url",
  codeforces_handle: "codeforces_handle",
  resume_url: "resume_url",
  transcript_url: "transcript_url",
  contest_consent: "contest_consent",
};

const STAGE_LABELS: Record<EducationStage, string> = {
  UNIVERSITY: "University / college student",
  SCHOOL: "School student",
  GRADUATED: "Graduated",
  PROFESSIONAL: "Working professional",
};

function normalizeOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isProfileUrl(value: string, domain: "linkedin.com" | "github.com") {
  if (!value.trim()) return true;
  try {
    const url = new URL(normalizeOptionalUrl(value));
    const host = url.hostname.toLowerCase();
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      (host === domain || host.endsWith(`.${domain}`)) &&
      url.pathname !== "/"
    );
  } catch {
    return false;
  }
}

function createSubmissionToken() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== "undefined") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function focusTarget(field: FieldName) {
  const target = document.querySelector<HTMLElement>(
    field === "college" ? '[name="college"]' : `[name="${field}"]`,
  );
  if (!target) return;
  target.focus();
  target.scrollIntoView({
    block: "center",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

function qualificationLabel(path: string) {
  if (path === "AUTO") return "Direct qualification";
  if (path === "QUALIFIER") return "Qualifier";
  return "Qualification pending";
}

function qualificationNextStep(path: string, reason: string) {
  if (path === "AUTO") {
    return "Your entry is on the direct-qualification route. Keep your reference; confirmed round details will be shared using your registration contact details.";
  }
  if (reason === "tier-1 claim unverified") {
    return "Your entry is currently on the qualifier route. The event team will share the qualifier schedule and any institution-verification update using your registration contact details.";
  }
  return "Your next competition stage is the C++ qualifier. The confirmed schedule and rules will be shared using your registration contact details.";
}


const PROGRESS_WIDTH: Record<RegistrationStep, string> = {
  1: "w-1/3",
  2: "w-2/3",
  3: "w-full",
};

function StageProgress({
  current,
  onNavigate,
}: {
  current: RegistrationStep;
  onNavigate: (step: RegistrationStep) => void;
}) {
  const steps = [
    { number: 1, label: "Contact details", shortLabel: "Contact" },
    {
      number: 2,
      label: "Education & institution",
      shortLabel: "Education",
    },
    { number: 3, label: "Review & submit", shortLabel: "Submit" },
  ] as const;

  return (
    <nav
      aria-label="Registration progress"
      className="border border-ascent-border bg-ascent-surface px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p
          className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-brand"
          aria-live="polite"
        >
          Step {current} of 3
        </p>
        <p className="text-xs leading-5 text-ascent-muted">
          Three short stages. You can revisit completed details before you
          submit.
        </p>
      </div>

      <div
        className="mt-3 h-1 bg-ascent-border"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={current}
        aria-label={`Registration step ${current} of 3`}
      >
        <div className={`h-full bg-ascent-brand ${PROGRESS_WIDTH[current]}`} />
      </div>

      <ol className="mt-3 grid grid-cols-3">
        {steps.map((step) => {
          const complete = step.number < current;
          const active = step.number === current;

          const content = (
            <>
              <span
                className={
                  active
                    ? "block font-mono text-[0.6875rem] font-semibold text-ascent-brand"
                    : "block font-mono text-[0.6875rem] text-ascent-muted"
                }
              >
                0{step.number}
              </span>
              <span
                className={
                  active
                    ? "mt-1 block text-xs font-semibold leading-5 text-ascent-ink sm:text-sm"
                    : complete
                      ? "mt-1 block text-xs font-medium leading-5 text-ascent-ink sm:text-sm"
                      : "mt-1 block text-xs font-medium leading-5 text-ascent-muted sm:text-sm"
                }
              >
                <span className="sm:hidden">{step.shortLabel}</span>
                <span className="hidden sm:inline">{step.label}</span>
              </span>
              <span className="sr-only">
                {active
                  ? "Current step"
                  : complete
                    ? "Completed"
                    : "Not started"}
              </span>
            </>
          );

          return (
            <li
              key={step.number}
              aria-current={active ? "step" : undefined}
              className="border-l border-ascent-border px-3 first:border-l-0 sm:px-5"
            >
              {complete ? (
                <button
                  type="button"
                  onClick={() => onNavigate(step.number)}
                  className="min-h-11 w-full text-left hover:text-ascent-brand"
                >
                  {content}
                </button>
              ) : (
                <div className="min-h-11">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StageFrame({
  number,
  title,
  description,
  children,
  hidden,
}: {
  number: RegistrationStep;
  title: string;
  description: string;
  children: ReactNode;
  hidden: boolean;
}) {
  return (
    <section hidden={hidden} aria-labelledby={`registration-stage-${number}`}>
      <div className="border border-ascent-border bg-ascent-surface lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <header className="border-b border-ascent-border bg-ascent-surface-subtle p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-brand">
            Stage 0{number}
          </p>
          <h2
            id={`registration-stage-${number}`}
            tabIndex={-1}
            className="mt-2 text-2xl font-semibold tracking-tight text-ascent-ink outline-none"
          >
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-ascent-muted">
            {description}
          </p>
        </header>
        <div className="p-5 sm:p-7">{children}</div>
      </div>
    </section>
  );
}

function SuccessReceipt({ receipt }: { receipt: RegistrationReceipt }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="mx-auto max-w-5xl">
      <section className="border border-ascent-border bg-ascent-surface">
        <div className="border-b border-ascent-success/30 bg-ascent-success-tint p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 h-7 w-7 shrink-0 text-ascent-success"
            />
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-success">
                Submission received
              </p>
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 text-3xl font-semibold tracking-tight text-ascent-ink outline-none sm:text-4xl"
              >
                Registration complete
              </h2>
              <p className="mt-3 leading-7 text-ascent-muted">
                Your Ascent competition entry is recorded. Keep the
                reference below.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h3 className="text-lg font-semibold text-ascent-ink">
            Entry receipt
          </h3>
          <dl className="mt-5 divide-y divide-ascent-border border-y border-ascent-border">
            {[
              ["Codeforces handle", receipt.codeforcesHandle ?? "Not provided"],
              ["Institution", receipt.college],
              [
                "Competition route",
                qualificationLabel(receipt.qualificationPath),
              ],
              ["Reference", receipt.reference],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4"
              >
                <dt className="text-sm text-ascent-muted">{label}</dt>
                <dd
                  className={
                    label === "Reference"
                      ? "break-all font-mono text-sm text-ascent-ink"
                      : "text-sm text-ascent-ink"
                  }
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 border-l-2 border-ascent-brand bg-ascent-brand-tint px-4 py-3">
            <p className="text-sm font-semibold text-ascent-brand">
              What happens next
            </p>
            <p className="mt-1 text-sm leading-6 text-ascent-ink">
              {qualificationNextStep(
                receipt.qualificationPath,
                receipt.qualificationReason,
              )}
            </p>
          </div>

          <div className="mt-7 flex flex-col gap-4 border-t border-ascent-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ascent-muted">
              Save this reference for any registration support request.
            </p>
            <Button href="/" variant="secondary">
              Return to event
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function RegistrationForm() {
  const [step, setStep] = useState<RegistrationStep>(1);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [selectedCollege, setSelectedCollege] = useState<CollegeResult | null>(
    null,
  );
  const [unlistedName, setUnlistedName] = useState("");
  const [optionalProfilesOpen, setOptionalProfilesOpen] = useState(false);
  const [website, setWebsite] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FieldName, string>>
  >({});
  const [globalError, setGlobalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<RegistrationReceipt | null>(null);
  const submissionTokenRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  function clearFieldError(field: FieldName) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateValue<Key extends keyof FormValues>(
    key: Key,
    value: FormValues[Key],
    field: FieldName,
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    clearFieldError(field);
    setGlobalError("");
  }

  function revealOptionalProfileErrors(
    errors: Partial<Record<FieldName, string>>,
  ) {
    if (errors.linkedin_url || errors.github_url) setOptionalProfilesOpen(true);
  }

  function validateStage(targetStep: RegistrationStep) {
    const errors: Partial<Record<FieldName, string>> = {};

    if (targetStep === 1) {
      const legalName = values.legalName.trim().replace(/\s+/gu, " ");
      const legalNameLength = Array.from(legalName).length;
      if (legalNameLength < 2 || legalNameLength > 100) {
        errors.legal_name = "Name must be 2–100 characters.";
      } else if (
        !/^[\p{L}\p{M}][\p{L}\p{M}\s.\u0027\u2019-]*$/u.test(legalName)
      ) {
        errors.legal_name =
          "Use letters, spaces, apostrophes, periods, or hyphens.";
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        errors.email = "Enter a valid email address.";
      }
      const phoneResult = normalizeApacPhone(
        values.phone,
        values.phoneCountryCode,
      );
      if (!phoneResult.valid) {
        errors.phone = phoneResult.error ?? "Enter a valid mobile number.";
      }
    }

    if (targetStep === 2) {
      if (!selectedCollege && !unlistedName) {
        errors.college = "Choose an institution or confirm an unlisted one.";
      }
      if (!values.educationStage) {
        errors.education_stage = "Choose the option that best describes you.";
      }
      if (values.educationStage === "SCHOOL" && !values.currentStudyLevel) {
        errors.current_study_level = "Select your current grade.";
      }
      const yearRequired =
        values.educationStage === "UNIVERSITY" ||
        values.educationStage === "SCHOOL" ||
        values.educationStage === "GRADUATED";
      if (yearRequired && !values.graduationYear) {
        errors.graduation_year = "Enter the relevant graduation year.";
      } else if (
        values.graduationYear &&
        (!/^\d{4}$/.test(values.graduationYear) ||
          Number(values.graduationYear) < 1980 ||
          Number(values.graduationYear) > 2100)
      ) {
        errors.graduation_year = "Enter a four-digit year from 1980 to 2100.";
      }
      if (!isProfileUrl(values.linkedinUrl, "linkedin.com")) {
        errors.linkedin_url = "Enter a valid LinkedIn profile URL.";
      }
      if (!isProfileUrl(values.githubUrl, "github.com")) {
        errors.github_url = "Enter a valid GitHub profile URL.";
      }
    }

    if (targetStep === 3) {
      const codeforcesResult = normalizeCodeforcesHandle(
        values.codeforcesHandle,
      );
      if (!codeforcesResult.valid) {
        errors.codeforces_handle =
          codeforcesResult.error ?? "Enter a valid Codeforces handle.";
      }

      const resumeResult = normalizeGoogleDriveUrl(values.resumeUrl, true);
      if (!resumeResult.valid) {
        errors.resume_url =
          resumeResult.error ?? "Paste a valid Google Drive resume link.";
      }

      const transcriptResult = normalizeGoogleDriveUrl(values.transcriptUrl);
      if (!transcriptResult.valid) {
        errors.transcript_url =
          transcriptResult.error ??
          "Paste a valid Google Drive transcript link.";
      }

      if (!values.contestConsent) {
        errors.contest_consent = "Consent is required to submit your entry.";
      }
    }

    return errors;
  }

  function focusFirstError(
    errors: Partial<Record<FieldName, string>>,
    targetStep: RegistrationStep,
  ) {
    const first = STEP_FIELDS[targetStep].find((field) => errors[field]);
    if (first) window.requestAnimationFrame(() => focusTarget(first));
  }

  function goToStep(nextStep: RegistrationStep) {
    setStep(nextStep);
    setGlobalError("");
    window.requestAnimationFrame(() => {
      document.getElementById(`registration-stage-${nextStep}`)?.focus();
      window.scrollTo({
        top:
          Math.max(
            0,
            document
              .getElementById(`registration-stage-${nextStep}`)
              ?.getBoundingClientRect().top ?? 0,
          ) +
          window.scrollY -
          104,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  }

  function continueFrom(targetStep: RegistrationStep) {
    const errors = validateStage(targetStep);
    if (Object.keys(errors).length > 0) {
      setFieldErrors((current) => ({ ...current, ...errors }));
      revealOptionalProfileErrors(errors);
      focusFirstError(errors, targetStep);
      return;
    }
    if (targetStep < 3) goToStep((targetStep + 1) as RegistrationStep);
  }

  function focusErrorSummary() {
    window.requestAnimationFrame(() => {
      errorSummaryRef.current?.focus();
      errorSummaryRef.current?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (step < 3) {
      continueFrom(step);
      return;
    }

    const allErrors = {
      ...validateStage(1),
      ...validateStage(2),
      ...validateStage(3),
    };
    if (Object.keys(allErrors).length > 0) {
      setFieldErrors(allErrors);
      revealOptionalProfileErrors(allErrors);
      const invalidStep =
        ([1, 2, 3] as RegistrationStep[]).find((candidate) =>
          STEP_FIELDS[candidate].some((field) => allErrors[field]),
        ) ?? 3;
      if (invalidStep !== step) goToStep(invalidStep);
      focusFirstError(allErrors, invalidStep);
      return;
    }
    if (!values.educationStage) return;

    submittingRef.current = true;
    setSubmitting(true);
    setGlobalError("");
    submissionTokenRef.current ??= createSubmissionToken();

    const formData = new FormData();
    formData.set("legal_name", values.legalName.trim());
    formData.set("email", values.email.trim().toLowerCase());
    const phoneResult = normalizeApacPhone(
      values.phone,
      values.phoneCountryCode,
    );
    formData.set("phone", phoneResult.e164 ?? values.phone.trim());
    if (values.codeforcesHandle.trim())
      formData.set("codeforces_handle", values.codeforcesHandle.trim());
    if (selectedCollege) formData.set("college_id", selectedCollege.college_id);
    else formData.set("unlisted_name", unlistedName);
    formData.set("education_stage", values.educationStage);
    if (values.currentStudyLevel)
      formData.set("current_study_level", values.currentStudyLevel);
    if (values.graduationYear)
      formData.set("graduation_year", values.graduationYear);
    if (values.linkedinUrl.trim())
      formData.set("linkedin_url", normalizeOptionalUrl(values.linkedinUrl));
    if (values.githubUrl.trim())
      formData.set("github_url", normalizeOptionalUrl(values.githubUrl));
    formData.set("resume_url", values.resumeUrl.trim());
    if (values.transcriptUrl.trim())
      formData.set("transcript_url", values.transcriptUrl.trim());
    formData.set("contest_consent", String(values.contestConsent));
    formData.set("submission_token", submissionTokenRef.current);
    formData.set("website", website);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      SUBMIT_TIMEOUT_MS,
    );

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = (await response
        .json()
        .catch(() => ({}))) as RegisterResponse;
      if (!response.ok || !data.success) {
        const mappedField = data.field
          ? SERVER_FIELD_MAP[data.field]
          : undefined;
        const message =
          data.error || "Registration could not be submitted. Try again.";
        if (mappedField) {
          const mappedStep =
            ([1, 2, 3] as RegistrationStep[]).find((candidate) =>
              STEP_FIELDS[candidate].includes(mappedField),
            ) ?? 3;
          setFieldErrors((current) => ({ ...current, [mappedField]: message }));
          revealOptionalProfileErrors({ [mappedField]: message });
          if (mappedStep !== step) goToStep(mappedStep);
          window.requestAnimationFrame(() => focusTarget(mappedField));
        } else {
          setGlobalError(message);
          focusErrorSummary();
        }
        return;
      }

      if (
        (data.codeforces_handle !== null &&
          data.codeforces_handle !== undefined &&
          typeof data.codeforces_handle !== "string") ||
        typeof data.reference !== "string" ||
        (data.qualification_path !== "AUTO" &&
          data.qualification_path !== "QUALIFIER") ||
        typeof data.qualification_reason !== "string" ||
        typeof data.college !== "string"
      ) {
        setGlobalError(
          "The registration receipt could not be read. Submit again to retrieve it.",
        );
        focusErrorSummary();
        return;
      }

      setReceipt({
        codeforcesHandle: data.codeforces_handle ?? null,
        reference: data.reference,
        qualificationPath: data.qualification_path,
        qualificationReason: data.qualification_reason,
        college: data.college,
      });
    } catch (error) {
      setGlobalError(
        error instanceof DOMException && error.name === "AbortError"
          ? "Submission is taking longer than expected. Try again—the same entry reference will be used safely."
          : "A network error interrupted submission. Check your connection and try again.",
      );
      focusErrorSummary();
    } finally {
      window.clearTimeout(timeoutId);
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (receipt) return <SuccessReceipt receipt={receipt} />;

  const institutionLabel = selectedCollege
    ? `${selectedCollege.canonical_name}${selectedCollege.campus ? ` · ${selectedCollege.campus}` : ""}`
    : unlistedName || "Not selected";
  const graduationLabel =
    values.educationStage === "GRADUATED" ||
    values.educationStage === "PROFESSIONAL"
      ? "Most recent graduation year"
      : "Expected graduation year";

  return (
    <main className="mx-auto max-w-5xl">
      <StageProgress current={step} onNavigate={goToStep} />

      {globalError ? (
        <div ref={errorSummaryRef} tabIndex={-1} className="mt-5 outline-none">
          <Notice tone="danger" heading="Registration not submitted">
            {globalError}
          </Notice>
        </div>
      ) : null}

      <form
        className="mt-6 space-y-5"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={submitting}
      >
        <p className="sr-only" role="status" aria-live="polite">
          {submitting ? "Submitting your competition entry." : ""}
        </p>
        <StageFrame
          number={1}
          title="Contact details"
          description="Tell the event team who you are and how to reach you with schedule and administration updates."
          hidden={step !== 1}
        >
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.12em] text-ascent-muted">
            Required unless marked optional.
          </p>
          <fieldset disabled={submitting} className="grid gap-5 sm:grid-cols-2">
            <legend className="sr-only">Contact details</legend>
            <FormField
              label="Full name"
              id="legal_name"
              required
              error={fieldErrors.legal_name}
              className="sm:col-span-2"
            >
              <Input
                name="legal_name"
                value={values.legalName}
                onChange={(event) =>
                  updateValue("legalName", event.target.value, "legal_name")
                }
                autoComplete="name"
                disabled={submitting}
              />
            </FormField>
            <FormField
              label="Email"
              id="email"
              required
              error={fieldErrors.email}
            >
              <Input
                name="email"
                type="email"
                inputMode="email"
                value={values.email}
                onChange={(event) =>
                  updateValue("email", event.target.value, "email")
                }
                autoComplete="email"
                disabled={submitting}
              />
            </FormField>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="phone"
                className="text-sm font-semibold leading-5 text-ascent-ink"
              >
                Mobile number
              </label>
              <div className="grid grid-cols-[minmax(7.5rem,0.9fr)_minmax(0,1fr)] gap-3">
                <Select
                  name="phone_country_code"
                  value={values.phoneCountryCode}
                  onChange={(event) =>
                    updateValue("phoneCountryCode", event.target.value, "phone")
                  }
                  aria-label="Mobile number country or territory"
                  disabled={submitting}
                >
                  {APAC_PHONE_COUNTRIES.map((country) => (
                    <option key={country.callingCode} value={country.callingCode}>
                      {country.name} +{country.callingCode}
                    </option>
                  ))}
                </Select>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  value={values.phone}
                  onChange={(event) =>
                    updateValue("phone", event.target.value, "phone")
                  }
                  autoComplete="tel-national"
                  placeholder="Mobile number"
                  aria-describedby={
                    fieldErrors.phone
                      ? "phone-description phone-error"
                      : "phone-description"
                  }
                  aria-invalid={Boolean(fieldErrors.phone)}
                  disabled={submitting}
                />
              </div>
              <p id="phone-description" className="text-xs leading-5 text-ascent-muted">
                Enter the local number, without its country code.
              </p>
              {fieldErrors.phone ? (
                <p
                  id="phone-error"
                  className="text-sm leading-5 text-ascent-danger"
                  aria-live="polite"
                >
                  {fieldErrors.phone}
                </p>
              ) : null}
            </div>
          </fieldset>
          <div className="mt-7 flex flex-col gap-4 border-t border-ascent-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-xs leading-5 text-ascent-muted">
              <span className="font-semibold text-ascent-ink">Private:</span>{" "}
              these contact details are used for competition administration and
              are not shown on the public ranklist.
            </p>
            <Button
              type="button"
              onClick={() => continueFrom(1)}
              className="w-full sm:w-auto"
            >
              Continue to education
            </Button>
          </div>
        </StageFrame>

        <StageFrame
          number={2}
          title="Education & institution"
          description="Choose your current situation. The form will ask only for the education details that apply."
          hidden={step !== 2}
        >
          <fieldset disabled={submitting} className="space-y-6">
            <legend className="sr-only">Education and profiles</legend>
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-brand">
                Required for your competition route
              </p>
              <p className="mt-1 text-sm leading-5 text-ascent-muted">
                Institution and current situation determine your competition route.
              </p>
            </div>
            <CollegeTypeahead
              disabled={submitting}
              error={fieldErrors.college}
              onSelect={(college) => {
                setSelectedCollege(college);
                if (college) setUnlistedName("");
                clearFieldError("college");
              }}
              onUnlisted={(name) => {
                setUnlistedName(name);
                if (name) setSelectedCollege(null);
                clearFieldError("college");
              }}
            />

            <FormField
              label="Which best describes you?"
              id="education_stage"
              required
              description="Choose Working professional if you are currently employed."
              error={fieldErrors.education_stage}
            >
              <Select
                name="education_stage"
                value={values.educationStage}
                onChange={(event) => {
                  updateValue(
                    "educationStage",
                    event.target.value as FormValues["educationStage"],
                    "education_stage",
                  );
                  setValues((current) => ({
                    ...current,
                    currentStudyLevel: "",
                    graduationYear: "",
                  }));
                  clearFieldError("current_study_level");
                  clearFieldError("graduation_year");
                }}
                disabled={submitting}
              >
                <option value="">Select your current situation</option>
                {EDUCATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>

            {values.educationStage ? (
              <div className="grid gap-5 border-l-2 border-ascent-brand bg-ascent-brand-tint p-4 sm:grid-cols-2">
                {values.educationStage === "SCHOOL" ? (
                  <FormField
                    label="Current grade"
                    id="current_study_level"
                    required
                    error={fieldErrors.current_study_level}
                  >
                    <Select
                      name="current_study_level"
                      value={values.currentStudyLevel}
                      onChange={(event) =>
                        updateValue(
                          "currentStudyLevel",
                          event.target.value,
                          "current_study_level",
                        )
                      }
                      disabled={submitting}
                    >
                      <option value="">Select grade</option>
                      {SCHOOL_GRADES.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                ) : null}

                <FormField
                  label={graduationLabel}
                  id="graduation_year"
                  required={values.educationStage !== "PROFESSIONAL"}
                  optional={values.educationStage === "PROFESSIONAL"}
                  description={
                    values.educationStage === "SCHOOL"
                      ? "Year you expect to finish school."
                      : values.educationStage === "UNIVERSITY"
                        ? "Year you expect to finish your current degree."
                        : values.educationStage === "GRADUATED"
                          ? "Year you completed your most recent degree."
                          : "Most recent graduation year, if relevant."
                  }
                  error={fieldErrors.graduation_year}
                  className={
                    values.educationStage === "SCHOOL" ? "" : "sm:col-span-2"
                  }
                >
                  <Input
                    name="graduation_year"
                    type="number"
                    inputMode="numeric"
                    min={1980}
                    max={2100}
                    value={values.graduationYear}
                    onChange={(event) =>
                      updateValue(
                        "graduationYear",
                        event.target.value,
                        "graduation_year",
                      )
                    }
                    placeholder={String(CURRENT_YEAR + 1)}
                    disabled={submitting}
                  />
                </FormField>
              </div>
            ) : null}

            <details
              className="group border-t border-ascent-border pt-6"
              open={optionalProfilesOpen}
              onToggle={(event) => setOptionalProfilesOpen(event.currentTarget.open)}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ascent-ink [&::-webkit-details-marker]:hidden">
                <span>
                  Optional profile links
                  <span className="ml-1 font-normal text-ascent-muted">(optional)</span>
                </span>
                <span aria-hidden="true" className="font-mono text-base font-normal text-ascent-brand transition-transform duration-150 motion-reduce:transition-none group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm leading-5 text-ascent-muted">
                Add LinkedIn or GitHub only if you want them included with your entry.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <FormField
                  label="LinkedIn profile"
                  id="linkedin_url"
                  optional
                  description="Paste your public profile URL."
                  error={fieldErrors.linkedin_url}
                >
                  <Input
                    name="linkedin_url"
                    type="url"
                    inputMode="url"
                    value={values.linkedinUrl}
                    onChange={(event) =>
                      updateValue(
                        "linkedinUrl",
                        event.target.value,
                        "linkedin_url",
                      )
                    }
                    placeholder="linkedin.com/in/your-name"
                    autoComplete="url"
                    disabled={submitting}
                  />
                </FormField>
                <FormField
                  label="GitHub profile"
                  id="github_url"
                  optional
                  description="Paste your public profile URL."
                  error={fieldErrors.github_url}
                >
                  <Input
                    name="github_url"
                    type="url"
                    inputMode="url"
                    value={values.githubUrl}
                    onChange={(event) =>
                      updateValue("githubUrl", event.target.value, "github_url")
                    }
                    placeholder="github.com/username"
                    autoComplete="url"
                    disabled={submitting}
                  />
                </FormField>
              </div>
            </details>
          </fieldset>

          <div className="mt-7 flex flex-col gap-3 border-t border-ascent-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => goToStep(1)}
              className="w-full sm:w-auto"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={() => continueFrom(2)}
              className="w-full sm:w-auto"
            >
              Continue to entry details
            </Button>
          </div>
        </StageFrame>

        <StageFrame
          number={3}
          title="Review & submit"
          description="Add the required resume link first, then any optional context you want us to consider."
          hidden={step !== 3}
        >
          <div className="border border-ascent-border bg-ascent-surface-subtle p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-ascent-ink">
              Check your details
            </h3>
            <p className="mt-1 text-sm leading-5 text-ascent-muted">
              You can revise either section before submitting.
            </p>
            <dl className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ascent-muted">Contact</dt>
                <dd className="mt-1 text-sm text-ascent-ink">
                  {values.legalName}
                </dd>
                <dd className="mt-0.5 break-all text-xs text-ascent-muted">
                  {values.email}
                </dd>
                <dd className="mt-0.5 text-xs text-ascent-muted">
                  {values.phone}
                </dd>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="mt-2 min-h-11 text-xs font-semibold text-ascent-brand underline underline-offset-4"
                >
                  Edit contact details
                </button>
              </div>
              <div>
                <dt className="text-xs text-ascent-muted">Background</dt>
                <dd className="mt-1 text-sm text-ascent-ink">
                  {institutionLabel}
                </dd>
                <dd className="mt-0.5 text-xs text-ascent-muted">
                  {values.educationStage
                    ? STAGE_LABELS[values.educationStage]
                    : "Not selected"}
                </dd>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="mt-2 min-h-11 text-xs font-semibold text-ascent-brand underline underline-offset-4"
                >
                  Edit education details
                </button>
              </div>
            </dl>
          </div>

          <fieldset disabled={submitting} className="mt-6 space-y-6">
            <legend className="sr-only">Competition entry</legend>
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-brand">
                Required to complete
              </p>
              <p className="mt-1 text-sm leading-5 text-ascent-muted">
                Share a Google Drive link to your resume. It must open without sign-in.
              </p>
            </div>
            <FormField
              label="Resume link"
              id="resume_url"
              required
              description="Paste your Google Drive sharing link."
              error={fieldErrors.resume_url}
            >
              <Input
                name="resume_url"
                type="url"
                inputMode="url"
                value={values.resumeUrl}
                onChange={(event) =>
                  updateValue(
                    "resumeUrl",
                    event.target.value,
                    "resume_url",
                  )
                }
                placeholder="drive.google.com/file/d/..."
                autoComplete="url"
                disabled={submitting}
              />
            </FormField>

            <details className="group border-l-2 border-ascent-brand bg-ascent-brand-tint px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ascent-ink [&::-webkit-details-marker]:hidden">
                <span>How to make a Drive link viewable</span>
                <span aria-hidden="true" className="font-mono text-base font-normal text-ascent-brand transition-transform duration-150 motion-reduce:transition-none group-open:rotate-45">+</span>
              </summary>
              <p className="mt-1 text-sm leading-6 text-ascent-muted">
                In Google Drive, open Share, set General access to “Anyone with
                the link,” and choose “Viewer.” We never ask for Google sign-in.
              </p>
            </details>

            <div className="border-t border-ascent-border pt-6">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-brand">
                Optional context
              </p>
              <p className="mt-1 text-sm leading-5 text-ascent-muted">
                Add either item only if you want it considered with your entry.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                label="Transcript link"
                id="transcript_url"
                optional
                description="Paste a Google Drive sharing link if you would like to provide one."
                error={fieldErrors.transcript_url}
              >
                <Input
                  name="transcript_url"
                  type="url"
                  inputMode="url"
                  value={values.transcriptUrl}
                  onChange={(event) =>
                    updateValue(
                      "transcriptUrl",
                      event.target.value,
                      "transcript_url",
                    )
                  }
                  placeholder="drive.google.com/file/d/..."
                  autoComplete="url"
                  disabled={submitting}
                />
              </FormField>

              <FormField
                label="Codeforces handle"
                id="codeforces_handle"
                optional
                description="Add this only if you have one. It helps us understand your competitive-programming background."
                error={fieldErrors.codeforces_handle}
              >
                <Input
                  name="codeforces_handle"
                  value={values.codeforcesHandle}
                  onChange={(event) =>
                    updateValue(
                      "codeforcesHandle",
                      event.target.value,
                      "codeforces_handle",
                    )
                  }
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="e.g. tourist"
                  maxLength={24}
                  disabled={submitting}
                />
              </FormField>
            </div>
            <div className="border border-ascent-border bg-ascent-surface-subtle p-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-brand">
                Final confirmation
              </p>
              <label
                className={
                  submitting
                    ? "mt-3 flex cursor-not-allowed items-start gap-3 text-sm leading-6 text-ascent-ink opacity-60"
                    : "mt-3 flex cursor-pointer items-start gap-3 text-sm leading-6 text-ascent-ink"
                }
              >
                <input
                  id="contest_consent"
                  name="contest_consent"
                  type="checkbox"
                  checked={values.contestConsent}
                  onChange={(event) =>
                    updateValue(
                      "contestConsent",
                      event.target.checked,
                      "contest_consent",
                    )
                  }
                  required
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.contest_consent)}
                  aria-describedby={
                    fieldErrors.contest_consent
                      ? "contest_consent-error"
                      : undefined
                  }
                  className="mt-1 size-4 shrink-0 accent-ascent-brand"
                />
                <span>
                  I consent to the use of these details to administer my Ascent
                  competition registration.
                </span>
              </label>
              <p className="mt-2 pl-7 text-xs leading-5 text-ascent-muted">
                This consent covers competition participation only. It does not
                opt you into public profile visibility or sponsor sharing.
              </p>
              {fieldErrors.contest_consent ? (
                <p
                  id="contest_consent-error"
                  className="mt-2 text-sm leading-5 text-ascent-danger"
                  aria-live="polite"
                >
                  {fieldErrors.contest_consent}
                </p>
              ) : null}
            </div>
          </fieldset>

          <div className="mt-7 flex flex-col gap-3 border-t border-ascent-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => goToStep(2)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Back
            </Button>
            <p className="text-xs leading-5 text-ascent-muted sm:ml-auto">
              Your confirmation reference appears on this page.
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              {submitting ? (
                <>
                  <Spinner />
                  Submitting competition entry…
                </>
              ) : (
                "Submit competition entry"
              )}
            </Button>
          </div>
        </StageFrame>

        <div
          aria-hidden="true"
          className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
        >
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            autoComplete="off"
            tabIndex={-1}
            disabled={submitting}
          />
        </div>
      </form>
    </main>
  );
}
