import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Sequence.io palette */
        primary: "#025864",         // dark teal
        "primary-hover": "#014750",
        "primary-soft": "#E6F0F2",
        "primary-tint": "#F4F9FA",
        accent: "#00D47E",          // sequence green
        "accent-hover": "#00B86B",
        "accent-soft": "rgba(0, 212, 126, 0.10)",
        "accent-tint": "#E6FBF2",
        danger: "#E5484D",
        "danger-hover": "#CC3B40",
        "danger-soft": "rgba(229, 72, 77, 0.08)",
        /* Neutrals */
        ink: "#0A1519",             // near black with teal undertone
        "ink-light": "#1F2D31",
        "card-border": "#E6EAEB",
        "card-border-hover": "#CFD7D9",
        surface: "#FFFFFF",
        "surface-hover": "#FAFBFB",
        muted: "#F2F5F5",
        "muted-2": "#E9EEEE",
        "text-primary": "#0A1519",
        "text-secondary": "#4A5B60",
        "text-tertiary": "#7A8B90",
      },
      fontFamily: {
        sans: [
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      fontSize: {
        "display": ["2.75rem", { lineHeight: "1.05", letterSpacing: "-0.035em", fontWeight: "500" }],
        "heading": ["1.75rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "500" }],
        "title": ["1.125rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "500" }],
      },
      boxShadow: {
        "soft": "0 1px 2px rgba(10, 21, 25, 0.04), 0 1px 1px rgba(10, 21, 25, 0.02)",
        "lift": "0 4px 16px rgba(10, 21, 25, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
