export type HeroStat = { label: string; value: string };
export type ScoringStep = {
  label: string;
  title: string;
  body: string;
};
export type CompetitionRound = {
  number: string;
  phase: string;
  participation: string;
  setting: string;
  focus: string;
};
export type TimelinePhase = {
  phase: string;
  timing: string;
  body: string;
};
export type FaqItem = { q: string; a: string };

export const HERO_STATS: HeroStat[] = [
  { label: "Scoring", value: "Measured speedup" },
  { label: "Language", value: "C++20" },
  { label: "Entry", value: "Free" },
];

export const SCORING_STEPS: ScoringStep[] = [
  {
    label: "01 / Correct",
    title: "Preserve the result",
    body: "Every optimization must remain correct. A faster wrong answer does not score.",
  },
  {
    label: "02 / Measure",
    title: "Run against the baseline",
    body: "Valid submissions are evaluated in a controlled environment against the same starting point.",
  },
  {
    label: "03 / Rank",
    title: "Rank by speedup",
    body: "Your measured speedup determines your place in the rankings.",
  },
];

export const COMPETITION_ROUNDS: CompetitionRound[] = [
  {
    number: "01",
    phase: "C++ qualifier",
    participation: "Individual",
    setting: "AMS Access",
    focus: "Performance-focused C++ problems establish who advances.",
  },
  {
    number: "02",
    phase: "Hub optimization",
    participation: "Team",
    setting: "Participating IIT hubs",
    focus: "Profile, test, and improve code under a shared set of constraints.",
  },
  {
    number: "03",
    phase: "Codebase finale",
    participation: "Finalists",
    setting: "IIT Bombay",
    focus: "Optimize a real codebase while preserving its required behaviour.",
  },
];

// Master fact sheet, compiled 11 September 2026: selected calendar Version A.
// Registration closing is unset; Round 3 remains tentative.
export const TIMELINE: TimelinePhase[] = [
  {
    phase: "Registration opens",
    timing: "24 September 2026",
    body: "Submit your contact, education, and competition details. The registration closing date is yet to be announced.",
  },
  {
    phase: "Round 1: Proficiency",
    timing: "24 October 2026",
    body: "Online on AMS Access with remote proctoring. C++ proficiency, puzzles, and live debugging.",
  },
  {
    phase: "Round 2: Implementation",
    timing: "6 December 2026",
    body: "Group-based implementation on AMS Access at partner campuses, moderated by campus club members.",
  },
  {
    phase: "Round 3: Mastery",
    timing: "20 December 2026 · Tentative",
    body: "30 finalists meet on site in Mumbai for live judging of language, build system, profiling, and debugging skills. AMS covers travel and stay.",
  },
];

export const FAQ: FaqItem[] = [
  {
    q: "Who can register?",
    a: "Anyone can register. Advancement depends on the qualification process and your contest results.",
  },
  {
    q: "What determines my score?",
    a: "Correctness comes first. Valid solutions are then measured against a common baseline, and performance improvement drives the ranking.",
  },
  {
    q: "Do I need a team when I register?",
    a: "No. Registration and the qualifier are individual. Team-based work is introduced only for competitors who advance to the hub round.",
  },
  {
    q: "Which compiler and hardware will be used?",
    a: "The competition uses C++20. The exact compiler, flags, target hardware, allowed libraries, and measurement method will be published with the official rules before the qualifier.",
  },
  {
    q: "When are registration and the competition rounds?",
    a: "Registration opens on 24 September 2026. Round 1 is on 24 October and Round 2 on 6 December. Round 3 is planned for 20 December 2026 in Mumbai, with that date still tentative. The registration closing date is yet to be announced.",
  },
  {
    q: "What happens after I submit the form?",
    a: "After you submit, the page confirms your registration and shows your entry reference. Save that reference and check that your email and mobile number are correct so the Ascent team can contact you.",
  },
  {
    q: "Is there an entry fee?",
    a: "No. Registration for Ascent is free.",
  },
];
