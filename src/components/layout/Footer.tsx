import Image from "next/image";

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Entry status", href: "/register/status" },
] as const;
function LegalLinks() {
  return <nav aria-label="Privacy, terms and entry status" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{LEGAL_LINKS.map(link => <a key={link.href} href={link.href} className="inline-flex min-h-11 items-center underline underline-offset-4">{link.label}</a>)}</nav>;
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
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-ascent-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Brand href={homeHref} />
          <p>Competition registration · Ascent by AMS</p>
          <p><a href="mailto:team@amshq.in" className="inline-flex min-h-11 items-center underline">Help: team@amshq.in</a></p>
          <LegalLinks />
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-ascent-border bg-ascent-surface-subtle">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div>
            <Brand href={homeHref} />
            <p className="mt-2 max-w-lg text-sm leading-6 text-ascent-muted">
              A C++ optimization competition ranked by the measured speedup of
              correct code.
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="-mx-2.5 inline-flex min-h-11 items-center px-2.5 text-sm font-medium text-ascent-muted hover:text-ascent-brand"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-ascent-border pt-5 text-xs text-ascent-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 Ascent. Organised by the <a href="https://www.linkedin.com/company/algorithms-mathematics-society/" target="_blank" rel="noreferrer" className="underline">Algorithms &amp; Mathematics Society</a>, Mumbai. <a href="https://discord.gg/fgm4CnBKzV" target="_blank" rel="noreferrer" className="underline">Discord</a></p>
          <LegalLinks />
          <p><a href="mailto:team@amshq.in" className="inline-flex min-h-11 items-center underline">Help: team@amshq.in</a><br /><a href="mailto:partners@amshq.in" className="inline-flex min-h-11 items-center underline">Sponsors: partners@amshq.in</a></p>
        </div>
      </div>
    </footer>
  );
}
