// src/components/sections/About.tsx
import { Container, Section, SectionHeading } from "@/components/ui";
import { SCORING_STEPS } from "@/content/sections";

export default function About() {
  return (
    <Section
      id="about"
      className="scroll-mt-16 border-b border-ascent-border bg-ascent-surface"
    >
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-20">
          <SectionHeading
            eyebrow="How scoring works"
            title="Correctness is the gate. Performance is the score."
            lede="Ascent begins where a normal accepted verdict ends. Once the program is correct, the question becomes how much faster, leaner, and more deliberate you can make it."
          />

          <ol className="border-y border-ascent-border">
            {SCORING_STEPS.map((step) => (
              <li
                key={step.label}
                className="grid gap-3 border-b border-ascent-border py-6 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:gap-6"
              >
                <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ascent-brand">
                  {step.label}
                </p>
                <div>
                  <h3 className="text-lg font-semibold text-ascent-ink">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-ascent-muted">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div data-cache-obstacle className="mt-12 grid overflow-hidden rounded-panel border border-ascent-border bg-ascent-brand-tint sm:grid-cols-3">
          {[
            "Correct output",
            "Controlled benchmark",
            "Measured improvement",
          ].map((item, index) => (
            <div
              key={item}
              className="flex min-h-16 items-center gap-3 border-b border-ascent-border px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <span className="font-mono text-xs font-semibold text-ascent-brand">
                0{index + 1}
              </span>
              <span className="text-sm font-semibold text-ascent-ink">
                {item}
              </span>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
