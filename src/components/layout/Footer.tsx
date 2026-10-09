import Image from "next/image";

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Entry status", href: "/register/status" },
] as const;

function LegalLinks() {
  return (
    <nav aria-label="Privacy, terms and entry status" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {LEGAL_LINKS.map((link) => (
        <a key={link.href} href={link.href} className="inline-flex min-h-11 items-center underline underline-offset-4">
          {link.label}
        </a>
      ))}
    </nav>
  );
}

const FOOTER_LINKS = [
  { label: "About", href: "/#about" },
  { label: "Format", href: "/#tracks" },
  { label: "Timeline", href: "/#timeline" },
  { label: "FAQ", href: "/#faq" },
  { label: "Syllabus", href: "/syllabus" },
  { label: "Register", href: "/register" },
] as const;

interface FooterProps {
  compact?: boolean;
  homeHref?: string;
}

function Brand({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="group inline-flex min-h-11 items-center gap-2 font-mono text-sm font-bold tracking-tight text-ascent-ink hover:text-ascent-brand"
    >
      <Image
        src="/ascent-logo.svg"
        alt=""
        aria-hidden="true"
        width={32}
        height={32}
        unoptimized
        className="h-8 w-8 shrink-0"
      />
      <span>Ascent</span>
    </a>
  );
}

/** Shared footer with a compact mode for focused application routes. */
export default function Footer({
  compact = false,
  homeHref = "#top",
}: FooterProps) {
  if (compact) {
    return (
      <footer className="border-t border-ascent-border bg-ascent-surface">
        <div className="mx-auto max-w-7xl px-4 py-5 text-sm text-ascent-muted sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <Brand href={homeHref} />
            <p>Competition registration · Ascent by AMS</p>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-ascent-border pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6">
            <a href="mailto:team@amshq.in" className="inline-flex min-h-11 items-center underline underline-offset-4">Help: team@amshq.in</a>
            <LegalLinks />
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-ascent-border bg-ascent-surface-subtle">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <Brand href={homeHref} />
            <p className="mt-2 max-w-sm text-sm leading-6 text-ascent-muted">
              A C++ optimization competition ranked by the measured speedup of
              correct code.
            </p>
          </div>

          <nav aria-label="Footer">
            <h2 className="text-sm font-semibold text-ascent-ink">Explore</h2>
            <ul className="mt-2 grid grid-cols-2 gap-x-6">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-sm text-ascent-muted hover:text-ascent-brand hover:underline hover:underline-offset-4"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold text-ascent-ink">Get in touch</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-ascent-muted">Registration &amp; support</dt>
                <dd><a href="mailto:team@amshq.in" className="inline-flex min-h-11 items-center text-ascent-ink underline underline-offset-4">team@amshq.in</a></dd>
              </div>
              <div>
                <dt className="text-ascent-muted">Sponsorship</dt>
                <dd><a href="mailto:partners@amshq.in" className="inline-flex min-h-11 items-center text-ascent-ink underline underline-offset-4">partners@amshq.in</a></dd>
              </div>
            </dl>
            <a href="https://discord.gg/fgm4CnBKzV" target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center text-sm text-ascent-muted underline underline-offset-4">Join our Discord</a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 border-t border-ascent-border py-6 md:grid-cols-2 md:items-center md:gap-12">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ascent-gold-ink">Gold Sponsor</p>
            <a
              href="https://www.janestreet.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Jane Street, Gold Sponsor of Ascent"
              className="inline-flex min-h-11 items-center justify-center rounded-control bg-ascent-ink px-6 py-4 transition-opacity hover:opacity-90"
            >
              <Image src="/Jane_Street.svg" alt="Jane Street" width={151} height={40} unoptimized className="h-8 w-auto" />
            </a>
          </div>
          <p className="max-w-md text-sm leading-6 text-ascent-muted md:justify-self-end">
            Organised by the <a href="https://www.linkedin.com/company/algorithms-mathematics-society/" target="_blank" rel="noreferrer" className="text-ascent-ink underline underline-offset-4">Algorithms &amp; Mathematics Society</a>, Mumbai.
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-ascent-border pt-4 text-sm text-ascent-muted sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6">
          <p>&copy; 2026 Ascent.</p>
          <LegalLinks />
        </div>
      </div>
    </footer>
  );
}
