import type { Metadata } from "next";
import Image from "next/image";
import localFont from "next/font/local";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import {
  LATER_ROUNDS,
  LIBRARY_GROUPS,
  ROUND_ONE_FORMATS,
  ROUND_ONE_GROUPS,
  type SyllabusGroup,
} from "@/content/syllabus";

const garamond = localFont({
  src: "../../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2",
  weight: "600",
  display: "swap",
  variable: "--font-eb-garamond",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: "Syllabus · Ascent",
  description:
    "The published Round 1 and Round 2 C++ syllabi, plus the Round 3 outline for Ascent 2026.",
  alternates: { canonical: "/syllabus" },
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

export default function SyllabusPage() {
  return (
    <>
      <Navbar page="syllabus" />
      <main id="top" tabIndex={-1} className={garamond.variable}>
        <section className="border-b border-ascent-border bg-ascent-brand px-4 pb-12 pt-28 text-ascent-on-brand sm:px-6 sm:pb-16 sm:pt-32 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-ascent-on-brand/70">
              Ascent · Competition syllabus
            </p>
            <div className="mt-5">
              <div>
                <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[0.94] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
                  Know the language. Understand the machine.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-ascent-on-brand/75">
                  Round 1 tests C++ proficiency, puzzles and debugging. The complete Round 2 team-round syllabus is now published, followed by the Round 3 toolchain outline.
                </p>
              </div>
            </div>
          </div>
        </section>

        <nav aria-label="Syllabus sections" className="sticky top-16 z-40 border-b border-ascent-border bg-ascent-surface px-4 sm:px-6 lg:px-8">
          <ol className="mx-auto grid max-w-7xl grid-cols-2 sm:grid-cols-4">
            {[
              ["01", "Language", "#round-1"],
              ["02", "Library & machine", "#library-machine"],
              ["03", "Question formats", "#question-formats"],
              ["04", "Rounds 2 & 3", "#later-rounds"],
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

        <section id="later-rounds" className="scroll-mt-44 sm:scroll-mt-32 bg-ascent-canvas px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Syllabus · Round 2 published · Round 3 outline"
              title="Rounds 2 and 3"
              description="The complete official Round 2 syllabus is now available. Round 3 remains an outline until its detailed scope is confirmed."
            />

            <div className="mt-9 grid gap-px overflow-hidden rounded-panel border border-ascent-border bg-ascent-border md:grid-cols-2">
              {LATER_ROUNDS.map((round) => (
                <article key={round.round} className="bg-ascent-surface-strong p-6 sm:p-8">
                  <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-ascent-gold-ink">
                    {round.round} · {round.mode}
                  </p>
                  <h3 className="mt-4 font-display text-3xl font-semibold leading-none text-ascent-ink">{round.title}</h3>
                  <p className="mt-5 text-sm leading-6 text-ascent-muted">{round.description}</p>
                  <ul className="mt-6 grid gap-2 text-sm leading-6 text-ascent-muted">
                    {round.facts.map((fact) => (
                      <li key={fact}>· {fact}</li>
                    ))}
                  </ul>
                  {round.round === "Round 2" ? (
                    <a href="/syllabus/round-2" className="mt-7 inline-flex min-h-11 items-center rounded-control bg-ascent-brand px-4 text-sm font-semibold text-ascent-on-brand hover:bg-ascent-brand-hover">
                      View the complete Round 2 syllabus
                    </a>
                  ) : (
                    <p className="mt-7 border-t border-ascent-border pt-4 font-mono text-[0.68rem] tracking-[0.05em] text-ascent-muted">
                      Detailed topics will be announced.
                    </p>
                  )}
                </article>
              ))}
            </div>

            <aside className="mt-14 rounded-panel border border-ascent-border bg-ascent-brand-tint p-5 sm:p-6" aria-labelledby="round-two-published-title">
              <h3 id="round-two-published-title" className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-brand">
                Round 2 syllabus published
              </h3>
              <p className="mt-4 max-w-5xl text-sm leading-6 text-ascent-muted">
                Review all 47 topics across seven levels, the explicit out-of-scope list, and optional C++ references on the dedicated Round 2 syllabus page.
              </p>
              <a href="/syllabus/round-2" className="mt-5 inline-flex min-h-11 items-center rounded-control border border-ascent-brand px-4 text-sm font-semibold text-ascent-brand hover:bg-ascent-brand hover:text-ascent-on-brand">
                Open Round 2 syllabus
              </a>
            </aside>
            <SectionFooter>ascent · rounds 2–3 · outline</SectionFooter>
          </div>
        </section>
      </main>
      <Footer homeHref="/#top" />
    </>
  );
}
