// src/components/sections/Faq.tsx
import { Container, Section, SectionHeading } from "@/components/ui";
import { FAQ } from "@/content/sections";

export default function Faq() {
  return (
    <Section
      id="faq"
      className="scroll-mt-16 border-b border-ascent-border bg-ascent-canvas"
    >
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,1.38fr)] lg:gap-20">
          <SectionHeading
            eyebrow="Before you register"
            title="Answers to decisions that matter."
            lede="The format is unusual, so the important rules should be explicit. Unconfirmed operational details stay marked as pending."
          />

          <dl className="border-t border-ascent-border">
            {FAQ.map(({ q, a }, index) => (
              <div
                key={q}
                className="grid gap-3 border-b border-ascent-border py-6 sm:grid-cols-[2.5rem_0.82fr_1.18fr] sm:gap-5"
              >
                <span className="font-mono text-xs font-semibold text-ascent-brand">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <dt className="font-semibold leading-6 text-ascent-ink">{q}</dt>
                <dd className="text-sm leading-6 text-ascent-muted">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </Section>
  );
}
