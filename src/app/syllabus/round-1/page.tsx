import type { Metadata } from "next";
import Image from "next/image";
import localFont from "next/font/local";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import {
  LIBRARY_GROUPS,
  ROUND_ONE_FORMATS,
  ROUND_ONE_GROUPS,
  type SyllabusGroup,
} from "@/content/syllabus";

const garamond = localFont({
  src: "../../../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2",
  weight: "600",
  display: "swap",
  variable: "--font-eb-garamond",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: "Round 1 syllabus · Ascent 2026",
  description:
    "The published Ascent 2026 Round 1 C++ syllabus covering language, library, machine concepts, and question formats.",
  alternates: { canonical: "/syllabus/round-1" },
};

function StepMark() {
  return (
    <Image
      src="/ascent-logo.svg"
      alt=""
      aria-hidden="true"
      width={49}
      height={48}
      loading="lazy"
      unoptimized
      className="h-12 w-auto shrink-0"
    />
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="border-b border-ascent-border pb-6 sm:pb-7">
      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-ascent-gold-ink">
        {eyebrow}
      </p>
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="font-display text-4xl font-semibold leading-none tracking-[-0.025em] text-ascent-ink sm:text-5xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-xl text-sm leading-6 text-ascent-muted">
            {description}
          </p>
        ) : null}
      </div>
    </header>
  );
}

