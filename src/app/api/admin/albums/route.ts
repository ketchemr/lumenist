import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { Photo } from "@/types/photo";
import {
  resolvePhotosDir,
  findTxtPath,
  updateTxtFileMetadata,
  isPhotoOnlyInAll,
  getCustomAlbums,
  saveCustomAlbums,
} from "@/lib/adminCatalog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const isAuthed = await isAuthenticatedAdmin();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const catalogPath = path.join(process.cwd(), "data", "photos.json");
    if (!fs.existsSync(catalogPath)) {
      return NextResponse.json({
        albums: [],
        unassignedCount: 0,
        onlyInAllCount: 0,
        totalPhotos: 0,
      });
    }

    let catalog: Photo[] = [];
    try {
      catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
    } catch {
      catalog = [];
    }

    const customAlbums = getCustomAlbums();
    const albumMap = new Map<string, { count: number; photos: Photo[] }>();

    // Seed any explicitly created custom albums even before photos are assigned
    for (const alb of customAlbums) {
      const trimmed = alb.trim();
      if (trimmed && trimmed.toLowerCase() !== "all") {
        if (!albumMap.has(trimmed)) {
          albumMap.set(trimmed, { count: 0, photos: [] });
        }
      }
    }

    let onlyInAllCount = 0;

    for (const photo of catalog) {
      if (isPhotoOnlyInAll(photo)) {
        onlyInAllCount++;
      } else {
        const cats = (photo.categories || []).filter(
          (c) => c && c.trim() && c.trim().toLowerCase() !== "all"
        );
        for (const cat of cats) {
          const trimmed = cat.trim();
          if (!albumMap.has(trimmed)) {
            albumMap.set(trimmed, { count: 0, photos: [] });
          }
          const entry = albumMap.get(trimmed)!;
          entry.count++;
          if (entry.photos.length < 5) {
            entry.photos.push(photo);
          }
        }
      }
    }

    const curatedAlbums = Array.from(albumMap.entries())
      .map(([name, data]) => {
        // Pick a nice cover photo if available
        const cover = data.photos[0];
        return {
          name,
          slug: encodeURIComponent(name),
          count: data.count,
          coverPhoto: cover
            ? {
                photoID: cover.photoID,
                title: cover.title,
                imageDesktop: cover.imageDesktop,
                size: cover.size,
              }
            : undefined,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    // Pick a random cover photo for "All"
    const randomAllPhoto =
      catalog.length > 0
        ? catalog[Math.floor(Math.random() * catalog.length)]
        : undefined;

    const allAlbum = {
      name: "All",
      slug: "All",
      count: catalog.length,
      isSystemArchive: true,
      coverPhoto: randomAllPhoto
        ? {
            photoID: randomAllPhoto.photoID,
            title: randomAllPhoto.title,
            imageDesktop: randomAllPhoto.imageDesktop,
            size: randomAllPhoto.size,
          }
        : undefined,
    };

    const albums = [allAlbum, ...curatedAlbums];

    return NextResponse.json({
      albums,
      unassignedCount: onlyInAllCount,
      onlyInAllCount,
      totalPhotos: catalog.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load albums" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAuthed = await isAuthenticatedAdmin();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action;

    const catalogPath = path.join(process.cwd(), "data", "photos.json");
    if (!fs.existsSync(catalogPath)) {
      return NextResponse.json({ error: "Catalog not found" }, { status: 404 });
    }

    let catalog: Photo[] = [];
    try {
      catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
    } catch {
      catalog = [];
    }

    const photosRoot = resolvePhotosDir();

    // 0. CREATE ALBUM
    if (action === "create") {
      const name = (body.name || "").trim();
      if (!name) {
        return NextResponse.json(
          { error: "Album name is required" },
          { status: 400 }
        );
      }
      if (name.toLowerCase() === "all") {
        return NextResponse.json(
          { error: "Cannot use reserved collection name 'All'" },
          { status: 400 }
        );
      }

      // Check existing albums in catalog and custom albums
      const customAlbums = getCustomAlbums();
      const existingInCatalog = catalog.some((p) =>
        (p.categories || []).some((c) => c.toLowerCase() === name.toLowerCase())
      );
      const existingInCustom = customAlbums.some(
        (a) => a.toLowerCase() === name.toLowerCase()
      );

      if (existingInCatalog || existingInCustom) {
        return NextResponse.json(
          { error: `Album "${name}" already exists` },
          { status: 400 }
        );
      }

      saveCustomAlbums([...customAlbums, name]);

      return NextResponse.json({
        success: true,
        action: "create",
        name,
        message: `Album "${name}" created successfully. You can now assign photographs to it.`,
      });
    }

    // 1. RENAME ALBUM
    if (action === "rename") {
      const oldName = (body.oldName || "").trim();
      const newName = (body.newName || "").trim();

      if (!oldName) {
        return NextResponse.json(
          { error: "Current album name is required" },
          { status: 400 }
        );
      }
      if (!newName) {
        return NextResponse.json(
          { error: "New album name is required" },
          { status: 400 }
        );
      }
      if (oldName.toLowerCase() === "all" || newName.toLowerCase() === "all") {
        return NextResponse.json(
          { error: "Cannot use reserved collection name 'All'" },
          { status: 400 }
        );
      }
      if (oldName === newName) {
        return NextResponse.json(
          { error: "New album name is identical to current name" },
          { status: 400 }
        );
      }

      let updatedCount = 0;
      const lowerOld = oldName.toLowerCase();

      for (const photo of catalog) {
        photo.categories = photo.categories || [];
        const hasOld = photo.categories.some((c) => c.toLowerCase() === lowerOld);

        if (hasOld) {
          // Replace oldName with newName
          const nextCategories: string[] = [];
          for (const c of photo.categories) {
            if (c.toLowerCase() === lowerOld) {
              if (!nextCategories.some((nc) => nc.toLowerCase() === newName.toLowerCase())) {
                nextCategories.push(newName);
              }
            } else {
              if (!nextCategories.some((nc) => nc.toLowerCase() === c.toLowerCase())) {
                nextCategories.push(c);
              }
            }
          }

          nextCategories.sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
          );
          photo.categories = nextCategories;

          // Update .txt file on disk
          const txtPath = findTxtPath(photo, photosRoot);
          if (txtPath) {
            updateTxtFileMetadata(txtPath, { categories: photo.categories });
          }
          updatedCount++;
        }
      }

      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

      // Update in custom albums
      const customAlbums = getCustomAlbums();
      const updatedCustom = customAlbums.map((a) =>
        a.toLowerCase() === lowerOld ? newName : a
      );
      saveCustomAlbums(updatedCustom);

      return NextResponse.json({
        success: true,
        action: "rename",
        oldName,
        newName,
        updatedCount,
        message: `Album "${oldName}" successfully renamed to "${newName}". Updated ${updatedCount} photograph${updatedCount === 1 ? "" : "s"}.`,
      });
    }

    // 2. DELETE ALBUM
    // Note: Only removes the album label/category from photographs.
    // The photographs themselves are NOT deleted and remain viewable in "All Photographs".
    if (action === "delete") {
      const name = (body.name || "").trim();

      if (!name) {
        return NextResponse.json(
          { error: "Album name is required" },
          { status: 400 }
        );
      }
      if (name.toLowerCase() === "all") {
        return NextResponse.json(
          { error: "Cannot delete the complete archive collection 'All'" },
          { status: 400 }
        );
      }

      let updatedCount = 0;
      const lowerName = name.toLowerCase();

      for (const photo of catalog) {
        photo.categories = photo.categories || [];
        const hasTarget = photo.categories.some((c) => c.toLowerCase() === lowerName);

        if (hasTarget) {
          // Remove the category label
          photo.categories = photo.categories.filter(
            (c) => c.toLowerCase() !== lowerName
          );

          // Update .txt file on disk
          const txtPath = findTxtPath(photo, photosRoot);
          if (txtPath) {
            updateTxtFileMetadata(txtPath, { categories: photo.categories });
          }
          updatedCount++;
        }
      }

      fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

      // Remove from custom albums
      const customAlbums = getCustomAlbums();
      const updatedCustom = customAlbums.filter(
        (a) => a.toLowerCase() !== lowerName
      );
      saveCustomAlbums(updatedCustom);

      return NextResponse.json({
        success: true,
        action: "delete",
        name,
        updatedCount,
        message: `Album "${name}" deleted. Removed label from ${updatedCount} photograph${updatedCount === 1 ? "" : "s"}. Photographs remain viewable in All Photographs.`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process album action" },
      { status: 500 }
    );
  }
}
