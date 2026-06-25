// src/components/sections/Faq.tsx
import { Card, Container, Section, SectionHeading } from "@/components/ui";
import { FAQ } from "@/content/sections";

export default function Faq() {
  return (
    <Section id="faq" className="scroll-mt-24">
      <Container>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="center"
            eyebrow="FAQ"
            title="Quick answers"
          />
          <dl className="mt-10 space-y-4">
            {FAQ.map(({ q, a }) => (
              <Card key={q} className="p-6">
                <dt className="text-base font-semibold text-ascent-ink">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ascent-muted">
                  {a}
                </dd>
              </Card>
            ))}
          </dl>
        </div>
      </Container>
    </Section>
  );
}
