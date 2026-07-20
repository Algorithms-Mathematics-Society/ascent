# Architecture / Components / Theming Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Ascent marketing site into a principal-grade architecture — thin composition root, per-section components, typed UI primitives, a single-source content layer, and a documented dark-ready token system — with the rendered light-mode output pixel-identical.

**Architecture:** Static, server-first Next.js App Router site. Data flows one-way: `content/*` → `sections/*` → `page.tsx`. Reusable presentation primitives in `components/ui/` wrap the existing `.ascent-btn`/`.glass-card` CSS classes with a typed API. Theming is a documented semantic `--ascent-*` token layer in `globals.css`, structured so a `[data-theme="dark"]` block can flip it later.

**Tech Stack:** Next.js (App Router), React 18 (server components; Navbar is the only client component), TypeScript, Tailwind CSS, lucide-react, @fontsource fonts.

## Global Constraints

- **Pure refactor — light-mode render must stay pixel-identical.** Acceptance = green build + visual parity + preserved anchor ids.
- **No new runtime dependencies.** Existing stack only.
- **No dark-mode toggle.** Structure for dark mode only; ship light-only.
- **Import alias:** `@/*` → `src/*` (already in tsconfig). Use it for all new modules.
- **Server-first.** Only `Navbar` carries `"use client"`. Do not add client directives elsewhere.
- **Preserve anchor ids exactly:** `#top`, `#about`, `#tracks`, `#timeline`, `#prizes`, `#register`, `#faq`.
- **Verification per task:** `npm run build` must pass (TypeScript + Next lint), ending in static prerender. There is no unit-test framework; do not add one.
- **No hardcoded color literals** in `src/components/**` or the `globals.css` component layer after this work — colors flow through `ascent-*` tokens/utilities.
- **Disk is near-full.** If a build fails on ENOSPC, remove `.next/` and retry; do not delete anything else.

---

## Task 1: `lib/cn.ts` — className-merge helper

**Files:**
- Create: `src/lib/cn.ts`

**Interfaces:**
- Produces: `export function cn(...parts: Array<string | false | null | undefined>): string` — joins truthy class strings with a single space.

- [ ] **Step 1: Create the helper**

```ts
// src/lib/cn.ts
/**
 * Join class name fragments, dropping falsy values.
 * Intentionally dependency-free — no clsx/tailwind-merge needed for this site.
 */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/lib/cn.ts
git commit -m "Add cn() className-merge helper"
```

---

## Task 2: `content/` — site config + section data

Move all static content out of `page.tsx`, `Navbar.tsx`, `Footer.tsx` into a single-source content layer. Icons stay inline as lucide-react components.

**Files:**
- Create: `src/content/site.ts`
- Create: `src/content/sections.ts`

**Interfaces:**
- Produces (`site.ts`):
  - `export type NavLink = { label: string; href: string }`
  - `export type FooterColumn = { heading: string; links: NavLink[] }`
  - `export const site: { name: string; tagline: string; seo: { title: string; description: string }; nav: NavLink[]; footer: FooterColumn[] }`
- Produces (`sections.ts`):
  - `export type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>`
  - `export type AboutCard = { icon: IconType; title: string; body: string }`
  - `export type Track = { badge: string; title: string; body: string }`
  - `export type TimelinePhase = { icon: IconType; phase: string; date: string; body: string }`
  - `export type FaqItem = { q: string; a: string }`
  - `export type HeroStat = { label: string; value: string }`
  - `export const ABOUT_CARDS: AboutCard[]`, `TRACKS: Track[]`, `TIMELINE: TimelinePhase[]`, `FAQ: FaqItem[]`, `HERO_STATS: HeroStat[]`

- [ ] **Step 1: Create `src/content/site.ts`**

```ts
// src/content/site.ts
export type NavLink = { label: string; href: string };
export type FooterColumn = { heading: string; links: NavLink[] };

/** Single source of truth for brand, navigation, footer and SEO copy. */
export const site = {
  name: "Ascent",
  tagline:
    "A C++ competitive-programming ascent — climb from your first g++ build to the algorithmic summit.",
  seo: {
    title: "Ascent — The C++ Ascent",
    description:
      "Ascent is a C++ competitive-programming event. Climb the C++ ladder through algorithmic rounds — from prelims to finals.",
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
```

