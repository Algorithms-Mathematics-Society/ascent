// src/content/site.ts
export type NavLink = { label: string; href: string };
export type FooterColumn = { heading: string; links: NavLink[] };
export type ProofStat = { value: string; label: string };

/** Single source of truth for brand, footer and SEO copy. */
export const site = {
  name: "AMS Ascent",
  tagline:
    "A C++ competitive-programming ascent — climb from your first g++ build to the algorithmic summit.",
  seo: {
    title: "AMS Ascent — The C++ Ascent",
    description:
      "AMS Ascent is a C++ competitive-programming event. Climb the C++ ladder through algorithmic rounds — from prelims to finals.",
  },

  /**
   * Social proof — org-level track record, honestly attributed to the team
   * behind AMS Derive (NOT claimed as Ascent's own history). These figures are
   * Derive's real, published numbers. No partner logos until a partner is
   * confirmed for Ascent specifically.
   */
  proof: {
    lead: "From the team behind AMS Derive",
    stats: [
      { value: "600+", label: "competitors" },
      { value: "20+", label: "institutions" },
      { value: "On-site", label: "finals at an IIT hub" },
    ] satisfies ProofStat[],
  },

  /**
   * Registration window. Set `closeISO` to the REAL close date/time (ISO 8601
   * with timezone offset, e.g. "2026-07-20T18:30:00+05:30") to switch on the
   * countdown. While null, the countdown renders nothing — we never show a
   * fabricated date.
   */
  registration: {
    closeISO: null as string | null,
  },
  footer: [
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
  ] satisfies FooterColumn[],
};
