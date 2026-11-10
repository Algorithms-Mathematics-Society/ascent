"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { ArrowRight, Award, Mail } from "lucide-react";
import BotCheck from "@/components/security/BotCheck";
import { Button, FormField, Input, Notice, Spinner } from "@/components/ui";
import { PRIVACY_URL } from "@/content/legal";
import { ROUND_ONE_SELECTION_COUNT } from "@/lib/results";
import CertificateReady from "./CertificateReady";
import {
  errorMessage,
  isCertificateSummary,
  postJson,
  requestCertificate,
  type CertificateSummary,
} from "./certificateRequest";

type Step = "checking" | "email" | "code" | "done";

const RESEND_COOLDOWN_SECONDS = 30;
const CODE_LENGTH = 6;
const SENT_FALLBACK =
  "If this email belongs to a Round 1 qualifier, a 6-digit code is on its way. Check spam too.";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

export default function CertificatePortal({
  hasSession,
  expired = false,
}: {
  hasSession: boolean;
  expired?: boolean;
}) {
  const [step, setStep] = useState<Step>(hasSession ? "checking" : "email");
  const [summary, setSummary] = useState<CertificateSummary | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [botToken, setBotToken] = useState("");
  const [botReset, setBotReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    expired && !hasSession
      ? "Your 30-minute session ended. Request a new code to download your certificate again."
      : "",
  );
  const [announcement, setAnnouncement] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);

  const inFlight = useRef(false);
  const moveFocus = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  const restoreSession = useCallback(async () => {
    setStep("checking");
    setSessionCheckFailed(false);
    setError("");
    try {
      const { response, data } = await requestCertificate(
        "/api/certificates/me",
      );
      if (response.ok && isCertificateSummary(data.certificate)) {
        setSummary(data.certificate);
        setStep("done");
        setAnnouncement("Your certificate is ready.");
        return;
      }
      // 401 simply means no live session: start at the email step without alarming anyone.
      if (response.status !== 401) {
        setSessionCheckFailed(true);
        setError(
          data.error ||
            "We couldn’t check for an open session. You can try again, or request a new code below.",
        );
      }
    } catch (caught) {
      setSessionCheckFailed(true);
      setError(errorMessage(caught, "We couldn’t check for an open session."));
    }
    setStep("email");
  }, []);

  useEffect(() => {
    if (hasSession) void restoreSession();
  }, [hasSession, restoreSession]);

  // Focus follows user-driven step changes only, never the initial render.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    if (step === "email") emailInput.current?.focus();
    if (step === "code") codeInput.current?.focus();
    if (step === "done") doneHeading.current?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCooldown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function goTo(next: Step) {
    moveFocus.current = true;
    setStep(next);
  }

  function resetBotCheck() {
    // Turnstile tokens are single-use, so every submission needs a fresh widget.
    setBotToken("");
    setBotReset((value) => value + 1);
  }

  async function sendCode(token: string, isResend: boolean) {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError("");
      try {
        const { response, data } = await postJson("/api/certificates/code", {
          email: email.trim(),
          botToken: token,
        });
        if (!response.ok)
          throw new Error(
            data.error || "We couldn’t send a code. Please try again.",
          );
        const message = data.message || SENT_FALLBACK;
        setNotice(message);
        setAnnouncement(
          isResend ? `A new code was requested. ${message}` : message,
        );
        setCode("");
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setResending(false);
        if (isResend) codeInput.current?.focus();
        else goTo("code");
      } catch (caught) {
        setError(
          errorMessage(caught, "We couldn’t send a code. Please try again."),
        );
        // Stop the automatic resend so a failure never loops through fresh tokens.
        if (isResend) setResending(false);
      } finally {
        inFlight.current = false;
        setBusy(false);
        resetBotCheck();
      }
  }

  function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!email.trim()) {
      setError("Enter the email you registered with.");
      emailInput.current?.focus();
      return;
    }
    if (!botToken) {
      setError(
        "The verification check hasn’t finished yet. Wait a moment, then try again. If it doesn’t appear, reload the page.",
      );
      return;
    }
    void sendCode(botToken, false);
  }

  // On resend the widget reappears and the request goes out as soon as it yields a token.
  function resendWithToken(token: string) {
    if (token) void sendCode(token, true);
  }

  async function verifyCode(value: string) {
    if (inFlight.current || value.length !== CODE_LENGTH) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const { response, data } = await postJson("/api/certificates/verify", {
        email: email.trim(),
        code: value,
      });
      if (!response.ok || !isCertificateSummary(data.certificate)) {
        throw new Error(
          data.error || "We couldn’t check that code. Please try again.",
        );
      }
      setSummary(data.certificate);
      setNotice("");
      setCode("");
      setAnnouncement("Code accepted. Your certificate is ready.");
      goTo("done");
    } catch (caught) {
      setError(
        errorMessage(caught, "We couldn’t check that code. Please try again."),
      );
      setCode("");
      requestAnimationFrame(() => codeInput.current?.focus());
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function updateCode(raw: string) {
    const next = digitsOnly(raw);
    setCode(next);
    if (error && next) setError("");
    if (next.length === CODE_LENGTH) void verifyCode(next);
  }

  function pasteCode(event: ClipboardEvent<HTMLInputElement>) {
    // maxLength would truncate "123 456" before the spaces are stripped, so handle paste directly.
    const pasted = digitsOnly(event.clipboardData.getData("text"));
    if (!pasted) return;
    event.preventDefault();
    updateCode(pasted);
  }

  function switchEmail() {
    setCode("");
    setError("");
    setNotice("");
    setResending(false);
    setCooldown(0);
    resetBotCheck();
    setAnnouncement("Enter a different email address.");
    goTo("email");
  }

  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const { response, data } = await requestCertificate(
        "/api/certificates/session",
        { method: "DELETE" },
      );
      if (!response.ok)
        throw new Error(
          data.error || "We couldn’t sign you out. Please try again.",
        );
      setSummary(null);
      setEmail("");
      setCode("");
      setCooldown(0);
      resetBotCheck();
      setNotice(
        "You’re signed out. Your certificate stays available: request a new code any time.",
      );
      setAnnouncement("You’re signed out.");
      goTo("email");
    } catch (caught) {
      setError(
        errorMessage(caught, "We couldn’t sign you out. Please try again."),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const minutes = Math.floor(cooldown / 60);
  const seconds = String(cooldown % 60).padStart(2, "0");

  return (
    <main
      id="top"
      tabIndex={-1}
      className="min-h-screen bg-ascent-canvas pt-16 outline-none"
    >
      <section className="relative overflow-hidden bg-ascent-ink text-white">
        <div
          aria-hidden="true"
          className="absolute -right-28 -top-40 h-[32rem] w-[32rem] rounded-full border border-ascent-gold/20"
        />
        <div
          aria-hidden="true"
          className="absolute -right-14 -top-24 h-80 w-80 rounded-full border border-ascent-gold/15"
        />
        <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-6 sm:pb-28 sm:pt-16">
          <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ascent-gold">
            <Award size={17} aria-hidden="true" /> Ascent ’26 · Round 1
          </div>
          <h1 className="mt-5 font-display text-5xl leading-[0.96] sm:text-6xl">
            Your certificate
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
            For the {ROUND_ONE_SELECTION_COUNT} qualifiers selected for Round 2.
            Enter the email you registered with and we’ll send you a one-time
            code. No password needed.
          </p>
        </div>
      </section>

      <div className="relative mx-auto -mt-14 max-w-3xl px-4 pb-14 sm:-mt-16 sm:px-6 sm:pb-20">
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announcement}
        </p>

        <section
          aria-busy={busy || step === "checking"}
          className="min-h-[24rem] rounded-panel border border-ascent-border bg-ascent-surface p-6 shadow-[0_22px_70px_rgba(20,40,58,0.10)] sm:p-8"
        >
          {error ? (
            <Notice tone="danger" className="mb-5">
              {error}{" "}
              {sessionCheckFailed && step === "email" ? (
                <button
                  type="button"
                  onClick={() => void restoreSession()}
                  className="font-semibold underline underline-offset-4"
                >
                  Try again
                </button>
              ) : null}
            </Notice>
          ) : null}

          {step === "checking" ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center gap-3 text-sm text-ascent-muted">
              <Spinner size="md" className="text-ascent-brand" />
              <p role="status">Checking for an open session…</p>
            </div>
          ) : step === "email" ? (
            <div>
              <h2 className="font-display text-3xl text-ascent-ink sm:text-4xl">
                Get your certificate
              </h2>
              <p className="mt-2 text-sm leading-6 text-ascent-muted">
                We’ll email a 6-digit code to confirm it’s you.
              </p>
              {notice ? (
                <Notice tone="success" className="mt-5">
                  {notice}
                </Notice>
              ) : null}
              <form
                onSubmit={requestCode}
                className="mt-6"
                aria-busy={busy}
              >
                <FormField
                  label="Registered email"
                  description="Use the same email address you registered for Ascent with."
                >
                  <Input
                    ref={emailInput}
                    id="certificate-email"
                    type="email"
                    name="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={busy}
                  />
                </FormField>
                <BotCheck
                  action="certificate_code"
                  onToken={setBotToken}
                  resetKey={botReset}
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={busy}
                  className="w-full sm:w-auto"
                >
                  {busy ? (
                    <>
                      <Spinner /> Sending…
                    </>
                  ) : (
                    <>
                      <Mail size={18} aria-hidden="true" /> Email me a code
                    </>
                  )}
                </Button>
                <p className="mt-4 text-xs leading-5 text-ascent-muted">
                  We use this address only to send your code and prevent abuse.{" "}
                  <a
                    href={PRIVACY_URL}
                    className="underline underline-offset-2"
                  >
                    Privacy policy
                  </a>
                  .
                </p>
              </form>
            </div>
          ) : step === "code" ? (
            <div>
              <h2 className="font-display text-3xl text-ascent-ink sm:text-4xl">
                Enter your code
              </h2>
              <p className="mt-2 text-sm leading-6 text-ascent-muted">
                We sent a 6-digit code to{" "}
                <strong className="break-all font-semibold text-ascent-ink">
                  {email.trim()}
                </strong>
                .{" "}
                <button
                  type="button"
                  onClick={switchEmail}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center font-semibold text-ascent-brand underline underline-offset-4 sm:min-h-0"
                >
                  Use a different email
                </button>
              </p>
              {notice ? (
                <Notice tone="info" className="mt-5">
                  {notice}
                </Notice>
              ) : null}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyCode(code);
                }}
                className="mt-6"
                aria-busy={busy}
              >
                <FormField
                  label="6-digit code"
                  description="It expires in 10 minutes."
                >
                  <Input
                    ref={codeInput}
                    id="certificate-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={CODE_LENGTH}
                    required
                    spellCheck={false}
                    value={code}
                    onChange={(event) => updateCode(event.target.value)}
                    onPaste={pasteCode}
                    readOnly={busy}
                    aria-invalid={error ? true : undefined}
                    placeholder="000000"
                    className="max-w-[16rem] text-center font-mono text-2xl font-semibold tracking-[0.45em] placeholder:tracking-[0.45em]"
                  />
                </FormField>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={busy || code.length !== CODE_LENGTH}
                  >
                    {busy && !resending ? (
                      <>
                        <Spinner /> Checking…
                      </>
                    ) : (
                      <>
                        Continue <ArrowRight size={18} aria-hidden="true" />
                      </>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    disabled={busy || cooldown > 0 || resending}
                    onClick={() => {
                      setError("");
                      resetBotCheck();
                      setResending(true);
                    }}
                  >
                    {cooldown > 0
                      ? `Resend code in ${minutes}:${seconds}`
                      : resending
                        ? "Resending…"
                        : "Resend code"}
                  </Button>
                </div>
                {resending ? (
                  <div>
                    <p className="mt-4 text-sm leading-6 text-ascent-muted">
                      Completing a quick check, then we’ll send a new code.
                    </p>
                    <BotCheck
                      action="certificate_code"
                      onToken={resendWithToken}
                      resetKey={botReset}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setResending(false);
                        resetBotCheck();
                      }}
                      disabled={busy}
                      className="min-h-11 text-sm font-medium text-ascent-muted underline underline-offset-4 hover:text-ascent-ink"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </form>
              <p className="mt-6 border-t border-ascent-border pt-5 text-sm leading-6 text-ascent-muted">
                Didn’t get it? Check spam, or make sure you used the email you
                registered with. Still stuck?{" "}
                <a
                  href="mailto:team@amshq.in?subject=Ascent%20certificate"
                  className="font-medium text-ascent-ink underline underline-offset-4"
                >
                  team@amshq.in
                </a>
              </p>
            </div>
          ) : summary ? (
            <CertificateReady
              ref={doneHeading}
              summary={summary}
              busy={busy}
              onSignOut={() => void signOut()}
              onAnnounce={setAnnouncement}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}
