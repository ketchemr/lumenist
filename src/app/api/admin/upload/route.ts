import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import exifr from "exifr";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { Photo, PhotoSize } from "@/types/photo";
import {
  isSupportedVideoFilename,
  parseVideoEmbed,
  SUPPORTED_VIDEO_EXTENSIONS,
} from "@/lib/media";
import {
  saveUploadedImage,
  extractVideoPosterWithFfmpeg,
  fetchRemotePosterImage,
} from "@/lib/mediaServer";

function cleanCameraName(make?: string, model?: string): string {
  if (!model && !make) return "Unknown Camera";
  let m = (model || "").trim();
  let mk = (make || "").trim();

  if (mk.toUpperCase().includes("NIKON")) mk = "Nikon";
  else if (mk.toUpperCase().includes("SONY")) mk = "Sony";
  else if (mk.toUpperCase().includes("CANON")) mk = "Canon";
  else if (mk.toUpperCase().includes("GOOGLE")) mk = "Google";
  else if (mk.toUpperCase().includes("SAMSUNG")) mk = "Samsung";

  if (m.toUpperCase().startsWith("NIKON ")) {
    return "Nikon " + m.slice(6).trim();
  }
  if (m.toUpperCase().startsWith("SONY ")) {
    return "Sony " + m.slice(5).trim();
  }

  if (mk && !m.toLowerCase().includes(mk.toLowerCase())) {
    return `${mk} ${m}`.trim();
  }
  return m || mk;
}

