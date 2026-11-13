import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background-rgb, 0 0 0) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb, 248 250 252) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent-rgb, 245 158 11) / <alpha-value>)",
          light: "rgb(var(--accent-light-rgb, 251 191 36) / <alpha-value>)",
          dark: "rgb(var(--accent-dark-rgb, 217 119 6) / <alpha-value>)",
          contrast: "var(--accent-contrast, #ffffff)",
        },
        surface: {
          DEFAULT: "var(--surface, #111111)",
          hover: "var(--surface-hover, #1a1a1a)",
          border: "var(--surface-border, #262626)",
        },
        muted: "var(--text-muted, #94a3b8)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
