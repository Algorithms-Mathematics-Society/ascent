"use client";

import { useEffect, useState } from "react";
import { ChevronsUp, Menu, X } from "lucide-react";

/** In-page anchor links shared by the desktop nav and the mobile drawer. */
const NAV_LINKS: { label: string; href: string }[] = [
  { label: "About", href: "#about" },
  { label: "Tracks", href: "#tracks" },
  { label: "Timeline", href: "#timeline" },
  { label: "Prizes", href: "#prizes" },
  { label: "FAQ", href: "#faq" },
];

/**
 * Fixed, frosted page-chrome navbar for AMS Ascent.
 * Renders with no required props. Client component for the mobile menu toggle.
 */
export default function Navbar() {
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/10 bg-ascent-bg/70 backdrop-blur-xl">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        {/* Wordmark */}
        <a
          href="#top"
          className="group flex items-center gap-2 font-mono text-sm font-bold tracking-tight text-ascent-ink transition-colors duration-150 ease-expo"
        >
          <ChevronsUp
            aria-hidden="true"
            className="h-5 w-5 text-ascent-accent transition-colors duration-150 ease-expo group-hover:text-ascent-cyan"
          />
          <span>AMS&nbsp;Ascent</span>
        </a>

        {/* Desktop links */}
        <ul className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-ascent-muted transition-colors duration-150 ease-expo hover:font-semibold hover:text-ascent-ink focus-visible:text-ascent-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Right cluster: CTA + mobile toggle */}
        <div className="flex items-center gap-2">
          <a
            href="#register"
            className="ascent-btn ascent-btn-primary ascent-btn-sm"
          >
            Register
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-ascent-ink transition-colors duration-150 ease-expo hover:border-ascent-accent/50 hover:bg-white/10 lg:hidden"
          >
            {open ? (
              <X aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Menu aria-hidden="true" className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown drawer */}
      {open && (
        <div
          id="mobile-nav"
          className="border-b border-white/10 bg-ascent-bg/95 backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ascent-muted transition-colors duration-150 ease-expo hover:bg-white/5 hover:text-ascent-ink focus-visible:bg-white/5 focus-visible:text-ascent-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
