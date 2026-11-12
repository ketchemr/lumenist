import { NextRequest, NextResponse } from "next/server";
import { getAllPhotos } from "@/lib/photos";
import { isAuthenticatedAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const isAuthed = await isAuthenticatedAdmin();
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limitParam = searchParams.get("limit") || "50";
  const limit =
    limitParam === "all" ? 100000 : Math.max(1, parseInt(limitParam, 10));
  const albumFilter = (searchParams.get("album") || "").trim().toLowerCase();

  const allPhotos = getAllPhotos();

  // Extract all unique albums across all photos for filtering dropdown
  const albumSet = new Set<string>();
  let unassignedCount = 0;
  allPhotos.forEach((p) => {
    const cats = (p.categories || []).filter((c) => c && c.trim());
    if (cats.length === 0) {
      unassignedCount++;
    } else {
      cats.forEach((c) => albumSet.add(c.trim()));
    }
  });
  const allAlbums = Array.from(albumSet).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  let results = allPhotos;

  // Filter by album if specified
  if (albumFilter && albumFilter !== "all") {
    if (albumFilter === "__unassigned__") {
      results = results.filter((p) => !p.categories || p.categories.length === 0);
    } else {
      results = results.filter((p) =>
        p.categories?.some((c) => c.toLowerCase() === albumFilter)
      );
    }
  }

  // Filter by search query across multiple fields
  if (q) {
    results = results.filter(
      (p) =>
        p.photoID.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.categories?.some((c) => c.toLowerCase().includes(q)) ||
        p.keywords?.some((k) => k.toLowerCase().includes(q)) ||
        String(p.dateTaken?.year).includes(q)
    );
  }

  const total = results.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * limit;

  const pageItems = results.slice(offset, offset + limit);

  const photos = pageItems.map((p) => ({
    photoID: p.photoID,
    title: p.title,
    imageDesktop: p.imageDesktop,
    dateTaken: p.dateTaken,
    categories: p.categories || [],
    keywords: p.keywords || [],
    createdTimestamp: p.createdTimestamp,
  }));

  return NextResponse.json({
    total,
    page: currentPage,
    pageSize: limit,
    totalPages,
    photos,
    allAlbums,
    unassignedCount,
  });
}
