"use client";

import { useEffect, useState } from "react";
import { ChevronsUp, Menu, X } from "lucide-react";
import { site } from "@/content/site";
import { Button } from "@/components/ui";

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
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-ascent-border bg-ascent-bg/80 backdrop-blur-md">
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
          {site.nav.map((link) => (
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
          <Button href="#register" size="sm">
            Register
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ascent-border bg-ascent-bg text-ascent-ink transition-colors duration-150 ease-expo hover:border-slate-300 hover:bg-ascent-surface lg:hidden"
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
          className="border-b border-ascent-border bg-ascent-bg/95 backdrop-blur-md lg:hidden"
        >
          <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {site.nav.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ascent-muted transition-colors duration-150 ease-expo hover:bg-ascent-surface hover:text-ascent-ink focus-visible:bg-ascent-surface focus-visible:text-ascent-ink"
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
