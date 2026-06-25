// src/content/site.ts
export type NavLink = { label: string; href: string };
export type FooterColumn = { heading: string; links: NavLink[] };

/** Single source of truth for brand, navigation, footer and SEO copy. */
export const site = {
  name: "AMS Ascent",
  tagline:
    "A C++ competitive-programming ascent — climb from your first g++ build to the algorithmic summit.",
  seo: {
    title: "AMS Ascent — The C++ Ascent",
    description:
      "AMS Ascent is a C++ competitive-programming event. Climb the C++ ladder through algorithmic rounds — from prelims to finals.",
  },
  nav: [
    { label: "About", href: "#about" },
    { label: "Tracks", href: "#tracks" },
    { label: "Timeline", href: "#timeline" },
    { label: "Prizes", href: "#prizes" },
    { label: "FAQ", href: "#faq" },
  ] satisfies NavLink[],
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
