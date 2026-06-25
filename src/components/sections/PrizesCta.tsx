// src/components/sections/PrizesCta.tsx
import { Users } from "lucide-react";
import { Button, Card, Container, Section } from "@/components/ui";

export default function PrizesCta() {
  return (
    <Section id="prizes">
      <Container>
        <Card
          id="register"
          className="relative isolate overflow-hidden p-10 text-center sm:p-16"
        >
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-ascent-ink sm:text-4xl">
              Ready to start the climb?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ascent-muted">
              Cash prizes, swag and editorial recognition await the top climbers
              in Div 1, Div 2 and the Team Relay. Registration is free — bring
              your toolchain.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button href="#register" size="lg">
                Register
              </Button>
              <Button href="#timeline" variant="secondary" size="lg">
                See the schedule
              </Button>
            </div>

            <p className="mt-6 inline-flex items-center gap-2 font-mono text-xs text-ascent-muted">
              <Users aria-hidden="true" className="h-3.5 w-3.5" />
              Open to all skill levels · Solo or teams of three
            </p>
          </div>
        </Card>
      </Container>
    </Section>
  );
}
