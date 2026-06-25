// src/content/sections.ts
import type { ComponentType } from "react";
import {
  Binary,
  Cpu,
  Flag,
  ListChecks,
  Timer,
  Trophy,
} from "lucide-react";

export type IconType = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

export type AboutCard = { icon: IconType; title: string; body: string };
export type Track = { badge: string; title: string; body: string };
export type TimelinePhase = {
  icon: IconType;
  phase: string;
  date: string;
  body: string;
};
export type FaqItem = { q: string; a: string };
export type HeroStat = { label: string; value: string };

export const HERO_STATS: HeroStat[] = [
  { label: "Judged on", value: "Speed" },
  { label: "Standard", value: "C++20" },
  { label: "Entry", value: "Free" },
];

export const ABOUT_CARDS: AboutCard[] = [
  {
    icon: Cpu,
    title: "Pure C++",
    body: "One language, no shortcuts. Every solution compiles with modern g++ and the C++20 standard library.",
  },
  {
    icon: Binary,
    title: "Algorithmic",
    body: "Graphs, DP, number theory and clever data structures — problems that reward the right idea, not boilerplate.",
  },
  {
    icon: Timer,
    title: "Timed rounds",
    body: "Live, judged rounds with an instant verdict. Speed and correctness both count toward the leaderboard.",
  },
];

export const TRACKS: Track[] = [
  {
    badge: "Div 2",
    title: "Beginner",
    body: "New to competitive C++? Friendlier constraints and guided problems to make your first accepted submission.",
  },
  {
    badge: "Div 1",
    title: "Advanced",
    body: "Tight time limits and hard problem sets for seasoned competitors chasing a top rank.",
  },
  {
    badge: "Relay",
    title: "Team Relay",
    body: "Teams of three share a single judge queue — coordinate, split the set and climb together.",
  },
];

export const TIMELINE: TimelinePhase[] = [
  {
    icon: Flag,
    phase: "Registration",
    date: "Jul 1 – Jul 20, 2026",
    body: "Sign up solo or form your relay team. Warm-up problems unlock as soon as you register.",
  },
  {
    icon: ListChecks,
    phase: "Prelims",
    date: "Jul 26, 2026",
    body: "A timed online round across both divisions. Top scorers advance to the finals.",
  },
  {
    icon: Cpu,
    phase: "Finals",
    date: "Aug 9, 2026",
    body: "The summit set — harder constraints, live standings and a frozen scoreboard for the last hour.",
  },
  {
    icon: Trophy,
    phase: "Results",
    date: "Aug 12, 2026",
    body: "Final rankings, editorials and prizes announced. Bragging rights are permanent.",
  },
];

export const FAQ: FaqItem[] = [
  {
    q: "Do I need a team to compete?",
    a: "No. Div 1 and Div 2 are individual tracks. Only the Team Relay requires a squad of three.",
  },
  {
    q: "Which compiler is used?",
    a: "The judge runs g++ with -O2 -std=c++20. Anything in the standard library is fair game.",
  },
  {
    q: "How much does it cost?",
    a: "Ascent is free to enter. All you need is a C++ toolchain and a willingness to climb.",
  },
];
