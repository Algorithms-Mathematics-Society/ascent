# Ascent interface audit: things to fix and how to remove the AI-slop feel

## 0. Purpose and scope

This is a source-level audit of the current repository, with special attention to:

- how the project is organized and how the files connect;
- the visual system used by the home page;
- the visual and interaction quality of the registration flow;
- why the registration experience feels detached from the home page;
- where the design-token system has drifted or is incomplete;
- which parts of the home page also feel generated or generic and should **not** be copied blindly;
- a concrete, ordered remediation plan.

The original diagnosis is based on the implementation in `src/`, the
Tailwind/CSS configuration, and the repository design documents. The completed
implementation is additionally covered by the browser and build record below.

### 0.1 Redesign implementation status — July 20, 2026

This document began as a baseline audit. Sections that say “currently” describe
the pre-redesign implementation unless an implementation status note says
otherwise. The working sequence is:

- **Block 1 — audit:** complete.
- **Block 2 — semantic tokens:** complete. The active system now follows the
  supplied Ascent identity: Ice `#EDF1F2` for the canvas, white for working
  surfaces, Midnight `#0D1822` for primary ink, and Glacier `#14283A` for
  brand/action emphasis. Gold remains optional rather than a UI requirement.
- **Block 3 — shared primitives and chrome:** complete. Navbar, footer, buttons,
  cards, fields, notices, and registration shell now share the same flat visual
  language.
  The shared navbar and footer use the supplied stepped Ascent mark from
  `media/ascent-dark-logo.svg`, published unchanged for the site shell.
- **Block 4 — home hero:** complete. The hero now has one primary event
  proposition, one CTA pair, a compact fact row, and a quiet proof line. The
  interactive runner, Worker, WebGL flow field, radial glows, ambient pulse,
  faux traffic-light window dots, gradient text, and benchmark glow states were
  retired. The final hero is a focused editorial introduction rather than an
  embedded product demo.
- **Block 5 — remaining home sections:** complete. The generic benefit cards,
  invented Div 1/Div 2/Relay model, placeholder dates, unsupported cash/swag
  claims, floating CTA card, and repeated FAQ cards were removed. The page now
  explains the performance scoring sequence, the repository-backed three-round
  format, visibly pending schedule states, the real three-stage registration
  commitment, and decision-ready FAQ answers. The registration CTA now carries
  an autonomous execution field with no staged diagram or pipeline labels. On
  desktop, the cursor becomes a `TRACE` probe: nearby instruction marks connect
  and deflect, movement lays down a segmented path and paired C++ ticks, and the
  whole response fades cleanly when the pointer leaves. The field routes around
  foreground controls, touch keeps only the ambient motion, and reduced motion
  receives a composed still.
- **Block 6 — registration redesign:** complete. Registration is now a single
  calm, three-stage form inside the same white, Ice, Midnight, and Glacier
  system as the home page. The pass replaced the pastel stage cards with a flat
  progress rail and one neutral workspace; made the three decisions concrete
  (contact, education, entry); added private-use explanations beside sensitive
  fields; rebuilt college commitment and document-link states; and added focus
  recovery, mobile-safe actions, an idempotent submit path, and a recoverable
  timeout. Stage three now asks for a required Google Drive resume link, an
  optional Google Drive transcript link, and an optional Codeforces handle.
  Both link fields explain the exact Viewer sharing setting beside the controls,
  while the application itself never asks for Google authentication. Client and
  server use the same format rules. The registration API no longer uploads a
  PDF, creates a handle reservation, or throttles and rejects an optional
  Codeforces value as if it were a public Ascent identity.
  Submission and the receipt remain on `/register` with no account, provider,
  email-link, or off-site handoff.
  The institution typeahead now uses the confirmed 40-entry Winter '26 set.
  One shared data module drives alias search, server-side registration
  validation, and the Firebase seed; exact list order, unique IDs, campus
  disambiguation, and representative abbreviations are regression-tested.
- **Block 7 — final QA and hardening:** complete. Both routes now hold their
  viewport without horizontal overflow from 320 through 1440 px; keyboard skip,
  focus recovery, form validation, search failure, reduced motion, and
  server-error paths were exercised in a live browser. The pass also corrected
  placeholder contrast, compact target sizes, test discovery, Firebase emulator
  configuration, and the ambiguous transaction cleanup path. The runner was
  subsequently removed as a final product-simplification decision.
- **All seven implementation blocks are complete.**

### 0.2 Block 7 QA record — July 20, 2026

The final pass tested the implemented system rather than only rereading its
source:

- **Responsive layout:** `/` and `/register` were measured at 320, 375, 768,
  1024, and 1440 px. Both routes finish with document width equal to viewport
  width, no visible clipping, one `main`, one visible `h1`, no duplicate IDs,
  and no unlabelled visible form controls.
- **Keyboard and focus:** the shared skip link is first in tab order and moves
  focus past the fixed navigation. Registration focuses the first invalid
  control, each new stage heading, college confirmation actions, the committed
  institution summary, the global error notice, and the final receipt.
- **Registration failures:** empty-stage validation, invalid or missing Google
  Drive links, missing consent, institution-search failure, unlisted-name
  confirmation, and
  a mocked server failure were exercised without sending test registration
  data. Institution search outages no longer block a confirmed unlisted entry.
- **Motion and interaction:** reduced motion disables smooth scrolling across
  the remaining interface. The optional benchmark interaction and its Worker
  were later removed completely, leaving no animated or device-dependent demo
  in the home hero.
- **Contrast and targets:** rendered text has no detected WCAG contrast failure;
  placeholders now measure 4.63:1 on their white fields. Compact actions are
  44 px high and compact navigation links have a 44 px target area.
- **Transaction integrity:** a failed Firestore transaction call checks the
  idempotency receipt before reporting failure. A recovered commit returns its
  receipt, and the private record stores normalized document URLs atomically
  with the application rather than depending on a separate file upload.
- **Verification:** TypeScript, ESLint, diff validation, and the production
  build pass under a supported Node release. The root unit suite passes 44/44 tests and the
  Firestore/Storage emulator suite passes 11/11 tests.

Before public launch, perform one short smoke test with the actual deployment
configuration and a real assistive-technology/browser pairing. That external
check validates deployed credentials and spoken phrasing; it is not a remaining
source-level redesign block.

---

## 1. Executive diagnosis

The registration screens feel like a different product because they effectively are a second, much thinner UI implementation inside the same repository.

The home page has:

- a fixed branded navbar;
- a full-viewport hero composition;
- a distinctive real benchmark interaction;
- shared `Button`, `Card`, `Container`, `Section`, `SectionHeading`, and `Eyebrow` primitives;
- repeated use of semantic `ascent-*` color utilities;
- deliberate typography, spacing, borders, and responsive layout;
- a footer and complete page frame.

The registration flow has:

- no shared page shell, navbar, footer, breadcrumb, progress indicator, or route context;
- a generic `max-w-md` column floating in a mostly empty page;
- repeated raw Tailwind strings rather than reusable form primitives;
- bare browser inputs, select, and file input;
- inconsistent colors such as `text-white`, `border-white/10`, `text-red-400`, and `hover:bg-white/5` that bypass the token layer;
- no clear hierarchy between stage information, instructions, fields, help text, validation, and next actions;
- weak loading, success, empty, search, and error states;
- no visible brand-specific interaction or visual artifact.

