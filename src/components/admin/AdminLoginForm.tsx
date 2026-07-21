"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { Button, FormField, Input, Notice, Spinner } from "@/components/ui";
import { getFirebaseClientAuth } from "@/lib/firebaseClient";

export default function AdminLoginForm() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string>();

  const emailError =
    attempted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? "Enter your administrator email."
      : undefined;
  const passwordError =
    attempted && !password ? "Enter your password." : undefined;

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

      auth = getFirebaseClientAuth();
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      const idToken = await credential.user.getIdToken(true);
      const sessionResponse = await fetch("/api/admin/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, csrfToken: csrfPayload.csrfToken }),
      });
      const sessionPayload = (await sessionResponse.json()) as { error?: string };
      if (!sessionResponse.ok) {
        if (sessionResponse.status === 429 && sessionPayload.error) {
          throw new Error(sessionPayload.error);
        }
        throw new Error("credentials");
      }

      await signOut(auth);
      window.location.assign("/admin");
    } catch (error) {
      if (auth) await signOut(auth).catch(() => undefined);
      setGlobalError(
        error instanceof Error && error.message.startsWith("Too many")
          ? error.message
          : "Email or password is incorrect, or this account does not have admin access.",
      );
      setSubmitting(false);
    }
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
