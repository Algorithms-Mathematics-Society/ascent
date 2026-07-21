// src/components/sections/RegistrationCta.tsx
import { ArrowRight } from "lucide-react";
import { Button, Container } from "@/components/ui";
import DeferredCtaOptimizationCurrent from "./DeferredCtaOptimizationCurrent";

const REGISTRATION_FACTS = [
  "No account or sign-in",
  "Google Drive resume link",
  "Submit on this site",
] as const;

export default function RegistrationCta() {
  return (
    <section
      id="prizes"
      className="relative isolate scroll-mt-16 overflow-hidden bg-ascent-brand py-16 text-ascent-on-brand sm:py-20"
    >
      <DeferredCtaOptimizationCurrent />
      <Container className="relative z-10">
        <div
          id="register"
          className="scroll-mt-24 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:items-end lg:gap-16"
        >
          <div data-cta-obstacle>
            <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ascent-on-brand/70">
              Competition entry
            </p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to put your C++ performance to the test?
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ascent-on-brand/75 sm:text-lg">
              Bring your contact and education details and a shareable Google
              Drive resume link. A transcript and Codeforces handle are
              optional. Registration stays here from start to submission.
            </p>

            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ascent-on-brand/80">
              {REGISTRATION_FACTS.map((fact) => (
                <li key={fact} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 bg-ascent-on-brand"
                  />
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          <div
            data-cta-obstacle
            className="flex flex-col items-start gap-4 lg:items-end"
          >
            <Button href="/register" size="lg" variant="secondary">
              Register for Ascent
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
            <a
              href="#timeline"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-ascent-on-brand underline decoration-ascent-on-brand/40 underline-offset-4 hover:decoration-ascent-on-brand"
            >
              Review the event sequence
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