The token system is not merely using the “wrong blue.” Its larger problem is that it is incomplete and ambiguously governed. The code has a color token layer, but it does not have a full interface token system. Typography, spacing, field height, radii, form surfaces, feedback colors, and component states are either scattered across Tailwind strings or hard-coded in individual components. Three repository documents also describe materially different visual systems, so there is no trustworthy written source of truth.

The most urgent functional/design problem is that every home-page “Register” link points to `#register`, while the real registration flow lives at `/register`. The CTA inside the element with `id="register"` points back to itself. A visitor can see the registration route in the code but cannot reach it from the visible home-page CTA path.

The correct goal is **not** “apply more glow and glass to the forms.” The correct goal is to make registration feel like the focused transactional mode of the same product:

- same identity;
- same typography and measured spacing;
- same blue signal color and engineered border language;
- quieter than the marketing page;
- clearer about progress, privacy, errors, and next steps;
- one restrained signature detail, rather than decorative effects around every field.

---

## 2. Project map and file connections

### 2.1 Runtime foundation

`src/app/layout.tsx` is the root shared by **both** the home page and all registration routes. It:

- loads Geist Sans and JetBrains Mono;
- loads `src/app/globals.css`;
- applies `bg-ascent-bg` and `text-ascent-ink` to the body;
- pulls site metadata from `src/content/site.ts`.

`src/app/globals.css` defines the runtime CSS custom properties and the few global component classes:

- color tokens such as `--ascent-bg`, `--ascent-surface`, `--ascent-accent`, and `--ascent-muted`;
- global focus and selection behavior;
- `.ascent-btn*` button variants and sizes;
- `.glass-card`;
- `.ascent-pulse` and reduced-motion behavior.

`tailwind.config.ts` bridges those CSS variables into Tailwind names such as `bg-ascent-bg`, `text-ascent-muted`, and `border-ascent-border`. It also defines the Geist/JetBrains font families and the `ease-expo` timing function.

The dependency direction is:

```text
globals.css CSS variables
        ↓
tailwind.config.ts ascent.* utilities
        ↓
UI primitives and direct utility strings
        ↓
home sections and registration forms
```

The weakness is at the last two levels: the home page usually goes through primitives; registration mostly skips them.

### 2.2 Home-page composition

`src/app/page.tsx` is a clean composition root:

```text
Home
├── Navbar
├── main#top
│   ├── Hero
│   ├── About
│   ├── Tracks
│   ├── Timeline
│   ├── RegistrationCta
│   └── Faq
└── Footer
```

The relevant implementation is split as follows:

- `src/components/layout/Navbar.tsx` — fixed wordmark and Register CTA.
- `src/components/layout/Footer.tsx` — brand, navigation columns, and legal row.
- `src/components/sections/Hero.tsx` — hero composition and content.
- `About.tsx`, `Tracks.tsx`, `Timeline.tsx`, `RegistrationCta.tsx`, `Faq.tsx` — below-the-fold blocks.
- The retired backdrop, flow-field, benchmark, and Worker files have been deleted.
- `Countdown.tsx` — optional registration deadline, rendered only when configured.
- `src/content/site.ts` — site metadata, proof copy, countdown configuration, and footer links.
- `src/content/sections.ts` — hero stats, card content, timeline, and FAQ.
- `src/components/ui/*` — shared home-page primitives.

The active home page is intentionally static and data-driven:

```text
page.tsx → sections → typed content → shared UI primitives
```

There is no background renderer, device benchmark, or Worker dependency.

### 2.3 Registration route and data flow

The registration flow is server-gated and split across four routes:

```text
/register
   └── SignInForm
         ├── Firebase Google popup, or
         ├── Firebase email magic link
         └── POST /api/auth/session
                     ↓
/register/handle
   └── HandleForm
         ├── CollegeTypeahead
         │      └── GET /api/colleges/search
         └── POST /api/register/handle
                     ↓
/register/profile
   └── ProfileForm
         └── POST /api/register/profile
                     ↓
/register/path
   └── server-rendered registration outcome
```

Every page server component reads the `ascent_session` cookie, verifies it through `src/lib/session.ts`, reads the application through `src/lib/firebaseAdmin.ts`, and redirects the applicant to the correct step. This is a sound resumable-flow architecture.

The supporting files are:

- `src/lib/firebaseClient.ts` — browser Firebase Auth and emulator wiring.
- `src/lib/firebaseAdmin.ts` — server-side Auth, Firestore, and Storage.
- `src/lib/session.ts` — session cookie creation and verification.
- `src/lib/validators.ts` — handle, Indian phone, and PDF validation.
- `src/lib/rateLimit.ts` — rate-limiting helpers.
- `src/lib/qualificationEngine.ts` — determines `AUTO` or `QUALIFIER`.
- `src/types/registration.ts` — application, PII, college, tier, and state types.
- `src/app/api/auth/session/route.ts` — ID-token-to-session-cookie exchange.
- `src/app/api/register/handle/route.ts` — creates the initial application and reserves the handle.
- `src/app/api/register/profile/route.ts` — validates profile/resume, stores PII, and determines the path.
- `src/app/api/colleges/search/route.ts` — rate-limited canonical college search.

The backend flow is substantially more considered than the frontend presentation. The visual layer fails to communicate the safety, resumability, deterministic state, and privacy structure that already exists underneath it.

---

## 3. Why the design-token system feels “messed up”

### 3.1 There are three competing written sources of truth

The repository currently contains mutually incompatible guidance:

1. `FRONTEND-DESIGN.md` describes **AMS Access**, including a bright white marketing surface, purple accent, and a separate dark console style.
2. `docs/ascent-home-plan.md` describes Ascent as dark and blue-forward, but specifies older values such as a `6 9 16` canvas, `59 130 246` primary accent, and pure-white ink.
3. `docs/superpowers/specs/2026-06-25-architecture-restructure-design.md` describes a light-mode, pixel-identical restructure and says dark mode is not shipped.
4. The actual `globals.css` ships a dark system with a `10 12 18` canvas, a lighter `96 165 250` accent, slate-200 ink, and a special magenta performance color.

The code is the runtime truth, but the repository has no single reliable **brand truth**. Future changes can “correct” the system toward three different destinations and all appear justified by a document.

**Fix:** create one current Ascent design-system document and explicitly mark older plans/reference documents as historical or superseded. It must state the active palette, typography, radii, spacing rules, surface hierarchy, component states, and when the special performance color is allowed.

### 3.2 The current system is a color palette, not a complete token system

The current CSS variables cover:

- canvas/surfaces;
- border;
- several blue/cyan colors;
- ink/muted text;
- performance magenta;
- primary button background and hover background.

They do **not** cover:

- field background, border, hover, focus, invalid, disabled, or autofill;
- success, warning, error, and information feedback;
- text hierarchy beyond primary and muted;
- control heights;
- radii by role;
- spacing/rhythm by role;
- typography roles;
- elevation levels;
- overlay/scrim colors;
- motion durations;
- content widths for prose, forms, and application shells.

