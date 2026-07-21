import type { Config } from "tailwindcss";

/** Ascent light access-portal tokens, rooted in Glacier, Ice, and Midnight. */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ascent: {
          canvas: "rgb(var(--ascent-canvas) / <alpha-value>)",
          bg: "rgb(var(--ascent-canvas) / <alpha-value>)",
          surface: "rgb(var(--ascent-surface) / <alpha-value>)",
          "surface-subtle":
            "rgb(var(--ascent-surface-subtle) / <alpha-value>)",
          "surface-strong":
            "rgb(var(--ascent-surface-strong) / <alpha-value>)",
          border: "rgb(var(--ascent-border) / <alpha-value>)",
          "border-strong":
            "rgb(var(--ascent-border-strong) / <alpha-value>)",
          ink: "rgb(var(--ascent-ink) / <alpha-value>)",
          muted: "rgb(var(--ascent-muted) / <alpha-value>)",
          gold: "rgb(var(--ascent-gold) / <alpha-value>)",
          brand: "rgb(var(--ascent-brand) / <alpha-value>)",
          "brand-hover":
            "rgb(var(--ascent-brand-hover) / <alpha-value>)",
          "brand-pressed":
            "rgb(var(--ascent-brand-pressed) / <alpha-value>)",
          "brand-tint":
            "rgb(var(--ascent-brand-tint) / <alpha-value>)",
          "brand-tint-strong":
            "rgb(var(--ascent-brand-tint-strong) / <alpha-value>)",
          "on-brand": "rgb(var(--ascent-on-brand) / <alpha-value>)",
          focus: "rgb(var(--ascent-focus) / <alpha-value>)",
          field: {
            bg: "rgb(var(--ascent-field-bg) / <alpha-value>)",
            border: "rgb(var(--ascent-field-border) / <alpha-value>)",
            "border-hover":
              "rgb(var(--ascent-field-border-hover) / <alpha-value>)",
            focus: "rgb(var(--ascent-field-focus) / <alpha-value>)",
            invalid: "rgb(var(--ascent-field-invalid) / <alpha-value>)",
            disabled: "rgb(var(--ascent-field-disabled) / <alpha-value>)",
            placeholder:
              "rgb(var(--ascent-field-placeholder) / <alpha-value>)",
          },
          danger: "rgb(var(--ascent-danger) / <alpha-value>)",
          "danger-tint":
            "rgb(var(--ascent-danger-tint) / <alpha-value>)",
          success: "rgb(var(--ascent-success) / <alpha-value>)",
          "success-tint":
            "rgb(var(--ascent-success-tint) / <alpha-value>)",
          info: "rgb(var(--ascent-info) / <alpha-value>)",
          "info-tint": "rgb(var(--ascent-info-tint) / <alpha-value>)",

          /* Compatibility aliases removed as components migrate in Blocks 3–5. */
          panel: "rgb(var(--ascent-surface) / <alpha-value>)",
          accent: "rgb(var(--ascent-brand) / <alpha-value>)",
          "accent-bright": "rgb(var(--ascent-brand) / <alpha-value>)",
          "blue-deep": "rgb(var(--ascent-brand-hover) / <alpha-value>)",
          cyan: "rgb(var(--ascent-brand) / <alpha-value>)",
          hot: "rgb(var(--ascent-brand) / <alpha-value>)",
          "hot-bright": "rgb(var(--ascent-brand-hover) / <alpha-value>)",
          "btn-primary": "rgb(var(--ascent-brand) / <alpha-value>)",
          "btn-primary-hover":
            "rgb(var(--ascent-brand-hover) / <alpha-value>)",
          "form-panel": "rgb(var(--ascent-surface) / <alpha-value>)",
          "form-panel-border":
            "rgb(var(--ascent-border) / <alpha-value>)",
          "progress-track":
            "rgb(var(--ascent-border) / <alpha-value>)",
          "progress-current":
            "rgb(var(--ascent-brand) / <alpha-value>)",
          "progress-complete":
            "rgb(var(--ascent-brand) / <alpha-value>)",
          register: {
            canvas: "rgb(var(--ascent-canvas) / <alpha-value>)",
            panel: "rgb(var(--ascent-surface) / <alpha-value>)",
            "panel-border": "rgb(var(--ascent-border) / <alpha-value>)",
            blue: "rgb(var(--ascent-brand-tint) / <alpha-value>)",
            "blue-strong":
              "rgb(var(--ascent-brand-tint-strong) / <alpha-value>)",
            "blue-border":
              "rgb(var(--ascent-border-strong) / <alpha-value>)",
            mint: "rgb(var(--ascent-success-tint) / <alpha-value>)",
            "mint-border": "rgb(var(--ascent-success) / <alpha-value>)",
            lilac: "rgb(var(--ascent-surface-subtle) / <alpha-value>)",
            "lilac-border":
              "rgb(var(--ascent-border-strong) / <alpha-value>)",
          },
        },
      },
      fontFamily: {
        display: ["var(--font-eb-garamond)", "Georgia", "serif"],
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
    },
  },
  plugins: [],
};

export default config;
