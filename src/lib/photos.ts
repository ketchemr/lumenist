import fs from "fs";
import path from "path";
import { Photo } from "@/types/photo";
import { getSettings } from "@/lib/settings";
import { sortPhotos } from "./photoSort";
import { getJpegDimensions } from "./imageDimensions";

export { sortPhotos };

let cachedPhotos: Photo[] | null = null;
let lastMtime = 0;
let persistTimeout: NodeJS.Timeout | null = null;
const pendingUpdates = new Map<string, Photo>();

/**
 * Resolves the on-disk file path for a photo.
 * If multiple candidate locations exist (e.g. year folder vs Film folder),
 * selects the candidate with the newest modification time.
 */
export function resolvePhotoDiskPath(
  photo: Photo
): { filePath: string; mtimeSec: number; webSubpath: string } | null {
  const cleanPath = (photo.imageDesktop || "")
    .replace(/^\/photos\//, "")
    .split("?")[0];
  if (!cleanPath) return null;

  const photosDir =
    process.env.PHOTOS_SOURCE_DIR ||
    process.env.LOCAL_PHOTO_DIR ||
    path.join(process.cwd(), "public", "photos");

  const candidates: { path: string; webSubpath: string }[] = [
    { path: path.join(photosDir, cleanPath), webSubpath: cleanPath },
    { path: path.join(process.cwd(), "public", "photos", cleanPath), webSubpath: cleanPath },
  ];

  const baseFilename = path.basename(cleanPath);
  if (photo.dateTaken?.year) {
    const yearSub = `${photo.dateTaken.year}/${baseFilename}`;
    candidates.push({ path: path.join(photosDir, yearSub), webSubpath: yearSub });
    candidates.push({ path: path.join(process.cwd(), "public", "photos", yearSub), webSubpath: yearSub });
  }

  const filmSub = `Film/${baseFilename}`;
  candidates.push({ path: path.join(photosDir, filmSub), webSubpath: filmSub });
  candidates.push({ path: path.join(process.cwd(), "public", "photos", filmSub), webSubpath: filmSub });

  let best: { filePath: string; mtimeSec: number; webSubpath: string } | null = null;
  const seenPaths = new Set<string>();

  for (const cand of candidates) {
    if (seenPaths.has(cand.path)) continue;
    seenPaths.add(cand.path);

    try {
      if (fs.existsSync(cand.path)) {
        const stat = fs.statSync(cand.path);
        const mtimeSec = Math.floor(stat.mtimeMs / 1000);
        if (!best || mtimeSec > best.mtimeSec) {
          best = { filePath: cand.path, mtimeSec, webSubpath: cand.webSubpath };
        }
      }
    } catch {}
  }

  return best;
}

/**
 * Invalidates generated WebP/JPEG thumbnails in .thumbnails/ for a photo.
 */
export function invalidatePhotoThumbnails(photoID: string) {
  try {
    const thumbDir = path.join(process.cwd(), ".thumbnails");
    if (fs.existsSync(thumbDir)) {
      const files = fs.readdirSync(thumbDir);
      for (const f of files) {
        if (f.includes(photoID)) {
          try {
            fs.unlinkSync(path.join(thumbDir, f));
          } catch {}
        }
      }
    }
  } catch {}
}

/**
 * Persists an automatically synced photo size/mtime update to data/photos.json.
 * Batched and debounced to prevent redundant disk writes during parallel requests.
 */
export function persistPhotoUpdate(updatedPhoto: Photo) {
  pendingUpdates.set(updatedPhoto.photoID, updatedPhoto);

  if (cachedPhotos) {
    const idx = cachedPhotos.findIndex((p) => p.photoID === updatedPhoto.photoID);
    if (idx !== -1) {
      cachedPhotos[idx] = updatedPhoto;
    }
  }

  if (persistTimeout) clearTimeout(persistTimeout);
  persistTimeout = setTimeout(() => {
    try {
      const filePath = path.join(process.cwd(), "data", "photos.json");
      if (!fs.existsSync(filePath)) return;
      const raw = fs.readFileSync(filePath, "utf-8");
      const list: Photo[] = JSON.parse(raw);
      let changed = false;

      for (const [id, update] of pendingUpdates.entries()) {
        const i = list.findIndex((p) => p.photoID === id);
        if (i !== -1) {
          list[i] = {
            ...list[i],
            size: update.size,
            updatedAt: update.updatedAt,
            imageDesktop: update.imageDesktop,
          };
          changed = true;
        }
      }
      pendingUpdates.clear();

      if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(list, null, 2), "utf-8");
        const stats = fs.statSync(filePath);
        lastMtime = stats.mtimeMs;
      }
    } catch (e) {
      console.warn("[Lumenist] Could not persist auto-synced photo update:", e);
    }
  }, 100);
}

