import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { Photo } from "@/types/photo";
import {
  resolvePhotosDir,
  findCandidateFilesToDelete,
  findTxtPath,
  updateTxtFileMetadata,
} from "@/lib/adminCatalog";

export const dynamic = "force-dynamic";

interface BulkRequest {
  action: "delete" | "addAlbum" | "removeAlbum" | "addTags" | "removeTag";
  photoIDs: string[];
  album?: string;
  tags?: string[];
  tag?: string;
}

export async function POST(req: NextRequest) {
  try {
    const isAuthed = await isAuthenticatedAdmin();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: BulkRequest = await req.json();
    const { action, photoIDs, album, tags, tag } = body;

    if (!photoIDs || !Array.isArray(photoIDs) || photoIDs.length === 0) {
      return NextResponse.json(
        { error: "No photograph IDs provided for bulk action" },
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

    const photosRoot = resolvePhotosDir();
    const idSet = new Set(photoIDs);
    let affectedCount = 0;

    if (action === "delete") {
      const deletedFilesTotal: string[] = [];
      const remainingCatalog: Photo[] = [];

      for (const photo of catalog) {
        if (idSet.has(photo.photoID)) {
          const filesToDelete = findCandidateFilesToDelete(photo, photosRoot);
          for (const filePath of filesToDelete) {
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                deletedFilesTotal.push(path.basename(filePath));
              }
            } catch (err) {
              console.warn(`Could not delete file ${filePath}:`, err);
            }
          }
          affectedCount++;
        } else {
          remainingCatalog.push(photo);
        }
      }

      fs.writeFileSync(
        catalogPath,
        JSON.stringify(remainingCatalog, null, 2),
        "utf-8"
      );

      try {
        revalidatePath("/", "layout");
      } catch {}

      return NextResponse.json({
        success: true,
        action: "delete",
        affectedCount,
        remainingCount: remainingCatalog.length,
        deletedFilesCount: deletedFilesTotal.length,
      });
    }

    if (action === "addAlbum") {
      const targetAlbum = (album || "").trim();
      if (!targetAlbum) {
        return NextResponse.json(
          { error: "Album name is required" },
          { status: 400 }
        );
      }

      for (const photo of catalog) {
        if (idSet.has(photo.photoID)) {
          photo.categories = photo.categories || [];
          if (
            !photo.categories.some(
              (c) => c.toLowerCase() === targetAlbum.toLowerCase()
            )
          ) {
            photo.categories.push(targetAlbum);
            photo.categories.sort((a, b) =>
              a.localeCompare(b, undefined, { sensitivity: "base" })
            );

            const txtPath = findTxtPath(photo, photosRoot);
            if (txtPath) {
              updateTxtFileMetadata(txtPath, {
                categories: photo.categories,
              });
            }
            affectedCount++;
          }
        }
      }

      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

      try {
        revalidatePath("/", "layout");
      } catch {}

      return NextResponse.json({
        success: true,
        action: "addAlbum",
        album: targetAlbum,
        affectedCount,
      });
    }

    if (action === "removeAlbum") {
      const targetAlbum = (album || "").trim().toLowerCase();
      if (!targetAlbum) {
        return NextResponse.json(
          { error: "Album name is required" },
          { status: 400 }
        );
      }

      for (const photo of catalog) {
        if (idSet.has(photo.photoID)) {
          photo.categories = photo.categories || [];
          const origLen = photo.categories.length;
          photo.categories = photo.categories.filter(
            (c) => c.toLowerCase() !== targetAlbum
          );
          if (photo.categories.length !== origLen) {
            const txtPath = findTxtPath(photo, photosRoot);
            if (txtPath) {
              updateTxtFileMetadata(txtPath, {
                categories: photo.categories,
              });
            }
            affectedCount++;
          }
        }
      }

      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

      try {
        revalidatePath("/", "layout");
      } catch {}

      return NextResponse.json({
        success: true,
        action: "removeAlbum",
        album,
        affectedCount,
      });
    }

    if (action === "addTags") {
      const incomingTags = (tags || [])
        .map((t) => t.trim())
        .filter(Boolean);

      if (incomingTags.length === 0) {
        return NextResponse.json(
          { error: "At least one tag is required" },
          { status: 400 }
        );
      }

      for (const photo of catalog) {
        if (idSet.has(photo.photoID)) {
          photo.keywords = photo.keywords || [];
          let photoChanged = false;

          for (const newTag of incomingTags) {
            if (
              !photo.keywords.some(
                (k) => k.toLowerCase() === newTag.toLowerCase()
              )
            ) {
              photo.keywords.push(newTag);
              photoChanged = true;
            }
          }

          if (photoChanged) {
            const txtPath = findTxtPath(photo, photosRoot);
            if (txtPath) {
              updateTxtFileMetadata(txtPath, {
                keywords: photo.keywords,
              });
            }
            affectedCount++;
          }
        }
      }

      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

      try {
        revalidatePath("/", "layout");
      } catch {}

      return NextResponse.json({
        success: true,
        action: "addTags",
        tags: incomingTags,
        affectedCount,
      });
    }

    if (action === "removeTag") {
      const targetTag = (tag || "").trim().toLowerCase();
      if (!targetTag) {
        return NextResponse.json(
          { error: "Tag name is required" },
          { status: 400 }
        );
      }

      for (const photo of catalog) {
        if (idSet.has(photo.photoID)) {
          photo.keywords = photo.keywords || [];
          const origLen = photo.keywords.length;
          photo.keywords = photo.keywords.filter(
            (k) => k.toLowerCase() !== targetTag
          );
          if (photo.keywords.length !== origLen) {
            const txtPath = findTxtPath(photo, photosRoot);
            if (txtPath) {
              updateTxtFileMetadata(txtPath, {
                keywords: photo.keywords,
              });
            }
            affectedCount++;
          }
        }
      }

      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

      try {
        revalidatePath("/", "layout");
      } catch {}

      return NextResponse.json({
        success: true,
        action: "removeTag",
        tag,
        affectedCount,
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("Bulk action error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute bulk action" },
      { status: 500 }
    );
  }
}
