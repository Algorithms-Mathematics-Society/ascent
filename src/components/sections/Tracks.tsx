// src/components/sections/Tracks.tsx
import { Card, Container, Section, SectionHeading } from "@/components/ui";
import { TRACKS } from "@/content/sections";

export default function Tracks() {
  return (
    <Section id="tracks">
      <Container>
        <SectionHeading
          eyebrow="Tracks"
          title="Pick your route up the mountain."
          lede="Three ways to compete, each with its own scoreboard. Climb solo or rope up with a team."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TRACKS.map(({ badge, title, body }) => (
            <Card key={title} className="flex flex-col p-6">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ascent-accent">
                {badge}
              </span>
              <h3 className="mt-2 text-xl font-semibold text-ascent-ink">
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
