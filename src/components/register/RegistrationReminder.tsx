"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Bell } from "lucide-react";
import { Button, Input } from "@/components/ui";

export default function RegistrationReminder() {
  const id = useId();
  const inFlight = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not save your reminder. Please try again.");
      }
      setStatus("saved");
      setEmail("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save your reminder. Please try again.");
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <div className="mt-4 text-ascent-ink">
      <Button
        variant="secondary"
        size="sm"
        aria-expanded={expanded}
        aria-controls={`${id}-form`}
        onClick={() => setExpanded(!expanded)}
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        Remind me
      </Button>
      <div id={`${id}-form`} hidden={!expanded} className="mt-4 max-w-md">
        {status === "saved" ? (
          <p role="status" className="text-sm leading-6">
            You’re on the reminder list. Your email has been saved for the Ascent team.
          </p>
        ) : (
          <form onSubmit={handleSubmit} aria-busy={status === "saving"}>
            <label htmlFor={`${id}-email`} className="text-sm font-semibold">
              Email address
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                id={`${id}-email`}
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={status === "saving"}
                aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
                className="min-w-0 flex-1"
              />
              <Button type="submit" disabled={status === "saving"} className="shrink-0">
                {status === "saving" ? "Saving…" : "Notify me"}
              </Button>
            </div>
            <p id={`${id}-description`} className="mt-2 text-xs leading-5 text-ascent-muted">
              Join the email reminder list for Ascent ’26 registration.
            </p>
            {error ? <p id={`${id}-error`} role="alert" className="mt-2 text-sm">{error}</p> : null}
          </form>
        )}
      </div>
    </div>
  );
}
