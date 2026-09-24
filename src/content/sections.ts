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
    focus: "C++ proficiency, puzzles and live debugging. Correct answers and how quickly you submit them decide who advances.",
  },
  {
    number: "02",
    phase: "Hub optimization",
    participation: "Team",
    setting: "Partner campuses · To be announced",
    focus: "Profile, test, and improve code under a shared set of constraints.",
  },
  {
    number: "03",
    phase: "Codebase finale",
    participation: "Finalists",
    setting: "Mumbai · Tentative",
    focus: "Optimize a real codebase while preserving its required behaviour.",
  },
];

// Master fact sheet, compiled 11 September 2026: selected calendar Version A.
// Registration closing is unset; Round 3 remains tentative.
/**
 * ISO forms of the dates rendered in TIMELINE below, for structured data.
 * Change these in the same edit as the display strings.
 */
export const SCHEDULE_ISO = {
  registrationOpens: "2026-09-24T06:00:00+05:30",
  registrationCloses: "2026-10-20T23:59:59+05:30",
  roundOne: "2026-10-24T14:00:00+05:30",
  roundOneEnds: "2026-10-24T16:00:00+05:30",
  roundTwo: "2026-12-06T00:00:00+05:30",
  roundThree: "2026-12-20T00:00:00+05:30",
  roundThreeEnds: "2026-12-20T23:59:59+05:30",
} as const;

export const TIMELINE: TimelinePhase[] = [
  {
    phase: "Registration opens",
    timing: "24 September 2026 · 06:00 IST",
    body: "Submit your contact, education, and competition details. Registration closes on 20 October 2026.",
  },
  {
    phase: "Round 1: Proficiency",
    timing: "24 October 2026 · 2:00 pm IST",
    body: "Two hours, online on AMS Access with remote proctoring. C++ proficiency, puzzles, and live debugging.",
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
    a: "Registration is open to candidates in India and across the Asia-Pacific region. Seats for candidates outside India are limited to 100 for this edition. Advancement depends on the qualification process and your contest results.",
  },
  {
    q: "What determines my score?",
    a: "Correctness comes first: an incorrect solution does not score. In Round 1 your rank then comes from how quickly you submit correct answers. From Round 2 onward, valid solutions are measured against a common baseline and the performance improvement drives the ranking. The syllabus describes each round in detail.",
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
    a: "Registration opens on 24 September 2026 at 06:00 IST and closes on 20 October 2026. Round 1 is on 24 October at 2:00 pm IST and runs for two hours. Round 2 is on 6 December. Round 3 is planned for 20 December 2026 in Mumbai, with that date still tentative.",
  },
  {
    q: "What happens after I submit the form?",
    a: "Check your email and mobile number carefully before you submit, because they are how the Ascent team reaches you. After you submit, the page confirms your registration and shows your entry reference, and a confirmation email is sent to the address you gave. You can view your entry at any time from the entry status page. If anything is wrong, email team@amshq.in and we will reply within 24 to 48 hours.",
  },
  {
    q: "What do I need to sit Round 1?",
    a: "Round 1 runs on AMS Access, our proctored competition application. Windows, macOS and Linux are supported, and screen recording may be required. You can download AMS Access and test your setup from 15 October 2026, ahead of the round on 24 October. Full requirements are at https://www.amsaccess.com. If your machine cannot run it, email team@amshq.in and we will help you sort it out.",
  },
  {
    q: "Is there an entry fee?",
    a: "No. Registration for Ascent is free.",
  },
];