This is why registration falls back to ad hoc values. The code has no semantic way to ask for “invalid field border” or “quiet application panel,” so the component author reaches for `text-red-400`, `border-white/10`, and `bg-ascent-panel`.

The current runtime inventory is:

| Current token                   | Runtime value | Current implied role        | Audit note                                                          |
| ------------------------------- | ------------: | --------------------------- | ------------------------------------------------------------------- |
| `--ascent-bg`                   |     `#0a0c12` | page canvas                 | Clear role, but differs from older plan values                      |
| `--ascent-surface`              |     `#111722` | card/footer surface         | Useful role                                                         |
| `--ascent-panel`                |     `#111722` | panel/input background      | Exact alias of surface; suggests hierarchy that does not exist      |
| `--ascent-border`               |     `#1e293b` | all borders                 | Too broad for fields, dividers, cards, and strong boundaries        |
| `--ascent-accent`               |     `#60a5fa` | text, icon, focus, glow     | Carries too many jobs                                               |
| `--ascent-accent-bright`        |     `#7dd3fc` | hero gradient stop          | Narrow but valid role                                               |
| `--ascent-blue-deep`            |     `#3b82f6` | nominal deeper blue         | Defined/bridged but not meaningfully consumed by components         |
| `--ascent-cyan`                 |     `#22d3ee` | secondary electric signal   | Often acts as a second brand accent without a documented hierarchy  |
| `--ascent-hot`                  |     `#ff3d71` | measured performance result | Strong and appropriately specific                                   |
| `--ascent-hot-bright`           |     `#ff6e96` | nominal hot highlight       | Present without meaningful rendered use                             |
| `--ascent-ink`                  |     `#e2e8f0` | primary text                | Good off-white role, but registration bypasses it with pure white   |
| `--ascent-muted`                |     `#94a3b8` | all secondary text          | Overloaded across labels, help, metadata, and disabled-looking text |
| `--ascent-btn-primary-bg`       |     `#3b82f6` | primary action              | Component token duplicates the value concept of `blue-deep`         |
| `--ascent-btn-primary-bg-hover` |     `#60a5fa` | primary action hover        | Component token duplicates the value concept of `accent`            |

The table shows why simply replacing one hex value will not solve the problem: several tokens duplicate values, several names imply unused hierarchy, and a few high-frequency tokens carry too many semantic responsibilities.

### 3.3 Token names mix primitives, roles, and components

Examples:

- `accent`, `accent-bright`, `blue-deep`, and `cyan` are palette-like names.
- `bg`, `surface`, `panel`, `border`, `ink`, and `muted` are semantic role names.
- `btn-primary-bg` is component-specific.
- `hot` is a meaning-specific exception.

These levels can coexist, but they need a deliberate mapping. Right now, `panel` is an alias of `surface`, `blue-deep` is effectively not part of rendered component decisions, and `hot-bright` is defined without an active usage. The comments describe strict rules that TypeScript/Tailwind cannot enforce.

**Fix:** separate the system into two layers:

```text
Primitive palette
blue-400, blue-500, cyan-400, slate-950, slate-900, slate-400, etc.
        ↓
Semantic roles
canvas, surface-1, surface-2, text-primary, text-secondary,
border-subtle, border-strong, action-primary, focus, danger, success,
performance-accent
        ↓
Component roles
button-primary-bg, field-bg, field-border, field-border-focus,
card-bg, notice-danger-bg, progress-active
```

The Tailwind-facing API should primarily expose semantic roles. Primitive values may remain private CSS implementation details.

### 3.4 The implementation leaks raw colors around the token layer

Current examples include:

- registration headings and controls using `text-white` instead of `text-ascent-ink`;
- registration borders using `border-white/10` instead of a semantic field-border token;
- errors using `text-red-400` without danger tokens;
- college results using `hover:bg-white/5`;
- benchmark title-bar dots using raw Tailwind red/yellow/green.

The benchmark window dots are a defensible representational exception. Registration errors and controls are not: they are core UI states and should be tokenized.

### 3.5 Shared classes and primitives are too narrow

The home page has a typed `Button` and `Card`, but registration uses literal `<button>` elements with raw `.ascent-btn` class strings. There are no form primitives at all.

At minimum the system needs:

- `RegistrationShell`;
- `FormPanel`;
- `FormField`;
- `TextInput`;
- `SelectField`;
- `FileUpload`;
- `FormMessage` or `Notice`;
- `ProgressSteps`;
- an accessible `Combobox`/college picker;
- `Button` support for loading state and full-width layout.

### 3.6 Recommended token contract

Do not begin by choosing more shades. Begin by defining roles. A practical target is:

```text
Canvas and surface
--ascent-canvas
--ascent-surface-1
--ascent-surface-2
--ascent-surface-raised

Text
--ascent-text-primary
--ascent-text-secondary
--ascent-text-tertiary
--ascent-text-on-action

Borders and focus
--ascent-border-subtle
--ascent-border-default
--ascent-border-strong
--ascent-focus-ring

Actions
--ascent-action-primary
--ascent-action-primary-hover
--ascent-action-secondary-hover
--ascent-action-disabled

Feedback
--ascent-info
--ascent-success
--ascent-warning
--ascent-danger
--ascent-danger-surface

Brand exception
--ascent-performance

Controls
--ascent-field-bg
--ascent-field-border
--ascent-field-border-hover
--ascent-field-border-focus
--ascent-field-border-invalid
--ascent-field-placeholder
--ascent-field-disabled-bg

Shape and rhythm
--ascent-radius-control
--ascent-radius-card
--ascent-control-height-sm/md/lg
--ascent-form-gap
--ascent-section-space

Motion
--ascent-duration-fast
--ascent-duration-standard
--ascent-ease-expressive
```

Existing public Tailwind names can be migrated gradually, but new registration components should consume the new semantic roles only.

---

## 4. Home screen: block-by-block analysis

## Home block 1 — Fixed navbar

**Files:** `src/components/layout/Navbar.tsx`, `src/components/ui/Button.tsx`

### What it currently does

- Fixed 64px frosted dark header.
- Left-aligned `ChevronsUp` icon and mono “Ascent” wordmark.
- One right-aligned primary Register button.
- No section navigation.

### What works

- The compact height, hairline border, and restrained blur fit the engineered visual language.
- The mono wordmark and upward chevrons establish the brand quickly.
- It avoids an overloaded SaaS-style navigation bar.

### What feels unfinished or generic

- The header is too empty on wide screens. It reads like a temporary shell rather than a confident navigation decision.
- The code comment says section links “live in the page flow,” but there is no alternate in-page navigation block. Discoverability is reduced.
- The Register CTA points to `#register`, not `/register`. It does not enter the real registration flow.
- The wordmark link points to `#top`, which only exists on the home page. If this navbar is later reused on registration routes, the link must become `/#top` or simply `/`.
- There is no active/current-page treatment because the component was designed only for the home page.

### Fix

