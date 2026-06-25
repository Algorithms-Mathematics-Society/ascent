import { ChevronsUp } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Fixed, frosted page-chrome navbar for AMS Ascent. Wordmark + primary CTA.
 * The section links were in-page anchors on a single-page site, so they live
 * in the page flow (and footer), not here. Server component, no required props.
 */
export default function Navbar() {
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

        {/* Primary CTA */}
        <Button href="#register" size="sm">
          Register
        </Button>
      </nav>
    </header>
  );
}
