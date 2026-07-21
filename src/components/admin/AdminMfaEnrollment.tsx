"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import {
  inMemoryPersistence,
  multiFactor,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  type TotpSecret,
} from "firebase/auth";
import QRCode from "qrcode";
import { Button, FormField, Input, Notice, Spinner } from "@/components/ui";
import { getFirebaseClientAuth } from "@/lib/firebaseClient";

type EnrollmentStage = "PASSWORD" | "AUTHENTICATOR" | "COMPLETE";

async function submitEnrollmentAction(action: "AUTHORIZE" | "COMPLETE", idToken: string) {
  const response = await fetch("/api/admin/mfa/enrollment", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, idToken }),
  });
  const result = (await response.json()) as { success?: boolean; error?: string };
  if (response.status === 401) {
    window.location.replace("/admin-page-login");
    throw new Error("Your admin session expired.");
  }
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Authenticator setup could not be completed.");
  }
}

export default function AdminMfaEnrollment({ email }: { email: string }) {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<EnrollmentStage>("PASSWORD");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<TotpSecret>();
  const [qrSvg, setQrSvg] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function beginEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || busy) {
      passwordRef.current?.focus();
      return;
    }

    setBusy(true);
    setError(undefined);
    const auth = getFirebaseClientAuth();
    try {
      await signOut(auth).catch(() => undefined);
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken(true);
      await submitEnrollmentAction("AUTHORIZE", idToken);

      const session = await multiFactor(credential.user).getSession();
      const nextSecret = await TotpMultiFactorGenerator.generateSecret(session);
      const uri = nextSecret.generateQrCodeUrl(email, "Ascent admin");
      const svg = await QRCode.toString(uri, {
        type: "svg",
        width: 224,
        margin: 1,
        color: { dark: "#0D1822", light: "#FFFFFF" },
        errorCorrectionLevel: "M",
      });
      setSecret(nextSecret);
      setQrSvg(svg);
      setPassword("");
      setStage("AUTHENTICATOR");
      window.setTimeout(() => codeRef.current?.focus(), 0);
    } catch (enrollmentError) {
      await signOut(auth).catch(() => undefined);
      if (
        enrollmentError instanceof FirebaseError &&
        enrollmentError.code === "auth/multi-factor-auth-required"
      ) {
        setError("This account already has an authenticator. Refresh to see its current status.");
        router.refresh();
      } else if (
        enrollmentError instanceof FirebaseError &&
        ["auth/invalid-credential", "auth/wrong-password"].includes(enrollmentError.code)
      ) {
        setError("That password was not accepted. Your admin session has not changed.");
      } else {
        setError(
          enrollmentError instanceof Error
            ? enrollmentError.message
            : "Authenticator setup could not be started.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function completeEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.replace(/\D/g, "");
    const auth = getFirebaseClientAuth();
    const user = auth.currentUser;
    if (!secret || !user || normalizedCode.length !== 6 || busy) {
      setError("Enter the current six-digit code from your authenticator app.");
      codeRef.current?.focus();
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        secret,
        normalizedCode,
      );
      await multiFactor(user).enroll(assertion, "Ascent authenticator");
      const idToken = await user.getIdToken(true);
      await submitEnrollmentAction("COMPLETE", idToken);
      await signOut(auth);
      setSecret(undefined);
      setQrSvg("");
      setCode("");
      setStage("COMPLETE");
      router.refresh();
    } catch (enrollmentError) {
      if (
        enrollmentError instanceof FirebaseError &&
        enrollmentError.code === "auth/invalid-verification-code"
      ) {
        setError("That code was not accepted. Wait for the next code and try again.");
      } else {
        setError(
          enrollmentError instanceof Error
            ? enrollmentError.message
            : "Authenticator enrollment could not be completed.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (stage === "COMPLETE") {
    return (
      <Notice tone="success" heading="Authenticator enrolled">
        The shared secret has been cleared from this page. Your next fresh sign-in will ask for
        a six-digit authenticator code. Block 3 will enforce MFA on every server session after
        both owners have completed this setup.
      </Notice>
    );
  }

  if (stage === "AUTHENTICATOR" && secret) {
    return (
      <form onSubmit={completeEnrollment} className="grid gap-6" noValidate>
        <div className="grid gap-px border border-ascent-border bg-ascent-border lg:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="flex items-center justify-center bg-white p-5">
            <div
              role="img"
              aria-label="QR code for the Ascent admin authenticator"
              className="w-full max-w-52 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
          <div className="bg-ascent-surface p-5 sm:p-6">
            <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
              Step 2 of 2 · Pair device
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-ascent-ink">
              Scan, then verify once
            </h3>
            <ol className="mt-4 grid gap-3 text-sm leading-6 text-ascent-muted">
              <li><strong className="text-ascent-ink">1.</strong> Open your authenticator app.</li>
              <li><strong className="text-ascent-ink">2.</strong> Scan this QR code or enter the key below.</li>
              <li><strong className="text-ascent-ink">3.</strong> Enter the current six-digit code to confirm.</li>
            </ol>
          </div>
        </div>

        <div className="border border-ascent-border bg-ascent-surface-subtle p-4">
          <p className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ascent-muted">
            Manual setup key
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <code className="break-all font-mono text-sm font-semibold tracking-[0.08em] text-ascent-ink">
              {secret.secretKey}
            </code>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(secret.secretKey);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? "Copied" : "Copy key"}
            </Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-ascent-muted">
            Treat this key like a password. It exists only in this browser while setup is open.
          </p>
        </div>

        {error ? <Notice tone="danger" heading="Could not confirm code">{error}</Notice> : null}

        <FormField label="Current six-digit code" id="mfa_enrollment_code" required>
          <Input
            ref={codeRef}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setError(undefined);
            }}
            disabled={busy}
            className="max-w-xs font-mono text-lg tracking-[0.28em] tabular-nums"
          />
        </FormField>

        <div className="flex flex-col gap-3 border-t border-ascent-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-ascent-brand underline underline-offset-4 hover:text-ascent-ink"
            disabled={busy}
            onClick={async () => {
              await signOut(getFirebaseClientAuth()).catch(() => undefined);
              setSecret(undefined);
              setQrSvg("");
              setCode("");
              setStage("PASSWORD");
              setError(undefined);
            }}
          >
            Cancel setup
          </button>
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? <span className="inline-flex items-center gap-2"><Spinner /> Confirming…</span> : "Confirm authenticator"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={beginEnrollment} className="grid gap-5" noValidate>
      <div className="border-l-2 border-ascent-brand pl-4">
        <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
          Step 1 of 2 · Confirm identity
        </p>
        <p className="mt-2 max-w-xl text-sm leading-6 text-ascent-muted">
          Enter the password for <strong className="text-ascent-ink">{email}</strong>. This opens
          a short-lived setup session; your existing admin session stays intact if setup is cancelled.
        </p>
      </div>

      {error ? <Notice tone="danger" heading="Could not start setup">{error}</Notice> : null}

      <FormField label="Current password" id="mfa_current_password" required>
        <Input
          ref={passwordRef}
          name="password"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(undefined);
          }}
          autoComplete="current-password"
          disabled={busy}
        />
      </FormField>

      <div className="flex justify-end border-t border-ascent-border pt-5">
        <Button type="submit" disabled={busy || !password}>
          {busy ? <span className="inline-flex items-center gap-2"><Spinner /> Preparing…</span> : "Continue to authenticator"}
        </Button>
      </div>
    </form>
  );
}
