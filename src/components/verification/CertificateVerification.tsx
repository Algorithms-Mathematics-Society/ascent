import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Search, ShieldCheck, Trophy, XCircle } from "lucide-react";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { findCertificateVerification, getVerificationContext, normalizeVerificationCode } from "@/content/certificateVerifications";
import { ROUND_ONE_SELECTION_COUNT } from "@/lib/results";

type CertificateVerificationProps = { code?: string };

function LookupForm({ code }: { code?: string }) {
  return (
    <form action="/verify" method="get" className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]" aria-label="Certificate verification lookup">
      <label className="sr-only" htmlFor="verification-code">Verification code</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ascent-muted" size={19} aria-hidden="true" />
        <input id="verification-code" name="code" defaultValue={code} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={16} placeholder="Enter code, e.g. XXXX-XXXX" className="min-h-12 w-full rounded-control border border-ascent-field-border bg-ascent-field-bg py-3 pl-12 pr-4 font-mono text-sm uppercase tracking-[0.08em] text-ascent-ink outline-none placeholder:normal-case placeholder:tracking-normal focus:border-ascent-field-focus focus:ring-2 focus:ring-ascent-focus/25" />
      </div>
      <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-ascent-brand px-6 text-sm font-semibold text-ascent-on-brand transition-colors hover:bg-ascent-brand-hover focus:outline-none focus:ring-2 focus:ring-ascent-focus focus:ring-offset-2">
        Verify certificate <ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>
  );
}

