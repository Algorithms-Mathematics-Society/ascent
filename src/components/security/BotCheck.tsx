"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type Turnstile = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
};
declare global { interface Window { turnstile?: Turnstile } }

export default function BotCheck({ action, onToken, resetKey = 0 }: {
  action: "registration" | "reminder" | "status_link";
  onToken: (token: string) => void;
  resetKey?: number;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const target = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    callback.current("");
    if (!siteKey || !ready || !target.current || !window.turnstile) return;
    setError("");
    const widget = window.turnstile.render(target.current, {
      sitekey: siteKey, action, theme: "light", size: "flexible", "response-field": false,
      callback: (token: string) => { setError(""); callback.current(token); },
      "expired-callback": () => callback.current(""),
      "timeout-callback": () => { callback.current(""); setError("Verification timed out. Please retry."); },
      "error-callback": () => { callback.current(""); setError("Verification could not load. Check your connection and retry."); },
    });
    return () => { window.turnstile?.remove(widget); };
  }, [action, ready, resetKey, siteKey]);
  if (!siteKey) return <p role="status" className="mt-3 text-sm text-ascent-muted">Online verification is being set up. Please try again later or contact <a className="underline" href="mailto:team@amshq.in">team@amshq.in</a>.</p>;
  return <div className="my-4 min-h-16">
    <Script id="ascent-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setReady(true)} onError={() => setError("Verification could not load. Please check your connection and reload.")} />
    <div ref={target} />
    {error ? <p role="alert" className="mt-2 text-sm text-ascent-danger">{error}</p> : null}
  </div>;
}