function resolvePhotosDir(): string {
  if (process.env.PHOTOS_DIR && fs.existsSync(process.env.PHOTOS_DIR)) {
    return process.env.PHOTOS_DIR;
  }
  const publicPhotos = path.join(process.cwd(), "public", "photos");
  try {
    return fs.realpathSync(publicPhotos);
  } catch {
    return publicPhotos;
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAuthed = await isAuthenticatedAdmin();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const rawMediaType = ((formData.get("mediaType") as string) || "photo").trim().toLowerCase();
    const isVideo = rawMediaType === "video";
    const videoMode = ((formData.get("videoMode") as string) || "").trim().toLowerCase(); // "self-hosted" | "embed"

    const file = formData.get("file") as File | null;
    const videoFile = formData.get("videoFile") as File | null;
    const videoFilenameRaw = ((formData.get("videoFilename") as string) || "").trim();
    const videoEmbedUrlRaw = ((formData.get("videoEmbedUrl") as string) || "").trim();

    if (!isVideo && (!file || file.size === 0)) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    let parsedEmbed = videoEmbedUrlRaw ? parseVideoEmbed(videoEmbedUrlRaw) : null;
    if (isVideo && (videoMode === "embed" || videoEmbedUrlRaw)) {
      if (!parsedEmbed) {
        return NextResponse.json(
          { error: "Please enter a valid YouTube or Vimeo URL." },
          { status: 400 }
        );
      }
    }

    if (isVideo && videoMode !== "embed" && !parsedEmbed) {
      const hasUploadedVideo = Boolean(videoFile && videoFile.size > 0);
      const hasSyncedVideo = Boolean(videoFilenameRaw);
      if (!hasUploadedVideo && !hasSyncedVideo) {
        return NextResponse.json(
          { error: "Please upload a video file (.mp4, .webm, .mov) or provide a CLI-synced video filename." },
          { status: 400 }
        );
      }
      if (hasUploadedVideo && videoFile && !isSupportedVideoFilename(videoFile.name)) {
        return NextResponse.json(
          { error: `Unsupported video format. Supported formats: ${SUPPORTED_VIDEO_EXTENSIONS.join(", ")}` },
          { status: 400 }
        );
      }
      if (hasSyncedVideo && !isSupportedVideoFilename(videoFilenameRaw)) {
        return NextResponse.json(
          { error: `Synced video filename must end with one of: ${SUPPORTED_VIDEO_EXTENSIONS.join(", ")}` },
          { status: 400 }
        );
      }
    }

    let imageBuffer: Buffer | null = null;
    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    }

    // Extract EXIF data from image buffer if present
    let exifData: any = {};
    if (imageBuffer) {
      try {
        exifData = (await exifr.parse(imageBuffer, {
          tiff: true,
          xmp: true,
          icc: false,
          gps: true,
        })) || {};
      } catch (e) {
        console.warn("Could not parse EXIF from buffer:", e);
      }
    }

    // Read form fields
    const title = (formData.get("title") as string)?.trim() || "Untitled";
    const description = (formData.get("description") as string)?.trim() || "";
    const albumsRaw = (formData.get("albums") as string) || "";
    const tagsRaw = (formData.get("tags") as string) || "";
    const tripod = (formData.get("tripod") as string)?.trim() || "None";
    const availability =
      (formData.get("availability") as string)?.trim() || "Available for Order";

    // Date & Time extraction
    const now = new Date();
    const exifDate: Date | undefined = exifData.DateTimeOriginal || exifData.CreateDate;
    const dateObj = exifDate instanceof Date && !isNaN(exifDate.getTime()) ? exifDate : now;

    const rawYear = parseInt(formData.get("year") as string, 10) || dateObj.getFullYear();
    const year = rawYear >= 1900 && rawYear <= 2100 ? rawYear : dateObj.getFullYear();
    const month = parseInt(formData.get("month") as string, 10) || dateObj.getMonth() + 1;
    const day = parseInt(formData.get("day") as string, 10) || dateObj.getDate();
    const hour = parseInt(formData.get("hour") as string, 10) || dateObj.getHours();
    const minute = parseInt(formData.get("minute") as string, 10) || dateObj.getMinutes();
    const second = parseInt(formData.get("second") as string, 10) || dateObj.getSeconds();

    // Generate canonical photoID if not passed
    const passedPhotoID = (formData.get("photoID") as string)?.trim();
    let photoID = passedPhotoID;
    if (!photoID) {
      const sourceName = file?.name || videoFile?.name || videoFilenameRaw || "";
      const baseName = path
        .basename(sourceName)
        .replace(/\.[^.]+$/, "")
        .replace(/_desktop$/, "");
      if (/^[dsv]\d[a-zA-Z0-9_-]*$/i.test(baseName)) {
        photoID = baseName;
      } else {
        const pad = (n: number) => String(n).padStart(2, "0");
        const prefix = isVideo ? "v" : "d";
        photoID = `${prefix}${year}${pad(month)}${pad(day)}${pad(hour)}${pad(minute)}${pad(second)}`;
      }
    }

    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(photoID)) {
      return NextResponse.json(
        { error: "Photo ID may only contain letters, numbers, hyphens, and underscores." },
        { status: 400 }
      );
    }

    // Location coordinates
    let latitude: number | null = null;
    let longitude: number | null = null;
    const hasLocation = formData.get("hasLocation");
    const rawLat = formData.get("latitude") as string | null;
    const rawLon = formData.get("longitude") as string | null;

    if (hasLocation === "false" || rawLat === "") {
      latitude = null;
      longitude = null;
    } else {
      const formLat = rawLat ? parseFloat(rawLat) : NaN;
      const formLon = rawLon ? parseFloat(rawLon) : NaN;

      if (
        !isNaN(formLat) &&
        !isNaN(formLon) &&
        formLat >= -90 &&
        formLat <= 90 &&
        formLon >= -180 &&
        formLon <= 180
      ) {
        latitude = parseFloat(formLat.toFixed(6));
        longitude = parseFloat(formLon.toFixed(6));
      } else if (
        exifData.latitude !== undefined &&
        exifData.longitude !== undefined
      ) {
        latitude = parseFloat(exifData.latitude.toFixed(6));
        longitude = parseFloat(exifData.longitude.toFixed(6));
      }
    }

    // Categories and Tags
    const categories = albumsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const keywords = tagsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Camera & Lens Details
    const camera = cleanCameraName(exifData.Make, exifData.Model);
    const lens = (exifData.LensModel || exifData.Lens || "").trim() || (isVideo ? "" : "Unknown Lens");
    const focalLength = exifData.FocalLength ? `${Math.round(exifData.FocalLength)} mm` : (isVideo ? "" : "Unknown");
    const shutterSpeed = exifData.ExposureTime
      ? exifData.ExposureTime >= 1
        ? `${exifData.ExposureTime}s`
        : `1/${Math.round(1 / exifData.ExposureTime)} ss`
      : (isVideo ? "" : "Unknown");
    const aperture = exifData.FNumber ? `f${exifData.FNumber}` : (isVideo ? "" : "Unknown");
    const iso = exifData.ISO ? `ISO ${exifData.ISO}` : (isVideo ? "" : "Unknown");
    const exposureComp =
      exifData.ExposureCompensation !== undefined
        ? `${exifData.ExposureCompensation} Ev`
        : "0 Ev";
    const whiteBalance = exifData.WhiteBalance || "Auto";

    // Target folder on disk
    const photosRoot = resolvePhotosDir();
    const targetFolder = path.join(photosRoot, String(year));
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    // Handle self-hosted video file saving or CLI-synced path
    let savedVideoSrc: string | undefined;
    let savedVideoDiskPath: string | undefined;
    let savedVideoEmbedUrl: string | undefined;

    if (isVideo) {
      if (parsedEmbed) {
        savedVideoEmbedUrl = parsedEmbed.canonicalUrl;
      } else if (videoFile && videoFile.size > 0) {
        const videoExt = path.extname(videoFile.name).toLowerCase() || ".mp4";
        const videoOutName = `${photoID}${videoExt}`;
        const videoDiskPath = path.join(targetFolder, videoOutName);
        const videoBuf = Buffer.from(await videoFile.arrayBuffer());
        fs.writeFileSync(videoDiskPath, videoBuf);
        savedVideoDiskPath = videoDiskPath;
        savedVideoSrc = `/photos/${year}/${videoOutName}`;
      } else if (videoFilenameRaw) {
        const safeVideoName = path.basename(videoFilenameRaw);
        savedVideoDiskPath = path.join(targetFolder, safeVideoName);
        savedVideoSrc = `/photos/${year}/${safeVideoName}`;
      }
    }

    // Save still image or video poster image
    let desktopFilename = `${photoID}.jpg`;
    let photoSize: PhotoSize = {
      width: 1920,
      height: 1080,
      aspectRatio: 1.778,
      orientation: "horizontal",
    };

    if (imageBuffer && file) {
      const saved = await saveUploadedImage({
        buffer: imageBuffer,
        originalName: file.name,
        mimeType: file.type,
        photoID,
        targetFolder,
      });
      desktopFilename = saved.filename;
      photoSize = saved.size;
    } else if (isVideo && parsedEmbed && parsedEmbed.thumbnailUrl) {
      // Auto-fetch YouTube thumbnail as poster image
      const fetched = await fetchRemotePosterImage(
        [parsedEmbed.thumbnailUrl, parsedEmbed.fallbackThumbnailUrl || ""],
        photoID,
        targetFolder
      );
      if (fetched) {
        desktopFilename = fetched.filename;
        photoSize = fetched.size;
      } else {
        return NextResponse.json(
          { error: "Could not automatically fetch a poster thumbnail for this video URL. Please upload a poster image." },
          { status: 400 }
        );
      }
    } else if (isVideo && savedVideoDiskPath && fs.existsSync(savedVideoDiskPath)) {
      // Attempt to extract a poster frame with ffmpeg if installed
      const posterPath = path.join(targetFolder, `${photoID}.jpg`);
      const extracted = await extractVideoPosterWithFfmpeg(savedVideoDiskPath, posterPath);
      if (extracted) {
        desktopFilename = `${photoID}.jpg`;
        try {
          const meta = await sharp(posterPath).metadata();
          if (meta.width && meta.height) {
            const w = meta.width;
            const h = meta.height;
            photoSize = {
              width: w,
              height: h,
              aspectRatio: parseFloat((w / h).toFixed(3)),
              orientation: w === h ? "square" : h > w ? "vertical" : "horizontal",
            };
          }
        } catch {}
      } else {
        return NextResponse.json(
          { error: "No poster image was provided and ffmpeg is not available on this server to auto-extract one. Please upload a poster image (JPG/PNG/WebP)." },
          { status: 400 }
        );
      }
    } else if (isVideo) {
      // Check if a poster already exists on disk (e.g. synced via CLI script)
      const existingPoster = path.join(targetFolder, `${photoID}.jpg`);
      if (fs.existsSync(existingPoster)) {
        desktopFilename = `${photoID}.jpg`;
        try {
          const meta = await sharp(existingPoster).metadata();
          if (meta.width && meta.height) {
            const w = meta.width;
            const h = meta.height;
            photoSize = {
              width: w,
              height: h,
              aspectRatio: parseFloat((w / h).toFixed(3)),
              orientation: w === h ? "square" : h > w ? "vertical" : "horizontal",
            };
          }
        } catch {}
      } else {
        return NextResponse.json(
          { error: "Please upload a poster image (JPG, PNG, or WebP) for this video." },
          { status: 400 }
        );
      }
    }

    const sizeStr = `${photoSize.width}x${photoSize.height}`;

    // Formatted created timestamp for upload sorting (YYYYMMDDHHMMSS)
    const pad = (n: number | string) => String(n).padStart(2, "0");
    let createdTimestamp = (formData.get("createdTimestamp") as string)?.trim();
    if (!createdTimestamp) {
      const cYear = parseInt(formData.get("createdYear") as string, 10);
      const cMonth = parseInt(formData.get("createdMonth") as string, 10);
      const cDay = parseInt(formData.get("createdDay") as string, 10);
      const cHour = parseInt(formData.get("createdHour") as string, 10);
      const cMinute = parseInt(formData.get("createdMinute") as string, 10);
      const cSecond = parseInt(formData.get("createdSecond") as string, 10);

      if (!isNaN(cYear) && cYear > 1900 && !isNaN(cMonth) && !isNaN(cDay)) {
        createdTimestamp = `${cYear}${pad(cMonth)}${pad(cDay)}${pad(isNaN(cHour) ? 0 : cHour)}${pad(isNaN(cMinute) ? 0 : cMinute)}${pad(isNaN(cSecond) ? 0 : cSecond)}`;
      } else {
        const cDateRaw = (formData.get("creationDate") as string)?.trim();
        if (cDateRaw) {
          const cd = new Date(cDateRaw);
          if (!isNaN(cd.getTime())) {
            createdTimestamp = `${cd.getFullYear()}${pad(cd.getMonth() + 1)}${pad(cd.getDate())}${pad(cd.getHours())}${pad(cd.getMinutes())}${pad(cd.getSeconds())}`;
          }
        }
      }
    }

    if (!createdTimestamp || !/^\d{14}$/.test(createdTimestamp)) {
      createdTimestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }

    // Write companion .txt file
    const txtFilename = `${photoID}.txt`;
    const targetTxtPath = path.join(targetFolder, txtFilename);

    const txtLines = [
      `photoID:${photoID}`,
      `title:${title}`,
      `created:${createdTimestamp}`,
      isVideo ? `mediaType:video` : "",
      savedVideoSrc ? `videoSrc:${savedVideoSrc}` : "",
      savedVideoEmbedUrl ? `videoEmbedUrl:${savedVideoEmbedUrl}` : "",
      description ? `description:${description}` : "",
      latitude !== null && longitude !== null ? `location:${latitude.toFixed(6)},${longitude.toFixed(6)}` : "",
      categories.length > 0 ? `albums:${categories.join(",")}` : "",
      keywords.length > 0 ? `tags:${keywords.join(",")}` : "",
      `size:${sizeStr}`,
      tripod ? `tripod:${tripod}` : "tripod:None",
      availability ? `availability:${availability}` : "availability:Available for Order",
    ].filter(Boolean);

    fs.writeFileSync(targetTxtPath, txtLines.join("\n") + "\n", "utf-8");

    // Construct Photo object for JSON database
    const nowUnix = Math.floor(Date.now() / 1000);
    const newPhoto: Photo = {
      photoID,
      title,
      createdTimestamp,
      description,
      categories: categories.length > 0 ? categories : ["All"],
      keywords,
      dateTaken: {
        year,
        month,
        day,
        hour,
        minute,
        second,
        iso: dateObj.toISOString(),
      },
      updatedAt: nowUnix,
      imageDesktop: `/photos/${year}/${desktopFilename}?v=${nowUnix}`,
      imageFullsize: `/photos/${year}/${desktopFilename}`,
      ...(isVideo ? { mediaType: "video" as const } : {}),
      ...(savedVideoSrc ? { videoSrc: savedVideoSrc } : {}),
      ...(savedVideoEmbedUrl ? { videoEmbedUrl: savedVideoEmbedUrl } : {}),
      size: photoSize,
      camera,
      lens,
      focalLength,
      shutterspeed: shutterSpeed,
      aperture,
      sensitivity: iso,
      exposureCompensation: exposureComp,
      whiteBalance,
      toneCompensation: "Auto",
      hueAdjustment: 0,
      film: isVideo ? "Video" : "Digital",
      tripod,
      availability,
      location:
        latitude !== null && longitude !== null
          ? { latitude, longitude }
          : undefined,
    };

    // Update data/photos.json
    const catalogPath = path.join(process.cwd(), "data", "photos.json");
    let catalog: Photo[] = [];
    if (fs.existsSync(catalogPath)) {
      try {
        catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
      } catch {
        catalog = [];
      }
    }

    // Replace if exists, or prepend
    const existingIndex = catalog.findIndex((p) => p.photoID === photoID);
    if (existingIndex >= 0) {
      catalog[existingIndex] = newPhoto;
    } else {
      catalog.unshift(newPhoto);
    }

    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

    try {
      revalidatePath("/", "layout");
    } catch (e) {
      console.warn("Revalidation warning:", e);
    }

    return NextResponse.json({
      success: true,
      photoID,
      photo: newPhoto,
      url: `/photo/${photoID}`,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process upload" },
      { status: 500 }
    );
  }
}
