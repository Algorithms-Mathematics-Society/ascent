import type { Metadata } from "next";
import localFont from "next/font/local";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import {
  ROUND_TWO_LEVELS,
  ROUND_TWO_OUT_OF_SCOPE,
  type RoundTwoLevel,
} from "@/content/roundTwoSyllabus";

const garamond = localFont({
  src: "../../../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2",
  weight: "600",
  display: "swap",
  variable: "--font-eb-garamond",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: "Round 2 syllabus · Ascent 2026",
  description:
    "The official Ascent 2026 Round 2 team-round syllabus: 47 topics across seven levels, with study references and the explicit out-of-scope list.",
  alternates: { canonical: "/syllabus/round-2" },
};

const ROUND_TWO_PROGRESS = [
  {
    number: "01",
    title: "WhatsApp group",
    status: "Complete",
    date: "Sent by email",
    body: "The invitation link has been emailed to participants selected for Round 2.",
  },
  {
    number: "02",
    title: "Team assignments",
    status: "Complete",
    date: "Sent by email",
    body: "Teams have been formed, and each selected participant has been emailed their assignment.",
  },
  {
    number: "03",
    title: "Platform test",
    status: "Next",
    date: "1 December 2026",
    body: "Test the AMS Access team-round experience before the official event.",
  },
  {
    number: "04",
    title: "Official Round 2",
    status: "Upcoming",
    date: "6 December 2026",
    body: "Compete online with your assigned team in the AMS Access app.",
  },
] as const;

function LevelSection({ level }: { level: RoundTwoLevel }) {
  return (
    <section
      id={`level-${level.number}`}
      className={`scroll-mt-28 border-b border-ascent-border px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20 ${
        level.number % 2 === 0 ? "bg-ascent-surface" : "bg-ascent-canvas"
      }`}
      aria-labelledby={`level-${level.number}-title`}
    >
      <div className="mx-auto max-w-7xl">
        <header className="grid gap-7 border-b border-ascent-border pb-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)] lg:items-end">
          <div>
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ascent-gold-ink">
              Level {level.number} · {level.topics.length} topics
            </p>
            <h2
              id={`level-${level.number}-title`}
              className="mt-3 font-display text-4xl font-semibold leading-none tracking-[-0.025em] text-ascent-ink sm:text-5xl"
            >
              {level.title}
            </h2>
          </div>
          <aside aria-label={`References for ${level.title}`}>
            <p className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-ascent-muted">
              Optional references
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {level.references.map((reference) => (
                <a
                  key={reference.href}
                  href={reference.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-control border border-ascent-border-strong bg-ascent-surface px-3 text-xs font-semibold text-ascent-ink transition-colors hover:border-ascent-brand hover:bg-ascent-brand-tint hover:text-ascent-brand"
                >
                  {reference.label}
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              ))}
            </div>
          </aside>
        </header>

        <ol className="mt-7 overflow-hidden rounded-panel border border-ascent-border bg-ascent-surface">
          {level.topics.map((topic) => (
            <li
              key={topic.number}
              className="grid gap-4 border-b border-ascent-border p-5 last:border-b-0 sm:grid-cols-[3.5rem_minmax(0,0.7fr)_minmax(0,1.7fr)] sm:gap-6 sm:p-6"
            >
              <span className="font-mono text-sm font-semibold text-ascent-gold-ink">
                {String(topic.number).padStart(2, "0")}
              </span>
              <h3 className="text-base font-semibold leading-6 text-ascent-ink">
                {topic.title}
              </h3>
              <p className="font-mono text-[0.76rem] leading-6 text-ascent-muted">
                {topic.details}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function RoundTwoSyllabusPage() {
  return (
    <>
      <Navbar page="syllabus" />
      <main id="top" tabIndex={-1} className={garamond.variable}>
        <section className="border-b border-ascent-border bg-ascent-brand px-4 pb-12 pt-28 text-ascent-on-brand sm:px-6 sm:pb-16 sm:pt-32 lg:px-8 lg:pb-20">
          <div className="mx-auto max-w-7xl">
            <a
              href="/syllabus"
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ascent-on-brand/75 hover:text-ascent-on-brand"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              All syllabi
            </a>
            <div className="mt-7 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
              <div>
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-ascent-on-brand/70">
                  Ascent 2026 · Team round
                </p>
                <h1 className="mt-5 max-w-4xl font-display text-5xl font-semibold leading-[0.94] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
                  Round 2 syllabus.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-ascent-on-brand/75">
                  The complete official scope for the online team round: language fundamentals,
                  the standard library, compile-time techniques, performance, advanced C++, and
                  the external libraries you may need.
                </p>
              </div>
              <div className="border-t border-ascent-on-brand/25 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
                <dl className="grid grid-cols-3 gap-4">
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ascent-on-brand/60">Levels</dt>
                    <dd className="mt-1 font-display text-3xl font-semibold">7</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ascent-on-brand/60">Topics</dt>
                    <dd className="mt-1 font-display text-3xl font-semibold">47</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-ascent-on-brand/60">Format</dt>
                    <dd className="mt-2 text-sm font-semibold">Team</dd>
                  </div>
                </dl>
                <a
                  href="/AMS-R2-Syllabus.pdf"
                  download
                  className="mt-7 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-ascent-on-brand/40 bg-ascent-on-brand px-4 text-sm font-semibold text-ascent-brand hover:bg-ascent-canvas"
                >
                  <Download size={16} aria-hidden="true" />
                  Download official PDF
                </a>
              </div>
            </div>
          </div>
        </section>

        <aside className="border-b border-ascent-border bg-ascent-success-tint px-4 py-4 sm:px-6 lg:px-8" aria-label="Participant update">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <p className="shrink-0 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ascent-success">
              Participant update
            </p>
            <p className="text-sm leading-6 text-ascent-ink">
              The WhatsApp group invitation link and team assignments have been sent to selected participants at their registered email addresses.
            </p>
          </div>
        </aside>

        <section className="border-b border-ascent-border bg-ascent-surface px-4 py-12 sm:px-6 lg:px-8" aria-labelledby="round-two-progress-title">
          <div className="mx-auto max-w-7xl">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-ascent-gold-ink">
                  Round 2 progress
                </p>
                <h2 id="round-two-progress-title" className="mt-3 font-display text-4xl font-semibold leading-none tracking-[-0.025em] text-ascent-ink sm:text-5xl">
                  What is happening now.
                </h2>
              </div>
              <span className="w-fit rounded-control bg-ascent-brand px-3 py-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ascent-on-brand">
                Current stage · Platform test next
              </span>
            </header>

            <ol className="mt-8 grid gap-px overflow-hidden rounded-panel border border-ascent-border bg-ascent-border md:grid-cols-4">
              {ROUND_TWO_PROGRESS.map((step) => (
                <li
                  key={step.number}
                  aria-current={step.status === "Next" ? "step" : undefined}
                  className={step.status === "Next" ? "bg-ascent-brand-tint-strong p-5 sm:p-6" : step.status === "Complete" ? "bg-ascent-success-tint p-5 sm:p-6" : "bg-ascent-surface p-5 sm:p-6"}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={step.status === "Complete" ? "flex h-8 w-8 items-center justify-center rounded-full bg-ascent-success font-mono text-xs font-bold text-white" : step.status === "Next" ? "flex h-8 w-8 items-center justify-center rounded-full bg-ascent-brand font-mono text-xs font-bold text-ascent-on-brand" : "flex h-8 w-8 items-center justify-center rounded-full border border-ascent-border-strong bg-ascent-surface font-mono text-xs font-bold text-ascent-muted"}>
                      {step.status === "Complete" ? "✓" : step.number}
                    </span>
                    <span className={step.status === "Complete" ? "font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ascent-success" : step.status === "Next" ? "font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ascent-brand" : "font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ascent-muted"}>
                      {step.status}
                    </span>
                  </div>
                  <p className="mt-6 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ascent-gold-ink">
                    {step.date}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-ascent-ink">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-ascent-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <nav aria-label="Round 2 syllabus levels" className="sticky top-16 z-40 overflow-x-auto border-b border-ascent-border bg-ascent-surface">
          <ol className="mx-auto flex min-w-max max-w-7xl px-4 sm:px-6 lg:px-8">
            {ROUND_TWO_LEVELS.map((level) => (
              <li key={level.number}>
                <a
                  href={`#level-${level.number}`}
                  className="flex min-h-12 items-center gap-2 border-b-2 border-transparent px-3 text-xs font-semibold text-ascent-muted hover:border-ascent-brand hover:text-ascent-brand"
                >
                  <span className="font-mono text-ascent-gold-ink">{String(level.number).padStart(2, "0")}</span>
                  <span>{level.title}</span>
                </a>
              </li>
            ))}
            <li>
              <a
                href="#out-of-scope"
                className="flex min-h-12 items-center border-b-2 border-transparent px-3 text-xs font-semibold text-ascent-muted hover:border-ascent-brand hover:text-ascent-brand"
              >
                Out of scope
              </a>
            </li>
          </ol>
        </nav>

        <section className="border-b border-ascent-border bg-ascent-surface px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-2">
            <div className="rounded-panel border border-ascent-border bg-ascent-surface-subtle p-5 sm:p-6">
              <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ascent-gold-ink">
                Official scope
              </p>
              <p className="mt-3 text-sm leading-6 text-ascent-muted">
                The topic names and scope below follow the supplied AMS Round 2 syllabus. An asterisk
                marks the same advanced or optional subtopics marked with an asterisk in the official PDF.
              </p>
            </div>
            <div className="rounded-panel border border-ascent-border bg-ascent-brand-tint p-5 sm:p-6">
              <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ascent-brand">
                Reference links
              </p>
              <p className="mt-3 text-sm leading-6 text-ascent-muted">
                C++ reference and library-documentation links are study aids. They do not add to,
                remove from, or reinterpret the official competition scope.
              </p>
            </div>
          </div>
        </section>

        {ROUND_TWO_LEVELS.map((level) => (
          <LevelSection key={level.number} level={level} />
        ))}

        <section id="out-of-scope" className="scroll-mt-28 bg-ascent-brand px-4 py-14 text-ascent-on-brand sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <header className="border-b border-ascent-on-brand/25 pb-7">
              <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ascent-on-brand/65">
                Boundaries
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-none sm:text-5xl">
                Out of scope.
              </h2>
            </header>
            <dl className="mt-7 overflow-hidden rounded-panel border border-ascent-on-brand/25">
              {ROUND_TWO_OUT_OF_SCOPE.map((item) => (
                <div key={item.category} className="grid gap-2 border-b border-ascent-on-brand/20 p-5 last:border-b-0 sm:grid-cols-[12rem_1fr] sm:gap-6 sm:p-6">
                  <dt className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-on-brand/70">
                    {item.category}
                  </dt>
                  <dd className="text-sm leading-6 text-ascent-on-brand/85">{item.details}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="/syllabus" className="inline-flex min-h-11 items-center justify-center rounded-control border border-ascent-on-brand/35 px-4 text-sm font-semibold hover:bg-ascent-on-brand/10">
                Back to all syllabi
              </a>
              <a href="/AMS-R2-Syllabus.pdf" download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-ascent-on-brand px-4 text-sm font-semibold text-ascent-brand hover:bg-ascent-canvas">
                <Download size={16} aria-hidden="true" />
                Download PDF
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer homeHref="/#top" />
    </>
  );
}
