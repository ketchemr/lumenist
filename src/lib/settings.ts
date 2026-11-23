import fs from "fs";
import path from "path";
import {
  SiteSettings,
  SocialLink,
  DEFAULT_SETTINGS,
  THEME_PRESETS,
  ThemePreset,
  BACKGROUND_PRESETS,
  BackgroundPreset,
  isLightBackground,
  isLightModeActive,
  migrateLegacyInstagramLink,
  sanitizeSocialLinks,
} from "@/types/settings";

export type { SiteSettings, SocialLink, BackgroundPreset, ThemePreset };
export {
  DEFAULT_SETTINGS,
  THEME_PRESETS,
  BACKGROUND_PRESETS,
  isLightBackground,
  isLightModeActive,
};

let cachedSettings: SiteSettings | null = null;
let lastMtime = 0;

function getSettingsFilePath(): string {
  return path.join(process.cwd(), "data", "settings.json");
}

export function getSettings(): SiteSettings {
  const filePath = getSettingsFilePath();

  try {
    if (!fs.existsSync(filePath)) {
      const dataDir = path.dirname(filePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
      cachedSettings = { ...DEFAULT_SETTINGS };
      return cachedSettings;
    }

    const stats = fs.statSync(filePath);
    if (cachedSettings && stats.mtimeMs === lastMtime) {
      return cachedSettings;
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const result: SiteSettings = { ...DEFAULT_SETTINGS, ...parsed };
    if (Array.isArray(parsed.socialLinks)) {
      result.socialLinks = sanitizeSocialLinks(parsed.socialLinks);
    } else {
      result.socialLinks = migrateLegacyInstagramLink(
        parsed.instagramHandle,
        parsed.instagramUrl
      );
    }
    cachedSettings = result;
    lastMtime = stats.mtimeMs;
    return result;
  } catch (err) {
    console.error("Failed to read settings.json:", err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(updates: Partial<SiteSettings>): SiteSettings {
  const filePath = getSettingsFilePath();
  const current = getSettings();
  const normalizedUpdates: Partial<SiteSettings> = { ...updates };
  if ("socialLinks" in normalizedUpdates) {
    normalizedUpdates.socialLinks = sanitizeSocialLinks(normalizedUpdates.socialLinks);
    // Clear legacy Instagram fields once generic socialLinks are explicitly saved
    normalizedUpdates.instagramHandle = "";
    normalizedUpdates.instagramUrl = "";
  }
  const updated: SiteSettings = {
    ...current,
    ...normalizedUpdates,
  };

  const dataDir = path.dirname(filePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), "utf-8");
  cachedSettings = updated;
  try {
    lastMtime = fs.statSync(filePath).mtimeMs;
  } catch {
    lastMtime = Date.now();
  }

  return updated;
}

export function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "").trim();
  const num = parseInt(clean, 16);
  if (isNaN(num)) return "245 158 11"; // fallback amber
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r} ${g} ${b}`;
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function sanitizeHexColor(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : fallback;
}

export function getThemeCssVariables(settings: SiteSettings): string {
  const bg = sanitizeHexColor(settings.themeBackground, "#000000");
  const bgRgb = hexToRgb(bg);

  const isLight = isLightModeActive(settings);

  // Dynamic surface & border with smart light/dark adaptation
  let surface = sanitizeHexColor(settings.themeSurface, isLight ? "#ffffff" : "#111111");
  let border = sanitizeHexColor(settings.themeBorder, isLight ? "#cbd5e1" : "#262626");

  if (isLight) {
    if (!surface || !isLightBackground(surface)) {
      surface = "#ffffff";
    }
    if (!border || !isLightBackground(border) || border.toLowerCase() === "#e2e8f0") {
      border = "#cbd5e1";
    }
  } else {
    if (!surface || isLightBackground(surface)) {
      surface = "#111111";
    }
    if (!border || isLightBackground(border)) {
      border = "#262626";
    }
  }

  // Accent color contrast adaptation (e.g. silver on white becomes rich slate, pitch black on OLED black becomes silver)
  let accent = sanitizeHexColor(settings.themeAccent, DEFAULT_SETTINGS.themeAccent);
  let accentLight = sanitizeHexColor(settings.themeAccentLight, DEFAULT_SETTINGS.themeAccentLight);
  let accentDark = sanitizeHexColor(settings.themeAccentDark, DEFAULT_SETTINGS.themeAccentDark);

  if (isLight) {
    const cleanAccent = accent.replace("#", "").trim();
    const num = parseInt(cleanAccent, 16);
    if (!isNaN(num)) {
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      if (brightness > 205) {
        accent = "#0f172a";
        accentLight = "#334155";
        accentDark = "#000000";
      }
    }
  } else {
    const cleanAccent = accent.replace("#", "").trim();
    const num = parseInt(cleanAccent, 16);
    if (!isNaN(num)) {
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      if (brightness < 45) {
        accent = "#e2e8f0";
        accentLight = "#ffffff";
        accentDark = "#94a3b8";
      }
    }
  }

  // Calculate contrast text color for buttons using accent
  const accentIsLight = isLightBackground(accent);
  const accentContrast = accentIsLight ? "#0f172a" : "#ffffff";

  const accentRgb = hexToRgb(accent);
  const lightRgb = hexToRgb(accentLight);
  const darkRgb = hexToRgb(accentDark);

  const surfaceHover = isLight ? "#f1f5f9" : "#1a1a1a";
  const foreground = isLight ? "#0f172a" : "#f8fafc";
  const foregroundRgb = hexToRgb(foreground);
  const textMuted = isLight ? "#64748b" : "#94a3b8";

  return `
    :root {
      --background: ${bg};
      --background-rgb: ${bgRgb};
      --surface: ${surface};
      --surface-hover: ${surfaceHover};
      --surface-border: ${border};
      --foreground: ${foreground};
      --foreground-rgb: ${foregroundRgb};
      --text-muted: ${textMuted};
      --accent: ${accent};
      --accent-rgb: ${accentRgb};
      --accent-light: ${accentLight};
      --accent-light-rgb: ${lightRgb};
      --accent-dark: ${accentDark};
      --accent-dark-rgb: ${darkRgb};
      --accent-contrast: ${accentContrast};
      color-scheme: ${isLight ? "light" : "dark"};
    }
  `.trim();
}
