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
  const width = Math.min(1200, Math.max(100, parseInt(widthStr, 10) || 600));

  if (!src) {
    return new NextResponse("Missing src parameter", { status: 400 });
  }

  // Resolve path to the source image
  // src is e.g. "/photos/2026/d20261026125756_desktop.jpg"
  let cleanSrc = decodeURIComponent(src).replace(/^\/+/, "");
  let fullPath = path.join(process.cwd(), "public", cleanSrc);

  // If symlink or path doesn't exist in public, check Google Drive source dir directly
  if (!fs.existsSync(fullPath)) {
    const gdriveDir =
      "/Users/ketchemr/Library/CloudStorage/GoogleDrive-ketchemr@gmail.com/My Drive/www/rrkphoto.com";
    fullPath = path.join(gdriveDir, cleanSrc);
  }

  if (!fs.existsSync(fullPath)) {
    return new NextResponse("Image not found", { status: 404 });
  }

  try {
    const stats = fs.statSync(fullPath);
    // Cache key incorporates image path, mtime, and requested width
    const safeKey = cleanSrc.replace(/[^a-zA-Z0-9_-]/g, "_") + `_${stats.mtimeMs}_w${width}.jpg`;
    const cachedFilePath = path.join(THUMB_CACHE_DIR, safeKey);

    // If already generated and cached, serve from cache
    if (fs.existsSync(cachedFilePath)) {
      const cachedBuffer = fs.readFileSync(cachedFilePath);
      return new NextResponse(cachedBuffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Downsample using sharp with high-quality Lanczos3 anti-aliasing filter
    const thumbBuffer = await sharp(fullPath)
      .resize(width, null, {
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: true,
      })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();

    // Save to disk cache asynchronously
    fs.writeFile(cachedFilePath, thumbBuffer, () => {});

    return new NextResponse(thumbBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    console.error("Thumbnail generation error:", err);
    return new NextResponse("Error generating thumbnail", { status: 500 });
  }
}
