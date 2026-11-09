import { Photo, PhotoLocation, PhotoSize } from "../types/photo";

export function parseTxtMetadata(content: string, fallbackId?: string): Photo {
  const lines = content.split(/\r?\n/);
  const raw: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    raw[key] = value;
  }

  const photoID = raw["photoID"] || fallbackId || "unknown";

  // Parse location
  let location: PhotoLocation | undefined;
  if (raw["location"] && raw["location"].includes(",")) {
    const [latStr, lonStr] = raw["location"].split(",");
    const lat = parseFloat(latStr.trim());
    const lon = parseFloat(lonStr.trim());
    if (!isNaN(lat) && !isNaN(lon)) {
      location = { latitude: lat, longitude: lon };
    }
  }

  // Parse size & aspect ratio
  let size: PhotoSize | undefined;
  if (raw["size"] && raw["size"].toLowerCase().includes("x")) {
    const [wStr, hStr] = raw["size"].toLowerCase().split("x");
    const width = parseInt(wStr.trim(), 10);
    const height = parseInt(hStr.trim(), 10);
    if (!isNaN(width) && !isNaN(height) && height > 0) {
      const aspectRatio = parseFloat((width / height).toFixed(3));
      let orientation: "horizontal" | "vertical" | "square" = "horizontal";
      if (width === height) orientation = "square";
      else if (height > width) orientation = "vertical";

      size = { width, height, aspectRatio, orientation };
    }
  }

  // Parse categories & keywords
  const categories = raw["category"]
    ? raw["category"]
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  const keywords = raw["keyword"]
    ? raw["keyword"]
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : [];

  // Parse chronology
  const year = parseInt(raw["year"] || "0", 10);
  const month = parseInt(raw["month"] || "1", 10);
  const day = parseInt(raw["day"] || "1", 10);
  const hour = raw["hour"] ? parseInt(raw["hour"], 10) : undefined;
  const minute = raw["minute"] ? parseInt(raw["minute"], 10) : undefined;
  const second = raw["second"] ? parseInt(raw["second"], 10) : undefined;

  let iso: string | undefined;
  if (year > 0) {
    try {
      const d = new Date(
        year,
        Math.max(0, month - 1),
        day,
        hour || 0,
        minute || 0,
        second || 0
      );
      iso = d.toISOString();
    } catch {
      // ignore invalid dates
    }
  }

  // Construct Photo object
  return {
    photoID,
    title: raw["title"] || photoID,
    description: raw["description"] || "",
    availability: raw["availability"] || "Available for Order",

    categories,
    keywords,

    dateTaken: {
      year,
      month,
      day,
      hour,
      minute,
      second,
      iso,
    },
    createdTimestamp: raw["created"],

    film: raw["film"] || "Digital",
    camera: raw["camera"] || "Unknown Camera",
    lens: raw["lens"] || "",
    focalLength: raw["focalLength"] || "",
    shutterspeed: raw["shutterspeed"] || "",
    aperture: raw["aperture"] || "",
    sensitivity: raw["sensitivity"] || "",
    exposureCompensation: raw["exposureCompensation"] || "",
    whiteBalance: raw["whiteBalance"] || "",
    toneCompensation: raw["toneCompensation"] || "",
    hueAdjustment: raw["hueAdjustment"] ? parseInt(raw["hueAdjustment"], 10) : 0,
    tripod: raw["tripod"],

    location,
    size,

    // Default paths based on standard structure
    imageDesktop: `/photos/${year > 0 ? year : "general"}/${photoID}_desktop.jpg`,
    rawFields: raw,
  };
}
