import fs from "fs";
import { Photo, PhotoLocation, PhotoSize } from "../types/photo";

// Extract real image dimensions from JPEG, PNG, GIF, or WebP headers synchronously
export function getImageDimensions(filePath: string): { width: number; height: number } | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fd = fs.openSync(filePath, "r");
    try {
      const header = Buffer.alloc(30);
      const readBytes = fs.readSync(fd, header, 0, 30, 0);
      if (readBytes < 10) return null;

      // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR width/height at bytes 16..23
      if (
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47
      ) {
        if (readBytes >= 24) {
          const width = header.readUInt32BE(16);
          const height = header.readUInt32BE(20);
          if (width > 0 && height > 0) return { width, height };
        }
        return null;
      }

      // GIF: "GIF87a" or "GIF89a", width/height at bytes 6..9 (little-endian)
      if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
        const width = header.readUInt16LE(6);
        const height = header.readUInt16LE(8);
        if (width > 0 && height > 0) return { width, height };
        return null;
      }

      // WebP: "RIFF".... "WEBP"
      if (
        header.toString("ascii", 0, 4) === "RIFF" &&
        header.toString("ascii", 8, 12) === "WEBP"
      ) {
        const chunk = header.toString("ascii", 12, 16);
        if (chunk === "VP8X" && readBytes >= 30) {
          const width = 1 + (header[24] | (header[25] << 8) | (header[26] << 16));
          const height = 1 + (header[27] | (header[28] << 8) | (header[29] << 16));
          if (width > 0 && height > 0) return { width, height };
        } else if (chunk === "VP8 " && readBytes >= 30) {
          const width = header.readUInt16LE(26) & 0x3fff;
          const height = header.readUInt16LE(28) & 0x3fff;
          if (width > 0 && height > 0) return { width, height };
        } else if (chunk === "VP8L" && readBytes >= 25) {
          const bits = header.readUInt32LE(21);
          const width = (bits & 0x3fff) + 1;
          const height = ((bits >> 14) & 0x3fff) + 1;
          if (width > 0 && height > 0) return { width, height };
        }
        return null;
      }

      // JPEG: FF D8
      if (header[0] === 0xff && header[1] === 0xd8) {
        let pos = 2;
        const buf = Buffer.alloc(9);
        while (true) {
          const bytesRead = fs.readSync(fd, buf, 0, 2, pos);
          if (bytesRead < 2) break;
          if (buf[0] !== 0xff) {
            pos++;
            continue;
          }
          const marker = buf[1];
          if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            fs.readSync(fd, buf, 0, 7, pos + 2);
            const height = buf.readUInt16BE(3);
            const width = buf.readUInt16BE(5);
            if (width > 0 && height > 0) {
              return { width, height };
            }
            return null;
          } else if (marker === 0xd9 || marker === 0xda) {
            break;
          } else {
            fs.readSync(fd, buf, 0, 2, pos + 2);
            const segLen = buf.readUInt16BE(0);
            pos += 2 + segLen;
          }
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
  return null;
}

// Backwards-compatible alias
export function getJpegDimensions(filePath: string): { width: number; height: number } | null {
  return getImageDimensions(filePath);
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

  // Parse size & aspect ratio from raw text first
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

  // Cross-reference with actual JPEG file on disk:
  // If the JPEG exists, its actual geometry takes precedence over incorrect/stale values in txt
  if (imageFilePath && fs.existsSync(imageFilePath)) {
    const dims = getJpegDimensions(imageFilePath);
    if (dims) {
      const actualRatio = parseFloat((dims.width / dims.height).toFixed(3));
      let actualOrientation: "horizontal" | "vertical" | "square" = "horizontal";
      if (dims.width === dims.height) actualOrientation = "square";
      else if (dims.height > dims.width) actualOrientation = "vertical";

      if (!size) {
        // No size in txt: derive directly from JPEG
        size = {
          width: dims.width,
          height: dims.height,
          aspectRatio: actualRatio,
          orientation: actualOrientation,
        };
      } else {
        // Compare txt aspect ratio against actual JPEG aspect ratio
        const ratioDiff = Math.abs(size.aspectRatio - actualRatio);
        const orientationMismatch = size.orientation !== actualOrientation;
        if (ratioDiff > 0.05 || orientationMismatch) {
          // Txt size has wrong aspect ratio or inverted orientation: ignore txt size and trust the image
          size = {
            width: dims.width,
            height: dims.height,
            aspectRatio: actualRatio,
            orientation: actualOrientation,
          };
        } else {
          // Aspect ratios match: keep master dimensions from txt but align aspect ratio precisely to JPEG
          size.aspectRatio = actualRatio;
          size.orientation = actualOrientation;
        }
      }
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

  // Parse video fields (optional)
  const rawVideoSrc = raw["videoSrc"] || raw["video"] || undefined;
  const rawVideoEmbedUrl = raw["videoEmbedUrl"] || raw["videoUrl"] || raw["embedUrl"] || undefined;
  const rawMediaType = (raw["mediaType"] || raw["media"] || "").toLowerCase();
  const isVideo = rawMediaType === "video" || Boolean(rawVideoSrc) || Boolean(rawVideoEmbedUrl);

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
    ...(isVideo ? { mediaType: "video" as const } : {}),
    ...(rawVideoSrc ? { videoSrc: rawVideoSrc } : {}),
    ...(rawVideoEmbedUrl ? { videoEmbedUrl: rawVideoEmbedUrl } : {}),
    rawFields: raw,
  };
}
