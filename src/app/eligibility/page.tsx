import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui";
import { ELIGIBLE_INSTITUTIONS } from "@/content/institutions";
import { REGISTRATION_CLOSED } from "@/lib/registrationLaunch";

const garamond = localFont({
  src: "../../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2",
  weight: "600",
  display: "swap",
  variable: "--font-eb-garamond",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: "Eligibility · Ascent",
  description:
    "See the 40 institutions with direct entry to Ascent Round 1. Students from other universities can apply for profile review and receive an entry decision by email.",
  alternates: { canonical: "/eligibility" },
};

const reviewSteps = [
  {
    title: "Submit your profile",
    body: "Enter your institution in the registration form, even if it is not listed. Include your resume and, if you have them, your GitHub profile and Codeforces handle. Use these to show your relevant projects, programming experience and problem-solving work.",
  },
  {
    title: "We review your application",
    body: "The Ascent team reviews your profile for relevant skills and readiness for the competition. A strong profile can earn you a place in Round 1. Admission through this route depends on the review outcome.",
  },
  {
    title: "Receive your decision",
    body: "We email the outcome to your registered address. Approval confirms your place in Round 1. If you are waitlisted, your place is not yet confirmed; we will email you if that decision changes.",
  },
];

export default function EligibilityPage() {
  return (
    <>
      <Navbar page="eligibility" />
      <main id="top" tabIndex={-1} className={`${garamond.variable} bg-ascent-canvas`}>
        <section className="px-4 pb-12 pt-28 sm:px-6 sm:pb-16 sm:pt-32 lg:px-8" aria-labelledby="eligibility-title">
          <div className="mx-auto max-w-7xl">
            <header className="border-b border-ascent-border pb-8">
              <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-ascent-gold-ink">
                Eligibility · Ascent Winter ’26
              </p>
              <h1 id="eligibility-title" className="mt-4 font-display text-5xl font-semibold leading-none tracking-[-0.03em] text-ascent-ink sm:text-6xl">
                Who can compete.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-ascent-muted">
                Students at the institutions below have a direct path to Round 1.
                If your university is not listed, you can still apply. We review
                your profile for a place in the same round.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-ascent-muted">
                Registration is free and open to candidates in India and across
                the Asia-Pacific region. Places for candidates outside India are
                limited to 100 for this edition.
              </p>
            </header>

            <div className="mt-8 grid gap-px border border-ascent-border bg-ascent-border md:grid-cols-2">
              <section className="bg-ascent-surface p-6 sm:p-8" aria-labelledby="direct-title">
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ascent-gold-ink">01 · Listed institutions</p>
                <h2 id="direct-title" className="mt-4 font-display text-3xl font-semibold text-ascent-ink">Direct entry to Round 1.</h2>
                <p className="mt-4 text-sm leading-6 text-ascent-muted">
                  Select your institution and campus when you register. Your entry
                  is accepted on submission, and you go through to Round 1.
                </p>
                <a href="#institutions" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-ascent-brand underline underline-offset-4">See the {ELIGIBLE_INSTITUTIONS.length} institutions →</a>
              </section>
              <section className="bg-ascent-surface p-6 sm:p-8" aria-labelledby="review-title">
                <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ascent-gold-ink">02 · Other institutions</p>
                <h2 id="review-title" className="mt-4 font-display text-3xl font-semibold text-ascent-ink">Apply through profile review.</h2>
                <p className="mt-4 text-sm leading-6 text-ascent-muted">
                  Don’t worry if your university is not here. Submit your application
                  with evidence of your skills. If your profile is approved, you
                  join Round 1 alongside entrants from the listed institutions.
                </p>
                <a href="#profile-review" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-ascent-brand underline underline-offset-4">How profile review works →</a>
              </section>
            </div>
          </div>
        </section>

        <section id="institutions" className="scroll-mt-24 border-y border-ascent-border bg-ascent-surface-subtle px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="institutions-title">
          <div className="mx-auto max-w-7xl">
            <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-ascent-gold-ink">Direct entry · {ELIGIBLE_INSTITUTIONS.length} institutions</p>
            <h2 id="institutions-title" className="mt-4 font-display text-3xl font-semibold tracking-tight text-ascent-ink sm:text-4xl">Find your institution.</h2>
            <p className="mt-4 text-sm leading-6 text-ascent-muted">The list is campus-specific. Choose the institution and campus you attend when registering.</p>
            <ul className="mt-8 columns-1 gap-8 font-mono text-xs leading-6 text-ascent-ink sm:columns-2 lg:columns-3 lg:text-[0.8rem]">
              {ELIGIBLE_INSTITUTIONS.map((institution) => (
                <li key={institution.id} className="mb-1 break-inside-avoid pl-3 -indent-3">
                  <span aria-hidden="true">· </span>
                  {institution.canonical_name}{institution.campus ? `, ${institution.campus}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-8 border-t border-ascent-border pt-5 text-sm leading-6 text-ascent-muted">
              University not listed? <a href="#profile-review" className="font-semibold text-ascent-brand underline underline-offset-4">You can apply through profile review.</a>
            </p>
          </div>
        </section>

        <section id="profile-review" className="scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16 lg:px-8" aria-labelledby="profile-title">
          <div className="mx-auto max-w-7xl">
            <header className="max-w-2xl">
              <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-ascent-gold-ink">For students at other institutions</p>
              <h2 id="profile-title" className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-ascent-ink">Show us what you can do.</h2>
              <p className="mt-5 text-base leading-7 text-ascent-muted">Your university’s absence from the list does not close the door. Use your application to show the work and skills you would bring to Ascent.</p>
            </header>
            <ol className="mt-8 grid gap-8 border-y border-ascent-border py-8 md:grid-cols-3">
              {reviewSteps.map((step, index) => (
                <li key={step.title}>
                  <p className="font-mono text-xs font-semibold text-ascent-gold-ink">0{index + 1}</p>
                  <h3 className="mt-3 text-base font-semibold text-ascent-ink">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-ascent-muted">{step.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 max-w-3xl text-sm leading-6 text-ascent-muted">
              <p><span className="font-semibold text-ascent-ink">Under review and waitlisted are different.</span> An unlisted institution sends your entry for review. Waitlisted is a possible outcome of that review, and does not confirm a Round 1 place. Applications may also be declined.</p>
              <p className="mt-3">You can check your latest decision on the <Link href="/register/status" className="font-semibold text-ascent-brand underline underline-offset-4">entry status page</Link>. Both entry routes lead to the same Round 1; advancement after that depends on your competition results.</p>
            </div>
            <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
              {REGISTRATION_CLOSED ? (
                <Button href="/register/status">Check entry status</Button>
              ) : (
                <Button href="/register">Register for Ascent</Button>
              )}
              <Link href="/syllabus" className="inline-flex min-h-11 items-center text-sm font-semibold text-ascent-brand underline underline-offset-4">Read the Round 1 syllabus →</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer homeHref="/#top" />
    </>
  );
}
