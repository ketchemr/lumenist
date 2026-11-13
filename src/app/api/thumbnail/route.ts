import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const THUMB_CACHE_DIR = path.join(process.cwd(), ".thumbnails");
if (!fs.existsSync(THUMB_CACHE_DIR)) {
  fs.mkdirSync(THUMB_CACHE_DIR, { recursive: true });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get("src");
  const widthStr = searchParams.get("w") || "600";
  const width = Math.min(1600, Math.max(100, parseInt(widthStr, 10) || 600));

  if (!src) {
    return new NextResponse("Missing src parameter", { status: 400 });
  }

  // Resolve path to the source image
  // src is e.g. "/photos/2026/d20261026125756_desktop.jpg" (or with ?v=... cache buster)
  let cleanSrc = decodeURIComponent(src).replace(/^\/+/, "").split("?")[0];
  let fullPath = path.join(process.cwd(), "public", cleanSrc);

  // If symlink or path doesn't exist in public, check configured external photo dir directly
  if (!fs.existsSync(fullPath)) {
    const externalDir =
      process.env.LOCAL_PHOTO_DIR || process.env.PHOTOS_SOURCE_DIR;
    if (externalDir) {
      fullPath = path.join(externalDir, cleanSrc);
    }
  }

  if (!fs.existsSync(fullPath)) {
    return new NextResponse("Image not found", { status: 404 });
  }

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
    let pipeline = sharp(fullPath).resize(width, null, {
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