- Change the primary CTA destination to `/register`.
- Add a small desktop navigation group for the highest-value anchors only: Event, Tracks, Timeline, FAQ. Do not add a five-pill nav.
- Build a shared site header mode that works on both home and registration routes:
  - home: anchor links plus Register;
  - registration: wordmark, “Back to event,” and optionally “Save and exit”/sign out when authenticated.
- Keep the same height and border language. Do not add a giant gradient logo or animated nav indicator.

## Home block 2 — Hero copy, stats, credibility, and CTAs

**Files:** `Hero.tsx`, `HeroBackdrop.tsx`, `HeroFlowField.tsx`, `Countdown.tsx`, `src/content/site.ts`, `src/content/sections.ts`

### What it currently does

- Full-viewport two-column hero.
- Headline: “The ascent is measured in milliseconds.”
- Long performance-contest explanation.
- Register and View tracks actions.
- Three compact stats: Speed, C++20, Free.
- AMS Derive proof row and optional registration countdown.
- Radial glow plus responsive WebGL flow field.

### What works

- This is the most brand-specific marketing block.
- The headline is sharper than generic “unlock your potential” copy.
- The visual effect reacts to a real measured benchmark instead of playing an unrelated ambient loop.
- Typography is controlled: medium-weight large heading, muted prose, and mono data labels.
- Motion has reduced-motion and device capability gates.

### Problems and contradictions

- The hero defines Ascent as a **performance optimization contest against a real codebase**, but later blocks define it as a conventional algorithmic competitive-programming event with graphs, DP, Div 1/Div 2, and a team relay. This is the page’s largest narrative break.
- “Judged on Speed” is imprecise. The benchmark and copy imply correctness is a gate and runtime determines ranking. The stat should not imply that correctness does not matter.
- Both Register buttons still lead to the dead/self-referential `#register` path.
- The proof row is carefully attributed in code, but still reads like a standard social-proof garnish unless visitors understand the relationship between Derive and Ascent.
- The WebGL effect, benchmark, proof row, stats, two actions, glow layers, and long paragraph create a lot of simultaneous hero signals. The benchmark earns attention; some secondary proof can move below the fold.
- `registration.closeISO` is null while the Timeline contains explicit registration dates. The content system therefore presents an event calendar and disables the most relevant live date cue at the same time.

### Fix

- Decide the actual contest proposition before redesigning lower blocks:
  - **Option A:** a systems/performance optimization contest; rewrite About, Tracks, Timeline, FAQ, and prizes around profiling, cache locality, throughput, and codebase optimization.
  - **Option B:** conventional algorithmic competitive programming; reduce the benchmark’s prominence or frame it as a warm-up demonstration rather than the core contest mechanic.
- Replace “Judged on Speed” with a precise rule such as “Correctness first / runtime decides” if that is true.
- Point Register to `/register`.
- Keep the benchmark as the signature artifact and simplify secondary hero content if visual testing shows competition.
- Use one source for registration dates and derive both Timeline and Countdown from it.

## Home block 3 — Live benchmark console (retired)

**Files:** `BenchmarkConsole.tsx`, `bench.worker.ts`, `HeroFlowContext.tsx`, `HeroFlowField.tsx`

### Implementation status — retired after final review

This block is no longer part of the product. `BenchmarkConsole.tsx` and
`bench.worker.ts` were deleted, and the hero was rebalanced as a single-column
editorial introduction. The analysis below is retained only as historical
evidence of why the original demo competed with the event proposition.

### What it currently does

- Shows a code-editor-style matrix-sum example.
- Runs real work in a Web Worker.
- Measures column-major versus row-major traversal.
- Rewrites the displayed source, animates measured runtime, and exposes the speedup.
- Changes the background flow field from warm/turbulent to cool/fast.

### What works

- This is the strongest anti-slop component in the repository because it demonstrates the proposition instead of decorating it.
- Numbers are measured rather than fabricated.
- The performance behavior is thoughtfully bounded: Worker, timeout, adaptive canvas resolution, visibility pausing, reduced-motion fallback, and low-core fallback.
- The special magenta color has a clear semantic job: measured performance gain.

### What needs refinement

- The console establishes a much more specific identity than the rest of the page supports.
- The raw red/yellow/green title-bar dots are acceptable as window chrome, but they should be documented as a representational exception to the “semantic colors only” rule.
- The custom “Run on your machine” control does not use the shared `Button` primitive, so focus/disabled/size behavior can drift.
- The pulsing ring may pull attention continuously even after the user has already understood the control. Limit the pulse duration or stop it after first interaction.
- Speedup is rounded to an integer, which can flatten meaningful differences and produce a minimum displayed “1× faster.” The copy should avoid implying an improvement when results are effectively equal.

### Fix

- Keep this block, but make the rest of the page earn its specificity.
- Extend `Button` with a quiet/inline technical variant instead of styling a one-off button.
- Stop ambient pulse after interaction and consider stopping it after a few cycles even without interaction.
- Define honest display rules for near-equal/noisy benchmark results.

## Home block 4 — About

**Files:** `About.tsx`, `src/content/sections.ts`

### What it currently does

- Section eyebrow, headline, long lede.
- Three equal cards: Pure C++, Algorithmic, Timed rounds.
- Each card has a Lucide icon and `01/02/03` label.

### What works

- Clear section hierarchy and reusable primitives.
- Cards use consistent spacing, surfaces, typography, and responsive columns.
- The copy is specific enough to the C++ domain to avoid pure lorem-ipsum marketing.

### AI-slop tells

- “Eyebrow + large headline + paragraph + three equal icon cards” is the most common generated landing-page section pattern.
- The icons, numbers, titles, and descriptions all communicate the same hierarchy. The numbers are decorative redundancy rather than useful information.
- The content contradicts the performance/codebase hero and returns to a generic algorithm contest.
- The repeated mountain language begins to feel mechanically applied rather than authored.

### Fix

- Replace the three abstract benefit cards with one concrete explanation of the contest format.
- A better structure would be a compact “what you receive / what you optimize / how scoring works” diagram, sample task anatomy, or scoring formula.
- If cards remain, remove either icons or numbering and vary information density based on actual importance.
- Use mountain language once or twice across the entire page, not in every section.

## Home block 5 — Tracks

**Files:** `Tracks.tsx`, `src/content/sections.ts`

### What it currently does

- Repeats the three-column card layout.
- Offers Beginner/Div 2, Advanced/Div 1, and Team Relay.

### What works

- The labels are easy to scan.
- The card system remains visually consistent.

### Problems

- It is visually almost identical to About, so the page rhythm becomes template-like.
- The division model and relay model are not reconciled with the hero’s “optimize a real codebase” proposition.
- “Beginner” and “Advanced” are too vague to help a participant choose. There are no eligibility criteria, expected background, scoring differences, team size details beyond later copy, or format distinctions.
- “Pick your route up the mountain” is another automatic brand-metaphor insertion rather than useful guidance.

### Fix

- First confirm whether these tracks actually exist.
- Present tracks as a comparison table or segmented specification, not another identical card row.
- Include meaningful decision data: team size, duration, format, expected experience, scoring, advancement, and whether a participant can enter more than one track.
- If the real contest has only one performance track, remove the artificial three-option structure.

