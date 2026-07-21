import Image from "next/image";
import { Button } from "@/components/ui";

interface NavbarProps {
  page?: "home" | "registration" | "syllabus";
}

const PUBLIC_LINKS = [
  { label: "About", href: "#about" },
  { label: "Format", href: "#tracks" },
  { label: "Timeline", href: "#timeline" },
  { label: "FAQ", href: "#faq" },
  { label: "Syllabus", href: "/syllabus" },
] as const;

/** Shared, solid site chrome for marketing and registration routes. */
export default function Navbar({ page = "home" }: NavbarProps) {
  const isRegistration = page === "registration";
  const isHome = page === "home";

  function resolveHref(href: string) {
    return !isHome && href.startsWith("#") ? `/${href}` : href;
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-ascent-border bg-ascent-surface">
      <a
        href="#top"
        className="fixed left-4 top-3 z-[60] inline-flex min-h-11 -translate-y-20 items-center rounded-control border border-ascent-brand bg-ascent-surface px-4 text-sm font-semibold text-ascent-brand focus:translate-y-0"
      >
        Skip to main content
      </a>

      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <div className="flex shrink-0 items-center gap-8 lg:gap-10">
          <a
            href={isHome ? "#top" : "/#top"}
            aria-label="Ascent home"
            className="group flex min-h-11 shrink-0 items-center gap-2 font-mono text-sm font-bold tracking-tight text-ascent-ink hover:text-ascent-brand"
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

          {!isRegistration ? (
            <div className="hidden items-center gap-6 md:flex">
              {PUBLIC_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={resolveHref(link.href)}
                  aria-current={
                    page === "syllabus" && link.href === "/syllabus"
                      ? "page"
                      : undefined
                  }
                  className={`-mx-2.5 inline-flex min-h-11 items-center border-b-2 px-2.5 text-sm font-medium hover:text-ascent-brand ${
                    page === "syllabus" && link.href === "/syllabus"
                      ? "border-ascent-brand text-ascent-ink"
                      : "border-transparent text-ascent-muted"
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {isRegistration ? (
          <div className="flex items-center gap-3">
            <span className="hidden rounded-control border border-ascent-border-strong bg-ascent-brand-tint px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ascent-brand sm:inline-flex">
              Registration
            </span>
            <Button href="/" size="sm" variant="secondary">
              View event
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <a
              href="/syllabus"
              aria-current={page === "syllabus" ? "page" : undefined}
              className={`inline-flex min-h-11 items-center text-sm font-medium md:hidden ${
                page === "syllabus" ? "text-ascent-ink" : "text-ascent-muted"
              }`}
            >
              Syllabus
            </a>
            <Button href="/register" size="sm">
              Register
            </Button>
          </div>
        )}
      </nav>
    </header>
  );
}
