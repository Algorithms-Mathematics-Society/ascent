# Ascent — Home Page Build Plan

Build the marketing **home page only** for **Ascent**, a new AMS event focused on **C++**.
Single page with a **navbar** and **footer**. No other routes/pages.

Design language is adapted from **AMS Access** (`/home/user/amsascent/FRONTEND-DESIGN.md`) but
**re-themed from purple → blue**. Dark, blue-forward marketing aesthetic.

Repo: `/home/user/amsascent` (git, branch `ascent-home`). Next.js project lives at repo root.

---

## Global Constraints (every task MUST honor these — copy verbatim into reviews)

1. **Stack:** Next.js 14 (App Router, `src/app`), React 18, TypeScript, Tailwind CSS 3.4.
   `lucide-react` for icons. `@fontsource/geist-sans` (UI) + `@fontsource/jetbrains-mono` (code/mono).
   No other UI/runtime dependencies. `clsx` + `tailwind-merge` allowed for class helpers.
2. **Scope:** Exactly ONE route — `/` (home). A navbar and a footer rendered on that page.
   Do NOT create `/pricing`, `/docs`, `/about`, etc. Nav links point to in-page anchors
   (`#about`, `#tracks`, `#timeline`) or `#` placeholders. No backend, no API routes, no forms wired up.
