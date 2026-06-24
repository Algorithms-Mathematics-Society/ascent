import { ChevronsUp } from "lucide-react";

type FooterColumn = {
  heading: string;
  links: { label: string; href: string }[];
};

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Event",
    links: [
      { label: "About", href: "#about" },
      { label: "Tracks", href: "#tracks" },
      { label: "Timeline", href: "#timeline" },
      { label: "Rules", href: "#rules" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Contact", href: "#contact" },
      { label: "Code of Conduct", href: "#conduct" },
    ],
  },
  {
    heading: "Social",
    links: [
      { label: "GitHub", href: "#" },
      { label: "Discord", href: "#" },
      { label: "X / Twitter", href: "#" },
    ],
  },
];

/**
 * Page-chrome footer for AMS Ascent. Server component, no required props.
 */
export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ascent-bg">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <a
              href="#top"
              className="group inline-flex items-center gap-2 font-mono text-sm font-bold tracking-tight text-ascent-ink"
            >
              <ChevronsUp
                aria-hidden="true"
                className="h-5 w-5 text-ascent-accent transition-colors duration-150 ease-expo group-hover:text-ascent-cyan"
              />
              <span>AMS&nbsp;Ascent</span>
            </a>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ascent-muted">
              A C++ competitive-programming ascent — climb from your first
              `g++` build to the algorithmic summit.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ascent-ink">
                {col.heading}
              </h2>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-ascent-muted transition-colors duration-150 ease-expo hover:text-ascent-ink focus-visible:text-ascent-ink"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-ascent-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 AMS Ascent. All rights reserved.</p>
          <p className="font-mono">
            Built for the C++ community · An AMS event.
          </p>
        </div>
      </div>
    </footer>
  );
}
