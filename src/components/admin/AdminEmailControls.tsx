"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function AdminEmailControls({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function processQueue() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const csrf = await fetch("/api/admin/session", { cache: "no-store" });
      const token = await csrf.json();
      if (!csrf.ok || !token.csrfToken) throw new Error("Please sign in again.");
      const response = await fetch("/api/admin/email", { method: "POST", headers: { "x-csrf-token": token.csrfToken } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Email processing failed.");
      setMessage(!result.configured ? "Configure Resend before processing email." : result.busy ? "Another worker is processing the queue." : `Processed ${result.processed} messages. Refresh the list for status; run again if messages remain due.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Email processing failed."); }
    finally { setBusy(false); }
  }
  return <div className="mt-5">
    <Button onClick={processQueue} disabled={!enabled || busy}>{busy ? "Processing…" : "Process due email"}</Button>
    <p role="status" className="mt-3 text-sm text-ascent-muted">{message}</p>
  </div>;
}
