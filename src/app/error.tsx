"use client";

import { Button } from "@/components/ui";

export default function PageError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-28">
      <h1 className="text-2xl font-semibold text-ascent-ink">This page couldn’t load.</h1>
      <p className="mt-3 text-sm leading-6 text-ascent-muted">Please try again in a moment. If you just submitted an entry, retry with the same form to check its status safely.</p>
      <Button onClick={reset} className="mt-6">Try again</Button>
    </main>
  );
}