function TopicGroup({ group }: { group: SyllabusGroup }) {
  return (
    <section className="rounded-panel border border-ascent-border bg-ascent-surface p-5 sm:p-6" aria-labelledby={`topic-${group.title.replaceAll(" ", "-").toLowerCase()}`}>
      <h3
        id={`topic-${group.title.replaceAll(" ", "-").toLowerCase()}`}
        className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-gold-ink"
      >
        {group.title}
      </h3>
      <ul className="mt-4 grid gap-3.5">
        {group.items.map((item) => (
          <li
            key={item}
            className="grid grid-cols-[0.45rem_minmax(0,1fr)] gap-3 text-sm leading-6 text-ascent-ink"
          >
            <span aria-hidden="true" className="mt-2.5 h-1 w-1 bg-ascent-gold" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionFooter({ children }: { children: React.ReactNode }) {
  return (
    <footer className="mt-14 flex items-end justify-between gap-6 border-t border-ascent-border pt-5 sm:mt-16">
      <p className="font-mono text-[0.62rem] tracking-[0.14em] text-ascent-muted">
        {children}
      </p>
      <StepMark />
    </footer>
  );
}

export default function RoundOneSyllabusPage() {
  return (
    <>
      <Navbar page="syllabus" />
      <main id="top" tabIndex={-1} className={garamond.variable}>
        <section className="border-b border-ascent-border bg-ascent-brand px-4 pb-12 pt-28 text-ascent-on-brand sm:px-6 sm:pb-16 sm:pt-32 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <nav aria-label="Choose syllabus round" className="inline-flex rounded-control border border-ascent-on-brand/35 bg-ascent-brand-pressed/30 p-1">
              <a href="/syllabus" className="inline-flex min-h-10 items-center rounded-control px-4 text-sm font-semibold text-ascent-on-brand/75 hover:bg-ascent-on-brand/10 hover:text-ascent-on-brand">
                Round 2
              </a>
              <a href="/syllabus/round-1" aria-current="page" className="inline-flex min-h-10 items-center rounded-control bg-ascent-on-brand px-4 text-sm font-semibold text-ascent-brand">
                Round 1
              </a>
            </nav>
            <p className="mt-7 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-ascent-on-brand/70">
              Ascent 2026 · Individual round
            </p>
            <div className="mt-5">
              <div>
                <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[0.94] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
                  Round 1 syllabus.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-ascent-on-brand/75">
                  The published scope for the individual qualifier: C++ language proficiency, standard-library knowledge, machine concepts, puzzles, and live debugging.
                </p>
              </div>
            </div>
          </div>
        </section>

        <nav aria-label="Syllabus sections" className="sticky top-16 z-40 border-b border-ascent-border bg-ascent-surface px-4 sm:px-6 lg:px-8">
          <ol className="mx-auto grid max-w-7xl grid-cols-3">
            {[
              ["01", "Language", "#round-1"],
              ["02", "Library & machine", "#library-machine"],
              ["03", "Question formats", "#question-formats"],
            ].map(([number, label, href]) => (
              <li key={href}>
                <a href={href} className="flex min-h-11 items-center gap-2 rounded-control px-2 py-2 text-xs font-medium text-ascent-ink hover:bg-ascent-brand-tint focus-visible:outline-ascent-brand focus-visible:-outline-offset-2 sm:px-3 sm:text-sm">
                  <span className="font-mono text-xs text-ascent-gold-ink">{number}</span>
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <section id="round-1" className="scroll-mt-44 sm:scroll-mt-32 border-b border-ascent-border bg-ascent-canvas px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Syllabus · Round 1 · Proficiency, puzzles & debugging"
              title="The language."
            />
            <div className="mt-8 grid items-start gap-5 md:grid-cols-2 sm:gap-6">
              {ROUND_ONE_GROUPS.map((group) => (
                <TopicGroup key={group.title} group={group} />
              ))}
            </div>
            <SectionFooter>ascent · round 1 · language</SectionFooter>
          </div>
        </section>

        <section id="library-machine" className="scroll-mt-44 sm:scroll-mt-32 border-b border-ascent-border bg-ascent-surface px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Syllabus · Round 1 · Continued"
              title="The library & the machine."
            />

            <div className="mt-8 grid items-start gap-5 md:grid-cols-2 sm:gap-6">
              {LIBRARY_GROUPS.map((group) => (
                <TopicGroup key={group.title} group={group} />
              ))}
              <aside className="rounded-panel border border-ascent-border bg-ascent-surface-strong p-5 sm:p-6 md:col-span-2" aria-labelledby="how-to-read-title">
                <p id="how-to-read-title" className="font-mono text-xs font-semibold text-ascent-gold-ink">
                  {"// how to read this"}
                </p>
                <p className="mt-4 text-sm leading-6 text-ascent-muted">
                  Round 1 tests C++ proficiency, puzzle-solving and debugging. Topics
                  marked “internals” cover memory layout and how the feature is
                  implemented.
                </p>
                <p className="mt-6 border-t border-ascent-border pt-4 text-xs leading-5 text-ascent-muted">
                  The official Round 2 topic placement is now published in the complete Round 2 syllabus.
                </p>
              </aside>
            </div>

            <section id="question-formats" className="scroll-mt-44 sm:scroll-mt-32 mt-14 border-t border-ascent-border pt-7 sm:mt-16" aria-labelledby="question-formats-title">
              <h3 id="question-formats-title" className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-gold-ink">
                Question formats · Round 1
              </h3>
              <div className="mt-5 grid gap-px overflow-hidden rounded-panel border border-ascent-border bg-ascent-border md:grid-cols-2">
                {ROUND_ONE_FORMATS.map((format) => (
                  <article key={format.number} className="bg-ascent-surface-subtle p-5 sm:p-6">
                    <p className="font-mono text-[0.68rem] font-semibold text-ascent-gold-ink">{format.number}</p>
                    <h4 className="mt-3 font-display text-2xl font-semibold leading-none text-ascent-ink">{format.title}</h4>
                    <p className="mt-4 text-sm leading-6 text-ascent-muted">{format.description}</p>
                    <p className="mt-5 border-t border-ascent-border pt-4 text-xs leading-5 text-ascent-muted">
                      tests: {format.tests}
                    </p>
                  </article>
                ))}
              </div>
            </section>
            <SectionFooter>ascent · round 1 · library & machine</SectionFooter>
          </div>
        </section>

      </main>
      <Footer homeHref="/#top" />
    </>
  );
}