## Home block 6 — Timeline

**Files:** `Timeline.tsx`, `src/content/sections.ts`

### What it currently does

- Four-step vertical line: Registration, Prelims, Finals, Results.
- Dates, icons, sequence numbers, and descriptions.

### What works

- The layout changes the page rhythm after two card grids.
- Dates are scannable in mono/cyan.
- The vertical structure collapses naturally on small screens.

### Problems

- The repository comments originally called these dates placeholders, but the UI presents them as definite facts.
- The configured registration countdown is disabled, so date truth is fragmented.
- “Prelims” and “Finals” again describe a conventional algorithm contest and do not explain how a performance/codebase contest progresses.
- Every node has an icon plus a sequence number; one sequencing device is enough.
- The line begins at a generic left edge rather than aligning to a stronger content grid on large screens, leaving unused horizontal space.

### Fix

- Move event dates to a single typed content object with status: confirmed, tentative, or TBA.
- Never publish placeholders as real dates.
- Use copy that explains what changes between phases, not only that phases exist.
- On desktop, consider a two-column layout: sticky timeline label/context and the phase list.

## Home block 7 — Prize/registration CTA

**Files:** `PrizesCta.tsx`

### What it currently does

- Large centered glass card.
- “Ready to start the climb?” headline.
- Cash prizes, swag, recognition, and free registration copy.
- Register and schedule buttons.
- Eligibility/team-size footnote.

### What works

- It clearly intends to be the conversion close.
- The secondary schedule action is useful.
- The centered composition differentiates it slightly from the preceding left-aligned sections.

### Critical problems

- The card itself owns `id="register"`, and its Register button links to `#register`. The primary action therefore targets the element the user is already viewing.
- Navbar and hero CTAs also target this block instead of the actual `/register` route.
- Cash prizes and swag are strong factual claims but are not sourced from the shared content layer and may be unconfirmed.
- This is another centered rounded-card CTA pattern, a common AI-template ending.

### Fix

- Link the CTA to `/register` immediately.
- Put confirmed prize facts in typed content; otherwise say “Prize details will be announced” or remove the claim.
- Consider making the conversion close a full-width structural band or a split “registration facts + action” layout instead of another floating card.
- The CTA should state the actual commitment: time required, what information is needed, and that progress can be resumed.

## Home block 8 — FAQ

**Files:** `Faq.tsx`, `src/content/sections.ts`

### What it currently does

- Centered “Quick answers” heading.
- Three separate glass cards with static question/answer pairs.

### What works

- Uses correct description-list semantics.
- Answers compiler and cost questions directly.

### Problems

- The FAQ repeats the card visual yet again.
- Only three very general questions are present, while real registration anxiety is left unanswered: eligibility, dates/time zones, resume use, privacy, college qualification, team rules, and what happens after registration.
- The answer “The judge runs g++…” assumes a conventional judge, while the hero implies benchmarking a real codebase.
- “Quick answers” is generic filler copy.

### Fix

- Use a simpler divided list, not three more cards.
- Add only verified, decision-ready answers.
- Prioritize questions that block registration.
- Link relevant answers to the registration flow or rules when those routes exist.

## Home block 9 — Footer

**Files:** `Footer.tsx`, `src/content/site.ts`

### What it currently does

- Brand column plus Event, Resources, and Social columns.
- Bottom legal/brand row.

### What works

- Strong consistent typography and surface treatment.
- Responsive structure is sensible.

### Problems

- Several links point to anchors that do not exist: Rules, Contact, and Code of Conduct.
- Social links point to `#` placeholders.
- Placeholder links make the page feel generated and unfinished more quickly than imperfect styling does.
- The footer repeats a generic startup-site sitemap even though the site is currently one page.

### Fix

- Remove every unavailable destination until it is real.
- Prefer a smaller honest footer over three populated-looking placeholder columns.
- Add registration/privacy/support links when those documents/routes exist.

---

## 5. Registration screen: block-by-block analysis

### Product decision and implementation status — 20 July 2026

The registration model has now been corrected after comparing it with the AMS
Derive registration flow. Entrants are registering for a competition; they are
not creating a general product account. Therefore the authoritative flow is:

`Open /register → complete one form → submit once → see the receipt on the same page`

There is **no sign-in, Google provider, email magic link, verification detour,
saved-step promise, or authentication gate**. The detailed subsections below
remain as evidence of the original state that produced the audit. Where they
discuss improving authentication UI, that recommendation is superseded by the
decision to remove authentication entirely.

| Original registration block | Resolution in the first implementation wave                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Missing shared shell     | Completed: shared Ascent header, canvas, and restrained form panel                                                                                     |
| 2. Sign-in context          | Retired: sign-in component deleted; direct-form introduction replaces it                                                                               |
| 3. Google action            | Retired: provider authentication and Firebase client auth removed                                                                                      |
| 4. Email magic link         | Retired: magic-link/session routes and all related UI removed                                                                                          |
| 5. Handle selection         | Consolidated into the direct form with client and server validation                                                                                    |
| 6. College typeahead        | Rebuilt as an accessible combobox with keyboard, loading, empty, error, retry, canonical selection, and explicit unlisted confirmation states          |
| 7–10. Profile fields        | Consolidated into clearly named fieldsets on the same page; student-only fields are conditional and sensitive inputs have explicit purpose/constraints |
| 11. Submit/errors           | Completed: whole-form disabled state, precise loading label, field errors, summary errors, focus management, and idempotent retry token                |
| 12. Outcome/path            | Replaced by an in-place receipt showing handle, college, determined competition route, reason, and reference                                           |

The useful lesson from AMS Derive is its low-friction topology—one URL, one
form, one submission, one visible outcome—not its styling, social proof, upload
architecture, or marketing language. Ascent keeps its own design system and
uses one private server-side upload plus an atomic registration transaction.

The remaining policy-level hardening item is to make the Firestore client rules
explicitly deny the new anonymous-registration collections. The current client
rules were not loosened, and the registration writes happen through Firebase
Admin on the server. Changing deployed access-control policy should be reviewed
and approved separately from this UI wave.

## Registration block 1 — Missing shared application shell

**Files:** all files under `src/app/register/` and `src/components/register/`

### Current state

Each route-level registration form/outcome renders its own `<main className="mx-auto flex min-h-[70vh] max-w-md ...">`. There is no `src/app/register/layout.tsx` and no shared registration shell.

### Why this creates the “different product” feeling

- No wordmark or stable navigation survives the transition from home to registration.
- The page width changes from a composed `max-w-7xl` environment to a lone `max-w-md` column.
- There is no surface/container boundary; controls float directly on the body canvas.
- `min-h-[70vh]` does not create a deliberate full-page composition and can leave arbitrary empty space.
- There is no progress/state model in the interface even though the backend has a strong state machine.

### Fix

Create `src/app/register/layout.tsx` and a `RegistrationShell` with:

- a compact shared header using the same wordmark, height, border, and canvas as home;
- a route back to the event page;
- a full-height application area below the 64px header;
- a restrained static background treatment derived from the hero colors, with no WebGL requirement;
- a form/content panel with a consistent maximum width;
- a visible stage rail: `01 Account → 02 Handle & college → 03 Profile → 04 Path`;
- a support/privacy line in a stable footer region.

