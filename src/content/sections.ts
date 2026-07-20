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
    title: "Climb through speedup",
    body: "Measured performance—not submission decoration or pedigree—separates the ranklist.",
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

export const TIMELINE: TimelinePhase[] = [
  {
    phase: "Registration",
    timing: "Schedule pending",
    body: "Submit your contact, education, and competition details in one three-stage form.",
  },
  {
    phase: "C++ qualifier",
    timing: "Date to be announced",
    body: "The first scored round runs on AMS Access. Qualification details will be published with the rules.",
  },
  {
    phase: "Hub optimization",
    timing: "Date to be announced",
    body: "Selected competitors move into team-based optimization at participating IIT hubs.",
  },
  {
    phase: "Codebase finale",
    timing: "Date to be announced",
    body: "Finalists meet at IIT Bombay for the real-codebase performance round.",
  },
];

export const FAQ: FaqItem[] = [
  {
    q: "Who can register?",
    a: "Anyone can register. Ascent uses contest performance and the qualification process—not a pedigree screen—as the merit gate.",
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
    q: "When will the competition dates be confirmed?",
    a: "The schedule is still being finalized. Confirmed dates will replace the clearly marked pending states on this page; placeholder dates are not presented as facts.",
  },
  {
    q: "What happens after I submit the form?",
    a: "The final stage records your competition entry and shows an on-site confirmation. Keep your email and mobile number accurate so the event team can share administrative next steps.",
  },
  {
    q: "Is there an entry fee?",
    a: "No. Registration for Ascent is free.",
  },
];
