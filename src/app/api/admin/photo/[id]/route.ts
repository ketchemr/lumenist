import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { Photo, PhotoLocation, PhotoSize } from "@/types/photo";
import {
  resolvePhotosDir,
  findCandidateFilesToDelete,
} from "@/lib/adminCatalog";
import {
  isSupportedVideoFilename,
  parseVideoEmbed,
  SUPPORTED_VIDEO_EXTENSIONS,
} from "@/lib/media";
import { saveUploadedImage } from "@/lib/mediaServer";

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

    // Optional Photo ID renaming
    const requestedPhotoID = (formData.get("photoID") as string)?.trim();
    const targetPhotoID = requestedPhotoID || id;
    const idChanged = targetPhotoID !== id;

    if (idChanged) {
      if (!/^[a-zA-Z0-9_-]+$/.test(targetPhotoID)) {
        return NextResponse.json(
          { error: "Photo ID may only contain letters, numbers, hyphens, and underscores." },
          { status: 400 }
        );
      }
      const existingIdx = catalog.findIndex((p) => p.photoID === targetPhotoID);
      if (existingIdx !== -1 && existingIdx !== photoIndex) {
        return NextResponse.json(
          { error: `Photograph with ID "${targetPhotoID}" already exists in catalog` },
          { status: 400 }
        );
      }
    }

    // Optional replacement image processing
    const defaultSize: PhotoSize = {
      width: 1600,
      height: 1067,
      aspectRatio: 1.5,
      orientation: "horizontal",
    };
    let updatedSize: PhotoSize = photo.size || defaultSize;
    let imageReplaced = false;
    let replacedDesktopFilename: string | null = null;

    if (replacementFile && replacementFile.size > 0) {
      const arrayBuffer = await replacementFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const saved = await saveUploadedImage({
        buffer,
        originalName: replacementFile.name,
        mimeType: replacementFile.type,
        photoID: targetPhotoID,
        targetFolder,
      });

      updatedSize = saved.size;
      replacedDesktopFilename = saved.filename;
      const targetImagePath = saved.filePath;

      // Clean up old image files if extension or ID changed
      const oldExts = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"];
      for (const ext of oldExts) {
        const oldPath = path.join(targetFolder, `${id}${ext}`);
        if (fs.existsSync(oldPath) && oldPath !== targetImagePath) {
          try {
            fs.unlinkSync(oldPath);
          } catch {}
        }
        if (idChanged) {
          const oldTargetPath = path.join(targetFolder, `${targetPhotoID}${ext}`);
          if (fs.existsSync(oldTargetPath) && oldTargetPath !== targetImagePath) {
            try {
              fs.unlinkSync(oldTargetPath);
            } catch {}
          }
        }
      }

      // Also ensure public/photos copy is synced if public/photos isn't symlinked
      const publicTargetFolder = path.join(process.cwd(), "public", "photos", String(year));
      if (fs.existsSync(publicTargetFolder) && publicTargetFolder !== targetFolder) {
        try {
          fs.copyFileSync(targetImagePath, path.join(publicTargetFolder, saved.filename));
          if (idChanged) {
            for (const ext of oldExts) {
              const oldPublicImg = path.join(publicTargetFolder, `${id}${ext}`);
              if (fs.existsSync(oldPublicImg) && oldPublicImg !== path.join(publicTargetFolder, saved.filename)) {
                fs.unlinkSync(oldPublicImg);
              }
            }
          }
        } catch {}
      }

      imageReplaced = true;
    } else if (idChanged) {
      // No replacement file uploaded, but photoID was renamed: rename disk media files
      const suffixes = [
        ".jpg",
        "_desktop.jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".avif",
        ".gif",
        ".mp4",
        ".webm",
        ".mov",
        ".m4v",
        "_gallery.jpg",
        "_home.jpg",
        "_tn.jpg",
        "_fullsize.jpg",
      ];
      for (const suffix of suffixes) {
        const oldFile = path.join(targetFolder, `${id}${suffix}`);
        const newFile = path.join(targetFolder, `${targetPhotoID}${suffix}`);
        if (fs.existsSync(oldFile) && !fs.existsSync(newFile)) {
          try {
            fs.renameSync(oldFile, newFile);
          } catch (e) {
            console.warn(`Could not rename media file ${oldFile} to ${newFile}:`, e);
          }
        }
      }

      // Sync public/photos if separate
      const publicTargetFolder = path.join(process.cwd(), "public", "photos", String(year));
      if (fs.existsSync(publicTargetFolder) && publicTargetFolder !== targetFolder) {
        for (const suffix of suffixes) {
          const oldPub = path.join(publicTargetFolder, `${id}${suffix}`);
          const newPub = path.join(publicTargetFolder, `${targetPhotoID}${suffix}`);
          if (fs.existsSync(oldPub) && !fs.existsSync(newPub)) {
            try {
              fs.renameSync(oldPub, newPub);
            } catch {}
          }
        }
      }

      // Check fullsize archive locations if present (driven by env var if configured)
      const possibleFullsizeDirs = [
        process.env.PHOTOS_FULLSIZE_DIR
          ? path.join(process.env.PHOTOS_FULLSIZE_DIR, String(year))
          : null,
        process.env.FULLSIZE_DIR
          ? path.join(process.env.FULLSIZE_DIR, String(year))
          : null,
      ].filter((d): d is string => Boolean(d));
      for (const fDir of possibleFullsizeDirs) {
        if (fs.existsSync(fDir)) {
          const oldFs = path.join(fDir, `${id}_fullsize.jpg`);
          const newFs = path.join(fDir, `${targetPhotoID}_fullsize.jpg`);
          if (fs.existsSync(oldFs) && !fs.existsSync(newFs)) {
            try {
              fs.renameSync(oldFs, newFs);
            } catch (err) {
              console.warn(`Could not rename fullsize file in ${fDir}:`, err);
            }
          }
        }
      }
    }

    // Invalidate existing cached thumbnails for old and new photo IDs
    const thumbDir = path.join(process.cwd(), ".thumbnails");
    if (fs.existsSync(thumbDir)) {
      try {
        const cachedFiles = fs.readdirSync(thumbDir);
        for (const cf of cachedFiles) {
          if (cf.includes(id) || (idChanged && cf.includes(targetPhotoID))) {
            try {
              fs.unlinkSync(path.join(thumbDir, cf));
            } catch {}
          }
        }
      } catch (e) {
        console.warn("Could not clear cached thumbnails:", e);
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

    // Video metadata & optional replacement video file
    const rawMediaType = formData.get("mediaType") as string | null;
    const rawVideoSrc = formData.get("videoSrc") as string | null;
    const rawVideoEmbedUrl = formData.get("videoEmbedUrl") as string | null;
    const replacementVideoFile = formData.get("videoFile") as File | null;

    let updatedVideoSrc = rawVideoSrc !== null ? (rawVideoSrc.trim() || undefined) : photo.videoSrc;
    let updatedVideoEmbedUrl = rawVideoEmbedUrl !== null ? (rawVideoEmbedUrl.trim() || undefined) : photo.videoEmbedUrl;

    if (updatedVideoEmbedUrl) {
      const parsed = parseVideoEmbed(updatedVideoEmbedUrl);
      if (!parsed) {
        return NextResponse.json(
          { error: "Please enter a valid YouTube or Vimeo URL." },
          { status: 400 }
        );
      }
      updatedVideoEmbedUrl = parsed.canonicalUrl;
    }

    if (replacementVideoFile && replacementVideoFile.size > 0) {
      if (!isSupportedVideoFilename(replacementVideoFile.name)) {
        return NextResponse.json(
          { error: `Unsupported video format. Supported formats: ${SUPPORTED_VIDEO_EXTENSIONS.join(", ")}` },
          { status: 400 }
        );
      }
      const vExt = path.extname(replacementVideoFile.name).toLowerCase() || ".mp4";
      const vFilename = `${targetPhotoID}${vExt}`;
      const vPath = path.join(targetFolder, vFilename);
      const vBuf = Buffer.from(await replacementVideoFile.arrayBuffer());
      fs.writeFileSync(vPath, vBuf);
      updatedVideoSrc = `/photos/${year}/${vFilename}`;
    } else if (idChanged && updatedVideoSrc && updatedVideoSrc.includes(`/${id}.`)) {
      updatedVideoSrc = updatedVideoSrc.replace(`/${id}.`, `/${targetPhotoID}.`);
    }

    const isVideo =
      rawMediaType === "video" ||
      (rawMediaType === null && photo.mediaType === "video") ||
      Boolean(updatedVideoSrc) ||
      Boolean(updatedVideoEmbedUrl);
    const updatedMediaType: "photo" | "video" | undefined = isVideo ? "video" : undefined;

    // Write updated .txt file
    const txtFilename = `${targetPhotoID}.txt`;
    const targetTxtPath = path.join(targetFolder, txtFilename);

    const createdVal = photo.createdTimestamp || photo.rawFields?.created;
    const txtLines = [
      `photoID:${targetPhotoID}`,
      `title:${title}`,
      createdVal ? `created:${createdVal}` : "",
      isVideo ? `mediaType:video` : "",
      updatedVideoSrc ? `videoSrc:${updatedVideoSrc}` : "",
      updatedVideoEmbedUrl ? `videoEmbedUrl:${updatedVideoEmbedUrl}` : "",
      description ? `description:${description}` : "",
      newLocation ? `location:${newLocation.latitude.toFixed(6)},${newLocation.longitude.toFixed(6)}` : "",
      categories.length > 0 ? `albums:${categories.join(",")}` : "",
      keywords.length > 0 ? `tags:${keywords.join(",")}` : "",
      `size:${updatedSize.width}x${updatedSize.height}`,
      tripod ? `tripod:${tripod}` : "tripod:None",
      availability ? `availability:${availability}` : "availability:Available for Order",
    ].filter(Boolean);

    fs.writeFileSync(targetTxtPath, txtLines.join("\n") + "\n", "utf-8");

    if (idChanged) {
      const oldTxtPath = path.join(targetFolder, `${id}.txt`);
      if (fs.existsSync(oldTxtPath) && oldTxtPath !== targetTxtPath) {
        try {
          fs.unlinkSync(oldTxtPath);
        } catch {}
      }
    }

    // Also sync public/photos .txt if separate
    const publicTxtPath = path.join(process.cwd(), "public", "photos", String(year), txtFilename);
    if (fs.existsSync(path.dirname(publicTxtPath)) && publicTxtPath !== targetTxtPath) {
      try {
        fs.copyFileSync(targetTxtPath, publicTxtPath);
        if (idChanged) {
          const oldPublicTxt = path.join(path.dirname(publicTxtPath), `${id}.txt`);
          if (fs.existsSync(oldPublicTxt)) {
            fs.unlinkSync(oldPublicTxt);
          }
        }
      } catch {}
    }

    // Update Photo in catalog
    const updatedMtime = (imageReplaced || idChanged)
      ? Math.floor(Date.now() / 1000)
      : (photo.updatedAt || (photo.imageDesktop?.includes("?v=") ? parseInt(photo.imageDesktop.split("?v=")[1], 10) : Math.floor(Date.now() / 1000)));

    let baseDesktop = replacedDesktopFilename
      ? `/photos/${year}/${replacedDesktopFilename}`
      : (photo.imageDesktop || `/photos/${year}/${id}.jpg`).split("?")[0];
    if (!replacedDesktopFilename && idChanged) {
      baseDesktop = baseDesktop
        .replace(`/${id}.jpg`, `/${targetPhotoID}.jpg`)
        .replace(`/${id}_desktop.jpg`, `/${targetPhotoID}_desktop.jpg`)
        .replace(`/${id}.jpeg`, `/${targetPhotoID}.jpeg`)
        .replace(`/${id}.png`, `/${targetPhotoID}.png`)
        .replace(`/${id}.webp`, `/${targetPhotoID}.webp`)
        .replace(`/${id}.avif`, `/${targetPhotoID}.avif`)
        .replace(`/${id}.gif`, `/${targetPhotoID}.gif`);
      if (!baseDesktop.includes(targetPhotoID)) {
        baseDesktop = `/photos/${year}/${targetPhotoID}.jpg`;
      }
    }

    let imageFullsize = photo.imageFullsize;
    if (imageFullsize && idChanged) {
      imageFullsize = imageFullsize.replace(id, targetPhotoID);
    }

    const updatedPhoto: Photo = {
      ...photo,
      photoID: targetPhotoID,
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
      updatedAt: updatedMtime,
      imageDesktop: `${baseDesktop}?v=${updatedMtime}`,
      mediaType: updatedMediaType,
      videoSrc: updatedVideoSrc,
      videoEmbedUrl: updatedVideoEmbedUrl,
      ...(imageFullsize ? { imageFullsize } : {}),
      rawFields: {
        ...(photo.rawFields || {}),
        photoID: targetPhotoID,
        title,
        description,
        tripod,
        availability,
        category: categories.join(","),
        keyword: keywords.join(","),
        size: `${updatedSize.width}x${updatedSize.height}`,
      },
    };

    catalog[photoIndex] = updatedPhoto;
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

    try {
      revalidatePath("/", "layout");
    } catch {}

    return NextResponse.json({
      success: true,
      imageReplaced,
      idChanged,
      oldPhotoID: id,
      newPhotoID: targetPhotoID,
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

    try {
      revalidatePath("/", "layout");
    } catch {}

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
