import type { ReactNode } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function LegalPage({ title, version, children }: { title: string; version: string; children: ReactNode }) {
  return <><Navbar page="legal" /><main id="top" className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:px-6">
    <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
    <p className="mt-3 text-sm text-ascent-muted">Ascent ’26 · Version {version} · Published 14 September 2026</p>
    <div className="mt-8 space-y-8 text-sm leading-7 text-ascent-ink [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_p+p]:mt-3 [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">{children}</div>
  </main><Footer /></>;
}
