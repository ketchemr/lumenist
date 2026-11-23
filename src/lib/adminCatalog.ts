import fs from "fs";
import path from "path";
import { Photo } from "@/types/photo";

export function resolvePhotosDir(): string {
  if (process.env.PHOTOS_DIR && fs.existsSync(process.env.PHOTOS_DIR)) {
    return process.env.PHOTOS_DIR;
  }
  const publicPhotos = path.join(process.cwd(), "public", "photos");
  try {
    return fs.realpathSync(publicPhotos);
  } catch {
    return publicPhotos;
  }
}

export function findCandidateFilesToDelete(photo: Photo, photosRoot: string): string[] {
  const files: string[] = [];
  const mediaExts = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".avif",
    ".gif",
    ".mp4",
    ".webm",
    ".mov",
    ".m4v",
  ];
  if (photo.imageDesktop && photo.imageDesktop.startsWith("/photos/")) {
    const relPath = photo.imageDesktop.replace(/^\/photos\//, "").split("?")[0];
    const fullDesktopPath = path.join(photosRoot, relPath);
    files.push(fullDesktopPath);
    const dirName = path.dirname(fullDesktopPath);
    for (const ext of mediaExts) {
      files.push(path.join(dirName, `${photo.photoID}${ext}`));
    }
  }
  if (photo.videoSrc && photo.videoSrc.startsWith("/photos/")) {
    const relVideo = photo.videoSrc.replace(/^\/photos\//, "").split("?")[0];
    files.push(path.join(photosRoot, relVideo));
  }
  if (photo.dateTaken?.year) {
    const yearDir = path.join(photosRoot, String(photo.dateTaken.year));
    files.push(path.join(yearDir, `${photo.photoID}_desktop.jpg`));
    for (const ext of mediaExts) {
      files.push(path.join(yearDir, `${photo.photoID}${ext}`));
    }
  }
  return Array.from(new Set(files));
}

export function isPhotoOnlyInAll(photo: { categories?: string[] }): boolean {
  if (!photo.categories || photo.categories.length === 0) return true;
  const nonAll = photo.categories.filter(
    (c) => c && c.trim() && c.trim().toLowerCase() !== "all"
  );
  return nonAll.length === 0;
}

export function getCustomAlbums(): string[] {
  const albumsFile = path.join(process.cwd(), "data", "albums.json");
  if (!fs.existsSync(albumsFile)) return [];
  try {
    const list = JSON.parse(fs.readFileSync(albumsFile, "utf-8"));
    if (Array.isArray(list)) {
      return list.filter(
        (a) =>
          typeof a === "string" &&
          a.trim() &&
          a.trim().toLowerCase() !== "all"
      );
    }
  } catch {}
  return [];
}

export function saveCustomAlbums(albums: string[]): void {
  const albumsFile = path.join(process.cwd(), "data", "albums.json");
  const unique = Array.from(
    new Set(
      albums
        .map((a) => (typeof a === "string" ? a.trim() : ""))
        .filter((a) => a && a.toLowerCase() !== "all")
    )
  );
  unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const dir = path.dirname(albumsFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(albumsFile, JSON.stringify(unique, null, 2), "utf-8");
}
