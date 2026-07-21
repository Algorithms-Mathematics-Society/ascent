import type { ReactNode } from "react";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

export default function RegistrationShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ascent-canvas">
      <Navbar page="registration" />

      <div id="top" tabIndex={-1} className="pt-16">
        <header className="border-b border-ascent-border bg-ascent-surface">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-ascent-brand">
                Ascent / Competition entry
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-ascent-ink sm:text-5xl">
                Register for Ascent
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-ascent-muted sm:mt-4 sm:text-lg">
                Complete your entry on this page—no account or email handoff.
                Have a shareable Google Drive resume link ready before you begin.
              </p>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          {children}
        </div>
      </div>

      <Footer compact homeHref="/" />
    </div>
  );
}
