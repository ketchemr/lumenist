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

export function findTxtPath(photo: Photo, photosRoot: string): string | null {
  if (photo.imageDesktop && photo.imageDesktop.startsWith("/photos/")) {
    const relPath = photo.imageDesktop.replace(/^\/photos\//, "");
    const fullDesktopPath = path.join(photosRoot, relPath);
    const dirName = path.dirname(fullDesktopPath);
    const p1 = path.join(dirName, `${photo.photoID}.txt`);
    if (fs.existsSync(p1)) return p1;
  }
  if (photo.dateTaken?.year) {
    const yearDir = path.join(photosRoot, String(photo.dateTaken.year));
    const p2 = path.join(yearDir, `${photo.photoID}.txt`);
    if (fs.existsSync(p2)) return p2;
  }
  return null;
}

export function findCandidateFilesToDelete(photo: Photo, photosRoot: string): string[] {
  const files: string[] = [];
  if (photo.imageDesktop && photo.imageDesktop.startsWith("/photos/")) {
    const relPath = photo.imageDesktop.replace(/^\/photos\//, "");
    const fullDesktopPath = path.join(photosRoot, relPath);
    files.push(fullDesktopPath);
    const dirName = path.dirname(fullDesktopPath);
    files.push(path.join(dirName, `${photo.photoID}.txt`));
    files.push(path.join(dirName, `${photo.photoID}.jpg`));
    files.push(path.join(dirName, `${photo.photoID}.jpeg`));
  }
  if (photo.dateTaken?.year) {
    const yearDir = path.join(photosRoot, String(photo.dateTaken.year));
    files.push(path.join(yearDir, `${photo.photoID}.txt`));
    files.push(path.join(yearDir, `${photo.photoID}_desktop.jpg`));
    files.push(path.join(yearDir, `${photo.photoID}.jpg`));
    files.push(path.join(yearDir, `${photo.photoID}.jpeg`));
  }
  return Array.from(new Set(files));
}

export function updateTxtFileMetadata(
  txtPath: string,
  updates: { categories?: string[]; keywords?: string[] }
): boolean {
  if (!fs.existsSync(txtPath)) return false;
  try {
    const content = fs.readFileSync(txtPath, "utf-8");
    const lines = content.split(/\r?\n/);

    let categoryLineIndex = -1;
    let keywordLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim().toLowerCase();
      if (
        trimmed.startsWith("category:") ||
        trimmed.startsWith("categories:") ||
        trimmed.startsWith("albums:") ||
        trimmed.startsWith("album:")
      ) {
        categoryLineIndex = i;
      }
      if (
        trimmed.startsWith("keyword:") ||
        trimmed.startsWith("keywords:") ||
        trimmed.startsWith("tags:") ||
        trimmed.startsWith("tag:")
      ) {
        keywordLineIndex = i;
      }
    }

    if (updates.categories !== undefined) {
      const catStr = updates.categories.join(",");
      const colonPrefix =
        categoryLineIndex >= 0
          ? lines[categoryLineIndex].split(":")[0] + ":"
          : "category:";
      const newLine = `${colonPrefix}${catStr}`;

      if (categoryLineIndex >= 0) {
        lines[categoryLineIndex] = newLine;
      } else {
        lines.push(newLine);
      }
    }

    if (updates.keywords !== undefined) {
      const kwStr = updates.keywords.join(",");
      const colonPrefix =
        keywordLineIndex >= 0
          ? lines[keywordLineIndex].split(":")[0] + ":"
          : "keyword:";
      const newLine = `${colonPrefix}${kwStr}`;

      if (keywordLineIndex >= 0) {
        lines[keywordLineIndex] = newLine;
      } else {
        lines.push(newLine);
      }
    }

    fs.writeFileSync(
      txtPath,
      lines
        .filter((l, idx) => idx < lines.length - 1 || l.trim().length > 0)
        .join("\n") + "\n",
      "utf-8"
    );
    return true;
  } catch (err) {
    console.warn(`Failed to update txt file at ${txtPath}:`, err);
    return false;
  }
}
