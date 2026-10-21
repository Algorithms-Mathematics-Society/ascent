// src/components/sections/Hero.tsx
import { Button } from "@/components/ui";
import { HERO_STATS } from "@/content/sections";
import { site } from "@/content/site";
import { REGISTRATION_CLOSED } from "@/lib/registrationLaunch";
import Countdown from "./Countdown";
import DeferredHeroCacheField from "./DeferredHeroCacheField";

export default function Hero() {
  const { community, proof, registration } = site;

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden border-b border-ascent-border bg-ascent-canvas px-4 pb-14 pt-24 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8 lg:pb-24 lg:pt-36"
    >
      <DeferredHeroCacheField />
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="max-w-5xl">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-brand">
              Ascent / 2026 C++ competition
            </p>

            <h1
              id="hero-title"
              className="mt-5 max-w-5xl text-4xl font-medium leading-[1.02] tracking-[-0.04em] text-ascent-ink sm:text-6xl sm:leading-[0.98] sm:tracking-[-0.045em] lg:text-[5.25rem]"
            >
              The ascent is measured in
              <span className="block text-ascent-brand">milliseconds.</span>
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-7 text-ascent-muted sm:mt-7 sm:text-lg sm:leading-8">
              Write correct C++, then make it faster. Ascent ranks valid
              submissions by measured speedup. The contest runs from an
              individual qualifier to a final round working on a real codebase.
            </p>

            {REGISTRATION_CLOSED ? (
              <p className="mt-7 inline-flex items-center gap-2.5 rounded-control border border-ascent-border bg-ascent-surface px-3 py-2 text-sm text-ascent-brand sm:mt-8">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ascent-gold" aria-hidden="true" />
                <span className="font-semibold tabular-nums">
                  Registration closed · {registration.closedCount} registered
                </span>
              </p>
            ) : null}

            <div className={`${REGISTRATION_CLOSED ? "mt-4" : "mt-7 sm:mt-8"} flex flex-wrap items-center gap-3`}>
              {REGISTRATION_CLOSED ? (
                <Button href="/register/status" size="lg" className="w-full sm:w-64">
                  Check entry status
                </Button>
              ) : (
                <Button href="/register" size="lg" className="w-full sm:w-64">
                  Register for Ascent
                </Button>
              )}
              <Button
                href="#tracks"
                variant="secondary"
                size="lg"
                className="w-full sm:w-64"
              >
                See the three rounds
              </Button>
              <Button
                href={community.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                size="lg"
                className="w-full sm:w-64"
              >
                Join WhatsApp community
                <span className="sr-only"> (opens in a new tab)</span>
              </Button>
            </div>

            <dl className="mt-8 grid max-w-3xl grid-cols-3 border-y border-ascent-border py-5 sm:mt-10">
              {HERO_STATS.map((stat, index) => (
                <div
                  key={stat.label}
                  className={
                    index === 0
                      ? "pr-4"
                      : "border-l border-ascent-border px-4 sm:px-6"
                  }
                >
                  <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ascent-muted">
                    {stat.label}
                  </dt>
                  <dd className="mt-1.5 text-sm font-semibold text-ascent-ink sm:text-base">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>

          </div>
        </div>

        <div className="mt-12 border-t border-ascent-border pt-6 sm:mt-16 lg:mt-20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-6">
              <p className="shrink-0 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
                {proof.lead}
              </p>
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {proof.stats.map((stat) => (
                  <li key={stat.label} className="flex items-baseline gap-1.5">
                    <span className="text-sm font-semibold text-ascent-ink">
                      {stat.value}
                    </span>
                    <span className="text-sm text-ascent-muted">
                      {stat.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {registration.closeISO ? (
              <Countdown closeISO={registration.closeISO} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
