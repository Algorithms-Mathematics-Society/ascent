"use client";

import { useState } from "react";
import { Button, Spinner } from "@/components/ui";

export default function AdminLogoutButton() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  async function handleLogout() {
    setSubmitting(true);
    setError(undefined);

    try {
      const csrfResponse = await fetch("/api/admin/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) throw new Error("csrf");

      const response = await fetch("/api/admin/session", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csrfToken: csrfPayload.csrfToken }),
      });
      if (!response.ok) throw new Error("logout");

      window.location.replace("/admin-page-login");
    } catch {
      setError("Could not sign out. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={submitting}
        onClick={handleLogout}
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <Spinner /> Signing out…
          </span>
        ) : (
          "Sign out"
        )}
      </Button>
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