The registration shell should be calmer than the hero. One subtle glow or grid fragment is enough.

## Registration block 2 — Sign-in heading and context

**File:** `SignInForm.tsx`

### Current state

- One `text-2xl font-semibold text-white` heading.
- No eyebrow, explanation, time estimate, progress, or privacy context.

### Why it feels generic

“Register for Ascent” above two authentication options is functionally correct but visually indistinguishable from a scaffolded auth tutorial.

### Fix

- Use the shared page title role, not raw `text-2xl`.
- Add a concise stage label such as `Registration · Step 1 of 3`.
- Explain the action in one line: sign in to create a resumable application.
- State what is and is not shared: verified identity is used for the event; personal details are not shown publicly/externally without explicit permission, if that policy is accurate.
- Add a small “Already started? Sign in to continue” cue rather than separate mode complexity; server routing already resumes the correct step.

## Registration block 3 — Google action

**File:** `SignInForm.tsx`

### Current state

- Full blue primary button labeled “Continue with Google.”
- Disabled during loading, but button text does not change and no progress indicator appears.

### Problems

- There is no Google mark or neutral provider styling, so it looks like an ordinary internal CTA.
- On popup failure, all failure reasons collapse to “Google sign-in failed. Try again.”
- Loading disables the action but does not explain what is happening.
- No terms/privacy context appears near account creation.

### Fix

- Use an accessible provider-button treatment with a simple Google mark asset or neutral icon treatment, while keeping primary hierarchy clear.
- Show “Opening Google…”/“Signing you in…” and a small spinner during work.
- Preserve useful error categories where safe: popup closed, popup blocked, network error, configuration error.
- Add links to real Terms/Privacy documents before launch; do not add fake `#` links.

## Registration block 4 — Divider and email magic-link form

**File:** `SignInForm.tsx`

### Current state

- A centered text node containing “or.”
- Bare email input with placeholder-only guidance.
- Secondary button for sending a sign-in link.
- On success, the entire form becomes one muted paragraph.

### Problems

- The divider has no visual structure.
- The email field has no visible label, helper text, or autocomplete attribute.
- Placeholder text is not a substitute for a label.
- Input border, background, and text are hard-coded outside the semantic system.
- There is no focus-border state, invalid field state, or field-level error link.
- The success state does not provide resend, change-email, spam-folder, expiration, or same-browser guidance until failure.
- During automatic magic-link completion, the original form can remain visible while the asynchronous sign-in runs.

### Fix

- Use a divided separator with an accessible text label.
- Add a persistent Email label and `autoComplete="email"`.
- Use the shared field primitive and semantic states.
- Replace the success paragraph with a restrained success notice containing:
  - masked/entered address;
  - same-device/browser instruction;
  - resend cooldown;
  - change-address action;
  - spam-folder guidance.
- When a magic link is being completed, show one dedicated verification state rather than the full editable form.

## Registration block 5 — Handle selection

**File:** `HandleForm.tsx`

### Current state

- Heading, handle input, college picker, one global error, and Continue button.
- Handle constraints exist on the server but are not visible until submission fails.

### Problems

- There is no progress indication or explanation of why the handle matters.
- The label contains help text in parentheses instead of separating label and hint.
- The client does not share `validateHandle`, so preventable server round trips become the first validation feedback.
- The API returns `field: "handle"`, but the form ignores it and renders one global red paragraph.
- No `aria-describedby`/`aria-invalid` connection exists.
- No visible character/format guidance appears before error.

### Fix

- Label: “Contest handle.” Hint: “Shown on rankings. 3–24 characters; start with a letter; letters, numbers, and underscores only.”
- Validate on blur and submit using shared rules while retaining server validation as authority.
- Render field-level messages and focus the first invalid field.
- Use `autoCapitalize="none"`, `autoCorrect="off"`, and an appropriate autocomplete choice.
- Preserve the handle exactly as displayed but clearly explain case/uniqueness behavior.

## Registration block 6 — College typeahead

**File:** `CollegeTypeahead.tsx`

### Implementation status — Block 6 redesign

Completed as part of the integrated three-stage registration pass. The current
component is an ARIA combobox with debounced server search, stale-request
protection, keyboard navigation, bounded results, loading/empty/error/retry
states, canonical campus-aware results, explicit unlisted confirmation, live
announcements, and focus restoration through selection, change, and
confirmation cancellation. Its selected and confirmation surfaces now use the
same flat white/Ice/Glacier language as the rest of registration.

### Current state

- Debounced search after two characters.
- Results render in a normal-flow list below the input.
- Result selection fills the input.
- “My college isn’t listed” appears whenever two characters are present and nothing is selected.

### What works

- The data source is canonical and search is server mediated.
- Request IDs prevent stale responses from overwriting newer results.
- An explicit unlisted path protects data integrity better than silently treating free text as canonical.

### Major UX/accessibility problems

- It is not exposed as a combobox/listbox to assistive technology.
- There is no keyboard arrow navigation, active descendant, Enter selection, or Escape close behavior.
- Results are plain buttons in a list without option semantics.
- There is no loading state, empty-result state, search-error state, or retry.
- The API can return `429`, but the UI silently treats all non-OK responses as nothing.
- The result list pushes the form down and can produce layout jumps; it also has no max height or scroll strategy.
- “My college isn’t listed” appears before the search has conclusively returned no match, encouraging premature free-text submission.
- Selected and unlisted states have no strong visual confirmation or clear/reset control.
- Campus is appended as plain punctuation instead of being treated as disambiguating metadata.

### Fix

- Build or implement a proper ARIA combobox pattern.
- Show loading after the debounce begins and a clear empty state after it completes.
- Surface rate-limit/network failure as recoverable inline feedback.
- Render a positioned, bounded results panel that remains usable on small screens.
- Show canonical name as primary text and campus as secondary metadata.
- Offer “College not listed” after results are empty, or as a deliberately separated final option.
- After selection, show a selected state with a check and Change action.
- After unlisted selection, state the consequence clearly: the name will be reviewed and the applicant follows the qualifier route unless policy changes.

## Registration block 7 — Profile heading and stage context

**File:** `ProfileForm.tsx`

### Current state

- “Complete your profile” plus five controls.
- No progress, motivation, section grouping, time estimate, or privacy explanation.

### Problems

- This is the longest and most sensitive stage, yet it has the least trust framing.
- Status, academic details, phone, and resume are presented as one undifferentiated stack.
- The form does not explain how the resume or phone will be used.
- The underlying architecture contains a PII separation and consent model, but the UI exposes none of that reassurance.

### Fix

- Split the panel visually into “About you” and “Contact & document.” Do not turn these into two more routes unless testing proves necessary.
- Add a concise progress header and why-this-is-needed copy.
- Put privacy/use explanations next to sensitive fields, not in a distant footer.
- If the product decision still requires a resume at registration, explain that decision clearly. The earlier architecture document recommended deferring resume collection, so the current requirement deserves explicit product confirmation.

## Registration block 8 — Status, year of study, and graduation year

**File:** `ProfileForm.tsx`