- [ ] **Step 2: Create `src/content/sections.ts`** (arrays copied verbatim from current `page.tsx` lines 18–94, now typed)

```ts
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
  { label: "Standard", value: "C++20" },
  { label: "Tracks", value: "3 divisions" },
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
```

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors. (These modules are not yet imported anywhere — that's fine; they compile standalone.)

- [ ] **Step 4: Commit**

```bash
git add src/content/site.ts src/content/sections.ts
git commit -m "Add content layer (site config + typed section data)"
```

---

## Task 3: `globals.css` — semantic, dark-ready token restructure

Reorganize tokens with a documented primitive→semantic structure, add tokens for the values currently hardcoded in components, and document the dark-mode flip. **Light-mode RGB values are unchanged**, so render is identical.

**Files:**
- Modify: `src/app/globals.css` (`:root` block, lines 9–20; `.ascent-btn-primary`, lines 110–121)
- Modify: `tailwind.config.ts` (add the two new button tokens to the `ascent` color map)

**Interfaces:**
- Produces: new CSS vars `--ascent-btn-primary-bg` (`2 6 23`), `--ascent-btn-primary-bg-hover` (`30 41 59`); Tailwind colors `ascent.btn-primary`, `ascent.btn-primary-hover` (available but not required by other tasks).

- [ ] **Step 1: Replace the `:root` block** (`src/app/globals.css` lines 9–20) with the documented version

```css
/* ============================================================
   Ascent — semantic token system (dark-ready)
   Values are space-separated RGB triples (Tailwind <alpha-value>).

   PRIMITIVE PALETTE (reference — what the semantic tokens map to):
     white         255 255 255
     slate-50      248 250 252      slate-200   226 232 240
     slate-600      71  85 105      slate-800    30  41  59
     slate-900      15  23  42      slate-950     2   6  23
     blue-600       37  99 235      blue-500     59 130 246
     blue-700       29  78 216      cyan-600      8 145 178

   To add dark mode later: copy the `:root` mappings into a
   `[data-theme="dark"]` block and swap the primitive values.
   Every color in the app flows through these tokens.
   ============================================================ */
:root {
  /* Surfaces */
  --ascent-bg: 255 255 255; /* page canvas */
  --ascent-surface: 248 250 252; /* slate-50 — card / panel surface */
  --ascent-panel: 248 250 252; /* slate-50 (legacy alias of surface) */
  --ascent-border: 226 232 240; /* slate-200 — hairline borders */

  /* Brand / accent */
  --ascent-accent: 37 99 235; /* blue-600 — primary accent on white */
  --ascent-accent-bright: 59 130 246; /* blue-500 — gradient stop */
  --ascent-blue-deep: 29 78 216; /* blue-700 — accent hover */
  --ascent-cyan: 8 145 178; /* cyan-600 — secondary accent */

  /* Text */
  --ascent-ink: 15 23 42; /* slate-900 — headings / body */
  --ascent-muted: 71 85 105; /* slate-600 — secondary text */

  /* Component tokens (absorb formerly-hardcoded values) */
  --ascent-btn-primary-bg: 2 6 23; /* slate-950 — primary CTA fill */
  --ascent-btn-primary-bg-hover: 30 41 59; /* slate-800 — primary CTA hover */
}
```

- [ ] **Step 2: Replace `.ascent-btn-primary` + its `:hover`** (`src/app/globals.css` lines 110–121) to consume the tokens

```css
  /* Primary — solid near-black, white text (AMS Access style) */
  .ascent-btn-primary {
    color: rgb(var(--ascent-bg));
    background-color: rgb(var(--ascent-btn-primary-bg));
    border-color: rgb(var(--ascent-btn-primary-bg));
    box-shadow: 0 12px 28px rgb(15 23 42 / 0.14);
  }

  .ascent-btn-primary:hover {
    background-color: rgb(var(--ascent-btn-primary-bg-hover));
    border-color: rgb(var(--ascent-btn-primary-bg-hover));
  }
```

- [ ] **Step 3: Add the two new tokens to `tailwind.config.ts`** — inside the `ascent: { ... }` color object (after the `muted` line, ~line 22), add:

```ts
          "btn-primary": "rgb(var(--ascent-btn-primary-bg) / <alpha-value>)",
          "btn-primary-hover":
            "rgb(var(--ascent-btn-primary-bg-hover) / <alpha-value>)",
```

- [ ] **Step 4: Verify the build is green and CSS values are unchanged**

Run: `npm run build`
Expected: completes, ends with `○ (Static) prerendered as static content`.
Then confirm no stray hex remains in the component layer:
Run: `grep -nE '#[0-9a-fA-F]{3,6}' src/app/globals.css`
Expected: no matches inside `@layer components` (matches only in the primitive-palette comment, if any — those are reference text, acceptable).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "Restructure tokens into documented dark-ready semantic layer"
```

---

## Task 4: `components/ui/` — typed presentation primitives

Build the six primitives + barrel. They wrap existing CSS classes/utilities; no new styles. Each renders markup byte-equivalent to its current inline usage so sections can adopt them with zero visual change.

**Files:**
- Create: `src/components/ui/Container.tsx`, `Section.tsx`, `Eyebrow.tsx`, `SectionHeading.tsx`, `Button.tsx`, `Card.tsx`, `index.ts`

**Interfaces:**
- Consumes: `cn` from `@/lib/cn` (Task 1).
- Produces:
  - `Container({ children, className? })`
  - `Section({ id?, className?, children })`
  - `Eyebrow({ children, className? })`
  - `SectionHeading({ eyebrow?, title, lede?, align?: "left"|"center", className? })`
  - `Button({ variant?: "primary"|"secondary", size?: "sm"|"md"|"lg", href?, className?, children, ...rest })`
  - `Card({ as?: "div"|"li", className?, children, ...rest })`
  - barrel `index.ts` re-exporting all six.

- [ ] **Step 1: `Container.tsx`**

```tsx
// src/components/ui/Container.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Centered page-width wrapper with the shared responsive gutters. */
export default function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: `Section.tsx`**

```tsx
// src/components/ui/Section.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Semantic <section> with the shared vertical rhythm. Layout-neutral: it does
 * not impose a Container, so sections compose their own inner width.
 */
export default function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("py-24", className)}>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: `Eyebrow.tsx`**

```tsx
// src/components/ui/Eyebrow.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Mono uppercase accent label that sits above a section heading. */
export default function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-mono text-xs font-semibold uppercase tracking-wider text-ascent-accent",
        className,
      )}
    >
      {children}
    </p>
  );
}
```

- [ ] **Step 4: `SectionHeading.tsx`**

```tsx
// src/components/ui/SectionHeading.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import Eyebrow from "./Eyebrow";

