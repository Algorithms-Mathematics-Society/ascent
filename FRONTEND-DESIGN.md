# AMS Access — Frontend Design Doc

A reference for the visual language, interaction patterns, and frontend conventions of the
AMS Access web app (Next.js 14 App Router + Tailwind + a hand-written CSS design system).

Source of truth in code:
- `src/app/globals.css` — the design system (tokens, components, animations)
- `tailwind.config.ts` — token → utility bridge
- `src/components/*` — component implementations

---

## 1. Design philosophy

**Minimal, controlled, evidence-grade.** Two deliberately different surfaces:

| Surface | Mood | Background | Feel |
|---|---|---|---|
| **Marketing site** (`(marketing)`) | Bright, calm, product-page | `bg-white` / `text-slate-900` | Apple / Stripe-clean, lots of whitespace |
| **App console** (`(admin)`, `(org)`, `amsadmin`) | Dark, focused, "instrument panel" | near-black (`#05050A` / `#000`) | Raycast / Linear glassmorphism |

The minimalness is intentional and rule-based:
- **One accent color.** Purple (`#8B5CF6` → `#7C3AED`). No competing hues; teal/amber exist only as semantic status tokens.
- **Restrained motion.** Animations are slow, subtle, and ambient — never bouncy. Default easing is always `cubic-bezier(0.16, 1, 0.3, 1)` (a soft "ease-out-expo").
- **Type does the work.** Geist Sans for UI, JetBrains Mono for data/code/timestamps. Headings are `font-medium`, tight tracking (`tracking-tight`), large but not heavy.
- **Borders over fills.** Surfaces are separated with 1px translucent borders + subtle inner highlights, not solid blocks of color.

---

## 2. Color tokens

All colors are CSS custom properties stored as **space-separated RGB triples** so Tailwind can apply `<alpha-value>` (e.g. `bg-ams-cyan/40`). Defined in `globals.css`, bridged in `tailwind.config.ts` under the `ams.*` namespace.

```
--ams-dark:   5 5 10        /* #05050A — dark canvas / CTA / footer bg */
--ams-accent: 139 92 246    /* purple-500 — primary brand accent */
--ams-bg:     0 0 0         /* app canvas (pure black) */
--ams-panel:  9 9 11        /* cards / panels */
--ams-cyan:   139 92 246    /* "cyan" token is actually purple #8B5CF6 */
--ams-blue:   124 58 237    /* purple #7C3AED — gradient partner */
--ams-ink:    255 255 255   /* body text */
--ams-muted:  161 161 170   /* slate-400 — secondary text */
--ams-heading:255 255 255
--ams-teal:   20 184 166    /* status only */
--ams-amber:  245 158 11    /* status only */
```

> Note: the token named `--ams-cyan` / `--ams-blue` holds **purple** values — a historical name kept for compatibility. Treat them as "accent" and "accent-deep."

**Theming.** A `.light` class re-defines every token (and swaps the body to a multi-radial-gradient background). The active theme is chosen by an **inline `<head>` script** in `layout.tsx` that reads `localStorage('ams-theme')` (falling back to `prefers-color-scheme`) and toggles `.light`/`.dark` before paint — so there's no flash of the wrong theme.

Selection color is themed too: `::selection` uses `--ams-selection` (translucent purple).

---

## 3. Navbar style

### Marketing header (`MarketingEndpointPage.tsx` → `MarketingHeader`)
- **Fixed, full-bleed, translucent.** `fixed inset-x-0 top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100`.
- Height **`h-16`** (64px), content capped at `max-w-7xl`, padded `px-4 sm:px-6 lg:px-8`.
- **Three-zone layout:** logo (left, SVG at `h-7`) · nav links (center) · CTA + mobile trigger (right).
- The header is a thin frosted bar — never a solid block. The blur + 80% white lets page content ghost through on scroll.

### Nav links (`MarketingNavLinks.tsx`)
- Desktop only (`hidden lg:flex`), `gap-7`, `text-sm font-medium`.
- Inactive: `text-slate-500`; hover → `text-slate-900` via `transition-colors`.
- **Active state is by weight + color**, not an underline or pill: `text-slate-900 font-semibold`. Active detection in `isActive()` handles hash links (`/#use-cases`) and nested docs.
- Accessibility: active link carries an `sr-only` "(current page)" marker.

### Mobile nav (`MobileNav.tsx`)
- Loaded with `dynamic(..., { ssr: false })` so it never ships in the SSR payload.
- Hamburger uses `.mobile-hamburger` (`-webkit-tap-highlight-color: transparent; touch-action: manipulation`) for a native-feeling tap.

### Console nav (`OrgPortalShell.tsx`)
- The dark app side uses a portal shell rather than the marketing bar — sidebar/topbar pattern over the black canvas, same token system.

---

## 4. Buttons