### Current state

- Status defaults to Student.
- Year of study is free text.
- Graduation year is numeric.
- Academic fields remain visible for Professional and Other.

### Problems

- The default can submit an accidental Student status if the user never actively chooses.
- “3rd year” free text creates inconsistent data and is awkward for non-students.
- Student-specific controls remain visible regardless of status.
- Required/optional behavior is not communicated.
- Number input has no explicit sensible bounds or help text.

### Fix

- Use a deliberate placeholder such as “Select status” unless a legally/product-valid default is intended.
- Conditionally show academic fields based on status.
- Prefer structured year-of-study options when the downstream model expects categories.
- Define graduation-year bounds and eligibility behavior in shared validation.
- Mark optional fields explicitly; do not force users to infer it from the absence of an asterisk.

## Registration block 9 — Phone number

**File:** `ProfileForm.tsx`

### Current state

- Plain text input with placeholder “10-digit Indian number.”
- Server normalizes `0`, `91`, and non-digit characters to E.164.

### Problems

- Missing `type="tel"`, `inputMode="tel"` or `numeric`, and `autoComplete="tel"`.
- No country prefix treatment; the India-only assumption is only in placeholder text.
- No explanation that phone is used for deduplication/contact.
- Server returns field-specific errors, but UI displays a single global error.

### Fix

- Use an explicit `+91` prefix or country selector if international users are allowed.
- Add correct input metadata and lightweight formatting.
- Explain use and visibility.
- Render field-level feedback and preserve the typed value after failure.

## Registration block 10 — Resume upload

**File:** `ProfileForm.tsx`

### Current state

- Native file input with only `className="text-white"`.
- Label contains PDF and 500KB requirements.
- Client only checks that some file exists; server checks magic bytes and size.

### Why it strongly contributes to the unfinished feel

The native control receives almost none of the interface language used elsewhere. Its appearance varies by browser and operating system, making it the most visibly disconnected control on the page.

### Fix

- Use a styled file-picker/dropzone that remains a real accessible file input underneath.
- Show selected filename, formatted size, replace/remove actions, and local PDF/size validation.
- Explain storage/use/retention accurately.
- Provide upload/submission progress or at minimum a clear processing state.
- Reconsider whether resume must block registration. This is a product/funnel decision, not just a styling issue.

## Registration block 11 — Submit, loading, and errors

**Files:** `HandleForm.tsx`, `ProfileForm.tsx`, `SignInForm.tsx`

### Current state

- Submit buttons disable while loading.
- Button labels stay “Continue.”
- All errors render as a small `text-red-400` paragraph.

### Problems

- Disabled opacity without state text is weak feedback.
- “Continue” does not say what will happen, especially on the profile step where upload, dedupe, storage, consent writing, and qualification determination all occur.
- Global errors are not connected to fields even though APIs return field identifiers.
- Error color bypasses tokens and may not meet contrast requirements once the palette changes.
- There is no error summary, focus movement, or retry distinction.
- Inputs remain editable during submission, which can make UI values diverge from the submitted payload.

### Fix

- Use explicit labels: “Save handle & college,” “Complete registration,” etc.
- Add loading labels: “Checking handle…,” “Uploading and finishing…”
- Map API `field` values into field messages; reserve the top-level notice for network/server failures.
- Add a semantic danger token and notice component.
- Focus the error summary or first invalid field after failure.
- Decide whether to disable the whole form during submission or safely allow edits with request cancellation/versioning.

## Registration block 12 — Outcome/path screen

**File:** `src/app/register/path/page.tsx`

### Current state

- Centered heading and one paragraph.
- Copy changes based on `college_tier === "AUTO_QUALIFY"`.
- No action, status summary, application reference, timeline, or support route.

### Critical correctness/communication issue

The screen branches on `college_tier`, not `qualification_path`. The qualification engine currently sends an unverified auto-tier applicant to `QUALIFIER`, while this page tells that applicant about future college verification because their **tier claim** is auto-qualify. That may be an intentional “next available action,” but the UI does not distinguish:

- claimed college tier;
- current determined qualification path;
- future path if verification succeeds;
- next required action.

The result is ambiguous at the most important moment of the flow.

### Fix

- Render a structured outcome from `qualification_path`, `qualification_reason`, college verification status, and next action—not college tier alone.
- Use an outcome panel with:
  - confirmation state;
  - handle/application summary;
  - current path;
  - why that path was assigned;
  - next step and expected date;
  - what happens if verification is missed;
  - return-home and support actions.
- Do not use celebratory confetti, giant check icons, or vague “You’re all set!” copy while next actions are unresolved.

---

## 6. Cross-screen consistency matrix

| System dimension | Home                                      | Registration at initial audit    | Required resolution                                       |
| ---------------- | ----------------------------------------- | -------------------------------- | --------------------------------------------------------- |
| Brand chrome     | Fixed navbar + footer                     | None                             | Shared registration header/shell                          |
| Content width    | `max-w-7xl` compositions                  | isolated `max-w-md`              | Intentional application grid with form and context widths |
| Primary text     | `text-ascent-ink`                         | often `text-white`               | One semantic text token                                   |
| Surfaces         | `Card`/`.glass-card`                      | controls directly on canvas      | Quiet form panel + semantic field surfaces                |
| Buttons          | typed `Button` primitive                  | raw classes on native buttons    | One button API with loading/full-width states             |
| Fields           | none in home                              | repeated raw utilities           | Shared accessible field system                            |
| Typography       | medium headings + mono metadata           | generic `text-2xl font-semibold` | Registration-specific type roles derived from same scale  |
| Motion           | purposeful benchmark + ambient flow       | none                             | Mostly static; subtle route/state transition only         |
| Feedback         | benchmark states                          | raw red paragraph                | Semantic notices and field errors                         |
| Progress         | narrative sections                        | invisible backend state          | Visible stage rail matching server state                  |
| CTA routing      | `#register`                               | `/register` exists               | Link public CTAs to `/register`                           |
| Voice            | technical performance + mountain metaphor | generic form instructions        | Plain, precise, technical, reassuring                     |

---

## 7. What “de-AI-slop” should mean for this project

### Keep

- Real benchmark behavior.
- Measured rather than fabricated performance claims.
- Mono typography for data/state, not for every paragraph.
- Near-black canvas, crisp hairline borders, and restrained blue signal color.
- Tight 8–10px engineered radii.
- Medium-weight headings rather than heavy display typography everywhere.
- One special performance accent with a strict semantic role.
- Honest attribution and conditional rendering of unconfirmed/time-sensitive content.

### Remove or reduce

- Repeated “eyebrow + headline + lede + three equal cards.”
- A Lucide icon on every concept.
- Decorative numbering that does not add navigation or sequence meaning.
- Repeating “climb,” “summit,” “route,” and “ascent” in every block.
- Placeholder links and invented-looking sitemap columns.
- Generic CTA cards with vague excitement copy.
- Unsupported prize, venue, date, or social-proof claims.
- Pills/chips used only to make empty areas look designed.
- More glow as a substitute for hierarchy.

### Do not introduce during the registration redesign

