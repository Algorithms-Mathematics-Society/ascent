"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebaseClient";

const EMAIL_STORAGE_KEY = "ascent_email_for_link";

async function exchangeSession(idToken: string) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Sign-in failed.");
}

export default function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;
    const storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    if (!storedEmail) {
      setError(
        "Open the sign-in link on the same device/browser you requested it from.",
      );
      return;
    }
    signInWithEmailLink(auth, storedEmail, window.location.href)
      .then(async (result) => {
        const idToken = await result.user.getIdToken();
        await exchangeSession(idToken);
        window.localStorage.removeItem(EMAIL_STORAGE_KEY);
        router.push("/register/handle");
      })
      .catch(() => setError("Sign-in link is invalid or expired."));
  }, [router]);

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      await exchangeSession(idToken);
      router.push("/register/handle");
    } catch {
      setError("Google sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/register`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
      setLinkSent(true);
    } catch {
      setError(
        "Could not send the sign-in link. Check the email and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold text-white">
        Register for AMS Ascent
      </h1>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="ascent-btn ascent-btn-primary"
      >
        Continue with Google
      </button>
      <div className="text-center text-sm text-ascent-muted">or</div>
      {linkSent ? (
        <p className="text-sm text-ascent-muted">
          Check {email} for a sign-in link.
        </p>
      ) : (
        <form onSubmit={handleSendLink} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-white/10 bg-ascent-panel px-4 py-2 text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="ascent-btn ascent-btn-secondary"
          >
            Email me a sign-in link
          </button>
        </form>
      )}
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
