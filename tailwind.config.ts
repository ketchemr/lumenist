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
        background: "#000000",
        foreground: "#f5f5f5",
        accent: {
          DEFAULT: "rgb(var(--accent-rgb, 245 158 11) / <alpha-value>)",
          light: "rgb(var(--accent-light-rgb, 251 191 36) / <alpha-value>)",
          dark: "rgb(var(--accent-dark-rgb, 217 119 6) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "#111111",
          hover: "#1a1a1a",
          border: "#262626",
        },
        muted: "#888888",
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