/**
 * Real-time inspection: if the image file on disk was replaced or modified,
 * automatically grab its new dimensions, aspect ratio, orientation, and mtime,
 * invalidate old thumbnails, and queue catalog persistence.
 */
export function syncPhotoIfModified(photo: Photo): Photo {
  const resolved = resolvePhotoDiskPath(photo);
  if (!resolved) return photo;

  const { filePath, mtimeSec, webSubpath } = resolved;
  const currentUpdated = photo.updatedAt || 0;

  // Check if file was modified on disk or if dimensions/aspect ratio are missing
  const isModified = !currentUpdated || Math.abs(currentUpdated - mtimeSec) > 2;

  if (!isModified && photo.size?.aspectRatio) {
    return photo;
  }

  try {
    const dims = getJpegDimensions(filePath);
    let newSize = photo.size;
    let sizeChanged = false;

    if (dims && dims.width > 0 && dims.height > 0) {
      const aspectRatio = parseFloat((dims.width / dims.height).toFixed(3));
      const orientation: "horizontal" | "vertical" | "square" =
        dims.width === dims.height
          ? "square"
          : dims.height > dims.width
          ? "vertical"
          : "horizontal";

      if (
        !photo.size ||
        photo.size.width !== dims.width ||
        photo.size.height !== dims.height ||
        photo.size.aspectRatio !== aspectRatio ||
        photo.size.orientation !== orientation
      ) {
        newSize = {
          width: dims.width,
          height: dims.height,
          aspectRatio,
          orientation,
        };
        sizeChanged = true;
      }
    }

    const newImageDesktop = `/photos/${webSubpath}?v=${mtimeSec}`;
    const updatedPhoto: Photo = {
      ...photo,
      size: newSize,
      updatedAt: mtimeSec,
      imageDesktop: newImageDesktop,
    };

    if (sizeChanged || isModified) {
      invalidatePhotoThumbnails(photo.photoID);
    }

    persistPhotoUpdate(updatedPhoto);
    return updatedPhoto;
  } catch (err) {
    console.warn(`[Lumenist] Error syncing photo ${photo.photoID}:`, err);
    return photo;
  }
}

/**
 * Syncs photo size and aspect ratio when dimensions are extracted by Sharp in the thumbnail route.
 */
