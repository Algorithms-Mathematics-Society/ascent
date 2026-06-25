// src/components/sections/Hero.tsx
import { Button } from "@/components/ui";
import { HERO_STATS } from "@/content/sections";
import { site } from "@/content/site";
import BenchmarkConsole from "./BenchmarkConsole";
import HeroBackdrop from "./HeroBackdrop";
import HeroDescent from "./HeroDescent";
import { HeroFlowProvider } from "./HeroFlowContext";
import Countdown from "./Countdown";

export default function Hero() {
  const { proof, registration } = site;
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pb-24 pt-28 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36">
      <HeroFlowProvider>
        {/* CSS base (always on; also the fallback) + 3D descent above it */}
        <HeroBackdrop />
        <HeroDescent />
        {/* Scrim: the copy always sits on a calm dark bed (same protection the
            card gets); the landscape lives in the right/negative space. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to right, rgb(var(--ascent-bg)) 0%, rgb(var(--ascent-bg) / 0.88) 30%, rgb(var(--ascent-bg) / 0.4) 52%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        {/* Copy */}
        <div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-ascent-ink sm:text-5xl lg:text-6xl">
            The ascent is
            <br />
            <span className="bg-gradient-to-r from-ascent-accent-bright to-ascent-cyan bg-clip-text text-transparent">
              measured in milliseconds.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ascent-muted">
            AMS Ascent is a C++ performance contest. Beyond finding the right
            algorithm, you optimize a real codebase against a baseline — cache,
            memory layout, allocation, the work that decides latency in the real
            world. The fastest correct solution climbs.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href="#register" size="lg">
              Register
            </Button>
            <Button href="#tracks" variant="secondary" size="lg">
              View tracks
            </Button>
          </div>

          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 font-mono">
            {HERO_STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs uppercase tracking-wider text-ascent-muted">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold text-ascent-ink">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Credibility — anchors the lower-left, balances the card.
              Org track record (honestly attributed to AMS Derive), plus the
              countdown when a real close date is configured. */}
          <div className="mt-10 border-t border-ascent-border/70 pt-6">
            <p className="font-mono text-xs uppercase tracking-wider text-ascent-muted">
              {proof.lead}
            </p>
            <ul className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1">
              {proof.stats.map((stat) => (
                <li key={stat.label} className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-ascent-ink">
                    {stat.value}
                  </span>
                  <span className="text-sm text-ascent-muted">{stat.label}</span>
                </li>
              ))}
            </ul>
            {registration.closeISO ? (
              <div className="mt-4">
                <Countdown closeISO={registration.closeISO} />
              </div>
            ) : null}
          </div>
        </div>

          {/* Live benchmark — runs on the visitor's own machine */}
          <div className="lg:pl-6">
            <BenchmarkConsole />
          </div>
        </div>
      </HeroFlowProvider>
    </section>
  );
}
