export interface SiteSettings {
  themeAccent: string; // e.g. "#f59e0b"
  themeAccentLight: string; // e.g. "#fbbf24"
  themeAccentDark: string; // e.g. "#d97706"
  defaultSortOrder: "date-desc" | "date-asc" | "created-desc" | "title-asc";
  slideshowInterval: number; // in seconds (e.g. 10)
  siteTitle: string;
  siteTagline: string;
  artistName: string;
}

export const THEME_PRESETS = [
  {
    id: "amber",
    name: "Amber Gold (Signature)",
    accent: "#f59e0b",
    light: "#fbbf24",
    dark: "#d97706",
  },
  {
    id: "monochrome",
    name: "Monochrome / Pure Silver",
    accent: "#e2e8f0",
    light: "#ffffff",
    dark: "#94a3b8",
  },
  {
    id: "cyan",
    name: "Pacific Cyan / Ocean",
    accent: "#06b6d4",
    light: "#22d3ee",
    dark: "#0891b2",
  },
  {
    id: "emerald",
    name: "Cascade Emerald",
    accent: "#10b981",
    light: "#34d399",
    dark: "#059669",
  },
  {
    id: "crimson",
    name: "Alpine Crimson / Sunset",
    accent: "#f43f5e",
    light: "#fb7185",
    dark: "#e11d48",
  },
  {
    id: "violet",
    name: "Amethyst / Violet",
    accent: "#8b5cf6",
    light: "#a78bfa",
    dark: "#7c3aed",
  },
];

export const DEFAULT_SETTINGS: SiteSettings = {
  themeAccent: "#f59e0b",
  themeAccentLight: "#fbbf24",
  themeAccentDark: "#d97706",
  defaultSortOrder: "date-desc",
  slideshowInterval: 10,
  siteTitle: "Randal R. Ketchem Photography",
  siteTagline: "Fine Art Landscape, Nature, and Pacific Northwest Photography",
  artistName: "Randal R. Ketchem",
};