A complete button system lives in `globals.css` as `.ams-btn` + modifiers (not Tailwind-only, so it's consistent across both themes).

### Geometry
- **Border radius: `0.5rem` (8px)** — the standard for `.ams-btn`.
  - Icon buttons (`.ams-icon-btn`) are square: `2.25rem × 2.25rem`.
  - Pills (chips, eyebrow badges) use `rounded-full` separately — buttons themselves are **not** pill-shaped.
- Base: `inline-flex`, centered, `gap-0.5rem`, `min-height: 2.5rem`, `font-weight: 600`, `font-size: 0.875rem`, `white-space: nowrap`, 1px transparent border.

### Sizes
| Class | Min height | Padding | Font |
|---|---|---|---|
| `.ams-btn-sm` | 2rem | `0 0.75rem` | 0.75rem |
| (base) | 2.5rem | `0 0.875rem` | 0.875rem |
| `.ams-btn-md` | 2.75rem | `0 1.25rem` | — |
| `.ams-btn-lg` | 3rem | `0 2rem` | — |

### Variants (12)
`primary` (near-black `#020617`, white text, soft shadow), `secondary` (white w/ slate border), `muted`, `danger`, `success`, `inverse`, `overlay-light`, `overlay-dark` (both `backdrop-filter: blur(12px)`), `ghost`. All share a `160ms ease` transition on bg/border/color/shadow.

### States
- `:disabled` / `[aria-disabled]` → `opacity: 0.56; cursor: not-allowed`.
- `:focus-visible` → `outline: 2px solid rgba(139,92,246,0.45); outline-offset: 2px` (purple accent ring, consistent everywhere).

> There's also a **dark-theme gradient CTA** (`.ams-button-primary`) used in the app/hero: a layered `linear-gradient(135deg, blue→cyan)` with an inner-light highlight and a purple glow shadow. Marketing CTAs use the flat near-black `.ams-btn-primary`; app CTAs use the gradient.

---

## 5. The "nodes" animation (ProctorNetwork)

`src/components/ProctorNetwork.tsx` — an interactive canvas particle network that visually represents the "proctoring / monitoring" idea. This is the signature ambient piece.

**What it is:** a full-bleed `<canvas>` (`pointer-events-none absolute inset-0`) of drifting nodes connected by lines, with a cursor that acts as a "proctor eye."

**Parameters (defaults):**
- `nodeCount = 32`, `connectDist = 155px`, `mouseRadius = 190px`, `BASE_SPEED = 0.35`.

**Behavior:**
1. **Drift** — each node has a random velocity; positions update each frame and **bounce off edges** (velocity flips at the walls).
2. **Connections** — every pair within `connectDist` draws a line whose opacity fades with distance (`t = 1 − d/connectDist`). Resting lines are faint purple `rgba(139,92,246, t*0.13)`, `0.5px`.
3. **Mouse proximity boost** — lines near the cursor brighten to `rgba(192,132,252, …)` and thicken (`lineWidth` up to ~1.6px). Nodes near the cursor **grow** (`r + t*3.5`), gain a **radial-gradient halo**, and shift to a bright lilac.
4. **Spokes** — the cursor casts faint white lines to every node within `mouseRadius`.
5. **Proctor-eye cursor** — a white center dot + a solid ring (`r=9`) + a **dashed** outer ring (`r=18`, `setLineDash([3,5])`, purple) drawn at the pointer.

**Implementation notes:**
- DPR-aware (`canvas.width = W * dpr`) for crisp lines on retina.
- Single `requestAnimationFrame` loop; cleaned up on unmount (`cancelAnimationFrame` + listener teardown).
- `mousemove` / `resize` listeners are `{ passive: true }`.
- Cursor parked off-screen (`-9999`) when outside the canvas so spokes/halos disappear.

**Related effect components** (`src/components/ui/`): `particle-brackets`, `particle-burst`, `meteors`, `retro-grid`, `aurora-background`, `border-beam`, `sparkles-text`, `typewriter-effect`, `3d-card`, `lamp`, `shimmer-button` — an "aceternity/magicui"-style kit used sparingly for hero accents.

---

## 6. Transitions & motion

**Global easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (soft ease-out-expo) for anything expressive; plain `ease` at `160ms` for utilitarian hover/focus.

**Durations** cluster around: `160ms` (inputs/buttons), `180–260ms` (cards, selects, scrub), `0.3s` (glass-card hover), `220ms` (CTA), `0.8s` (fade-in-up entrance).

**Performance discipline (important convention):** animate **compositor-only** properties (`transform`, `opacity`) — never `background-position`, `border-color`, or `width` in loops.
- The hero grid drifts via `transform` on a `::before` pseudo-element (`amsGridDrift`, 36s linear), not background-position.
- The session indicator animates `opacity` on a pseudo-element, not `border-color`.
- `will-change` is set on every animated element.

**Named keyframes (ambient, all infinite & slow):**
- `amsBreath` (8s) — hero bg gently scales/fades.
- `amsGridDrift` (36s) — background grid translate.
- `amsContextLine`, `amsLogUpdate`, `amsReviewEvent`, `amsSessionIndicator` — fake "live activity" in app mockups.
- `amsGlareSweep` (3s) — light sweep across cards (`.ams-glare`).
- `amsSkeletonShimmer` (2s) — loading skeletons (`.ams-skeleton`).
- `fadeInUp` (0.8s) — scroll-triggered entrances via `.animate-fade-in-up` + `-trigger`, with `.delay-100/200/300` stagger.
- `.ams-hero-console:hover::after` — a slow diagonal sheen sweep on hover.

**Entrance pattern:** elements start `opacity:0; translateY(20px)` (`.animate-fade-in-up`) and an intersection observer (`ScrollObserver.tsx`) adds `-trigger` to play `fadeInUp`.

**Reduced motion:** a full `@media (prefers-reduced-motion: reduce)` block disables *every* animation and transition listed above and forces fade-in elements to their resting state. This is non-negotiable — any new animation must be added to that block.

---

## 7. Surfaces, cards & glass

The dark side is built from layered translucent surfaces, never flat fills:

- **`.glass-card`** — `backdrop-filter: blur(12px)`, faint white top-light gradient over `rgba(25,25,25,0.4)`, 1px `rgba(255,255,255,0.08)` border, `border-radius: 16px`, layered shadow. Hover: border tints purple, lifts `translateY(-1px)`, adds a purple glow. `contain: paint` for perf.
- **`.ams-hero-panel` / `.ams-hero-console`** — the marquee app-window frame: multi-layer box-shadow (purple ring + purple glow + deep drop shadow + inner highlight) and a hover sheen.
- **`.ams-pricing-card`** — gradient **border via `::before` mask trick** (`mask-composite: exclude`), a `::after` radial glow that fades in on hover, and a `[data-recommended="true"]` variant with a stronger purple aura.
- **`.ams-foundation-card`, `.ams-trust-card`, `.ams-volume-modeler`, `.ams-contact-form`** — same recipe (radial purple wash + top-light gradient + inner highlight + deep shadow).
- **Radii in use:** `8px` (buttons, pricing cards, fields, form), `16px` (glass cards), `rounded-2xl`/`xl` on marketing image frames, `rounded-full` for chips/badges/eyebrows.

**Texture utilities:** `.ams-grid` (56px grid masked to fade out), `.ams-noise` (diagonal light streaks), both `background-attachment: fixed`.

---

## 8. Forms & inputs

- **Dark form fields** (`.ams-contact-field`): `border-radius: 8px`, 1px translucent border, dark translucent bg; focus → lilac border + purple ring glow (`0 0 0 1px rgba(139,92,246,0.13)`), `180ms` expo transition.
- **Custom select** (`.ams-contact-select` + `.ams-contact-select-menu`): fully styled dropdown with a CSS chevron (rotated border), translucent menu, purple-tinted hover/selected options. Native `<select>` is also themed (CSS-drawn arrow via layered gradients).
- **Range sliders** (`.ams-volume-slider`, `.ams-timeline-slider`): 1px track, white/purple thumb with a purple focus halo that scales on `:active`; styled for **both** `::-webkit-slider-thumb` and `::-moz-range-thumb`, plus a `-light` variant for marketing.
- **`.glass-input`** — token-driven input that works in both themes (uses `--ams-input-*` vars).
- **Autofill override:** WebKit autofill recolored to a light-purple theme (`#f5f3ff` / `#4c1d95`) instead of the browser default yellow/green.

---

## 9. Performance & a11y conventions (must-follow)

- **`content-visibility: auto`** (`.cv-auto`, `contain-intrinsic-size: auto 600px`) on every below-the-fold `<section>`/`<footer>` to skip off-screen layout/paint.
- **Speculation Rules** prerender in `layout.tsx` for `/pricing`, `/docs`, `/changelog`, `/contact`.
- Effect/canvas components are `"use client"` and self-clean (RAF + listeners torn down on unmount); heavy ones loaded via `next/dynamic` or `LazyMount.tsx`.
- Fonts self-hosted via `@fontsource` (Geist 400–700, JetBrains 400–700) — no external font CDN, no layout shift.
- Focus-visible rings are purple and consistent across buttons, CTAs, and selects.
- Reduced-motion is honored globally (§6).

---

## 10. Quick-reference cheatsheet

| Thing | Value |
|---|---|
| Brand accent | `#8B5CF6` → `#7C3AED` (purple) |
| App canvas | `#000` / `#05050A` |
| Marketing canvas | `#FFF` / `text-slate-900` |
| Button radius | **8px** (`0.5rem`) |
| Card radius | 16px (glass), 8px (pricing/foundation) |
| Default easing | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Hover/focus transition | `160ms ease` |
| Focus ring | `2px solid rgba(139,92,246,0.45)`, offset 2px |
| UI font | Geist Sans (`font-medium` headings) |
| Mono font | JetBrains Mono |
| Navbar | fixed, `h-16`, `bg-white/80 backdrop-blur-md`, bottom border |
| Nav active state | color + `font-semibold` (no underline) |
| Signature animation | ProctorNetwork canvas (32 nodes, 155px links, cursor "eye") |
| Motion rule | compositor-only props + `will-change` + reduced-motion fallback |
