export interface SocialLink {
  name: string;
  url: string;
}

export interface SiteSettings {
  themeAccent: string; // e.g. "#f59e0b"
  themeAccentLight: string; // e.g. "#fbbf24"
  themeAccentDark: string; // e.g. "#d97706"
  themeBackground: string; // e.g. "#000000"
  themeSurface: string; // e.g. "#111111"
  themeBorder: string; // e.g. "#262626"
  themeTextMode?: "auto" | "light" | "dark"; // auto (dynamic by background), light (dark text), dark (light text)
  defaultSortOrder: "date-desc" | "date-asc" | "created-desc" | "title-asc";
  defaultGalleryView?: "large" | "compact"; // "large" (Exhibition 2-column) vs "compact" (Justified grid)
  slideshowInterval: number; // in seconds (e.g. 10)
  siteTitle: string;
  siteTagline: string;
  artistName: string;
  aboutTitle?: string;
  aboutSubheading?: string;
  artistBio?: string;
  contactEmail?: string;
  socialLinks?: SocialLink[];
  /** @deprecated Legacy fallback; migrated automatically into `socialLinks`. */
  instagramHandle?: string;
  /** @deprecated Legacy fallback; migrated automatically into `socialLinks`. */
  instagramUrl?: string;
  gearList?: string[];
  supportGearList?: string[];
  copyrightText?: string;
  copyrightOverlay?: string;
  showWatermarkOverlay?: boolean;
  googleAnalyticsId?: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  accent: string;
  light: string;
  dark: string;
  description?: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "amber",
    name: "Amber Gold (Signature)",
    accent: "#f59e0b",
    light: "#fbbf24",
    dark: "#d97706",
  },
  {
    id: "dark-slate",
    name: "Monochrome / Dark Slate",
    accent: "#0f172a",
    light: "#334155",
    dark: "#020617",
    description: "Ideal for light themes",
  },
  {
    id: "charcoal",
    name: "Charcoal / Pitch Black",
    accent: "#18181b",
    light: "#3f3f46",
    dark: "#000000",
    description: "High contrast dark",
  },
  {
    id: "monochrome",
    name: "Monochrome / Pure Silver",
    accent: "#e2e8f0",
    light: "#ffffff",
    dark: "#94a3b8",
    description: "Ideal for dark themes",
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

export interface BackgroundPreset {
  id: string;
  name: string;
  background: string;
  surface: string;
  border: string;
  isLight?: boolean;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  // Dark Exhibition Presets
  {
    id: "oled-black",
    name: "Pure OLED Black (Default)",
    background: "#000000",
    surface: "#111111",
    border: "#262626",
    isLight: false,
  },
  {
    id: "deep-obsidian",
    name: "Deep Obsidian",
    background: "#08080a",
    surface: "#131317",
    border: "#24242c",
    isLight: false,
  },
  {
    id: "midnight-slate",
    name: "Midnight Slate",
    background: "#0a0e17",
    surface: "#111827",
    border: "#1f293d",
    isLight: false,
  },
  {
    id: "warm-espresso",
    name: "Warm Espresso",
    background: "#100d0c",
    surface: "#1a1614",
    border: "#2d2420",
    isLight: false,
  },
  {
    id: "charcoal",
    name: "Charcoal Neutral",
    background: "#141414",
    surface: "#1e1e1e",
    border: "#2e2e2e",
    isLight: false,
  },
  // Light Exhibition Presets
  {
    id: "studio-white",
    name: "Clean Studio White",
    background: "#ffffff",
    surface: "#f8fafc",
    border: "#cbd5e1",
    isLight: true,
  },
  {
    id: "gallery-parchment",
    name: "Warm Gallery Parchment",
    background: "#f9f8f5",
    surface: "#ffffff",
    border: "#d1cec7",
    isLight: true,
  },
  {
    id: "soft-silver",
    name: "Soft Silver / Slate",
    background: "#f1f5f9",
    surface: "#ffffff",
    border: "#94a3b8",
    isLight: true,
  },
];

export const DEFAULT_SETTINGS: SiteSettings = {
  themeAccent: "#f59e0b",
  themeAccentLight: "#fbbf24",
  themeAccentDark: "#d97706",
  themeBackground: "#000000",
  themeSurface: "#111111",
  themeBorder: "#262626",
  themeTextMode: "auto",
  defaultSortOrder: "date-desc",
  defaultGalleryView: "large",
  slideshowInterval: 10,
  siteTitle: "Fine Art Photography",
  siteTagline: "Landscape, Nature, and Fine Art Photography",
  artistName: "Photographer",
  aboutTitle: "About the Artist",
  aboutSubheading: "Landscape and Nature Photography",
  artistBio: "Welcome to my photography portfolio. This exhibition showcases fine art photography exploring the quiet grandeur, intricate details, and atmospheric light of the natural world.\n\nThank you for visiting. Please explore the galleries, and check back regularly as new photographic work and collections are added.",
  contactEmail: "",
  socialLinks: [],
  instagramHandle: "",
  instagramUrl: "",
  gearList: [],
  supportGearList: [],
  copyrightText: "",
  copyrightOverlay: "© Photographer",
  showWatermarkOverlay: false,
  googleAnalyticsId: "",
};

export function isLightBackground(hex?: string): boolean {
  if (!hex) return false;
  const clean = hex.replace("#", "").trim();
  const num = parseInt(clean, 16);
  if (isNaN(num)) return false;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  // Perceived brightness formula (sRGB standard)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140;
}

export function isLightModeActive(settings: SiteSettings): boolean {
  if (settings.themeTextMode === "light") return true;
  if (settings.themeTextMode === "dark") return false;
  return isLightBackground(settings.themeBackground || "#000000");
}

/**
 * Validates and normalizes an external link URL so only safe schemes
 * (`http:`, `https:`, `mailto:`) are accepted. Returns an empty string if invalid.
 */
export function sanitizeExternalUrl(rawUrl?: string): string {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:" ||
      parsed.protocol === "mailto:"
    ) {
      return trimmed;
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * Normalizes a list of SocialLink entries, dropping invalid/empty URLs and trimming whitespace.
 */
export function sanitizeSocialLinks(links: unknown): SocialLink[] {
  if (!Array.isArray(links)) return [];
  const result: SocialLink[] = [];
  for (const item of links) {
    if (!item || typeof item !== "object") continue;
    const rawName = (item as { name?: unknown }).name;
    const rawUrl = (item as { url?: unknown }).url;
    const url = sanitizeExternalUrl(typeof rawUrl === "string" ? rawUrl : "");
    if (!url) continue;
    const name = typeof rawName === "string" ? rawName.trim() : "";
    result.push({ name, url });
  }
  return result;
}

/**
 * Builds a fallback SocialLink list from legacy instagramHandle / instagramUrl fields.
 */
export function migrateLegacyInstagramLink(
  instagramHandle?: string,
  instagramUrl?: string
): SocialLink[] {
  const handle = typeof instagramHandle === "string" ? instagramHandle.trim() : "";
  const rawUrl =
    (typeof instagramUrl === "string" && instagramUrl.trim()) ||
    (handle ? `https://www.instagram.com/${handle.replace(/^@/, "")}/` : "");
  const url = sanitizeExternalUrl(rawUrl);
  if (!url) return [];
  return [
    {
      name: handle ? `Instagram (${handle})` : "Instagram",
      url,
    },
  ];
}

/**
 * Returns the resolved, sanitized list of external links for display,
 * falling back to legacy instagram fields if `socialLinks` has not been set.
 */
export function getResolvedSocialLinks(settings: SiteSettings): SocialLink[] {
  if (Array.isArray(settings.socialLinks)) {
    return sanitizeSocialLinks(settings.socialLinks);
  }
  return migrateLegacyInstagramLink(settings.instagramHandle, settings.instagramUrl);
}
