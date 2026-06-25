// src/components/sections/Timeline.tsx
import { Calendar } from "lucide-react";
import { Container, Section, SectionHeading } from "@/components/ui";
import { TIMELINE } from "@/content/sections";

export default function Timeline() {
  return (
    <Section id="timeline">
      <Container>
        <SectionHeading eyebrow="Timeline" title="Four phases to the top." />
        <ol className="mt-12 space-y-px border-l border-ascent-border pl-0">
          {TIMELINE.map(({ icon: Icon, phase, date, body }, i) => (
            <li key={phase} className="relative pb-10 pl-10 last:pb-0">
              {/* Node */}
              <span
                aria-hidden="true"
                className="absolute -left-[17px] top-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-ascent-accent/40 bg-ascent-bg text-ascent-accent shadow-sm"
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="text-lg font-semibold text-ascent-ink">
                  <span className="mr-2 font-mono text-sm text-ascent-muted">
                    0{i + 1}
                  </span>
                  {phase}
                </h3>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ascent-cyan">
                  <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
                  {date}
                </span>
              </div>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ascent-muted">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