/**
 * Eyebrow + h2 + optional lede, matching the site's section-header rhythm.
 * `align="center"` centers the block (FAQ, Prizes); default is left.
 */
export default function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "left",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        align === "center" ? "text-center" : "max-w-2xl",
        className,
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-ascent-ink sm:text-4xl">
        {title}
      </h2>
      {lede ? (
        <p className="mt-5 text-lg leading-relaxed text-ascent-muted">{lede}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: `Button.tsx`** (polymorphic: `<a>` with href, else `<button>`)

```tsx
// src/components/ui/Button.tsx
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";
type Size = "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  sm: "ascent-btn-sm",
  md: "ascent-btn-md",
  lg: "ascent-btn-lg",
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "ascent-btn-primary",
  secondary: "ascent-btn-secondary",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonAsLink = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

/** Typed wrapper over the .ascent-btn class family. Renders <a> when href is set. */
export default function Button(props: ButtonAsLink | ButtonAsButton) {
  const {
    variant = "primary",
    size = "md",
    className,
    children,
    ...rest
  } = props;
  const classes = cn(
    "ascent-btn",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    className,
  );

  if ("href" in props && props.href !== undefined) {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
```

- [ ] **Step 6: `Card.tsx`**

```tsx
// src/components/ui/Card.tsx
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Surface wrapper over the .glass-card class. `as` allows <li> for lists. */
export default function Card({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: "div" | "li";
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("glass-card", className)} {...rest}>
      {children}
    </Tag>
  );
}
```

- [ ] **Step 7: `index.ts` barrel**

```ts
// src/components/ui/index.ts
export { default as Container } from "./Container";
export { default as Section } from "./Section";
export { default as Eyebrow } from "./Eyebrow";
export { default as SectionHeading } from "./SectionHeading";
export { default as Button } from "./Button";
export { default as Card } from "./Card";
```

- [ ] **Step 8: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui
git commit -m "Add typed UI primitives (Button, Card, Container, Section, Eyebrow, SectionHeading)"
```

---

## Task 5: `components/layout/` — move chrome, adopt primitives + tokens

Move `Navbar`/`Footer` into `components/layout/`, source their links from `content/site.ts`, swap the CTA for `<Button>`, and replace hardcoded `slate-*`/`white` utility literals with `ascent-*` token utilities (same RGB → identical render).

**Files:**
- Create: `src/components/layout/Navbar.tsx` (from `src/components/Navbar.tsx`)
- Create: `src/components/layout/Footer.tsx` (from `src/components/Footer.tsx`)
- Delete: `src/components/Navbar.tsx`, `src/components/Footer.tsx` (in Task 7, after page rewire — see note)

**Interfaces:**
- Consumes: `Button`, `Container` from `@/components/ui`; `site` from `@/content/site`.
- Produces: `default` export `Navbar` (client component), `default` export `Footer` (server component).

> Note: keep the old `src/components/Navbar.tsx` / `Footer.tsx` in place until Task 7 flips the imports, so the build never breaks mid-task. This task creates the new files and verifies they type-check via a temporary direct import check; deletion happens in Task 7.

- [ ] **Step 1: Create `src/components/layout/Navbar.tsx`**

Start from the current `src/components/Navbar.tsx` (read it). Apply exactly these changes; keep everything else (the `"use client"` directive, `useEffect` Escape handler, mobile drawer, all classes) verbatim:

1. Remove the local `NAV_LINKS` const; import links from content instead. Top of file becomes:

```tsx
"use client";

import { useEffect, useState } from "react";
import { ChevronsUp, Menu, X } from "lucide-react";
import { site } from "@/content/site";
import { Button } from "@/components/ui";
```

2. Replace every `NAV_LINKS` reference with `site.nav`.
3. Replace the wordmark text `Ascent` — keep as is (it is `{site.name}` semantically, but the `&nbsp;` is intentional; leave the literal `Ascent`).
4. Replace the Register CTA anchor:

```tsx
          <Button href="#register" size="sm">
            Register
          </Button>
```

5. Replace the hardcoded chrome color literals with token utilities (identical RGB):
   - `border-slate-200` → `border-ascent-border` (both occurrences: header border, mobile drawer border)
   - `bg-white/80` → `bg-ascent-bg/80`; `bg-white/95` → `bg-ascent-bg/95`
   - mobile toggle button: `border-slate-200` → `border-ascent-border`, `bg-white` → `bg-ascent-bg`, `hover:border-slate-300` → `hover:border-ascent-border` is NOT equivalent (slate-300 ≠ slate-200). **Keep `hover:border-slate-300` as-is** — there is no slate-300 token; leaving a single Tailwind palette utility for a hover border is acceptable and preserves the exact hover color. Same for `hover:bg-slate-50` → `hover:bg-ascent-surface` (slate-50 = surface, so DO swap this one).

- [ ] **Step 2: Create `src/components/layout/Footer.tsx`**

Start from the current `src/components/Footer.tsx`. Apply exactly these changes:

1. Remove the local `FOOTER_COLUMNS` const and its `FooterColumn` type; import from content. Top of file:

```tsx
import { ChevronsUp } from "lucide-react";
import { site } from "@/content/site";
```

2. Replace `FOOTER_COLUMNS.map` with `site.footer.map`.
3. Replace color literals (identical RGB): `border-slate-200` → `border-ascent-border` (both: top border, bottom-row border), `bg-slate-50` → `bg-ascent-surface`.
4. Leave all other markup, classes, and copy verbatim (including the `g++` mono span and the tagline).

- [ ] **Step 3: Verify the new files type-check** (they are not imported yet)

Run: `npx tsc --noEmit`
Expected: no errors. (Old chrome still imported by `page.tsx`; new files compile standalone.)

- [ ] **Step 4: Commit**

```bash
git add src/components/layout
git commit -m "Add layout chrome (Navbar, Footer) sourced from content, tokenized colors"
```

---

## Task 6: `components/sections/` — per-section components

Build one component per section reading from `content/`, using the primitives. Markup is moved verbatim from `page.tsx` except where a primitive substitutes a literal wrapper. Add a barrel.

**Files:**
- Create: `src/components/sections/CodeConsole.tsx`, `Hero.tsx`, `About.tsx`, `Tracks.tsx`, `Timeline.tsx`, `PrizesCta.tsx`, `Faq.tsx`, `index.ts`

**Interfaces:**
- Consumes: primitives from `@/components/ui`; data from `@/content/sections`.
- Produces: a `default` export per file; barrel `index.ts` with `export { default as Hero } from "./Hero"` for Hero, About, Tracks, Timeline, PrizesCta, Faq (NOT CodeConsole — it is internal to Hero).

- [ ] **Step 1: `CodeConsole.tsx`** — move the `CodeConsole` function from current `page.tsx` lines 100–159 **verbatim** into its own file. Tokenize the two `border-slate-200` and two `bg-slate-50` literals in it to `border-ascent-border` / `bg-ascent-surface` (identical RGB). File:

```tsx
// src/components/sections/CodeConsole.tsx
import { Card } from "@/components/ui";

/** Static main.cpp + terminal mockup shown in the hero. */
export default function CodeConsole() {
  return (
    <Card className="overflow-hidden font-mono text-[13px] leading-relaxed">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-ascent-border bg-ascent-surface px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-400" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-yellow-400" aria-hidden="true" />
        <span className="h-3 w-3 rounded-full bg-green-400" aria-hidden="true" />
        <span className="ml-2 text-xs text-ascent-muted">main.cpp</span>
      </div>

      {/* Source */}
      <pre className="overflow-x-auto px-4 py-4 text-ascent-ink">
        <code>
          <span className="text-ascent-cyan">#include</span>{" "}
          <span className="text-ascent-muted">&lt;bits/stdc++.h&gt;</span>
          {"\n"}
          <span className="text-ascent-cyan">using namespace</span> std;
          {"\n\n"}
          <span className="text-ascent-accent">int</span> main() {"{"}
          {"\n"}
          {"  "}ios_base::sync_with_stdio(<span className="text-ascent-accent">false</span>);
          {"\n"}
          {"  "}cin.tie(<span className="text-ascent-accent">nullptr</span>);
          {"\n\n"}
          {"  "}<span className="text-ascent-accent">long long</span> n, sum = <span className="text-ascent-cyan">0</span>;
          {"\n"}
          {"  "}cin {">>"} n;
          {"\n"}
          {"  "}<span className="text-ascent-cyan">for</span> (<span className="text-ascent-accent">long long</span> i = <span className="text-ascent-cyan">1</span>; i &lt;= n; ++i)
          {"\n"}
          {"    "}sum += i * i;
          {"\n\n"}
          {"  "}cout {"<<"} sum {"<<"} <span className="text-ascent-muted">{"\"\\n\""}</span>;
          {"\n"}
          {"  "}<span className="text-ascent-cyan">return</span> <span className="text-ascent-cyan">0</span>;
          {"\n"}
          {"}"}
        </code>
      </pre>

      {/* Terminal */}
      <div className="border-t border-ascent-border bg-ascent-surface px-4 py-3 text-xs">
        <p className="text-ascent-muted">
          <span className="text-ascent-accent">$</span> g++ -O2 -std=c++20 main.cpp -o sol
        </p>
        <p className="mt-1 text-ascent-muted">
          <span className="text-ascent-accent">$</span> ./sol &lt; sample.in
        </p>
        <p
          className="mt-2 inline-flex items-center gap-2 rounded-md border border-green-600/30 bg-green-50 px-2.5 py-1 font-semibold text-green-700"
          style={{ boxShadow: "0 0 22px -6px rgb(37 99 235 / 0.35)" }}
        >
          Accepted ✓
          <span className="font-normal text-ascent-muted">· 12 ms · 3.1 MB</span>
        </p>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: `Hero.tsx`** — move the HERO `<section>` (current `page.tsx` lines 172–239) verbatim; swap CTAs for `<Button>` and the stats `dl` to map `HERO_STATS`.

```tsx
// src/components/sections/Hero.tsx
import { Button } from "@/components/ui";
import { HERO_STATS } from "@/content/sections";
import CodeConsole from "./CodeConsole";

export default function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pb-24 pt-36 sm:px-6 lg:px-8 lg:pt-44">
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        {/* Copy */}
        <div>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-ascent-ink sm:text-5xl lg:text-6xl">
            Climb the
            <br />
            <span className="bg-gradient-to-r from-ascent-accent to-ascent-cyan bg-clip-text text-transparent">
              C++ ascent.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ascent-muted">
            Ascent is a competitive-programming event built entirely around
            modern C++. Write fast code, solve hard problems, and climb the
            leaderboard from your first build to the algorithmic summit.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button href="#register" size="lg">
              Register
            </Button>
            <Button href="#tracks" variant="secondary" size="lg">
              View tracks
            </Button>
          </div>

          <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 font-mono">
            {HERO_STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs uppercase tracking-wider text-ascent-muted">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold text-ascent-ink">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Console */}
        <div className="lg:pl-6">
          <CodeConsole />
        </div>
      </div>
    </section>
  );
}
```

> The hero copy paragraph in the current file has the same words; minor whitespace differences in source do not change the rendered text. Keep the wording exactly as shown.

- [ ] **Step 3: `About.tsx`** (current lines 242–277)

```tsx
// src/components/sections/About.tsx
import { Card, Container, Section, SectionHeading } from "@/components/ui";
import { ABOUT_CARDS } from "@/content/sections";

export default function About() {
  return (
    <Section id="about">
      <Container>
        <SectionHeading
          eyebrow="What is Ascent"
          title="A C++-only climb to the algorithmic summit."
          lede="Ascent strips competitive programming back to its core: one language, sharp problems and a live judge. Whether you are landing your first accepted submission or hunting a podium finish, every round is designed to push how you think in C++."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ABOUT_CARDS.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-6">
              <Icon aria-hidden="true" className="h-7 w-7 text-ascent-accent" />
              <h3 className="mt-4 text-lg font-semibold text-ascent-ink">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ascent-muted">
                {body}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 4: `Tracks.tsx`** (current lines 280–312)

```tsx
// src/components/sections/Tracks.tsx
import { Card, Container, Section, SectionHeading } from "@/components/ui";
import { TRACKS } from "@/content/sections";

export default function Tracks() {
  return (
    <Section id="tracks">
      <Container>
        <SectionHeading
          eyebrow="Tracks"
          title="Pick your route up the mountain."
          lede="Three ways to compete, each with its own scoreboard. Climb solo or rope up with a team."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TRACKS.map(({ badge, title, body }) => (
            <Card key={title} className="flex flex-col p-6">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ascent-accent">
                {badge}
              </span>
              <h3 className="mt-2 text-xl font-semibold text-ascent-ink">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ascent-muted">
                {body}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 5: `Timeline.tsx`** (current lines 315–356) — note the `<ol>` keeps its exact classes; node circle markup verbatim

```tsx
// src/components/sections/Timeline.tsx
import { Calendar } from "lucide-react";
import { Container, Section, SectionHeading } from "@/components/ui";
import { TIMELINE } from "@/content/sections";

export default function Timeline() {
  return (
    <Section id="timeline">
      <Container>
        <SectionHeading eyebrow="Timeline" title="Four phases to the top." />
        <ol className="mt-12 space-y-px border-l border-ascent-border pl-0">
          {TIMELINE.map(({ icon: Icon, phase, date, body }, i) => (
            <li key={phase} className="relative pb-10 pl-10 last:pb-0">
              {/* Node */}
              <span
                aria-hidden="true"
                className="absolute -left-[17px] top-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-ascent-accent/40 bg-ascent-bg text-ascent-accent shadow-sm"
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="text-lg font-semibold text-ascent-ink">
                  <span className="mr-2 font-mono text-sm text-ascent-muted">
                    0{i + 1}
                  </span>
                  {phase}
                </h3>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ascent-cyan">
                  <Calendar aria-hidden="true" className="h-3.5 w-3.5" />
                  {date}
                </span>
              </div>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ascent-muted">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
```

> `border-slate-200`→`border-ascent-border` and `bg-white`→`bg-ascent-bg` swaps in this block are identical RGB.

- [ ] **Step 6: `PrizesCta.tsx`** (current lines 359–397 — the CTA card ONLY; the FAQ block becomes its own section in Step 7). Keeps both `#prizes` (section) and `#register` (inner card) ids.

```tsx
// src/components/sections/PrizesCta.tsx
import { Users } from "lucide-react";
import { Button, Card, Container, Section } from "@/components/ui";

export default function PrizesCta() {
  return (
    <Section id="prizes">
      <Container>
        <Card
          id="register"
          className="relative isolate overflow-hidden p-10 text-center sm:p-16"
        >
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-ascent-ink sm:text-4xl">
              Ready to start the climb?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ascent-muted">
              Cash prizes, swag and editorial recognition await the top climbers
              in Div 1, Div 2 and the Team Relay. Registration is free — bring
              your toolchain.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button href="#register" size="lg">
                Register
              </Button>
              <Button href="#timeline" variant="secondary" size="lg">
                See the schedule
              </Button>
            </div>

            <p className="mt-6 inline-flex items-center gap-2 font-mono text-xs text-ascent-muted">
              <Users aria-hidden="true" className="h-3.5 w-3.5" />
              Open to all skill levels · Solo or teams of three
            </p>
          </div>
        </Card>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 7: `Faq.tsx`** (current lines 400–422). Was nested in the prizes section with `mt-20`; as a standalone section it uses the shared `py-24` rhythm via `Section`. Keeps `#faq` and `scroll-mt-24`.

```tsx
// src/components/sections/Faq.tsx
import { Card, Container, Section, SectionHeading } from "@/components/ui";
import { FAQ } from "@/content/sections";

export default function Faq() {
  return (
    <Section id="faq" className="scroll-mt-24">
      <Container>
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            align="center"
            eyebrow="FAQ"
            title="Quick answers"
          />
          <dl className="mt-10 space-y-4">
            {FAQ.map(({ q, a }) => (
              <Card key={q} className="p-6">
                <dt className="text-base font-semibold text-ascent-ink">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ascent-muted">
                  {a}
                </dd>
              </Card>
            ))}
          </dl>
        </div>
      </Container>
    </Section>
  );
}
```

> **Spacing note (intentional, near-identical):** previously FAQ sat inside the prizes section at `mt-20` (80px) below the CTA card, with the prizes section providing `py-24` top/bottom. As its own `Section`, FAQ now has `py-24` (96px) above and below. This is a deliberate, negligible vertical-rhythm normalization called out in the spec's "visual parity (spot-check)" — the FAQ content, heading, and cards are otherwise identical. If exact 80px is required, change `Section`'s default by passing `className="pt-20"` — but the reviewer should accept the normalized rhythm.

- [ ] **Step 8: `index.ts` barrel**

```ts
// src/components/sections/index.ts
export { default as Hero } from "./Hero";
export { default as About } from "./About";
export { default as Tracks } from "./Tracks";
export { default as Timeline } from "./Timeline";
export { default as PrizesCta } from "./PrizesCta";
export { default as Faq } from "./Faq";
```

- [ ] **Step 9: Verify type-check** (sections not yet imported by page)

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/sections
git commit -m "Add per-section components built from content + UI primitives"
```

---

## Task 7: Rewire composition root + layout metadata; delete old chrome

Make `page.tsx` a thin composition root, source metadata from `site.ts`, switch chrome imports to `components/layout/`, and remove the now-dead files.

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)
- Modify: `src/app/layout.tsx` (metadata from `site.ts`)
- Delete: `src/components/Navbar.tsx`, `src/components/Footer.tsx`

**Interfaces:**
- Consumes: `Navbar`, `Footer` from `@/components/layout/*`; section barrel `@/components/sections`; `site` from `@/content/site`.

- [ ] **Step 1: Rewrite `src/app/page.tsx`**

```tsx
// src/app/page.tsx
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  Hero,
  About,
  Tracks,
  Timeline,
  PrizesCta,
  Faq,
} from "@/components/sections";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="top">
        <Hero />
        <About />
        <Tracks />
        <Timeline />
        <PrizesCta />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Update `src/app/layout.tsx` metadata to read from `site.ts`** — replace the inline `metadata` object (lines 15–19) with:

```tsx
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: site.seo.title,
  description: site.seo.description,
};
```

Keep the font imports, the `<html>` style vars, and the `<body>` classes exactly as they are.

- [ ] **Step 3: Delete the old chrome files**

```bash
git rm src/components/Navbar.tsx src/components/Footer.tsx
```

- [ ] **Step 4: Full build**

Run: `npm run build`
Expected: completes, ends with `○ (Static) prerendered as static content`. No type errors, no unused-import warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "Rewire page.tsx as thin composition root; metadata from content; drop old chrome"
```

---

## Task 8: Verification — build + visual parity + structure checks

Confirm the global constraints hold end-to-end.

**Files:** none (verification only).

- [ ] **Step 1: Clean build**

Run: `rm -rf .next && npm run build`
Expected: success, static prerender line present. (If ENOSPC: the `rm -rf .next` already freed space; rerun.)

- [ ] **Step 2: No hardcoded color literals in component files**

Run: `grep -rnE '#[0-9a-fA-F]{3,6}|slate-[0-9]|bg-white|border-white' src/components src/app/page.tsx`
Expected: the ONLY acceptable matches are `hover:border-slate-300` in `Navbar.tsx` (no slate-300 token exists — documented exception) and palette-name text inside comments. Any other `slate-*`/`#hex`/`bg-white` in a component is a regression to fix.

- [ ] **Step 3: Anchor ids preserved**

Run: `grep -rnoE 'id="(top|about|tracks|timeline|prizes|register|faq)"' src/app src/components`
Expected: all seven ids present (`top` in page.tsx main; the rest across sections).

- [ ] **Step 4: page.tsx is a thin root**

Run: `wc -l src/app/page.tsx`
Expected: under ~30 lines; no content arrays (`grep -n 'const .*= \[' src/app/page.tsx` → no matches).

- [ ] **Step 5: Visual parity spot-check** (manual)

Run: `npm run dev` and open the site. Confirm against the pre-refactor look:
- Hero fills the viewport, centered, gradient on "C++ ascent.", two buttons (near-black primary + white secondary), three mono stats.
- About: 3 cards with accent icons. Tracks: 3 cards with mono division labels. Timeline: 4 numbered nodes with calendar dates on a left rule. Prizes: centered CTA card with two buttons. FAQ: centered heading + 3 cards.
- Navbar: fixed, frosted, wordmark + 5 links + Register button; mobile menu toggles. Footer: 4 columns + bottom row.
- All nav/footer links scroll to the right sections.
Expected: indistinguishable from before except the FAQ top-gap normalization noted in Task 6 Step 7.

- [ ] **Step 6: Final commit** (only if Steps 1–4 surfaced fixable nits that were corrected; otherwise the tree is already clean)

```bash
git add -A
git commit -m "Verify restructure: clean build, no color literals, anchors intact" || echo "nothing to commit — already clean"
```

---

## Self-Review notes (author)

- **Spec coverage:** file structure (Tasks 1–7), primitives (Task 4), section split incl. FAQ extraction (Task 6), content layer with inline icons (Task 2), token restructure + tokenized button/chrome values + dark-ready comment (Tasks 3, 5, 6), thin composition root + metadata from content (Task 7), build + visual + structure acceptance (Task 8). All spec sections map to a task.
- **Known intentional deviation:** FAQ vertical gap normalizes from `mt-20` (80px) to `py-24` (96px) when extracted to its own Section — documented in Task 6 Step 7 and Task 8 Step 5, accepted under "visual parity (spot-check)".
- **Documented exception:** `hover:border-slate-300` in Navbar stays a raw Tailwind utility (no slate-300 token) — Task 5 Step 1.5 and Task 8 Step 2.
- **Type consistency:** `cn` signature, `IconType`, `site`/`HERO_STATS`/array names, and primitive prop names are used identically across Tasks 1–7.
