import fs from "fs";
import { Photo, PhotoLocation, PhotoSize } from "../types/photo";

// Extract real image dimensions from JPEG SOF marker
export function getJpegDimensions(filePath: string): { width: number; height: number } | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(65536);
    fs.readSync(fd, buffer, 0, 65536, 0);
    fs.closeSync(fd);

    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) {
          return { width, height };
        }
      }
      const length = buffer.readUInt16BE(offset + 2);
      offset += 2 + length;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseTxtMetadata(content: string, fallbackId?: string, imageFilePath?: string): Photo {
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

  // The filename (fallbackId) is the canonical identifier for the file on disk.
  // If the .txt file contains an outdated or copied photoID, prefer fallbackId.
  const photoID = fallbackId || raw["photoID"] || "unknown";

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
      // Sanity check: normal photos and wide panoramas are within 0.25 to 4.5
      if (aspectRatio >= 0.25 && aspectRatio <= 4.5) {
        let orientation: "horizontal" | "vertical" | "square" = "horizontal";
        if (width === height) orientation = "square";
        else if (height > width) orientation = "vertical";

        size = { width, height, aspectRatio, orientation };
      }
    }
  }

  // Fallback: probe actual JPEG dimensions if size is missing or invalid
  if (!size && imageFilePath && fs.existsSync(imageFilePath)) {
    const dims = getJpegDimensions(imageFilePath);
    if (dims) {
      const aspectRatio = parseFloat((dims.width / dims.height).toFixed(3));
      let orientation: "horizontal" | "vertical" | "square" = "horizontal";
      if (dims.width === dims.height) orientation = "square";
      else if (dims.height > dims.width) orientation = "vertical";

      size = { width: dims.width, height: dims.height, aspectRatio, orientation };
    }
  }

  // Parse categories & keywords (supports 'albums', 'album', 'category', 'categories')
  const rawCategories = raw["albums"] || raw["album"] || raw["category"] || raw["categories"];
  const categories = rawCategories
    ? rawCategories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : [];

  // Parse tags & keywords (supports 'tags', 'tag', 'keyword', 'keywords')
  const rawKeywords = raw["tags"] || raw["tag"] || raw["keyword"] || raw["keywords"];
  const keywords = rawKeywords
    ? rawKeywords
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
    imageDesktop: `/photos/${year > 0 ? year : "general"}/${photoID}.jpg`,
    rawFields: raw,
  };
}
