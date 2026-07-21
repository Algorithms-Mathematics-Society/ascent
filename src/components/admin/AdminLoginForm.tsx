"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  getMultiFactorResolver,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  type MultiFactorResolver,
  type UserCredential,
  type MultiFactorError,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { Button, FormField, Input, Notice, Spinner } from "@/components/ui";
import { getFirebaseClientAuth } from "@/lib/firebaseClient";

export default function AdminLoginForm() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string>();
  const [resolver, setResolver] = useState<MultiFactorResolver>();
  const [verificationCode, setVerificationCode] = useState("");
  const [csrfToken, setCsrfToken] = useState<string>();

  const emailError =
    attempted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? "Enter your administrator email."
      : undefined;
  const passwordError =
    attempted && !password ? "Enter your password." : undefined;

  async function createAdminSession(
    credential: UserCredential,
    submittedCsrfToken: string,
  ) {
    const idToken = await credential.user.getIdToken(true);
    const sessionResponse = await fetch("/api/admin/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, csrfToken: submittedCsrfToken }),
    });
    const sessionPayload = (await sessionResponse.json()) as { error?: string };
    if (!sessionResponse.ok) {
      if (sessionResponse.status === 429 && sessionPayload.error) {
        throw new Error(sessionPayload.error);
      }
      if (sessionResponse.status === 403 && sessionPayload.error) {
        throw new Error(sessionPayload.error);
      }
      throw new Error("credentials");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    setGlobalError(undefined);

    const invalidEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const invalidPassword = !password;

    if (invalidEmail) {
      emailRef.current?.focus();
      return;
    }
    if (invalidPassword) {
      passwordRef.current?.focus();
      return;
    }

    setSubmitting(true);
    let auth;
    try {
      const csrfResponse = await fetch("/api/admin/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) throw new Error("csrf");
      setCsrfToken(csrfPayload.csrfToken);

      auth = getFirebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await createAdminSession(credential, csrfPayload.csrfToken);

      await signOut(auth);
      window.location.assign("/admin");
    } catch (error) {
      if (
        auth &&
        error instanceof FirebaseError &&
        error.code === "auth/multi-factor-auth-required"
      ) {
        const nextResolver = getMultiFactorResolver(auth, error as MultiFactorError);
        const totpFactor = nextResolver.hints.find(
          (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID,
        );
        if (totpFactor) {
          setResolver(nextResolver);
          setVerificationCode("");
          setPassword("");
          setSubmitting(false);
          window.setTimeout(() => codeRef.current?.focus(), 0);
          return;
        }
      }
      if (auth) await signOut(auth).catch(() => undefined);
      setGlobalError(
        error instanceof Error &&
          (error.message.startsWith("Too many") ||
            error.message.startsWith("Authenticator"))
          ? error.message
          : "Email or password is incorrect, or this account does not have admin access.",
      );
      setSubmitting(false);
    }
  }

  async function handleSecondFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = verificationCode.replace(/\D/g, "");
    if (!resolver || !csrfToken || code.length !== 6) {
      setGlobalError("Enter the six-digit code from your authenticator app.");
      codeRef.current?.focus();
      return;
    }

    const factor = resolver.hints.find(
      (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID,
    );
    if (!factor) {
      setGlobalError("This account does not have a supported authenticator factor.");
      return;
    }

    setSubmitting(true);
    setGlobalError(undefined);
    const auth = getFirebaseClientAuth();
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(factor.uid, code);
      const credential = await resolver.resolveSignIn(assertion);
      await createAdminSession(credential, csrfToken);
      await signOut(auth);
      window.location.assign("/admin");
    } catch (error) {
      await signOut(auth).catch(() => undefined);
      if (error instanceof FirebaseError && error.code === "auth/invalid-verification-code") {
        setGlobalError("That code was not accepted. Wait for a fresh code and try again.");
      } else {
        setGlobalError("The authenticator check expired. Sign in again to restart securely.");
        setResolver(undefined);
        setCsrfToken(undefined);
      }
      setSubmitting(false);
    }
  }

  if (resolver) {
    return (
      <form className="mt-8 space-y-5" noValidate onSubmit={handleSecondFactor}>
        <div className="border-l-2 border-ascent-brand pl-4">
          <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
            Step 2 of 2
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ascent-ink">
            Authenticator check
          </h2>
          <p className="mt-2 text-sm leading-6 text-ascent-muted">
            Open the authenticator linked to this account and enter its current code.
          </p>
        </div>

        {globalError ? (
          <Notice tone="danger" heading="Code not verified">
            {globalError}
          </Notice>
        ) : null}

        <FormField label="Six-digit code" id="admin_totp" required>
          <Input
            ref={codeRef}
            name="totp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={verificationCode}
            onChange={(event) => {
              setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6));
              setGlobalError(undefined);
            }}
            className="font-mono text-lg tracking-[0.28em] tabular-nums"
            disabled={submitting}
          />
        </FormField>

        <div className="border-t border-ascent-border pt-5">
          <Button type="submit" size="lg" className="w-full" disabled={submitting || verificationCode.length !== 6}>
            {submitting ? <span className="inline-flex items-center gap-2"><Spinner /> Verifying…</span> : "Verify and continue"}
          </Button>
          <button
            type="button"
            className="mt-3 min-h-11 w-full text-sm font-semibold text-ascent-brand underline underline-offset-4 hover:text-ascent-ink"
            onClick={async () => {
              await signOut(getFirebaseClientAuth()).catch(() => undefined);
              setResolver(undefined);
              setCsrfToken(undefined);
              setGlobalError(undefined);
            }}
          >
            Use a different account
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
      {globalError ? (
        <Notice tone="danger" heading="Unable to sign in">
          {globalError}
        </Notice>
      ) : null}

      <FormField label="Administrator email" id="admin_email" required error={emailError}>
        <Input
          ref={emailRef}
          name="email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setGlobalError(undefined);
          }}
          autoComplete="username"
          disabled={submitting}
        />
      </FormField>

      <FormField label="Password" id="admin_password" required error={passwordError}>
        <Input
          ref={passwordRef}
          name="password"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setGlobalError(undefined);
          }}
          autoComplete="current-password"
          disabled={submitting}
        />
      </FormField>

      <div className="border-t border-ascent-border pt-5">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <Spinner /> Signing in…
            </span>
          ) : (
            "Sign in to admin"
          )}
        </Button>
        <p className="mt-3 text-center text-xs leading-5 text-ascent-muted">
          Administrator access is logged and restricted to authorized staff.
        </p>
      </div>
    </form>
  );
}
