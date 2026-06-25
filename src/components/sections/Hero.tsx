// src/components/sections/Hero.tsx
import { Button } from "@/components/ui";
import { HERO_STATS } from "@/content/sections";
import SpeedupConsole from "./SpeedupConsole";
import HeroBackdrop from "./HeroBackdrop";

export default function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pb-24 pt-28 sm:px-6 sm:pt-32 lg:px-8 lg:pt-36">
      <HeroBackdrop />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        {/* Copy */}
        <div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-ascent-ink sm:text-5xl lg:text-6xl">
            The ascent is
            <br />
            <span className="bg-gradient-to-r from-ascent-accent to-ascent-cyan bg-clip-text text-transparent">
              measured in milliseconds.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ascent-muted">
            AMS Ascent is a C++ performance contest. Beyond finding the right
            algorithm, you optimize a real codebase against a baseline — cache,
            memory layout, allocation, the work that decides latency in the real
            world. The fastest correct solution climbs.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button href="#register" size="lg">
              Register
            </Button>
            <Button href="#tracks" variant="secondary" size="lg">
              View tracks
            </Button>
          </div>

          <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 font-mono">
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
        </div>

        {/* Speedup reveal */}
        <div className="lg:pl-6">
          <SpeedupConsole />
        </div>
      </div>
    </section>
  );
}
