// src/components/sections/About.tsx
import { Card, Container, Section, SectionHeading } from "@/components/ui";
import { ABOUT_CARDS } from "@/content/sections";

export default function About() {
  return (
    <Section id="about">
      <Container>
        <SectionHeading
          eyebrow="What is Ascent"
          title="A C++-only climb to the algorithmic summit."
          lede="Ascent strips competitive programming back to its core: one language, sharp problems and a live judge. Whether you are landing your first accepted submission or hunting a podium finish, every round is designed to push how you think in C++."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ABOUT_CARDS.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-6">
              <Icon aria-hidden="true" className="h-7 w-7 text-ascent-accent" />
              <h3 className="mt-4 text-lg font-semibold text-ascent-ink">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ascent-muted">
                {body}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
