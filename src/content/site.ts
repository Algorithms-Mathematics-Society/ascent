// src/content/site.ts
export type ProofStat = { value: string; label: string };

/** Single source of truth for brand and SEO copy. */
export const site = {
  name: "Ascent",
  tagline:
    "A C++ optimization competition ranked by the measured speedup of correct code.",
  seo: {
    title: "Ascent | C++ Performance Competition",
    description:
      "Ascent is a C++ optimization competition spanning an individual qualifier, team optimization at partner campuses, and a real-codebase finale.",
  },

  /**
   * Social proof: organization track record attributed to the team
   * behind AMS Derive (NOT claimed as Ascent's own history). These figures are
   * Derive's real, published numbers. No partner logos until a partner is
   * confirmed for Ascent specifically.
   */
  proof: {
    lead: "From the team behind AMS Derive",
    stats: [
      { value: "2,500+", label: "registrants" },
      { value: "20+", label: "institutions" },
      { value: "On-site", label: "finals at an IIT hub" },
    ] satisfies ProofStat[],
  },

  /**
   * Registration window. Set `closeISO` to the REAL close date/time (ISO 8601
   * with timezone offset, e.g. "2026-07-20T18:30:00+05:30") to switch on the
   * countdown. While null, the countdown renders nothing.
   */
  registration: {
    closeISO: null as string | null,
  },
};
