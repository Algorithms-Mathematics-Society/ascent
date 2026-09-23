// src/components/sections/Sponsors.tsx
import Image from "next/image";
import { Container, Section, SectionHeading } from "@/components/ui";

/**
 * Partner credit. The firm is named plainly and the tier label is exact:
 * a sponsor credit is contractual surface, not decoration.
 *
 * The supplied Jane_Street.svg is a reversed (white) mark, so it sits on a
 * dark panel. That is the asset used as intended. Recolouring a sponsor's
 * logo to suit our palette is not ours to do.
 */
export default function Sponsors() {
  return (
    <Section
      id="sponsors"
      className="scroll-mt-16 border-b border-ascent-border bg-ascent-surface"
    >
      <Container>
        <SectionHeading
          eyebrow="Partners"
          title="Our sponsors"
          lede="Ascent is supported by firms whose engineers work on exactly the problems this competition measures."
          align="center"
          className="mx-auto"
        />

        <div className="mt-12 flex flex-col items-center gap-6">
          <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-ascent-muted">
            Gold Sponsor
          </p>
          <a
            href="https://www.janestreet.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Jane Street, Gold Sponsor of Ascent"
            className="inline-flex min-h-11 items-center rounded-panel bg-ascent-ink px-10 py-6 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ascent-focus"
          >
            <Image
              src="/Jane_Street.svg"
              alt="Jane Street"
              width={302}
              height={80}
              unoptimized
              className="h-8 w-auto sm:h-10"
            />
          </a>
        </div>
      </Container>
    </Section>
  );
}
