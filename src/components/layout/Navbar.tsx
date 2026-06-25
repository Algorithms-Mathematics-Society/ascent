import { ChevronsUp } from "lucide-react";
import { Button } from "@/components/ui";
import PerfReadout from "./PerfReadout";
import ScrollProgress from "./ScrollProgress";

/**
 * Fixed page-chrome navbar for AMS Ascent, treated as an IDE / terminal status
 * bar: a live performance readout is the signature (the bar demonstrates the
 * speed the contest judges), the Register CTA is the standard blue (one CTA
 * color site-wide; hot magenta is reserved for speed reveals), and a thin
 * scroll-progress "climb" line fills along the bottom edge. Server component;
 * the readout and progress line are the only client islands. Section links were
 * in-page anchors, so they live in the page flow, not here.
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
          className="group flex items-center gap-2 font-mono text-sm font-bold tracking-tight text-ascent-ink transition-colors duration-150 ease-expo hover:text-ascent-accent"
        >
          <ChevronsUp
            aria-hidden="true"
            className="h-5 w-5 text-ascent-accent transition-colors duration-150 ease-expo group-hover:text-ascent-cyan"
          />
          <span>AMS&nbsp;Ascent</span>
        </a>

        {/* Signature: live performance readout (status-line style) */}
        <PerfReadout />

        {/* Primary CTA — blue, matching every Register on the site */}
        <Button href="#register" size="sm">
          Register
        </Button>
      </nav>

      {/* Scroll-progress climb line */}
      <ScrollProgress />
    </header>
  );
}
