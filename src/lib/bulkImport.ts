import fs from "fs";
import path from "path";
import exifr from "exifr";
import { Photo, PhotoSize } from "../types/photo";
import { saveUploadedImage } from "./mediaServer";

export type DuplicateMode = "skip" | "overwrite" | "merge";

export interface ImportManifestRow {
  filename?: string;
  photoID?: string;
  title?: string;
  description?: string;
  albums?: string[];
  tags?: string[];
  latitude?: number | null;
  longitude?: number | null;
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  folder?: string;
  film?: string;
  camera?: string;
  lens?: string;
  focalLength?: string;
  shutterspeed?: string;
  aperture?: string;
  sensitivity?: string;
  exposureCompensation?: string;
  whiteBalance?: string;
  tripod?: string;
  availability?: string;
}

export function cleanCameraName(make?: string, model?: string): string {
  if (!model && !make) return "Unknown Camera";
  let m = (model || "").trim();
  let mk = (make || "").trim();

  if (mk.toUpperCase().includes("NIKON")) mk = "Nikon";
  else if (mk.toUpperCase().includes("SONY")) mk = "Sony";
  else if (mk.toUpperCase().includes("CANON")) mk = "Canon";
  else if (mk.toUpperCase().includes("GOOGLE")) mk = "Google";
  else if (mk.toUpperCase().includes("SAMSUNG")) mk = "Samsung";

  if (m.toUpperCase().startsWith("NIKON ")) return "Nikon " + m.slice(6).trim();
  if (m.toUpperCase().startsWith("SONY ")) return "Sony " + m.slice(5).trim();

  if (mk && !m.toLowerCase().includes(mk.toLowerCase())) {
    return `${mk} ${m}`.trim();
  }
  return m || mk;
}

/**
 * RFC-4180 compliant CSV parser (handles quoted fields, escaped quotes, newlines in quotes, BOM).
 */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\r") {
        if (clean[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.every((c) => !c.trim())) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = (cells[c] ?? "").trim();
    }
    out.push(obj);
  }
  return out;
}

function parseListField(val: unknown): string[] | undefined {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) {
    const items = val.map((x) => String(x).trim()).filter(Boolean);
    return items.length > 0 ? items : [];
  }
  const str = String(val).trim();
  if (!str) return undefined;
  const sep = str.includes(";") && !str.includes(",") ? ";" : ",";
  return str
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseOptionalNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function parseDateParts(
  val: unknown
): { year?: number; month?: number; day?: number; hour?: number; minute?: number; second?: number } {
  if (!val) return {};
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    return {
      year: parseOptionalNumber(obj.year),
      month: parseOptionalNumber(obj.month),
      day: parseOptionalNumber(obj.day),
      hour: parseOptionalNumber(obj.hour),
      minute: parseOptionalNumber(obj.minute),
      second: parseOptionalNumber(obj.second),
    };
  }
  const s = String(val).trim();
  const m = s.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (m) {
    return {
      year: parseInt(m[1], 10),
      month: parseInt(m[2], 10),
      day: parseInt(m[3], 10),
      hour: m[4] ? parseInt(m[4], 10) : undefined,
      minute: m[5] ? parseInt(m[5], 10) : undefined,
      second: m[6] ? parseInt(m[6], 10) : undefined,
    };
  }
  return {};
}

