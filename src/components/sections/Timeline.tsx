// src/components/sections/Timeline.tsx
import { Container, Section, SectionHeading } from "@/components/ui";
import { TIMELINE } from "@/content/sections";

export default function Timeline() {
  return (
    <Section
      id="timeline"
      className="scroll-mt-16 border-b border-ascent-border bg-ascent-surface"
    >
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-20">
          <div className="self-start lg:sticky lg:top-28">
            <SectionHeading
              eyebrow="Event sequence"
              title="Know what happens next."
              lede="The round structure is fixed. Dates remain visibly pending until the event team confirms them—no countdown or placeholder deadline is presented as fact."
            />
            <div className="mt-7 rounded-r-control border-l-2 border-ascent-brand bg-ascent-brand-tint px-4 py-3 text-sm leading-6 text-ascent-brand">
              Confirmed dates will be published here and shared through the
              contact details submitted during registration.
            </div>
          </div>

          <ol className="border-t border-ascent-border">
            {TIMELINE.map((item, index) => (
              <li
                key={item.phase}
                className="grid gap-4 border-b border-ascent-border py-7 sm:grid-cols-[3rem_1fr] sm:gap-6"
              >
                <span className="font-mono text-sm font-semibold text-ascent-brand">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg font-semibold text-ascent-ink">
                      {item.phase}
                    </h3>
                    <span className="w-fit rounded-control border border-ascent-border-strong bg-ascent-surface-subtle px-2.5 py-1 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-ascent-muted">
                      {item.timing}
                    </span>
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-ascent-muted">
                    {item.body}
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
