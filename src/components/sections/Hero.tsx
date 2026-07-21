// src/components/sections/Hero.tsx
import { Button } from "@/components/ui";
import { HERO_STATS } from "@/content/sections";
import { site } from "@/content/site";
import Countdown from "./Countdown";

export default function Hero() {
  const { proof, registration } = site;

  return (
    <section
      aria-labelledby="hero-title"
      className="border-b border-ascent-border bg-ascent-canvas px-4 pb-14 pt-24 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8 lg:pb-24 lg:pt-36"
    >
      <div className="mx-auto max-w-7xl">
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
              Ascent is a C++ optimization competition. Correctness is the
              gate; measured speedup drives the ranklist. Start with the
              qualifier and advance toward a real-codebase finale.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
              <Button href="/register" size="lg" className="w-full sm:w-64">
                Register for Ascent
              </Button>
              <Button
                href="#tracks"
                variant="secondary"
                size="lg"
                className="w-full sm:w-64"
              >
                Explore competition tracks
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