export function normalizeManifestRow(raw: Record<string, unknown>): ImportManifestRow {
  const lowerMap: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    lowerMap[k.trim().toLowerCase()] = v;
  }

  const pickStr = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = lowerMap[k.toLowerCase()];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        return String(v).trim();
      }
    }
    return undefined;
  };

  let latitude: number | null | undefined = parseOptionalNumber(
    lowerMap["latitude"] ?? lowerMap["lat"]
  );
  let longitude: number | null | undefined = parseOptionalNumber(
    lowerMap["longitude"] ?? lowerMap["lon"] ?? lowerMap["lng"]
  );

  const locVal = lowerMap["location"];
  if (latitude === undefined && longitude === undefined && locVal) {
    if (typeof locVal === "object" && locVal !== null) {
      const lObj = locVal as Record<string, unknown>;
      latitude = parseOptionalNumber(lObj.latitude ?? lObj.lat);
      longitude = parseOptionalNumber(lObj.longitude ?? lObj.lon ?? lObj.lng);
    } else {
      const parts = String(locVal).split(",").map((p) => Number(p.trim()));
      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        latitude = parts[0];
        longitude = parts[1];
      }
    }
  }

  const dateObj = parseDateParts(lowerMap["datetaken"] ?? lowerMap["date"]);
  const year = parseOptionalNumber(lowerMap["year"]) ?? dateObj.year;
  const month = parseOptionalNumber(lowerMap["month"]) ?? dateObj.month;
  const day = parseOptionalNumber(lowerMap["day"]) ?? dateObj.day;
  const hour = parseOptionalNumber(lowerMap["hour"]) ?? dateObj.hour;
  const minute = parseOptionalNumber(lowerMap["minute"]) ?? dateObj.minute;
  const second = parseOptionalNumber(lowerMap["second"]) ?? dateObj.second;

  return {
    filename: pickStr("filename", "file", "image", "imagedesktop"),
    photoID: pickStr("photoid", "photo_id", "id"),
    title: pickStr("title", "name"),
    description: pickStr("description", "caption"),
    albums: parseListField(
      lowerMap["albums"] ?? lowerMap["categories"] ?? lowerMap["category"] ?? lowerMap["album"]
    ),
    tags: parseListField(
      lowerMap["tags"] ?? lowerMap["keywords"] ?? lowerMap["keyword"] ?? lowerMap["tag"]
    ),
    latitude,
    longitude,
    year,
    month,
    day,
    hour,
    minute,
    second,
    folder: pickStr("folder", "directory"),
    film: pickStr("film"),
    camera: pickStr("camera"),
    lens: pickStr("lens"),
    focalLength: pickStr("focallength", "focal_length"),
    shutterspeed: pickStr("shutterspeed", "shutter_speed", "exposure"),
    aperture: pickStr("aperture"),
    sensitivity: pickStr("sensitivity", "iso"),
    exposureCompensation: pickStr("exposurecompensation", "exposure_compensation"),
    whiteBalance: pickStr("whitebalance", "white_balance"),
    tripod: pickStr("tripod"),
    availability: pickStr("availability"),
  };
}

export function parseManifestFile(
  filename: string,
  text: string
): ImportManifestRow[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.photos)
      ? parsed.photos
      : Array.isArray(parsed?.items)
      ? parsed.items
      : null;
    if (!arr) {
      throw new Error("JSON manifest must be an array of objects or { photos: [...] }.");
    }
    return arr
      .filter((x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null)
      .map(normalizeManifestRow);
  }
  if (lower.endsWith(".csv")) {
    return parseCsv(text).map(normalizeManifestRow);
  }
  throw new Error("Manifest must be a .csv or .json file.");
}

export function matchManifestRow(
  originalFilename: string,
  rows: ImportManifestRow[]
): ImportManifestRow | undefined {
  const baseName = path.basename(originalFilename);
  const stem = baseName.replace(/\.[^.]+$/, "").replace(/_desktop$/i, "");
  const baseLower = baseName.toLowerCase();
  const stemLower = stem.toLowerCase();

  for (const r of rows) {
    if (r.filename) {
      const rfBase = path.basename(r.filename.split("?")[0]).toLowerCase();
      const rfStem = rfBase.replace(/\.[^.]+$/, "").replace(/_desktop$/i, "");
      if (rfBase === baseLower || rfStem === stemLower) return r;
    }
    if (r.photoID && r.photoID.toLowerCase() === stemLower) {
      return r;
    }
  }
  return undefined;
}