export function syncPhotoSizeFromDimensions(
  imageSubpath: string,
  width: number,
  height: number,
  mtimeMs: number
) {
  if (!width || !height) return;
  const mtimeSec = Math.floor(mtimeMs / 1000);
  const cleanSub = imageSubpath.replace(/^\/+/, "").replace(/^photos\//, "").split("?")[0];
  const baseName = path.basename(cleanSub, path.extname(cleanSub)).replace(/_desktop|_gallery|_home|_tn$/, "");

  const photos = getAllPhotos();
  const photo = photos.find((p) => p.photoID === baseName || p.imageDesktop.includes(cleanSub));
  if (!photo) return;

  const aspectRatio = parseFloat((width / height).toFixed(3));
  const orientation: "horizontal" | "vertical" | "square" =
    width === height ? "square" : height > width ? "vertical" : "horizontal";

  if (
    !photo.size ||
    photo.size.width !== width ||
    photo.size.height !== height ||
    photo.size.aspectRatio !== aspectRatio ||
    photo.size.orientation !== orientation ||
    photo.updatedAt !== mtimeSec
  ) {
    const updatedPhoto: Photo = {
      ...photo,
      size: { width, height, aspectRatio, orientation },
      updatedAt: mtimeSec,
      imageDesktop: `/photos/${cleanSub}?v=${mtimeSec}`,
    };
    persistPhotoUpdate(updatedPhoto);
  }
}

export function getAllPhotos(): Photo[] {
  const filePath = path.join(process.cwd(), "data", "photos.json");
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const stats = fs.statSync(filePath);
    if (cachedPhotos && stats.mtimeMs === lastMtime) {
      return sortPhotos(cachedPhotos);
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed: Photo[] = JSON.parse(raw);
    cachedPhotos = parsed.map((p) => {
      if (p.imageDesktop) {
        const v = p.updatedAt || p.createdTimestamp;
        if (v && !p.imageDesktop.includes("?v=")) {
          return {
            ...p,
            imageDesktop: `${p.imageDesktop}?v=${v}`,
          };
        }
      }
      return p;
    });
    lastMtime = stats.mtimeMs;
    return sortPhotos(cachedPhotos || []);
  } catch {
    return cachedPhotos ? sortPhotos(cachedPhotos) : [];
  }
}

export function getPhotoById(id: string): Photo | undefined {
  const photos = getAllPhotos();
  const photo = photos.find((p) => p.photoID === id);
  if (!photo) return undefined;
  return syncPhotoIfModified(photo);
}

export function getPhotosByCategory(category: string): Photo[] {
  const photos = getAllPhotos();
  let decoded = category;
  try {
    while (decoded.includes("%")) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    try {
      decoded = decodeURIComponent(category);
    } catch {
      decoded = category;
    }
  }
  decoded = decoded.toLowerCase();
  
  if (decoded === "all" || decoded === "all photographs") {
    return photos;
  }

  return photos.filter((p) =>
    p.categories.some((c) => c.toLowerCase() === decoded)
  );
}

export interface CategorySummary {
  name: string;
  slug: string;
  count: number;
  coverPhoto?: Photo;
}

export function getAllCategories(): CategorySummary[] {
  const photos = getAllPhotos();
  if (photos.length === 0) return [];

  // Group photos by category
  const catMap = new Map<string, Photo[]>();
  for (const photo of photos) {
    for (const cat of photo.categories) {
      if (!catMap.has(cat)) {
        catMap.set(cat, []);
      }
      catMap.get(cat)!.push(photo);
    }
  }

  // To guarantee no two galleries share the same cover photo,
  // we sort categories by candidate pool size ascending (smallest pool first).
  const sortedCategories = Array.from(catMap.entries()).sort(
    (a, b) => a[1].length - b[1].length
  );

  const usedPhotoIds = new Set<string>();
  const coverMap = new Map<string, Photo>();

  for (const [catName, catPhotos] of sortedCategories) {
    const available = catPhotos.filter((p) => !usedPhotoIds.has(p.photoID));
    if (available.length > 0) {
      const chosen = available[Math.floor(Math.random() * available.length)];
      usedPhotoIds.add(chosen.photoID);
      coverMap.set(catName, chosen);
    } else {
      // Fallback if every photo in category has already been used
      const chosen = catPhotos[Math.floor(Math.random() * catPhotos.length)];
      coverMap.set(catName, chosen);
    }
  }

  // Unique random cover for "All Photographs"
  const allAvailable = photos.filter((p) => !usedPhotoIds.has(p.photoID));
  const allCover =
    allAvailable.length > 0
      ? allAvailable[Math.floor(Math.random() * allAvailable.length)]
      : photos[Math.floor(Math.random() * photos.length)];

  if (allCover) {
    usedPhotoIds.add(allCover.photoID);
  }

  const categoryList: CategorySummary[] = [
    {
      name: "All",
      slug: "All",
      count: photos.length,
      coverPhoto: allCover,
    },
    ...Array.from(catMap.entries())
      .filter(([name]) => name.trim().toLowerCase() !== "all")
      .map(([name, catPhotos]) => ({
        name,
        slug: encodeURIComponent(name),
        count: catPhotos.length,
        coverPhoto: coverMap.get(name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];

  return categoryList;
}

export function getAdjacentPhotos(currentId: string): {
  prev?: Photo;
  next?: Photo;
} {
  const photos = getAllPhotos();
  const idx = photos.findIndex((p) => p.photoID === currentId);
  if (idx === -1) return {};

  return {
    prev: idx > 0 ? photos[idx - 1] : undefined,
    next: idx < photos.length - 1 ? photos[idx + 1] : undefined,
  };
}
