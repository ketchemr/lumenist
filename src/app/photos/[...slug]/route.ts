import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function resolvePhotosDir(): string {
  if (process.env.PHOTOS_DIR && fs.existsSync(process.env.PHOTOS_DIR)) {
    return process.env.PHOTOS_DIR;
  }
  if (
    process.env.PHOTOS_SOURCE_DIR &&
    fs.existsSync(process.env.PHOTOS_SOURCE_DIR)
  ) {
    return process.env.PHOTOS_SOURCE_DIR;
  }
  if (
    process.env.LOCAL_PHOTO_DIR &&
    fs.existsSync(process.env.LOCAL_PHOTO_DIR)
  ) {
    return process.env.LOCAL_PHOTO_DIR;
  }
  const publicPhotos = path.join(process.cwd(), "public", "photos");
  try {
    return fs.realpathSync(publicPhotos);
  } catch {
    return publicPhotos;
  }
}

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
};

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    if (!slug || slug.length === 0) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Prevent directory traversal
    const safeSlug = slug.map((s) => path.basename(s));
    const subPath = path.join(...safeSlug);

    // Candidates to search
    const candidates = [
      path.join(process.cwd(), "public", "photos", subPath),
      path.join(resolvePhotosDir(), subPath),
      path.join("/home/ubuntu/photos", subPath),
    ];

    let foundPath: string | null = null;
    for (const cand of candidates) {
      try {
        if (fs.existsSync(cand)) {
          foundPath = cand;
          break;
        }
      } catch {}
    }

    if (!foundPath) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const stat = fs.statSync(foundPath);
    if (!stat.isFile()) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const ext = path.extname(foundPath).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";
    const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;

    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    const fileBuffer = fs.readFileSync(foundPath);

    const hasVersion = req.nextUrl.searchParams.has("v");
    const cacheControl = hasVersion
      ? "public, max-age=31536000, immutable"
      : "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Last-Modified": stat.mtime.toUTCString(),
        ETag: etag,
        "Cache-Control": cacheControl,
      },
    });
  } catch (err: any) {
    console.error("Photos route error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
