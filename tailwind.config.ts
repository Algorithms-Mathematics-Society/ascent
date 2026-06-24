import type { Config } from "tailwindcss";

/**
 * AMS Ascent — blue-forward design system.
 * Tokens are CSS custom properties holding space-separated RGB triples,
 * consumed here with `<alpha-value>` so `bg-ascent-accent/40` etc. work.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ascent: {
          bg: "rgb(var(--ascent-bg) / <alpha-value>)",
          surface: "rgb(var(--ascent-surface) / <alpha-value>)",
          border: "rgb(var(--ascent-border) / <alpha-value>)",
          panel: "rgb(var(--ascent-panel) / <alpha-value>)",
          accent: "rgb(var(--ascent-accent) / <alpha-value>)",
          "blue-deep": "rgb(var(--ascent-blue-deep) / <alpha-value>)",
          cyan: "rgb(var(--ascent-cyan) / <alpha-value>)",
          ink: "rgb(var(--ascent-ink) / <alpha-value>)",
          muted: "rgb(var(--ascent-muted) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: [
          "var(--font-jetbrains)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      transitionTimingFunction: {
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        ascentGlow: {
          "0%, 100%": { opacity: "0.7", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" },
        },
      },
      animation: {
        glow: "ascentGlow 8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
