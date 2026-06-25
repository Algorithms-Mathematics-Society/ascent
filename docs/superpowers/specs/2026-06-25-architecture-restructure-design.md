# AMS Ascent — Architecture, Components & Theming Restructure

**Date:** 2026-06-25
**Branch:** `ascent-home`
**Type:** Pure refactor — no visible change to the rendered light-mode site.

## Goal

Restructure the AMS Ascent marketing site to a principal-engineer-grade
architecture: a thin composition root, per-section components, a typed reusable
UI primitive set, a single-source content/data layer, and a documented,
dark-ready semantic token system. **The rendered light-mode output must remain
pixel-identical.** The value is in structure, maintainability, and
theme-readiness — not appearance.

## Constraints

- **Behavior preservation:** the page must look identical in light mode. This is
  the primary acceptance criterion alongside a green build.
- **No new runtime dependencies.** Use existing stack: Next.js App Router,
  Tailwind, `lucide-react`, `@fontsource` fonts.
- **No dark-mode toggle shipped.** Structure for dark mode (token flip via a
  `[data-theme="dark"]` block) but ship light-only.
- **Disk is near-full.** Avoid generating large artifacts; clear `.next` if needed.
- **Static export friendly.** Keep components server-first; only `Navbar`
  remains a client component (mobile menu state).

## Target file structure

```
src/
  app/
    layout.tsx          # root layout — metadata sourced from content/site
    page.tsx            # thin composition root (~20 lines)
    globals.css         # tailwind + token layers + minimal base reset
  components/
    ui/                 # reusable, presentation-only primitives
      Container.tsx
      Section.tsx
      Eyebrow.tsx
      SectionHeading.tsx
      Button.tsx
      Card.tsx
      index.ts          # barrel
    layout/
      Navbar.tsx        # moved from components/
      Footer.tsx        # moved from components/
    sections/
      Hero.tsx
      About.tsx
      Tracks.tsx
      Timeline.tsx
      PrizesCta.tsx
      Faq.tsx
      CodeConsole.tsx   # hero visual, co-located (used only by Hero)
  content/
    site.ts             # brand, nav links, footer columns, social, event dates, SEO
    sections.ts         # ABOUT_CARDS, TRACKS, TIMELINE, FAQ, hero stats (icons kept inline)
  lib/
    cn.ts               # className-merge helper
```

Import alias `@/*` already maps to `src/*` (tsconfig) — all new modules use it.

## Components (units of the design)

### UI primitives — `src/components/ui/`

Presentation-only, typed wrappers over the existing CSS component classes
(`.ascent-btn`, `.glass-card`). The CSS classes remain the styling engine; the
React components provide a type-safe, consistent API. Each is small and has one
purpose.

- **`Container`** — `{children, className?}`. Renders
  `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` + merged className. Replaces the
  repeated wrapper string at every section.
- **`Section`** — `{id?, className?, children}`. Semantic `<section>` with the
  shared vertical rhythm (`py-24`). Does NOT force a Container (Hero needs a
  bespoke full-height layout), so Section is layout-neutral padding + id.
- **`Eyebrow`** — `{children}`. The mono uppercase accent label
  (`font-mono text-xs font-semibold uppercase tracking-wider text-ascent-accent`).
- **`SectionHeading`** — `{eyebrow?, title, lede?, align?, className?}`. Composes
  Eyebrow + `<h2>` + optional lede paragraph, matching the current markup
  exactly (margins `mt-3`, `mt-5`). `align` supports `left` (default) and
  `center` (FAQ + Prizes use centered).
- **`Button`** — `{variant?: "primary"|"secondary", size?: "sm"|"md"|"lg",
  href?, className?, children, ...rest}`. Polymorphic: renders `<a>` when `href`
  is present, else `<button type="button">`. Maps to
  `ascent-btn ascent-btn-{variant} ascent-btn-{size}`. Defaults: `primary`,
  `md`. Forwards remaining anchor/button props.
- **`Card`** — `{as?, interactive?, className?, children, ...rest}`. Wraps
  `.glass-card`. Default `as="div"`. Passes through className for per-use padding
  (`p-6`, `p-10`, etc.) so we don't bake spacing into the primitive.
- **`index.ts`** — barrel re-exporting all six for `import { Button, Card } from "@/components/ui"`.

### Section components — `src/components/sections/`

Each owns its section's JSX layout and reads its data from `content/`. One file
per current section, plus the co-located hero visual:

- **`Hero.tsx`** — the full-height hero (`min-h-[100svh]`, centered grid, copy +
  stats + CTAs + `<CodeConsole/>`). Stats read from `content/sections.ts`.
- **`CodeConsole.tsx`** — the `main.cpp` mockup, moved verbatim from `page.tsx`.
- **`About.tsx`**, **`Tracks.tsx`**, **`Timeline.tsx`**, **`Faq.tsx`** — map over
  their content arrays.
- **`PrizesCta.tsx`** — the closing CTA card (`#register` / `#prizes`). Note: the
  current FAQ block lives inside the prizes `<section>`; on split, `Faq` becomes
  its own section and `PrizesCta` keeps only the CTA card. Anchor ids
  (`#prizes`, `#register`, `#faq`) must be preserved exactly for nav/footer links.

### Layout chrome — `src/components/layout/`

