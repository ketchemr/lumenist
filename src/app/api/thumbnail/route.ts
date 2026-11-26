import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getPhotoById, syncPhotoSizeFromDimensions } from "@/lib/photos";

const THUMB_CACHE_DIR = path.join(process.cwd(), ".thumbnails");
if (!fs.existsSync(THUMB_CACHE_DIR)) {
  fs.mkdirSync(THUMB_CACHE_DIR, { recursive: true });
}

const ALLOWED_IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
  ".tif",
  ".tiff",
]);

const ALLOWED_WIDTHS = [150, 300, 400, 600, 800, 1200, 1600];

function snapToAllowedWidth(rawWidth: number): number {
  const clamped = Math.min(1600, Math.max(100, rawWidth || 600));
  let best = ALLOWED_WIDTHS[0];
  let bestDiff = Math.abs(clamped - best);
  for (const w of ALLOWED_WIDTHS) {
    const diff = Math.abs(clamped - w);
    if (diff < bestDiff) {
      best = w;
      bestDiff = diff;
    }
  }
  return best;
}

function getAllowedImageRoots(): string[] {
  const rawRoots = [
    path.join(process.cwd(), "public", "photos"),
    process.env.PHOTOS_DIR,
    process.env.LOCAL_PHOTO_DIR,
    process.env.PHOTOS_SOURCE_DIR,
  ].filter((d): d is string => Boolean(d));

  const resolved: string[] = [];
  for (const root of rawRoots) {
    try {
      if (fs.existsSync(root)) {
        resolved.push(fs.realpathSync(root));
      }
    } catch {
      resolved.push(path.resolve(root));
    }
  }
  return Array.from(new Set(resolved));
}

function resolveSafeImagePath(rawSrc: string): { fullPath: string; cleanSrc: string } | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawSrc);
  } catch {
    return null;
  }

  // Strip query string and leading slashes; reject null bytes, backslashes, or traversal segments
  const cleanSrc = decoded.split("?")[0].replace(/^\/+/, "");
  if (!cleanSrc || cleanSrc.includes("\0") || cleanSrc.includes("\\")) {
    return null;
  }

  const segments = cleanSrc.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((s) => s === "." || s === "..")) {
    return null;
  }

  // Only allow image files to prevent file-existence oracle on non-image files
  const ext = path.extname(segments[segments.length - 1]).toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.has(ext)) {
    return null;
  }

  const allowedRoots = getAllowedImageRoots();
  if (allowedRoots.length === 0) return null;

  // Strip optional leading "photos/" prefix when checking against photos roots
  const subSegments = segments[0] === "photos" ? segments.slice(1) : segments;
  if (subSegments.length === 0) return null;
  const subPath = path.join(...subSegments);

  for (const root of allowedRoots) {
    const candidate = path.resolve(root, subPath);
    if (!candidate.startsWith(root + path.sep)) {
      continue;
    }
    try {
      if (fs.existsSync(candidate)) {
        const realCandidate = fs.realpathSync(candidate);
        if (
          realCandidate.startsWith(root + path.sep) &&
          fs.statSync(realCandidate).isFile()
        ) {
          return { fullPath: realCandidate, cleanSrc: `photos/${subSegments.join("/")}` };
        }
      }
    } catch {
      // Try next allowed root
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let src = searchParams.get("src");
  const id = searchParams.get("id");
  const widthStr = searchParams.get("w") || searchParams.get("size") || "600";
  const width = snapToAllowedWidth(parseInt(widthStr, 10));

  if (!src && id) {
    const photo = getPhotoById(id);
    if (!photo || !photo.imageDesktop) {
      return new NextResponse("Image not found", { status: 404 });
    }
    src = photo.imageDesktop;
  }

  if (!src) {
    return new NextResponse("Missing src or id parameter", { status: 400 });
  }

  const resolved = resolveSafeImagePath(src);
  if (!resolved) {
    return new NextResponse("Image not found", { status: 404 });
  }
  const { fullPath, cleanSrc } = resolved;

  try {
    const stats = fs.statSync(fullPath);

    // Determine output format (WebP by default for modern browsers, JPEG fallback)
    const acceptHeader = request.headers.get("accept") || "";
    const formatParam = searchParams.get("fmt") || searchParams.get("format");
    let isWebP = true;
    if (formatParam === "jpg" || formatParam === "jpeg") {
      isWebP = false;
    } else if (formatParam === "webp") {
      isWebP = true;
    } else {
      isWebP = acceptHeader.includes("image/webp") || !acceptHeader.includes("image/jpeg");
    }

    const ext = isWebP ? "webp" : "jpg";
    const contentType = isWebP ? "image/webp" : "image/jpeg";

    // Cache key incorporates image path, mtime, requested width, and format
    const safeKey = cleanSrc.replace(/[^a-zA-Z0-9_-]/g, "_") + `_${stats.mtimeMs}_w${width}.${ext}`;
    const cachedFilePath = path.join(THUMB_CACHE_DIR, safeKey);

    // If already generated and cached, serve directly from disk cache
    if (fs.existsSync(cachedFilePath)) {
      const cachedBuffer = fs.readFileSync(cachedFilePath);
      return new NextResponse(cachedBuffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Vary": "Accept",
        },
      });
    }

    // Downsample using sharp with high-quality Lanczos3 anti-aliasing filter
    const sharpInstance = sharp(fullPath);
    try {
      sharpInstance.metadata().then((meta) => {
        if (meta.width && meta.height) {
          syncPhotoSizeFromDimensions(cleanSrc, meta.width, meta.height, stats.mtimeMs);
        }
      }).catch(() => {});
    } catch {}

    let pipeline = sharpInstance.resize(width, null, {
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    });

    if (isWebP) {
      pipeline = pipeline.webp({ quality: 80, effort: 4 });
    } else {
      pipeline = pipeline.jpeg({ quality: 84, mozjpeg: true });
    }

    const thumbBuffer = await pipeline.toBuffer();

    // Save to disk cache asynchronously
    fs.writeFile(cachedFilePath, thumbBuffer, () => {});

    return new NextResponse(thumbBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Vary": "Accept",
      },
    });
  } catch (err: any) {
    console.error("Thumbnail generation error:", err);
    return new NextResponse("Error generating thumbnail", { status: 500 });
  }
}