3. **Theme = dark, blue-forward.** Token system mirrors Access but blue:
   - Canvas: deep navy / near-black `--ascent-bg: 6 9 16` (#060910).
   - Panel: `--ascent-panel: 12 16 26`.
   - Primary accent (blue): `--ascent-accent: 59 130 246` (#3B82F6).
   - Accent-deep: `--ascent-blue-deep: 37 99 235` (#2563EB).
   - Secondary (cyan): `--ascent-cyan: 34 211 238` (#22D3EE).
   - Ink: `255 255 255`; muted: `148 163 184` (slate-400).
   - Tokens stored as **space-separated RGB triples** consumed via Tailwind `<alpha-value>`
     under an `ascent.*` color namespace (e.g. `bg-ascent-accent/40`).
4. **Design carry-overs from Access (re-themed blue):**
   - **Border radius:** buttons/cards **8px** (`rounded-lg`); large hero/glass panels 16px. Chips/badges `rounded-full`.
   - **Default expressive easing:** `cubic-bezier(0.16, 1, 0.3, 1)`. Utility hover/focus: `~160ms ease`.
   - **Focus ring:** `2px solid` blue accent at ~45% alpha, `outline-offset: 2px`.
   - **Glassmorphism:** translucent panels, 1px translucent borders, inner top-highlight, blue glow shadows.
   - **Navbar:** fixed, full-bleed, frosted (`backdrop-blur`), thin bottom border, `h-16`, content capped `max-w-7xl`.
   - **Nav active/hover state by color + weight**, not underline.
   - Honor `@media (prefers-reduced-motion: reduce)` — any animation must have a reduced-motion off-switch.
5. **Brand:** Product name "Ascent". Tagline theme: the C++ ascent / climbing / competitive programming.
   Mono font (JetBrains Mono) used for code-flavored UI (the hero console, labels, timestamps).
   No real logo asset required — render a text/SVG wordmark "Ascent" (mono or a simple mountain glyph + text).
6. **Quality:** `npm run build` MUST pass (no type errors, no lint-blocking errors). Page must render
   server-side without runtime errors. Semantic HTML, alt text, keyboard-focusable interactive elements.
7. **No placeholder lorem ipsum** — write real, plausible copy for a C++ competitive-programming event.

---

## Task 1 — Project scaffold + blue design system

Create the Next.js project at repo root and the shared design foundation.

**Deliverables:**
- `package.json` (name `ams-ascent`, scripts: dev/build/start/lint), `next.config.mjs`,
  `tsconfig.json`, `next-env.d.ts`, `postcss.config.js`, `.eslintrc.json`, `.gitignore`
  (ignore `node_modules`, `.next`).
- `tailwind.config.ts` — content globs `./src/**/*.{ts,tsx}`; `ascent.*` color tokens bound to CSS vars
  (per Global Constraint 3); `fontFamily.sans = var(--font-geist)`, `fontFamily.mono = var(--font-jetbrains)`;
  a couple of keyframes/animations for ambient motion (e.g. a slow grid drift + a breathing glow).
- `src/app/globals.css` — `:root` blue token block (Constraint 3), base resets, a small component layer:
  `.ascent-btn` (+ `-primary` blue gradient, `-secondary` glass, sizes sm/md/lg, **8px radius**, focus ring),
  `.glass-card`, a hero grid/glow utility, selection color, and the `prefers-reduced-motion` block.
- `src/app/layout.tsx` — imports fontsource Geist + JetBrains Mono CSS + `globals.css`; sets
  `--font-geist`/`--font-jetbrains` via CSS; `metadata` (title "Ascent — The C++ Ascent", description);
  `<body className="font-sans bg-ascent-bg text-white antialiased">`.
- `src/app/page.tsx` — temporary minimal placeholder (`<main>Ascent</main>`) so the app builds.
  (Task 3 replaces this.)
- Run `npm install` then `npm run build`; build must pass. Commit.

**Interfaces this task defines (later tasks depend on):** the `ascent-*` Tailwind tokens, the
`.ascent-btn*` / `.glass-card` classes, the font CSS variables.

## Task 2 — Navbar + Footer (page chrome)

Build the two shared chrome components, dark blue-forward, using Task 1's design system.

**Deliverables:**
- `src/components/Navbar.tsx` — `"use client"`. Fixed, frosted (`backdrop-blur`), translucent dark
  bg, thin bottom border, `h-16`, `max-w-7xl` inner. Left: "Ascent" wordmark (mono, with a small
  mountain/chevron glyph via lucide e.g. `Mountain`/`ChevronsUp`). Center: nav links
  (About `#about`, Tracks `#tracks`, Timeline `#timeline`, Prizes `#prizes`, FAQ `#faq`) — hidden on
  mobile (`hidden lg:flex`), hover/active by color+weight. Right: a primary CTA button "Register"
  (`.ascent-btn .ascent-btn-primary`, sm) + a mobile hamburger that toggles a simple dropdown/drawer
  of the same links (client state). Keyboard accessible; reduced-motion safe.
- `src/components/Footer.tsx` — dark footer over near-black. Wordmark + one-line blurb, 2–4 link
  columns (Event: About/Tracks/Timeline/Rules; Resources: FAQ/Contact/Code of Conduct; Social
  placeholders), a thin top border, bottom row with "© 2026 Ascent" + small print. Links are `#`
  or in-page anchors. Responsive grid (2-col mobile → 4-col md+).
- Components must be self-contained and render with no props. `npm run build` passes. Commit.

## Task 3 — Home page (hero + sections + assembly)

Replace `src/app/page.tsx` with the full home page, importing `Navbar` and `Footer`.

**Deliverables (sections, top to bottom):**
1. `<Navbar />`.
2. **Hero** (`min-h` ~90vh): blue radial-glow + faint animated grid background; eyebrow chip
   ("AMS · C++ Competitive Programming"); large headline (e.g. "The C++ ascent."/"Climb the C++ ladder");
   subcopy; two CTAs (primary "Register" + secondary "View tracks"). A **glass code-console mockup**
   (JetBrains Mono) showing a tiny C++ snippet + a `g++ -O2 main.cpp` line + an `Accepted ✓` verdict
   with a blue glow — the signature visual.
3. **About** (`#about`): short "What is Ascent" — 1 heading + paragraph + 3 small stat/feature cards
   (glass cards) e.g. "Pure C++", "Algorithmic", "<time-limited> rounds".
4. **Tracks** (`#tracks`): 3 glass cards for event tracks (e.g. "Beginner / Div 2", "Advanced / Div 1",
   "Team Relay") with a 1-line description each.
5. **Timeline** (`#timeline`): a simple vertical/stepped timeline of 3–4 phases
   (Registration → Prelims → Finals → Results) with dates as placeholders.
6. **Prizes/CTA** (`#prizes`): a closing CTA band with a headline + Register button (and optionally
   a small prizes line). Can double as the FAQ anchor target or include a tiny 3-item FAQ (`#faq`).
7. `<Footer />`.

All sections use the blue design system, glassmorphism, the expressive easing, reduced-motion safety,
and real copy. Below-the-fold sections may use `content-visibility:auto` (optional). `npm run build`
passes; page renders without errors. Commit.

---

## Out of scope
Multiple pages/routes, real auth/registration backend, CMS, real logo/brand assets, animations beyond
lightweight CSS/ambient, tests beyond the build passing.
