import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { MEDIA_MIME_MAP } from "@/lib/media";

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

function findMediaFile(slug: string[]): string | null {
  if (!slug || slug.length === 0) return null;
  // Prevent directory traversal
  const safeSlug = slug.map((s) => path.basename(s));
  const subPath = path.join(...safeSlug);

  const candidates = [
    path.join(process.cwd(), "public", "photos", subPath),
    path.join(resolvePhotosDir(), subPath),
  ];

  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return cand;
      }
    } catch {}
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const foundPath = findMediaFile(slug);
    if (!foundPath) {
      return new NextResponse(null, { status: 404 });
    }

    const stat = fs.statSync(foundPath);
    const ext = path.extname(foundPath).toLowerCase();
    const contentType = MEDIA_MIME_MAP[ext] || "application/octet-stream";
    const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
    const hasVersion = req.nextUrl.searchParams.has("v");
    const cacheControl = hasVersion
      ? "public, max-age=31536000, immutable"
      : "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(stat.size),
        "Accept-Ranges": "bytes",
        "Last-Modified": stat.mtime.toUTCString(),
        ETag: etag,
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const foundPath = findMediaFile(slug);
    if (!foundPath) {
      return new NextResponse("Media not found", { status: 404 });
    }

    const stat = fs.statSync(foundPath);
    const fileSize = stat.size;
    const ext = path.extname(foundPath).toLowerCase();
    const contentType = MEDIA_MIME_MAP[ext] || "application/octet-stream";
    const etag = `W/"${fileSize.toString(16)}-${stat.mtimeMs.toString(16)}"`;

    const hasVersion = req.nextUrl.searchParams.has("v");
    const cacheControl = hasVersion
      ? "public, max-age=31536000, immutable"
      : "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400";

    const rangeHeader = req.headers.get("range");

    // HTTP Range streaming (required for video seeking & Safari playback)
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (!match) {
        return new NextResponse("Invalid Range", {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const startStr = match[1];
      const endStr = match[2];
      let start: number;
      let end: number;

      if (startStr === "" && endStr !== "") {
        // Suffix range: bytes=-500
        const suffixLen = parseInt(endStr, 10);
        start = Math.max(0, fileSize - suffixLen);
        end = fileSize - 1;
      } else {
        start = parseInt(startStr, 10);
        end = endStr ? parseInt(endStr, 10) : Math.min(start + 4 * 1024 * 1024 - 1, fileSize - 1);
      }

      if (isNaN(start) || isNaN(end) || start < 0 || end >= fileSize || start > end) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = fs.createReadStream(foundPath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": String(chunkSize),
          "Accept-Ranges": "bytes",
          "Last-Modified": stat.mtime.toUTCString(),
          ETag: etag,
          "Cache-Control": cacheControl,
        },
      });
    }

    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    // Stream video or large files without loading entirely into RAM
    if (contentType.startsWith("video/") || fileSize > 8 * 1024 * 1024) {
      const nodeStream = fs.createReadStream(foundPath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;
      return new NextResponse(webStream, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(fileSize),
          "Accept-Ranges": "bytes",
          "Last-Modified": stat.mtime.toUTCString(),
          ETag: etag,
          "Cache-Control": cacheControl,
        },
      });
    }

    const fileBuffer = fs.readFileSync(foundPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
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