export function mergeUniqueCaseInsensitive(base: string[], extra: string[]): string[] {
  const seen = new Set(base.map((s) => s.toLowerCase()));
  const out = [...base];
  for (const item of extra) {
    const t = item.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export interface ImportImageResult {
  photoID: string;
  filename: string;
  status: "imported" | "updated" | "merged" | "skipped" | "error";
  photo?: Photo;
  message?: string;
}

export async function processImageImport(opts: {
  buffer: Buffer;
  originalFilename: string;
  manifestRow?: ImportManifestRow;
  photosRoot: string;
  existingById: Map<string, Photo>;
  duplicateMode: DuplicateMode;
}): Promise<ImportImageResult> {
  const {
    buffer,
    originalFilename,
    manifestRow,
    photosRoot,
    existingById,
    duplicateMode,
  } = opts;

  let exifData: Record<string, any> = {};
  try {
    exifData =
      (await exifr.parse(buffer, {
        tiff: true,
        xmp: true,
        icc: false,
        gps: true,
      })) || {};
  } catch {
    exifData = {};
  }

  const now = new Date();
  const exifDate: Date | undefined = exifData.DateTimeOriginal || exifData.CreateDate;
  const dateObj =
    exifDate instanceof Date && !isNaN(exifDate.getTime()) ? exifDate : now;

  const rawYear = manifestRow?.year ?? dateObj.getFullYear();
  const year = rawYear >= 1900 && rawYear <= 2100 ? rawYear : dateObj.getFullYear();
  const month = manifestRow?.month ?? dateObj.getMonth() + 1;
  const day = manifestRow?.day ?? dateObj.getDate();
  const hour = manifestRow?.hour ?? dateObj.getHours();
  const minute = manifestRow?.minute ?? dateObj.getMinutes();
  const second = manifestRow?.second ?? dateObj.getSeconds();

  const pad = (n: number) => String(n).padStart(2, "0");
  const fileStem = path
    .basename(originalFilename)
    .replace(/\.[^.]+$/, "")
    .replace(/_desktop$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");

  const photoID =
    manifestRow?.photoID ||
    (/^[a-zA-Z0-9_-]{1,120}$/.test(fileStem) && fileStem.length > 0
      ? fileStem
      : `d${year}${pad(month)}${pad(day)}${pad(hour)}${pad(minute)}${pad(second)}`);

  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(photoID)) {
    return {
      photoID,
      filename: originalFilename,
      status: "error",
      message: "Invalid photoID characters.",
    };
  }

  const existing = existingById.get(photoID);
  if (existing && duplicateMode === "skip") {
    return {
      photoID,
      filename: originalFilename,
      status: "skipped",
      message: "Already exists in catalog",
    };
  }

  const folderName = (manifestRow?.folder || String(year)).replace(/[^a-zA-Z0-9_-]/g, "");
  const targetFolder = path.join(photosRoot, folderName || String(year));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  const saved = await saveUploadedImage({
    buffer,
    originalName: originalFilename,
    photoID,
    targetFolder,
  });
  const mtimeSec = Math.floor(Date.now() / 1000);
  const imageDesktop = `/photos/${folderName || String(year)}/${saved.filename}?v=${mtimeSec}`;
  const sizeObj: PhotoSize = saved.size;

  let latitude: number | undefined;
  let longitude: number | undefined;
  if (
    manifestRow?.latitude !== undefined &&
    manifestRow?.latitude !== null &&
    manifestRow?.longitude !== undefined &&
    manifestRow?.longitude !== null
  ) {
    latitude = parseFloat(manifestRow.latitude.toFixed(6));
    longitude = parseFloat(manifestRow.longitude.toFixed(6));
  } else if (
    typeof exifData.latitude === "number" &&
    typeof exifData.longitude === "number"
  ) {
    latitude = parseFloat(exifData.latitude.toFixed(6));
    longitude = parseFloat(exifData.longitude.toFixed(6));
  }

  const camera = manifestRow?.camera || cleanCameraName(exifData.Make, exifData.Model);
  const lens =
    manifestRow?.lens || (exifData.LensModel || exifData.Lens || "").trim() || "Unknown Lens";
  const focalLength =
    manifestRow?.focalLength ||
    (exifData.FocalLength ? `${Math.round(exifData.FocalLength)} mm` : "Unknown");
  const shutterspeed =
    manifestRow?.shutterspeed ||
    (exifData.ExposureTime
      ? exifData.ExposureTime >= 1
        ? `${exifData.ExposureTime}s`
        : `1/${Math.round(1 / exifData.ExposureTime)}s`
      : "Unknown");
  const aperture =
    manifestRow?.aperture || (exifData.FNumber ? `f${exifData.FNumber}` : "Unknown");
  const sensitivity =
    manifestRow?.sensitivity || (exifData.ISO ? `ISO ${exifData.ISO}` : "Unknown");
  const exposureCompensation =
    manifestRow?.exposureCompensation ||
    (exifData.ExposureCompensation !== undefined
      ? `${exifData.ExposureCompensation} Ev`
      : "0 Ev");
  const whiteBalance = manifestRow?.whiteBalance || String(exifData.WhiteBalance || "Auto");

  const createdTimestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const fallbackTitle = fileStem.replace(/[_-]+/g, " ").trim() || "Untitled";

  if (existing && duplicateMode === "merge") {
    const merged: Photo = {
      ...existing,
      title: manifestRow?.title || existing.title,
      description: manifestRow?.description || existing.description,
      categories: mergeUniqueCaseInsensitive(
        existing.categories || [],
        manifestRow?.albums || []
      ),
      keywords: mergeUniqueCaseInsensitive(
        existing.keywords || [],
        manifestRow?.tags || []
      ),
      location:
        latitude !== undefined && longitude !== undefined
          ? { latitude, longitude }
          : existing.location,
      size: sizeObj,
      imageDesktop,
      updatedAt: mtimeSec,
    };
    return {
      photoID,
      filename: originalFilename,
      status: "merged",
      photo: merged,
    };
  }

  const photo: Photo = {
    photoID,
    title: manifestRow?.title || fallbackTitle,
    description: manifestRow?.description || "",
    availability: manifestRow?.availability || "Available for Order",
    categories: manifestRow?.albums || [],
    keywords: mergeUniqueCaseInsensitive([], manifestRow?.tags || []),
    dateTaken: {
      year,
      month,
      day,
      hour,
      minute,
      second,
      iso: `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`,
    },
    createdTimestamp: existing?.createdTimestamp || createdTimestamp,
    updatedAt: mtimeSec,
    film: manifestRow?.film || "Digital",
    camera,
    lens,
    focalLength,
    shutterspeed,
    aperture,
    sensitivity,
    exposureCompensation,
    whiteBalance,
    toneCompensation: "Auto",
    hueAdjustment: 0,
    tripod: manifestRow?.tripod || "None",
    location:
      latitude !== undefined && longitude !== undefined
        ? { latitude, longitude }
        : undefined,
    size: sizeObj,
    imageDesktop,
  };

  return {
    photoID,
    filename: originalFilename,
    status: existing ? "updated" : "imported",
    photo,
  };
}

function escapeCsvCell(val: unknown): string {
  const s = val === undefined || val === null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function catalogToCsv(photos: Photo[]): string {
  const headers = [
    "photoID",
    "filename",
    "title",
    "description",
    "albums",
    "tags",
    "latitude",
    "longitude",
    "year",
    "month",
    "day",
    "film",
    "camera",
    "lens",
    "focalLength",
    "shutterspeed",
    "aperture",
    "sensitivity",
    "tripod",
    "availability",
  ];
  const lines = [headers.join(",")];
  for (const p of photos) {
    const filename = (p.imageDesktop || "").split("?")[0].split("/").pop() || `${p.photoID}.jpg`;
    const row = [
      p.photoID,
      filename,
      p.title,
      p.description,
      (p.categories || []).join(", "),
      (p.keywords || []).join(", "),
      p.location?.latitude ?? "",
      p.location?.longitude ?? "",
      p.dateTaken?.year ?? "",
      p.dateTaken?.month ?? "",
      p.dateTaken?.day ?? "",
      p.film ?? "",
      p.camera ?? "",
      p.lens ?? "",
      p.focalLength ?? "",
      p.shutterspeed ?? "",
      p.aperture ?? "",
      p.sensitivity ?? "",
      p.tripod ?? "",
      p.availability ?? "",
    ];
    lines.push(row.map(escapeCsvCell).join(","));
  }
  return lines.join("\n") + "\n";
}
