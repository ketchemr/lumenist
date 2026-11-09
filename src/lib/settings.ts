import fs from "fs";
import path from "path";
import { SiteSettings, DEFAULT_SETTINGS, THEME_PRESETS } from "@/types/settings";

export type { SiteSettings };
export { DEFAULT_SETTINGS, THEME_PRESETS };

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
  const accentRgb = hexToRgb(settings.themeAccent);
  const lightRgb = hexToRgb(settings.themeAccentLight);
  const darkRgb = hexToRgb(settings.themeAccentDark);

  return `
    :root {
      --accent: ${settings.themeAccent};
      --accent-rgb: ${accentRgb};
      --accent-light: ${settings.themeAccentLight};
      --accent-light-rgb: ${lightRgb};
      --accent-dark: ${settings.themeAccentDark};
      --accent-dark-rgb: ${darkRgb};
    }
  `.trim();
}