- WebGL or particle effects behind form controls.
- A gradient border around every field.
- Animated icons for every step.
- A huge illustration of a mountain or astronaut.
- Fake testimonials.
- Fake urgency/countdowns.
- A glass card nested inside another glass card for every form group.
- Excessive rounding (`rounded-2xl`/`rounded-full`) that conflicts with the engineered home language.
- Copy such as “Let’s embark on your journey,” “Unlock your potential,” or “You’re moments away from greatness.”

### Desired registration personality

The form should feel like a well-designed contest submission pipeline:

- calm;
- precise;
- technically literate;
- trustworthy with personal information;
- explicit about state and next actions;
- fast to scan;
- forgiving when something fails.

A restrained visual signature could be a mono stage rail resembling build stages—`identity / handle / profile / path`—but it should remain plain product UI, not turn the form into a fake terminal.

---

## 8. Recommended component and directory restructuring

Keep the existing route architecture. Add a shared presentation layer around it.

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── register/
│       ├── layout.tsx                 # shared registration shell
│       ├── page.tsx
│       ├── handle/page.tsx
│       ├── profile/page.tsx
│       └── path/page.tsx
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Footer.tsx
│   │   └── RegistrationHeader.tsx
│   ├── register/
│   │   ├── RegistrationShell.tsx
│   │   ├── RegistrationProgress.tsx
│   │   ├── SignInForm.tsx
│   │   ├── HandleForm.tsx
│   │   ├── ProfileForm.tsx
│   │   ├── CollegeCombobox.tsx
│   │   └── PathSummary.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── FormField.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── FileUpload.tsx
│       ├── Notice.tsx
│       └── Spinner.tsx
├── content/
│   ├── site.ts
│   ├── sections.ts
│   └── registration.ts                # trusted step/help/privacy copy
└── lib/
    ├── validators.ts
    └── ...
```

Do not create primitives only to wrap one static class string. Create them where they centralize behavior, accessibility, state, or a repeated visual contract.

---

## 9. Prioritized things to fix

## P0 — Fix before any visual polish

1. Change every real Register CTA from `#register` to `/register`.
2. Remove the self-link inside the `id="register"` CTA block.
3. Remove or repair all dead footer links and `#` social placeholders.
4. Clarify the actual event model: performance/codebase optimization versus conventional algorithmic divisions/relay.
5. Make the path screen branch on and explain actual qualification state, not just college tier.
6. Confirm dates and prize claims before presenting them as facts.

## P1 — Establish the system

1. Declare one active Ascent design document and mark conflicting documents as reference/history.
2. Refactor tokens into primitive, semantic, and component layers.
3. Add semantic feedback and form-control tokens.
4. Add shared registration layout/shell.
5. Extend the shared Button for loading, full-width, and technical/quiet actions.
6. Create accessible field, notice, select, and file-upload primitives.
7. Replace registration `text-white`, `border-white/10`, `text-red-400`, and `hover:bg-white/5` leaks.

## P2 — Rebuild registration experience

1. Add visible progress that matches server-gated route state.
2. Redesign sign-in states: default, provider loading, magic-link sent, magic-link verifying, error.
3. Add field-level validation and error focus management.
4. Rebuild college search as an accessible combobox with keyboard support and explicit async states.
5. Make profile fields conditional and structured by applicant status.
6. Improve phone metadata/formatting and explain use.
7. Replace the naked file input with an accessible styled uploader.
8. Add privacy and data-use copy where sensitive data is requested.
9. Build a structured path/outcome summary with next actions.

## P3 — De-template the home page

1. Reconcile all content with the chosen event proposition.
2. Replace either About or Tracks card grid with a more information-appropriate structure.
3. Reduce redundant icons/numbers and repeated mountain copy.
4. Simplify FAQ into a divided list and expand it with real registration blockers.
5. Reduce footer to real destinations.
6. Move all dates, prize details, and registration status into typed shared content.

## P4 — Accessibility, responsive, and visual QA

1. Test keyboard-only completion of every registration step.
2. Test screen-reader announcement of combobox results, field errors, notices, and route outcomes.
3. Verify 320px, 375px, 768px, 1024px, and wide desktop layouts.
4. Test browser autofill, passwordless-link return, popup blocked/closed, slow network, 429, duplicate handle, duplicate phone, bad PDF, oversized PDF, and server error.
5. Verify touch targets are at least 44px where practical.
6. Check text, field, disabled, and feedback contrast against the final token palette.
7. Verify reduced-motion behavior.
8. Run production build and existing tests after implementation.

---

## 10. Suggested implementation sequence

### Phase 1 — Truth and routing

- Decide the real contest format and confirm dates/prizes.
- Fix CTA destinations and dead links.
- Correct outcome-state logic and wording.
- Consolidate current design guidance.

### Phase 2 — Tokens and primitives

- Add semantic token roles without immediately rewriting every home component.
- Implement registration field/notice/loading primitives.
- Migrate existing Button/Card internals to the new roles while preserving their public API.

### Phase 3 — Registration shell

- Add `register/layout.tsx`.
- Add header, progress, content panel, contextual aside/help, and stable footer/support region.
- Validate responsive behavior before building all form detail.

### Phase 4 — Forms and states

- Sign in.
- Handle and college combobox.
- Profile and file upload.
- Outcome summary.
- Wire field errors and async states.

### Phase 5 — Home-content cleanup

- Rewrite contradictory sections.
- Vary block structures based on information type.
- remove redundant decoration and placeholders.

### Phase 6 — QA

- Visual regression across home and registration.
- Keyboard/screen-reader pass.
- Network/error-state pass.
- Production build and test suite.

---

## 11. Acceptance criteria for the redesign

The redesign is successful when:

- A visitor can move from any visible Register CTA into `/register`.
- Registration is visibly Ascent before the user reads the heading.
- Every registration route shares the same shell and communicates its stage.
- No registration component uses raw white/red/transparent-white values for core UI states.
- All fields have persistent labels, help/error associations, consistent focus treatment, and intentional loading/disabled states.
- College selection is fully keyboard accessible and communicates loading, empty, selected, unlisted, rate-limited, and failed states.
- The outcome page explains current path, reason, next action, and fallback behavior without ambiguity.
- Home and registration use the same typography, action hierarchy, surface hierarchy, radii, border treatment, and semantic color roles.
- Registration remains visually quieter than the home hero.
- The home page tells one coherent story about what the contest actually is.
- No placeholder navigation, unsupported fact, fake deadline, or self-referential CTA remains.
- The page does not rely on more gradients, more icons, or more animation to appear designed.

---

## 12. Final design direction in one paragraph

Keep the home page centered on the competition proposition, format, and next
action rather than an embedded technical demo. Treat registration as the
focused application mode of the same white, Ice `#EDF1F2`, Midnight
`#0D1822`, and Glacier `#14283A` system: crisp rules, restrained mono
metadata, plain-language guidance, excellent form states, and no gradients,
glow, glass, or runner gimmick. Motion is limited to the registration CTA's
identity-linked `TRACE` field: a quiet autonomous topology becomes an
immersive debugger probe under the pointer, pauses outside the viewport, keeps
touch non-interactive, and becomes static under reduced motion.
