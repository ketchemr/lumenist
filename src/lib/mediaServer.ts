import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import sharp from "sharp";
import { PhotoSize } from "@/types/photo";

const execFileAsync = promisify(execFile);

export interface SavedImageResult {
  filename: string;
  filePath: string;
  size: PhotoSize;
}

/**
 * Determines the canonical output extension for an uploaded image.
 * Preserves jpg, png, webp, avif, gif; converts tiff/other to jpg for universal browser support.
 */
export function resolveImageExtension(originalName: string, mimeType?: string): string {
  const ext = path.extname(originalName || "").toLowerCase();
  if (ext === ".png" || mimeType === "image/png") return ".png";
  if (ext === ".webp" || mimeType === "image/webp") return ".webp";
  if (ext === ".avif" || mimeType === "image/avif") return ".avif";
  if (ext === ".gif" || mimeType === "image/gif") return ".gif";
  return ".jpg";
}

/**
 * Saves an uploaded image buffer in its appropriate format, resizing if wider than 2400px
 * (except GIFs, which are written as-is to preserve animation).
 */
export async function saveUploadedImage(options: {
  buffer: Buffer;
  originalName: string;
  mimeType?: string;
  photoID: string;
  targetFolder: string;
}): Promise<SavedImageResult> {
  const { buffer, originalName, mimeType, photoID, targetFolder } = options;
  const outExt = resolveImageExtension(originalName, mimeType);
  const filename = `${photoID}${outExt}`;
  const filePath = path.join(targetFolder, filename);

  const sharpInstance = sharp(buffer);
  const imgMeta = await sharpInstance.metadata();
  const width = imgMeta.width || 1600;
  const height = imgMeta.height || 1067;
  const orientation: "horizontal" | "vertical" | "square" =
    width === height ? "square" : height > width ? "vertical" : "horizontal";
  const aspectRatio = parseFloat((width / height).toFixed(3));
  const size: PhotoSize = { width, height, aspectRatio, orientation };

  const inputExt = path.extname(originalName || "").toLowerCase();
  const needsConversion = inputExt === ".tif" || inputExt === ".tiff" || mimeType === "image/tiff";

  if (outExt === ".gif") {
    fs.writeFileSync(filePath, buffer);
  } else if (width > 2400 || needsConversion) {
    let pipeline = width > 2400
      ? sharp(buffer).resize({ width: 2400, withoutEnlargement: true })
      : sharp(buffer);

    if (outExt === ".png") {
      pipeline = pipeline.png({ compressionLevel: 8 });
    } else if (outExt === ".webp") {
      pipeline = pipeline.webp({ quality: 90 });
    } else if (outExt === ".avif") {
      pipeline = pipeline.avif({ quality: 82 });
    } else {
      pipeline = pipeline.jpeg({ quality: 92, mozjpeg: true });
    }
    await pipeline.toFile(filePath);
  } else {
    fs.writeFileSync(filePath, buffer);
  }

  return { filename, filePath, size };
}

/**
 * Attempts to extract a poster JPEG frame from a video file using ffmpeg if installed.
 */
export async function extractVideoPosterWithFfmpeg(
  videoPath: string,
  outputPosterPath: string
): Promise<boolean> {
  const attempts = ["00:00:01", "00:00:00"];
  for (const timestamp of attempts) {
    try {
      await execFileAsync(
        "ffmpeg",
        ["-y", "-ss", timestamp, "-i", videoPath, "-frames:v", "1", "-q:v", "2", outputPosterPath],
        { timeout: 30000 }
      );
      if (fs.existsSync(outputPosterPath) && fs.statSync(outputPosterPath).size > 0) {
        return true;
      }
    } catch {
      // Try next timestamp or fail gracefully if ffmpeg is not installed
    }
  }
  return false;
}

/**
 * Fetches a remote poster image (e.g. YouTube thumbnail) and saves it to disk.
 */
export async function fetchRemotePosterImage(
  urls: string[],
  photoID: string,
  targetFolder: string
): Promise<SavedImageResult | null> {
  for (const url of urls) {
    if (!url) continue;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const arr = await res.arrayBuffer();
      const buf = Buffer.from(arr);
      if (buf.length < 1000) continue;
      return await saveUploadedImage({
        buffer: buf,
        originalName: `${photoID}.jpg`,
        mimeType: "image/jpeg",
        photoID,
        targetFolder,
      });
    } catch {
      // Try next URL
    }
  }
  return null;
}
