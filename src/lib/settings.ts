import fs from "fs";
import path from "path";
import {
  SiteSettings,
  DEFAULT_SETTINGS,
  THEME_PRESETS,
  BACKGROUND_PRESETS,
  BackgroundPreset,
  isLightBackground,
  isLightModeActive,
} from "@/types/settings";

export type { SiteSettings, BackgroundPreset };
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
  const updated: SiteSettings = {
    ...current,
    ...updates,
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

export function getThemeCssVariables(settings: SiteSettings): string {
  const bg = settings.themeBackground || "#000000";
  const bgRgb = hexToRgb(bg);

  const isLight = isLightModeActive(settings);

  // Dynamic surface & border with smart light/dark adaptation
  let surface = settings.themeSurface;
  let border = settings.themeBorder;

  if (isLight) {
    if (!surface || !isLightBackground(surface)) {
      surface = "#ffffff";
    }
    if (!border || !isLightBackground(border)) {
      border = "#e2e8f0";
    }
  } else {
    if (!surface || isLightBackground(surface)) {
      surface = "#111111";
    }
    if (!border || isLightBackground(border)) {
      border = "#262626";
    }
  }

  // Accent color contrast adaptation (e.g. silver on white becomes rich slate)
  let accent = settings.themeAccent;
  let accentLight = settings.themeAccentLight;
  let accentDark = settings.themeAccentDark;

  if (isLight && isLightBackground(accent)) {
    accent = "#0f172a";
    accentLight = "#334155";
    accentDark = "#000000";
  }

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
      color-scheme: ${isLight ? "light" : "dark"};
    }
  `.trim();
}