export default function CertificateVerificationExperience({ code }: CertificateVerificationProps) {
  const submittedCode = code?.trim() ?? "";
  const normalizedCode = submittedCode ? normalizeVerificationCode(submittedCode) : "";
  const record = submittedCode ? findCertificateVerification(submittedCode) : null;
  const context = record ? getVerificationContext(record.rank) : null;

  return (
    <>
      <Navbar page="verify" />
      <main id="top" tabIndex={-1} className="min-h-screen bg-ascent-canvas pt-16">
        <section className="relative overflow-hidden bg-ascent-ink text-white">
          <div aria-hidden="true" className="absolute -right-28 -top-40 h-[32rem] w-[32rem] rounded-full border border-ascent-gold/20" />
          <div aria-hidden="true" className="absolute -right-14 -top-24 h-80 w-80 rounded-full border border-ascent-gold/15" />
          <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-ascent-gold"><ShieldCheck size={17} aria-hidden="true" /> AMS official record</div>
            <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[0.96] sm:text-6xl">Certificate verification</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">Confirm an Ascent 2026 certificate using the unique code printed on it. Verification records show the official published Round 1 rank and Round 2 qualification status.</p>
            <div className="max-w-2xl"><LookupForm code={normalizedCode || undefined} /></div>
          </div>
        </section>

        <section aria-live="polite" className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          {!submittedCode ? (
            <div className="grid gap-6 border border-ascent-border bg-ascent-surface p-6 shadow-sm sm:grid-cols-[auto_1fr] sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ascent-brand-tint text-ascent-brand"><BadgeCheck size={24} aria-hidden="true" /></div>
              <div><h2 className="font-display text-3xl text-ascent-ink">How to verify</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-ascent-muted">Enter the code exactly as it appears on the certificate. Letters are not case-sensitive, and the hyphen is optional. For privacy and integrity, certificate records are available only through their unique codes.</p></div>
            </div>
          ) : record && context ? (
            <article className="overflow-hidden border border-ascent-border-strong bg-ascent-surface shadow-[0_22px_70px_rgba(20,40,58,0.10)]">
              <header className="border-t-4 border-ascent-success bg-ascent-success-tint px-6 py-6 sm:px-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ascent-success text-white"><Check size={25} strokeWidth={2.5} aria-hidden="true" /></span>
                    <div><p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-ascent-success">Authentic record found</p><h2 className="mt-1 font-display text-3xl leading-tight text-ascent-ink sm:text-4xl">This certificate is verified.</h2></div>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-ascent-success/30 bg-white/70 px-4 py-2 text-xs font-semibold text-ascent-success"><ShieldCheck size={16} aria-hidden="true" /> AMS verified</span>
                </div>
              </header>

              <div className="p-6 sm:p-8">
                <div className="grid gap-8 lg:grid-cols-[1fr_15rem] lg:items-start">
                  <div>
                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ascent-gold-ink">Ascent 2026 · Round 1</p>
                    <h3 className="mt-3 font-display text-4xl leading-tight text-ascent-ink sm:text-5xl">Selected for Round 2</h3>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-ascent-muted">The Algorithms &amp; Mathematics Society confirms that this certificate corresponds to published Round 1 rank <strong className="font-semibold text-ascent-ink">#{record.rank}</strong> and qualification for Round 2.</p>
                  </div>
                  <div className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-full border border-ascent-gold/50 bg-[#faf6ec] text-center shadow-[inset_0_0_0_8px_#fff]">
                    <Trophy className="text-ascent-gold-ink" size={25} strokeWidth={1.5} aria-hidden="true" />
                    <span className="mt-3 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ascent-muted">Published rank</span>
                    <strong className="font-display text-7xl leading-none text-ascent-ink">{record.rank}</strong>
                    <span className="mt-2 text-xs text-ascent-muted">of {ROUND_ONE_SELECTION_COUNT} selected</span>
                  </div>
                </div>

                <dl className="mt-9 grid border-y border-ascent-border sm:grid-cols-3">
                  <div className="py-5 sm:pr-6"><dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-ascent-muted">Verification code</dt><dd className="mt-2 break-all font-mono text-sm font-bold tracking-[0.08em] text-ascent-ink">{record.code}</dd></div>
                  <div className="border-t border-ascent-border py-5 sm:border-l sm:border-t-0 sm:px-6"><dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-ascent-muted">Distinction</dt><dd className="mt-2 text-sm font-semibold text-ascent-ink">{context.distinction}</dd></div>
                  <div className="border-t border-ascent-border py-5 sm:border-l sm:border-t-0 sm:pl-6"><dt className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-ascent-muted">Qualification</dt><dd className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-ascent-success"><Check size={16} aria-hidden="true" /> Round 2</dd></div>
                </dl>

                <div className="mt-7 rounded-control border border-ascent-border bg-ascent-surface-subtle p-5">
                  <h4 className="text-sm font-semibold text-ascent-ink">Record context</h4>
                  <p className="mt-1 text-sm leading-6 text-ascent-muted">Rank #{record.rank} falls within the first {context.topPercent}% of the {ROUND_ONE_SELECTION_COUNT} published ranks selected for Round 2. This comparison is limited to the selected cohort and does not claim a percentile among all registrants.</p>
                </div>
              </div>
            </article>
          ) : (
            <div className="border border-ascent-danger/30 bg-ascent-danger-tint p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <XCircle className="mt-0.5 shrink-0 text-ascent-danger" size={30} aria-hidden="true" />
                <div><p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-ascent-danger">No verified record</p><h2 className="mt-2 font-display text-3xl text-ascent-ink">We could not verify this code.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-ascent-muted">Check every character on the certificate and try again. A missing record does not verify the certificate. If the printed code is clear and this persists, contact <a className="font-medium text-ascent-ink underline underline-offset-4" href="mailto:team@amshq.in">team@amshq.in</a>.</p><p className="mt-4 font-mono text-xs text-ascent-muted">Submitted: {normalizedCode || submittedCode}</p></div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 text-sm text-ascent-muted sm:flex-row sm:items-center sm:justify-between">
            <p>Records are matched only by the unique code printed on an AMS-issued certificate.</p>
            <Link href="/results" className="inline-flex min-h-11 items-center gap-2 font-semibold text-ascent-brand hover:underline hover:underline-offset-4">View Round 1 results <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </section>
      </main>
      <Footer homeHref="/" />
    </>
  );
}
