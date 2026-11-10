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
import BotCheck, { type BotCheckStatus } from "@/components/security/BotCheck";
import { Button, FormField, Input, Notice, Spinner } from "@/components/ui";
import { PRIVACY_URL } from "@/content/legal";
import { ROUND_ONE_SELECTION_COUNT } from "@/lib/results";
import CertificateReady from "./CertificateReady";
import {
  startCertificateImage,
  type CertificateImageJob,
} from "./certificateImage";
import {
  errorMessage,
  isCertificateSummary,
  postJson,
  requestCertificate,
  type CertificateSummary,
} from "./certificateRequest";
import { CERTIFICATE_CODE_ACCEPTED } from "@/lib/certificates/shared";

type Step = "checking" | "email" | "code" | "done";

const RESEND_COOLDOWN_SECONDS = 30;
const CODE_LENGTH = 6;
const SENT_FALLBACK = CERTIFICATE_CODE_ACCEPTED;
/** How long a click waits for Turnstile before giving up, unless the widget asks the visitor to act. */
export const BOT_WAIT_TIMEOUT_MS = 15_000;
const BOT_WAIT_TIMEOUT_MESSAGE =
  "The verification check is taking longer than expected. Check your connection, then try again. If it keeps happening, reload the page.";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/** Owns its own one-second tick, so the countdown re-renders this button and nothing else. */
function ResendButton({
  availableAt,
  disabled,
  resending,
  onResend,
}: {
  availableAt: number;
  disabled: boolean;
  resending: boolean;
  onResend: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((availableAt - now) / 1000));
  useEffect(() => {
    if (remaining <= 0) return;
    // Wake on the next whole-second boundary, so a throttled tab never drifts.
    const delay = (availableAt - Date.now()) % 1000 || 1000;
    const timer = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [availableAt, remaining]);
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  return (
    <Button
      variant="secondary"
      size="lg"
      disabled={disabled || remaining > 0 || resending}
      onClick={onResend}
    >
      {remaining > 0
        ? `Resend code in ${minutes}:${seconds}`
        : resending
          ? "Resending…"
          : "Resend code"}
    </Button>
  );
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
  const [resendAt, setResendAt] = useState(0);
  const [resending, setResending] = useState(false);
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);
  const [waitingForBot, setWaitingForBot] = useState(false);
  const [imageJob, setImageJob] = useState<CertificateImageJob | null>(null);

  const inFlight = useRef(false);
  const moveFocus = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const imageJobRef = useRef<CertificateImageJob | null>(null);
  const pendingSubmit = useRef(false);
  const botFailed = useRef(false);
  const botWaitTimer = useRef<number>();

  // One owner for the PNG transfer: replacing or clearing it always aborts and frees the old one.
  const replaceImageJob = useCallback((next: CertificateImageJob | null) => {
    imageJobRef.current?.dispose();
    imageJobRef.current = next;
    setImageJob(next);
  }, []);

  useEffect(
    () => () => {
      imageJobRef.current?.dispose();
      imageJobRef.current = null;
      window.clearTimeout(botWaitTimer.current);
      pendingSubmit.current = false;
    },
    [],
  );

  const restoreSession = useCallback(async () => {
    setStep("checking");
    setSessionCheckFailed(false);
    setError("");
    // /me and the PNG ride the same cookie, so the 2MB transfer starts now
    // instead of one full round trip later.
    const job = startCertificateImage();
    replaceImageJob(job);
    try {
      const { response, data } = await requestCertificate(
        "/api/certificates/me",
      );
      // A newer check (or a Strict Mode remount) took over: leave the screen to it.
      if (imageJobRef.current !== job) return;
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
      if (imageJobRef.current !== job) return;
      setSessionCheckFailed(true);
      setError(errorMessage(caught, "We couldn’t check for an open session."));
    }
    replaceImageJob(null);
    setStep("email");
  }, [replaceImageJob]);

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

  function goTo(next: Step) {
    moveFocus.current = true;
    setStep(next);
  }

  function stopWaitingForBot() {
    pendingSubmit.current = false;
    window.clearTimeout(botWaitTimer.current);
    setWaitingForBot(false);
  }

  function resetBotCheck() {
    // Turnstile tokens are single-use, so every submission needs a fresh widget.
    botFailed.current = false;
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
        setResendAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
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
    if (busy || pendingSubmit.current) return;
    if (!email.trim()) {
      setError("Enter the email you registered with.");
      emailInput.current?.focus();
      return;
    }
    if (botToken) {
      void sendCode(botToken, false);
      return;
    }
    // No token yet: hold the click and send the moment Turnstile answers, no second click.
    // A widget that already failed gets a fresh start, so the click doubles as "retry".
    if (botFailed.current) resetBotCheck();
    setError("");
    pendingSubmit.current = true;
    setWaitingForBot(true);
    setAnnouncement("Verifying you’re human. Your code will be sent automatically.");
    armBotWait();
  }

  function armBotWait() {
    window.clearTimeout(botWaitTimer.current);
    botWaitTimer.current = window.setTimeout(() => {
      if (!pendingSubmit.current) return;
      stopWaitingForBot();
      setError(BOT_WAIT_TIMEOUT_MESSAGE);
      // A fresh widget is the best chance the next click succeeds.
      resetBotCheck();
    }, BOT_WAIT_TIMEOUT_MS);
  }

  function receiveBotToken(token: string) {
    setBotToken(token);
    if (!token || !pendingSubmit.current) return;
    stopWaitingForBot();
    void sendCode(token, false);
  }

  function botStatus(status: BotCheckStatus) {
    if (status === "error") botFailed.current = true;
    if (!pendingSubmit.current) return;
    if (status === "interactive") {
      // The visitor now has something to do: never time them out mid-check.
      window.clearTimeout(botWaitTimer.current);
      setAnnouncement("Complete the quick check below to continue.");
      return;
    }
    // BotCheck shows (and announces) its own error next to the widget.
    stopWaitingForBot();
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
      // The session cookie is set now: start the PNG before React even renders the done card.
      replaceImageJob(startCertificateImage());
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
    setResendAt(0);
    stopWaitingForBot();
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
      replaceImageJob(null);
      setSummary(null);
      setEmail("");
      setCode("");
      setResendAt(0);
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
                    disabled={busy || waitingForBot}
                  />
                </FormField>
                <BotCheck
                  action="certificate_code"
                  appearance="interaction-only"
                  onToken={receiveBotToken}
                  onStatus={botStatus}
                  resetKey={botReset}
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={busy || waitingForBot}
                  className="w-full sm:w-auto"
                >
                  {waitingForBot ? (
                    <>
                      <Spinner /> Verifying you’re human…
                    </>
                  ) : busy ? (
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
                  <ResendButton
                    key={resendAt}
                    availableAt={resendAt}
                    disabled={busy}
                    resending={resending}
                    onResend={() => {
                      setError("");
                      resetBotCheck();
                      setResending(true);
                    }}
                  />
                </div>
                {resending ? (
                  <div>
                    <p className="mt-4 text-sm leading-6 text-ascent-muted">
                      Completing a quick check, then we’ll send a new code.
                    </p>
                    <BotCheck
                      action="certificate_code"
                      appearance="interaction-only"
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
              image={imageJob}
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
