// src/content/site.ts
export type ProofStat = { value: string; label: string };

/** Single source of truth for brand and SEO copy. */
export const site = {
  name: "Ascent",
  tagline:
    "A C++ optimization competition where correctness is the gate and measured performance drives the ranklist.",
  seo: {
    title: "Ascent — C++ Performance Competition",
    description:
      "Ascent is a C++ optimization competition spanning an individual qualifier, team optimization at IIT hubs, and a real-codebase finale.",
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
};
