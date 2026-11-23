import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { resolvePhotosDir } from "@/lib/adminCatalog";
import { Photo } from "@/types/photo";
import {
  DuplicateMode,
  ImportImageResult,
  ImportManifestRow,
  matchManifestRow,
  parseManifestFile,
  processImageImport,
} from "@/lib/bulkImport";

const SUPPORTED_IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
]);

export async function POST(req: NextRequest) {
  try {
    const isAuthed = await isAuthenticatedAdmin();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const rawFiles = formData.getAll("files");
    const files = rawFiles.filter(
      (f): f is File => f instanceof File && f.size > 0
    );

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one image file to import." },
        { status: 400 }
      );
    }

    const rawDuplicateMode = String(formData.get("duplicateMode") || "skip")
      .trim()
      .toLowerCase();
    const duplicateMode: DuplicateMode =
      rawDuplicateMode === "overwrite" || rawDuplicateMode === "merge"
        ? rawDuplicateMode
        : "skip";

    let manifestRows: ImportManifestRow[] = [];
    const manifestFile = formData.get("manifest");
    if (manifestFile instanceof File && manifestFile.size > 0) {
      try {
        const text = await manifestFile.text();
        manifestRows = parseManifestFile(manifestFile.name, text);
      } catch (err: any) {
        return NextResponse.json(
          { error: `Invalid manifest file: ${err?.message || "parse error"}` },
          { status: 400 }
        );
      }
    }

    const catalogPath = path.join(process.cwd(), "data", "photos.json");
    let catalog: Photo[] = [];
    if (fs.existsSync(catalogPath)) {
      try {
        catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
      } catch {
        catalog = [];
      }
    }

    const existingById = new Map<string, Photo>();
    for (const p of catalog) {
      existingById.set(p.photoID, p);
    }

    const photosRoot = resolvePhotosDir();
    if (!fs.existsSync(photosRoot)) {
      fs.mkdirSync(photosRoot, { recursive: true });
    }

    const results: ImportImageResult[] = [];
    const summary = {
      imported: 0,
      updated: 0,
      merged: 0,
      skipped: 0,
      errors: 0,
    };

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      if (!SUPPORTED_IMAGE_EXTS.has(ext)) {
        summary.errors += 1;
        results.push({
          photoID: file.name,
          filename: file.name,
          status: "error",
          message: `Unsupported image format (${ext || "unknown"})`,
        });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const matchedRow = matchManifestRow(file.name, manifestRows);
        const res = await processImageImport({
          buffer,
          originalFilename: file.name,
          manifestRow: matchedRow,
          photosRoot,
          existingById,
          duplicateMode,
        });

        if (res.photo) {
          existingById.set(res.photo.photoID, res.photo);
        }
        if (res.status === "imported") summary.imported += 1;
        else if (res.status === "updated") summary.updated += 1;
        else if (res.status === "merged") summary.merged += 1;
        else if (res.status === "skipped") summary.skipped += 1;
        else summary.errors += 1;

        results.push({
          photoID: res.photoID,
          filename: res.filename,
          status: res.status,
          message: res.message,
        });
      } catch (err: any) {
        summary.errors += 1;
        results.push({
          photoID: file.name,
          filename: file.name,
          status: "error",
          message: err?.message || "Failed to import image",
        });
      }
    }

    const nextCatalog = Array.from(existingById.values());
    nextCatalog.sort((a, b) => {
      const aDate =
        (a.dateTaken?.year || 0) * 10000 +
        (a.dateTaken?.month || 0) * 100 +
        (a.dateTaken?.day || 0);
      const bDate =
        (b.dateTaken?.year || 0) * 10000 +
        (b.dateTaken?.month || 0) * 100 +
        (b.dateTaken?.day || 0);
      if (bDate !== aDate) return bDate - aDate;
      return b.photoID.localeCompare(a.photoID);
    });

    const dataDir = path.dirname(catalogPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(catalogPath, JSON.stringify(nextCatalog, null, 2), "utf-8");

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/albums");
    revalidatePath("/map");

    return NextResponse.json({
      ok: true,
      summary,
      totalCatalogCount: nextCatalog.length,
      results,
    });
  } catch (err: any) {
    console.error("Bulk import error:", err);
    return NextResponse.json(
      { error: err?.message || "Bulk import failed" },
      { status: 500 }
    );
  }
}
