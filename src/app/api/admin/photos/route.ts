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
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const allPhotos = getAllPhotos();

  let results = allPhotos;
  if (q) {
    results = allPhotos.filter(
      (p) =>
        p.photoID.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        String(p.dateTaken?.year).includes(q)
    );
  }

  const photos = results.slice(0, limit).map((p) => ({
    photoID: p.photoID,
    title: p.title,
    imageDesktop: p.imageDesktop,
    dateTaken: p.dateTaken,
    categories: p.categories,
    createdTimestamp: p.createdTimestamp,
  }));

  return NextResponse.json({
    total: results.length,
    photos,
  });
}
