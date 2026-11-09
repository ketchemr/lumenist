import fs from "fs";
import path from "path";
import { Photo } from "@/types/photo";

let cachedPhotos: Photo[] | null = null;

export function getAllPhotos(): Photo[] {
  if (cachedPhotos) return cachedPhotos;

  const filePath = path.join(process.cwd(), "data", "photos.json");
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    cachedPhotos = JSON.parse(raw);
    return cachedPhotos || [];
  } catch {
    return [];
  }
}

export function getPhotoById(id: string): Photo | undefined {
  const photos = getAllPhotos();
  return photos.find((p) => p.photoID === id);
}

export function getPhotosByCategory(category: string): Photo[] {
  const photos = getAllPhotos();
  const decoded = decodeURIComponent(category).toLowerCase();
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
  const map = new Map<string, { count: number; cover?: Photo }>();

  for (const photo of photos) {
    for (const cat of photo.categories) {
      const existing = map.get(cat);
      if (!existing) {
        map.set(cat, { count: 1, cover: photo });
      } else {
        existing.count++;
      }
    }
  }

  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      slug: encodeURIComponent(name),
      count: data.count,
      coverPhoto: data.cover,
    }))
    .sort((a, b) => b.count - a.count);
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
