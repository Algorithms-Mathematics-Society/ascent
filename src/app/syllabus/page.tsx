import type { Metadata } from "next";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import {
  LATER_ROUNDS,
  LIBRARY_GROUPS,
  ROUND_ONE_FORMATS,
  ROUND_ONE_GROUPS,
  type SyllabusGroup,
} from "@/content/syllabus";

export const metadata: Metadata = {
  title: "Syllabus · Ascent",
  description:
    "The published Round 1 C++ syllabus and the working outlines for Rounds 2 and 3 of Ascent.",
};

function StepMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="h-10 w-10 text-ascent-brand"
      fill="none"
    >
      <path
        d="M4 40h13V29h11V18h10V8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <circle cx="40" cy="5" r="2" className="fill-ascent-gold" />
    </svg>
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
      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-ascent-gold">
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
    <section aria-labelledby={`topic-${group.title.replaceAll(" ", "-").toLowerCase()}`}>
      <h3
        id={`topic-${group.title.replaceAll(" ", "-").toLowerCase()}`}
        className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-ascent-gold"
      >
        {group.title}
      </h3>
      <ul className="mt-4 grid gap-3.5">
        {group.items.map((item) => (
          <li
            key={item}
            className="grid grid-cols-[0.45rem_minmax(0,1fr)] gap-3 font-mono text-[0.78rem] leading-[1.55] text-ascent-muted sm:text-[0.82rem]"
          >
            <span aria-hidden="true" className="mt-[0.46rem] h-1 w-1 bg-ascent-gold" />
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
  const behavior = ROUND_ONE_GROUPS[2];
  const generics = ROUND_ONE_GROUPS[3];

  return (
    <>
      <Navbar page="syllabus" />
      <main id="top" tabIndex={-1}>
        <section className="border-b border-ascent-border bg-ascent-brand px-4 pb-12 pt-28 text-ascent-on-brand sm:px-6 sm:pb-16 sm:pt-32 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-ascent-on-brand/70">
              Ascent · Competition syllabus
            </p>
            <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.52fr)] lg:items-end">
              <div>
                <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[0.94] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
                  Know the language. Understand the machine.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-ascent-on-brand/75">
                  Round 1 tests C++ proficiency, puzzles and debugging. Later rounds move from
                  individual language fluency to team implementation and real toolchain work.
                </p>
              </div>
              <nav aria-label="Syllabus sections" className="border-t border-ascent-on-brand/25 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <ol className="grid gap-px bg-ascent-on-brand/20">
                  {[
                    ["01", "Round 1 topics", "#round-1"],
                    ["02", "Question formats", "#question-formats"],
                    ["03", "Rounds 2 & 3", "#later-rounds"],
                  ].map(([number, label, href]) => (
                    <li key={href}>
                      <a
                        href={href}
                        className="group grid min-h-12 grid-cols-[2rem_1fr_auto] items-center gap-3 bg-ascent-brand px-3 font-mono text-xs text-ascent-on-brand/75 hover:bg-ascent-ink hover:text-ascent-on-brand"
                      >
                        <span className="text-ascent-on-brand/45">{number}</span>
                        <span>{label}</span>
                        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </div>
          </div>
        </section>

        <section id="round-1" className="scroll-mt-16 border-b border-ascent-border bg-ascent-canvas px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Syllabus · Round 1 · Proficiency, puzzles & debugging"
              title="The language."
            />
            <div className="mt-8 grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-12">
              <TopicGroup group={ROUND_ONE_GROUPS[0]} />
              <TopicGroup group={ROUND_ONE_GROUPS[1]} />
              <div className="grid content-start gap-10">
                <TopicGroup group={behavior} />
                <TopicGroup group={generics} />
              </div>
            </div>
            <SectionFooter>ascent · round 1 · language</SectionFooter>
          </div>
        </section>

        <section className="border-b border-ascent-border bg-ascent-surface px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Syllabus · Round 1 · Continued"
              title="The library & the machine."
            />

            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(17rem,0.85fr)] lg:gap-12">
              {LIBRARY_GROUPS.map((group) => (
                <TopicGroup key={group.title} group={group} />
              ))}
              <aside className="border border-ascent-border bg-ascent-surface-strong p-5 sm:p-6" aria-labelledby="how-to-read-title">
                <p id="how-to-read-title" className="font-mono text-xs font-semibold text-ascent-gold">
                  {"// how to read this"}
                </p>
                <p className="mt-4 font-mono text-[0.78rem] leading-[1.55] text-ascent-muted">
                  Round 1 tests proficiency, puzzle-solving and debugging — internals over
                  incantations. If a bullet says “internals,” expect to explain the memory, not
                  recite the API.
                </p>
                <p className="mt-6 border-t border-ascent-border pt-4 font-mono text-[0.72rem] leading-5 text-ascent-muted">
                  * candidates to shift to Round 2
                </p>
              </aside>
            </div>

            <section id="question-formats" className="scroll-mt-20 mt-14 border-t border-ascent-border pt-7 sm:mt-16" aria-labelledby="question-formats-title">
              <h3 id="question-formats-title" className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-ascent-gold">
                Question formats · Round 1
              </h3>
              <div className="mt-5 grid gap-px border border-ascent-border bg-ascent-border md:grid-cols-2">
                {ROUND_ONE_FORMATS.map((format) => (
                  <article key={format.number} className="bg-ascent-surface-subtle p-5 sm:p-6">
                    <p className="font-mono text-[0.68rem] font-semibold text-ascent-gold">{format.number}</p>
                    <h4 className="mt-3 font-display text-2xl font-semibold leading-none text-ascent-ink">{format.title}</h4>
                    <p className="mt-4 font-mono text-[0.78rem] leading-[1.55] text-ascent-muted">{format.description}</p>
                    <p className="mt-5 border-t border-ascent-border pt-4 font-mono text-[0.7rem] leading-5 text-ascent-muted">
                      tests: {format.tests}
                    </p>
                  </article>
                ))}
              </div>
            </section>
            <SectionFooter>ascent · round 1 · library & machine</SectionFooter>
          </div>
        </section>

        <section id="later-rounds" className="scroll-mt-16 bg-ascent-canvas px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Syllabus · Rounds 2 & 3 · Outline"
              title="Beyond the language."
              description="The later-round scope is intentionally directional. Detailed topic lists will be published only when the competition design is locked."
            />

            <div className="mt-9 grid gap-px border border-ascent-border bg-ascent-border md:grid-cols-2">
              {LATER_ROUNDS.map((round) => (
                <article key={round.round} className="bg-ascent-surface-strong p-6 sm:p-8">
                  <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-ascent-gold">
                    {round.round} · {round.mode}
                  </p>
                  <h3 className="mt-4 font-display text-3xl font-semibold leading-none text-ascent-ink">{round.title}</h3>
                  <p className="mt-5 font-mono text-[0.78rem] leading-[1.55] text-ascent-muted">{round.description}</p>
                  <ul className="mt-6 grid gap-2 font-mono text-[0.76rem] leading-5 text-ascent-muted">
                    {round.facts.map((fact) => (
                      <li key={fact}>· {fact}</li>
                    ))}
                  </ul>
                  <p className="mt-7 border-t border-ascent-border pt-4 font-mono text-[0.68rem] tracking-[0.05em] text-ascent-muted">
                    topic list pending — not for publication
                  </p>
                </article>
              ))}
            </div>

            <aside className="mt-14 border-t border-ascent-border pt-7" aria-labelledby="moves-between-title">
              <h3 id="moves-between-title" className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-ascent-gold">
                What moves between rounds
              </h3>
              <p className="mt-4 max-w-5xl font-mono text-[0.78rem] leading-[1.55] text-ascent-muted">
                Cache lines, false sharing and atomics are flagged on the Round 1 sheet as
                candidates to move here. They are machine topics, and Round 2 is where
                implementation meets the machine.
              </p>
            </aside>
            <SectionFooter>ascent · rounds 2–3 · outline</SectionFooter>
          </div>
        </section>
      </main>
      <Footer homeHref="/#top" />
    </>
  );
}
