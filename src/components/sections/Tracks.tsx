// src/components/sections/Tracks.tsx
import { Container, Section, SectionHeading } from "@/components/ui";
import { COMPETITION_ROUNDS } from "@/content/sections";

export default function Tracks() {
  return (
    <Section
      id="tracks"
      className="scroll-mt-16 border-b border-ascent-border bg-ascent-canvas"
    >
      <Container>
        <SectionHeading
          eyebrow="Competition format"
          title="Three rounds. Increasingly real systems work."
          lede="The contest moves from individual C++ performance problems to collaborative optimization and, finally, a real codebase. Each round asks for more than the one before it."
          className="max-w-3xl"
        />

        <div className="mt-12 overflow-hidden border-y border-ascent-border bg-ascent-surface">
          <div className="hidden grid-cols-[3.5rem_minmax(0,1.05fr)_minmax(0,0.72fr)_minmax(0,0.92fr)_minmax(0,1.45fr)] gap-5 border-b border-ascent-border bg-ascent-surface-subtle px-5 py-3 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-ascent-muted lg:grid">
            <span>Round</span>
            <span>Stage</span>
            <span>Entry</span>
            <span>Setting</span>
            <span>What changes</span>
          </div>

          <ol className="divide-y divide-ascent-border">
            {COMPETITION_ROUNDS.map((round) => (
              <li
                key={round.number}
                className="grid grid-cols-[3rem_1fr] gap-4 px-5 py-6 lg:grid-cols-[3.5rem_minmax(0,1.05fr)_minmax(0,0.72fr)_minmax(0,0.92fr)_minmax(0,1.45fr)] lg:gap-5"
              >
                <span className="font-mono text-sm font-semibold text-ascent-brand">
                  {round.number}
                </span>
                <div className="col-start-2 lg:col-auto">
                  <span className="mb-1 block font-mono text-[0.625rem] uppercase tracking-[0.12em] text-ascent-muted lg:hidden">
                    Stage
                  </span>
                  <h3 className="font-semibold text-ascent-ink">
                    {round.phase}
                  </h3>
                </div>
                <div className="col-start-2 lg:col-auto">
                  <span className="mb-1 block font-mono text-[0.625rem] uppercase tracking-[0.12em] text-ascent-muted lg:hidden">
                    Entry
                  </span>
                  <p className="text-sm leading-6 text-ascent-ink">
                    {round.participation}
                  </p>
                </div>
                <div className="col-start-2 lg:col-auto">
                  <span className="mb-1 block font-mono text-[0.625rem] uppercase tracking-[0.12em] text-ascent-muted lg:hidden">
                    Setting
                  </span>
                  <p className="text-sm leading-6 text-ascent-ink">
                    {round.setting}
                  </p>
                </div>
                <div className="col-start-2 lg:col-auto">
                  <span className="mb-1 block font-mono text-[0.625rem] uppercase tracking-[0.12em] text-ascent-muted lg:hidden">
                    What changes
                  </span>
                  <p className="text-sm leading-6 text-ascent-muted">
                    {round.focus}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
