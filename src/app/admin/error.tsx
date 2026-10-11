"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function AdminPageError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-2xl font-semibold text-ascent-ink">The admin page couldn’t load.</h1>
      <p className="mt-3 text-sm leading-6 text-ascent-muted">
        The latest records are temporarily unavailable. If you just approved or rejected an entry,
        the decision may already be saved. Reload the list and check its status before submitting again.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-ascent-muted">Error reference: {error.digest}</p>
      ) : null}
      <Button
        className="mt-6"
        disabled={refreshing}
        onClick={() => startTransition(() => { router.refresh(); reset(); })}
      >
        {refreshing ? "Reloading…" : "Reload admin page"}
      </Button>
    </section>
  );
}
