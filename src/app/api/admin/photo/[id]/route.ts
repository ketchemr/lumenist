import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { Photo } from "@/types/photo";
import {
  resolvePhotosDir,
  findCandidateFilesToDelete,
} from "@/lib/adminCatalog";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAuthed = await isAuthenticatedAdmin();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "No photo ID provided" },
        { status: 400 }
      );
    }

    const catalogPath = path.join(process.cwd(), "data", "photos.json");
    if (!fs.existsSync(catalogPath)) {
      return NextResponse.json(
        { error: "Catalog not found" },
        { status: 404 }
      );
    }

    let catalog: Photo[] = [];
    try {
      catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
    } catch {
      catalog = [];
    }

    const photoIndex = catalog.findIndex((p) => p.photoID === id);
    if (photoIndex === -1) {
      return NextResponse.json(
        { error: `Photograph with ID "${id}" not found in catalog` },
        { status: 404 }
      );
    }

    const photo = catalog[photoIndex];
    const photosRoot = resolvePhotosDir();

    // Determine candidate files to delete on disk
    const uniqueFiles = findCandidateFilesToDelete(photo, photosRoot);
    const deletedFiles: string[] = [];

    for (const filePath of uniqueFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deletedFiles.push(path.basename(filePath));
        }
      } catch (err) {
        console.warn(`Could not delete file ${filePath}:`, err);
      }
    }

    // Remove photo from catalog and write back atomically
    catalog.splice(photoIndex, 1);
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      photoID: id,
      deletedFiles,
      remainingCount: catalog.length,
    });
  } catch (err: any) {
    console.error("Delete photo error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete photograph" },
      { status: 500 }
    );
  }
}
