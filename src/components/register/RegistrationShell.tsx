import type { ReactNode } from "react";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

export default function RegistrationShell({
  children,
  title = "Register for Ascent",
  description,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
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
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-ascent-muted sm:mt-4 sm:text-lg">
                {description || "Complete the form below. You do not need an account. Have a shareable Google Drive resume link ready before you begin."}
              </p>
              {!description ? <p className="mt-3 text-sm"><a className="underline underline-offset-4" href="/register/status">Already registered? Check your entry status.</a></p> : null}
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
