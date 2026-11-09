import fs from "fs";
import path from "path";
import { Photo } from "@/types/photo";

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
      return cachedPhotos;
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    cachedPhotos = JSON.parse(raw);
    lastMtime = stats.mtimeMs;
    return cachedPhotos || [];
  } catch {
    return cachedPhotos || [];
  }
}

export function getPhotoById(id: string): Photo | undefined {
  const photos = getAllPhotos();
  return photos.find((p) => p.photoID === id);
}

export function getPhotosByCategory(category: string): Photo[] {
  const photos = getAllPhotos();
  const decoded = decodeURIComponent(category).toLowerCase();
  
  if (decoded === "all") {
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
      name: "All Photographs",
      slug: "All",
      count: photos.length,
      coverPhoto: allCover,
    },
    ...Array.from(catMap.entries())
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