`Navbar.tsx` and `Footer.tsx` moved unchanged (imports rewired). They adopt the
new `Button`/`Container` primitives where it's a 1:1 substitution and adopt
tokenized colors (see Theming). `Navbar` stays a client component.

### Composition root — `src/app/page.tsx`

```tsx
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Hero, About, Tracks, Timeline, PrizesCta, Faq } from "@/components/sections";
export default function Home() {
  return (
    <>
      <Navbar />
      <main id="top">
        <Hero /> <About /> <Tracks /> <Timeline /> <PrizesCta /> <Faq />
      </main>
      <Footer />
    </>
  );
}
```
(A `sections/index.ts` barrel is added so the import is one line.)

## Content/data layer — `src/content/`

Single source of truth for marketing copy and event facts.

- **`site.ts`** — exports a `site` object: name (`"AMS Ascent"`), tagline, the
  SEO `title`/`description` (consumed by `layout.tsx` metadata), `NAV_LINKS`
  (moved from Navbar), `FOOTER_COLUMNS` (moved from Footer), and event dates as
  named constants so Timeline copy references one place.
- **`sections.ts`** — exports `ABOUT_CARDS`, `TRACKS`, `TIMELINE`, `FAQ`, and
  `HERO_STATS` (the Standard/Tracks/Entry dl). **Icons stay inline** as imported
  `lucide-react` components (decided: simplest, normal coupling). Shared types
  (`IconType = ComponentType<{ className?: string }>`) declared here or in
  `lib/`.

## Theming — `src/app/globals.css` + `tailwind.config.ts`

Reorganize the existing `--ascent-*` vars into a documented, dark-ready system.
The Tailwind bridge in `tailwind.config.ts` is already correct and stays.

1. **Primitive palette** — a commented block naming the raw scale values
   (brand blue 600/500/700, cyan 600, slate 900/600/200/50, white) as
   reference. These feed the semantic tokens.
2. **Semantic tokens** in `:root` — the `--ascent-*` set keeps its names (bg,
   surface, border, panel, accent, accent-bright, blue-deep, cyan, ink, muted),
   each annotated with its semantic role. **New tokens added** to absorb the
   currently-hardcoded values so nothing bypasses the system:
   - `--ascent-btn-primary-bg` (`2 6 23` / slate-950) and
     `--ascent-btn-primary-bg-hover` (`30 41 59` / slate-800) — replace the
     hex literals in `.ascent-btn-primary`.
   - The `bg-slate-50` / `border-slate-200` / `bg-white` literals in
     `Navbar`, `Footer`, and `CodeConsole` switch to existing tokens
     (`bg-ascent-surface`, `border-ascent-border`, `bg-ascent-bg`) — these
     resolve to the same RGB today, so light mode is unchanged.
3. **Dark-readiness** — a commented, empty (or example) `[data-theme="dark"]`
   block documents how to flip the palette later. Not activated.
4. The component classes (`.ascent-btn-*`, `.glass-card`) keep their structure;
   only the primary-button hardcoded hexes move to `rgb(var(--token))`.

`--ascent-accent-bright` is retained even if currently unused (harmless, part of
the documented scale).

## Data flow

Static and one-directional: `content/*` (data) → `sections/*` (layout) →
`page.tsx` (composition). `site.ts` → `layout.tsx` (metadata) and → chrome
components (nav/footer links). No client state except Navbar's mobile-menu
`useState`. No fetching, no props drilling beyond primitive props.

## Error handling

Not applicable at runtime (static marketing page, no I/O). The relevant
"errors" are build/type errors and visual regressions — addressed by testing.

## Testing / acceptance

1. **`npm run build` passes** and ends with static prerender — no type errors,
   no unused-import lint failures.
2. **Visual parity:** light-mode render is unchanged. Verified by spot-checking
   hero, each section, navbar, footer, and the console mockup (run `next dev`
   and compare, or screenshot). Anchor links (`#about`, `#tracks`, `#timeline`,
   `#prizes`, `#faq`, `#register`, `#top`) still resolve to the right sections.
3. **Structural checks:** `page.tsx` is a thin composition root; no section
   holds inline content arrays; no hardcoded color hex remains in component
   files or `globals.css` component layer (grep for `#0`, `slate-` literals in
   `src/components`).

## Execution plan (subagent-driven)

Dependency-ordered waves; independent tasks within a wave run in parallel.

- **Wave 1 (parallel, no deps):**
  (a) `lib/cn.ts`; (b) `content/site.ts` + `content/sections.ts` (move arrays,
  keep icons); (c) `globals.css` token restructure + new button tokens.
- **Wave 2 (deps: theming):** `components/ui/*` primitives + barrel.
- **Wave 3 (deps: ui + content):** move chrome to `components/layout/` and
  adopt primitives/tokens; build `components/sections/*` from content + primitives.
- **Wave 4 (deps: all):** rewire `page.tsx` (composition root) and `layout.tsx`
  (metadata from `site.ts`); delete old `components/Navbar.tsx` / `Footer.tsx`.
- **Wave 5:** `npm run build` + visual parity check; fix regressions; commit.

## Out of scope (YAGNI)

- Dark-mode toggle / palette values (only the structure).
- New sections, copy rewrites, or layout redesign.
- Animation/motion additions.
- Test framework setup (no unit tests for a static page; build + visual check
  is the bar).
- Storybook or component docs site.
