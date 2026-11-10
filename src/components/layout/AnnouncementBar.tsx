import Link from "next/link";
import { ArrowRight, Award } from "lucide-react";

/**
 * Site-wide notice that sits directly under the fixed navbar and scrolls
 * away with the page. Pages already reserve the navbar's 4rem at their top,
 * so the wrapper starts with that 4rem (hidden behind the navbar) and gives it
 * back with a negative bottom margin: the only space the bar adds is its own
 * height. Sticky sub-navs (top-16) and anchor offsets keep working unchanged.
 */
export default function AnnouncementBar() {
  return (
    <div className="relative z-40 -mb-16 pt-16">
      <aside
        aria-label="Announcements"
        className="border-b border-white/10 bg-ascent-brand text-ascent-on-brand"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-2.5 sm:flex-row sm:py-3 sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8">
          <p className="flex items-start gap-2.5 text-sm leading-6 sm:items-center">
            <Award
              size={17}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-ascent-gold sm:mt-0"
            />
            <span>
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ascent-gold">
                Ascent ’26
              </span>
              <span aria-hidden="true" className="mx-2 text-white/40">
                ·
              </span>
              Round 1 certificates are out.
              <span className="hidden sm:inline"> Qualifiers can collect theirs now.</span>
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            <Link
              href="/certificate"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-control bg-white px-3.5 text-sm font-semibold text-ascent-brand transition-colors hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ascent-brand"
            >
              <span className="sm:hidden">Get certificate</span>
              <span className="hidden sm:inline">Collect your certificate</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/syllabus"
              className="inline-flex min-h-9 items-center rounded-control border border-white/40 px-3.5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ascent-brand"
            >
              Round 2 updates
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
