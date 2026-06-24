# Task 1 Report — Project scaffold + blue design system

**Status:** DONE
**Branch:** `ascent-home`
**Build:** PASS (no TypeScript / lint-blocking errors), single route `/`.

## Files created
- `package.json` — name `ams-ascent`; scripts dev/build/start/lint. Deps & devDeps per Global Constraint 1 only (next `14.2.5`, react/react-dom 18, tailwindcss 3.4, @fontsource/geist-sans, @fontsource/jetbrains-mono, lucide-react, clsx, tailwind-merge; dev: typescript, @types/*, postcss, autoprefixer, eslint, eslint-config-next).
- `next.config.mjs` — minimal, `reactStrictMode: true`.
- `tsconfig.json` — standard Next strict TS, `@/*` → `./src/*`.
- `next-env.d.ts`
- `postcss.config.js` — tailwindcss + autoprefixer.
- `.eslintrc.json` — `next/core-web-vitals`.
- `.gitignore` — ignores `node_modules`, `.next/` (+ out/build, env, tsbuildinfo, next-env.d.ts).
- `tailwind.config.ts` — content `./src/**/*.{ts,tsx}`; `ascent.*` color tokens; sans/mono font families; ambient keyframes + animations.
- `src/app/globals.css` — token block, base resets, component layer, hero grid/glow utilities, reduced-motion block.
- `src/app/layout.tsx` — fontsource imports, font CSS vars, metadata, themed body.
- `src/app/page.tsx` — TEMPORARY placeholder `<main>AMS Ascent</main>` (Task 3 replaces).

## Design-system interfaces (Task 2 / Task 3 depend on these)

### Color tokens — `:root` CSS vars (space-separated RGB triples)
| CSS var | Value | Hex / note |
|---|---|---|
| `--ascent-bg` | `6 9 16` | #060910 canvas |
| `--ascent-panel` | `12 16 26` | cards/panels |
| `--ascent-accent` | `59 130 246` | #3B82F6 primary blue |
| `--ascent-blue-deep` | `37 99 235` | #2563EB gradient partner |
| `--ascent-cyan` | `34 211 238` | #22D3EE secondary cyan |
| `--ascent-ink` | `255 255 255` | body text |
| `--ascent-muted` | `148 163 184` | slate-400 muted |

### Tailwind color utilities (namespace `ascent.*`, all support `<alpha-value>`)
`ascent-bg`, `ascent-panel`, `ascent-accent`, `ascent-blue-deep`, `ascent-cyan`, `ascent-ink`, `ascent-muted`
→ e.g. `bg-ascent-bg`, `text-ascent-muted`, `bg-ascent-accent/40`, `border-ascent-cyan/20`.

### Fonts
- `fontFamily.sans` = `var(--font-geist)` (Geist Sans 400–700) → class `font-sans`.
- `fontFamily.mono` = `var(--font-jetbrains)` (JetBrains Mono 400–700) → class `font-mono`.
- CSS vars `--font-geist` / `--font-jetbrains` set on `<html>` in `layout.tsx`.

### Animations / keyframes (tailwind.config.ts)
- `animate-grid-drift` (keyframe `ascentGridDrift`, 36s linear) — slow grid translate via `transform`.
- `animate-glow` (keyframe `ascentGlow`, 8s ease-in-out) — breathing scale/opacity.
- Easing helper: `ease-expo` = `cubic-bezier(0.16, 1, 0.3, 1)`.

### Component / utility classes (globals.css)
- `.ascent-btn` — base button: inline-flex, min-h 2.5rem, **8px radius** (`0.5rem`), 600 weight, 160ms ease transitions, blue focus ring (`2px solid rgb(var(--ascent-accent)/0.45)`, offset 2px), disabled state.
  - Sizes: `.ascent-btn-sm` (2rem), `.ascent-btn-md` (2.75rem), `.ascent-btn-lg` (3rem).
  - `.ascent-btn-primary` — blue gradient (`linear-gradient(135deg, accent → blue-deep)`), inner top highlight, blue glow shadow, hover lift.
  - `.ascent-btn-secondary` — glass (translucent white bg, backdrop-blur, 1px border, hover tints accent).
  - Usage: `<a class="ascent-btn ascent-btn-primary ascent-btn-sm">`.
- `.glass-card` — 16px radius, translucent panel bg, top-light gradient, 1px white/8% border, blur(12px), layered shadow, `contain: paint`. Hover: accent border tint, `translateY(-1px)`, blue glow.
- `.ascent-grid` — absolute faint blue 56px grid, radial mask fade, drifts (`ascentGridDrift`). For hero bg.
- `.ascent-glow` — absolute radial blue glow, blur(60px), breathes (`ascentGlow`). For hero bg.
- `::selection` — accent at 35% alpha. Global `:focus-visible` — blue accent ring.

### Reduced motion
`@media (prefers-reduced-motion: reduce)` disables all animations/transitions and explicitly kills `.ascent-grid` / `.ascent-glow`. Any new animation in Task 2/3 must be safe under this block (it already nukes `animation` globally).

## Build evidence
Command: `npm run build`

```
  ▲ Next.js 14.2.5
 ✓ Compiled successfully
   Linting and checking validity of types ...
 ✓ Generating static pages (4/4)

Route (app)                              Size     First Load JS
┌ ○ /                                    137 B          87.2 kB
└ ○ /_not-found                          871 B          87.9 kB
+ First Load JS shared by all            87 kB

○  (Static)  prerendered as static content
```

## Concerns
- `npm install` reports 8 audit vulnerabilities and a deprecation warning for `next@14.2.5` (a known security advisory). The stack is pinned to next@14.2.x by Global Constraint 1, so I held the pin rather than upgrade. If the team wants, bump to the latest 14.2.x patch later — out of scope for Task 1.
- Font CSS vars are set to the literal fontsource family names (`'Geist Sans'`, `'JetBrains Mono'`) on `<html>`, so `font-sans`/`font-mono` resolve correctly. No `next/font` used (kept to @fontsource per spec).
