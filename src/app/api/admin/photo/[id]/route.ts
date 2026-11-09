import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { Photo, PhotoLocation, PhotoSize } from "@/types/photo";
import {
  resolvePhotosDir,
  findCandidateFilesToDelete,
} from "@/lib/adminCatalog";

export const dynamic = "force-dynamic";

export async function GET(
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

    const catalog: Photo[] = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
    const photo = catalog.find((p) => p.photoID === id);

    if (!photo) {
      return NextResponse.json(
        { error: `Photograph with ID "${id}" not found in catalog` },
        { status: 404 }
      );
    }

    return NextResponse.json({ photo });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load photograph" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const year = photo.dateTaken?.year || String(id).slice(1, 5) || "2026";
    const targetFolder = path.join(photosRoot, String(year));

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const formData = await req.formData();
    const replacementFile = formData.get("file") as File | null;

    // Optional replacement image processing
    const defaultSize: PhotoSize = {
      width: 1600,
      height: 1067,
      aspectRatio: 1.5,
      orientation: "horizontal",
    };
    let updatedSize: PhotoSize = photo.size || defaultSize;
    let imageReplaced = false;

    if (replacementFile && replacementFile.size > 0) {
      const arrayBuffer = await replacementFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const sharpInstance = sharp(buffer);
      const imgMeta = await sharpInstance.metadata();
      const width = imgMeta.width || updatedSize.width;
      const height = imgMeta.height || updatedSize.height;
      const orientation: "horizontal" | "vertical" | "square" =
        width === height ? "square" : height > width ? "vertical" : "horizontal";
      const aspectRatio = parseFloat((width / height).toFixed(3));
      updatedSize = { width, height, aspectRatio, orientation };

      const desktopFilename = `${id}_desktop.jpg`;
      const targetImagePath = path.join(targetFolder, desktopFilename);

      if (width > 2400) {
        await sharpInstance
          .resize({ width: 2400, withoutEnlargement: true })
          .jpeg({ quality: 92, mozjpeg: true })
          .toFile(targetImagePath);
      } else {
        fs.writeFileSync(targetImagePath, buffer);
      }

      // Also ensure public/photos copy is synced if public/photos isn't symlinked
      const publicTargetFolder = path.join(process.cwd(), "public", "photos", String(year));
      if (fs.existsSync(publicTargetFolder) && publicTargetFolder !== targetFolder) {
        try {
          fs.copyFileSync(targetImagePath, path.join(publicTargetFolder, desktopFilename));
        } catch {}
      }

      imageReplaced = true;

      // Invalidate existing cached thumbnails for this photo ID
      const thumbDir = path.join(process.cwd(), ".thumbnails");
      if (fs.existsSync(thumbDir)) {
        try {
          const cachedFiles = fs.readdirSync(thumbDir);
          for (const cf of cachedFiles) {
            if (cf.includes(id)) {
              fs.unlinkSync(path.join(thumbDir, cf));
            }
          }
        } catch (e) {
          console.warn("Could not clear cached thumbnails:", e);
        }
      }
    }

    // Process updated textual fields
    const title = (formData.get("title") as string)?.trim() ?? photo.title;
    const description =
      (formData.get("description") as string)?.trim() ?? photo.description ?? "";
    const albumsRaw = formData.get("albums") as string | null;
    const tagsRaw = formData.get("tags") as string | null;
    const tripod = (formData.get("tripod") as string)?.trim() ?? photo.tripod ?? "None";
    const availability =
      (formData.get("availability") as string)?.trim() ??
      photo.availability ??
      "Available for Order";

    const camera = (formData.get("camera") as string)?.trim() ?? photo.camera;
    const lens = (formData.get("lens") as string)?.trim() ?? photo.lens;
    const focalLength =
      (formData.get("focalLength") as string)?.trim() ?? photo.focalLength;
    const shutterSpeed =
      (formData.get("shutterspeed") as string)?.trim() ?? photo.shutterspeed;
    const aperture =
      (formData.get("aperture") as string)?.trim() ?? photo.aperture;
    const iso = (formData.get("iso") as string)?.trim() ?? photo.sensitivity;
    const exposureComp =
      (formData.get("exposureCompensation") as string)?.trim() ??
      photo.exposureCompensation;
    const whiteBalance =
      (formData.get("whiteBalance") as string)?.trim() ?? photo.whiteBalance;

    // Categories and Tags
    const categories = albumsRaw !== null
      ? albumsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : photo.categories;

    const keywords = tagsRaw !== null
      ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : photo.keywords;

    // Coordinates processing
    let newLocation: PhotoLocation | undefined = photo.location;
    const hasLocation = formData.get("hasLocation");
    const rawLat = formData.get("latitude") as string | null;
    const rawLon = formData.get("longitude") as string | null;

    if (hasLocation === "false" || rawLat === "") {
      newLocation = undefined;
    } else if (rawLat !== null && rawLon !== null) {
      const parsedLat = parseFloat(rawLat);
      const parsedLon = parseFloat(rawLon);
      if (
        !isNaN(parsedLat) &&
        !isNaN(parsedLon) &&
        parsedLat >= -90 &&
        parsedLat <= 90 &&
        parsedLon >= -180 &&
        parsedLon <= 180
      ) {
        newLocation = {
          latitude: parseFloat(parsedLat.toFixed(6)),
          longitude: parseFloat(parsedLon.toFixed(6)),
        };
      }
    }

    // Write updated .txt file
    const txtFilename = `${id}.txt`;
    const targetTxtPath = path.join(targetFolder, txtFilename);

    const txtLines = [
      `photoID:${id}`,
      `title:${title}`,
      description ? `description:${description}` : "",
      newLocation ? `location:${newLocation.latitude.toFixed(6)},${newLocation.longitude.toFixed(6)}` : "",
      categories.length > 0 ? `albums:${categories.join(",")}` : "",
      keywords.length > 0 ? `tags:${keywords.join(",")}` : "",
      `size:${updatedSize.width}x${updatedSize.height}`,
      tripod ? `tripod:${tripod}` : "tripod:None",
      availability ? `availability:${availability}` : "availability:Available for Order",
    ].filter(Boolean);

    fs.writeFileSync(targetTxtPath, txtLines.join("\n") + "\n", "utf-8");

    // Also sync public/photos .txt if separate
    const publicTxtPath = path.join(process.cwd(), "public", "photos", String(year), txtFilename);
    if (fs.existsSync(path.dirname(publicTxtPath)) && publicTxtPath !== targetTxtPath) {
      try {
        fs.copyFileSync(targetTxtPath, publicTxtPath);
      } catch {}
    }

    // Update Photo in catalog
    const updatedPhoto: Photo = {
      ...photo,
      title,
      description,
      categories: categories.length > 0 ? categories : ["All"],
      keywords,
      size: updatedSize,
      camera,
      lens,
      focalLength,
      shutterspeed: shutterSpeed,
      aperture,
      sensitivity: iso,
      exposureCompensation: exposureComp,
      whiteBalance,
      tripod,
      availability,
      location: newLocation,
    };

    catalog[photoIndex] = updatedPhoto;
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      imageReplaced,
      photo: updatedPhoto,
    });
  } catch (err: any) {
    console.error("Update photo error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update photograph" },
      { status: 500 }
    );
  }
}

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
