import fs from "fs";
import path from "path";
import { Photo } from "@/types/photo";
import { getSettings } from "@/lib/settings";
import { sortPhotos } from "./photoSort";

export { sortPhotos };

let cachedPhotos: Photo[] | null = null;
let lastMtime = 0;

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

  // Real-time mtime check for single photo page:
  // Dynamically attach the file's latest modification timestamp as ?v=
  // so any replaced file on disk updates immediately without waiting for re-import
  try {
    const photosDir =
      process.env.PHOTOS_SOURCE_DIR ||
      process.env.LOCAL_PHOTO_DIR ||
      path.join(process.cwd(), "public", "photos");
    const cleanPath = photo.imageDesktop.replace(/^\/photos\//, "").split("?")[0];
    const candidatePaths = [
      path.join(photosDir, cleanPath),
      path.join(process.cwd(), "public", "photos", cleanPath),
      path.join("/home/ubuntu/photos", cleanPath),
    ];
    for (const cand of candidatePaths) {
      if (fs.existsSync(cand)) {
        const stat = fs.statSync(cand);
        const mtimeSec = Math.floor(stat.mtimeMs / 1000);
        const basePath = photo.imageDesktop.split("?")[0];
        return {
          ...photo,
          updatedAt: mtimeSec,
          imageDesktop: `${basePath}?v=${mtimeSec}`,
        };
      }
    }
  } catch {}

  return photo;
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
