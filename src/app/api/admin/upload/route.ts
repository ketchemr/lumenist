import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import exifr from "exifr";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { Photo, PhotoSize } from "@/types/photo";

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
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract EXIF data from buffer
    let exifData: any = {};
    try {
      exifData = (await exifr.parse(buffer, {
        tiff: true,
        xmp: true,
        icc: false,
        gps: true,
      })) || {};
    } catch (e) {
      console.warn("Could not parse EXIF from buffer:", e);
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

    const year = parseInt(formData.get("year") as string, 10) || dateObj.getFullYear();
    const month = parseInt(formData.get("month") as string, 10) || dateObj.getMonth() + 1;
    const day = parseInt(formData.get("day") as string, 10) || dateObj.getDate();
    const hour = parseInt(formData.get("hour") as string, 10) || dateObj.getHours();
    const minute = parseInt(formData.get("minute") as string, 10) || dateObj.getMinutes();
    const second = parseInt(formData.get("second") as string, 10) || dateObj.getSeconds();

    // Generate canonical photoID if not passed (e.g. d20261027151131 or filename ID)
    const passedPhotoID = (formData.get("photoID") as string)?.trim();
    let photoID = passedPhotoID;
    if (!photoID) {
      const baseName = (file.name || "").replace(/\.[^.]+$/, "").replace(/_desktop$/, "");
      if (/^[ds]\d+/i.test(baseName)) {
        photoID = baseName;
      } else {
        const pad = (n: number) => String(n).padStart(2, "0");
        photoID = `d${year}${pad(month)}${pad(day)}${pad(hour)}${pad(minute)}${pad(second)}`;
      }
    }

    // Location coordinates (form input overrides EXIF, explicit empty/false disables location)
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
    const lens = (exifData.LensModel || exifData.Lens || "").trim() || "Unknown Lens";
    const focalLength = exifData.FocalLength ? `${Math.round(exifData.FocalLength)} mm` : "Unknown";
    const shutterSpeed = exifData.ExposureTime
      ? exifData.ExposureTime >= 1
        ? `${exifData.ExposureTime}s`
        : `1/${Math.round(1 / exifData.ExposureTime)} ss`
      : "Unknown";
    const aperture = exifData.FNumber ? `f${exifData.FNumber}` : "Unknown";
    const iso = exifData.ISO ? `ISO ${exifData.ISO}` : "Unknown";
    const exposureComp =
      exifData.ExposureCompensation !== undefined
        ? `${exifData.ExposureCompensation} Ev`
        : "0 Ev";
    const whiteBalance = exifData.WhiteBalance || "Auto";

    // Dimensions & Geometry
    const sharpInstance = sharp(buffer);
    const imgMeta = await sharpInstance.metadata();
    const width = imgMeta.width || 1600;
    const height = imgMeta.height || 1067;
    const sizeStr = `${width}x${height}`;
    const orientation: "horizontal" | "vertical" | "square" =
      width === height ? "square" : height > width ? "vertical" : "horizontal";
    const aspectRatio = parseFloat((width / height).toFixed(3));
    const photoSize: PhotoSize = { width, height, aspectRatio, orientation };

    // Target folder on disk
    const photosRoot = resolvePhotosDir();
    const targetFolder = path.join(photosRoot, String(year));
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    // Save image (resize if > 2400px wide for optimal web delivery)
    const desktopFilename = `${photoID}.jpg`;
    const targetImagePath = path.join(targetFolder, desktopFilename);

    if (width > 2400) {
      await sharpInstance
        .resize({ width: 2400, withoutEnlargement: true })
        .jpeg({ quality: 92, mozjpeg: true })
        .toFile(targetImagePath);
    } else {
      fs.writeFileSync(targetImagePath, buffer);
    }

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
      updatedAt: Math.floor(Date.now() / 1000),
      imageDesktop: `/photos/${year}/${desktopFilename}?v=${Math.floor(Date.now() / 1000)}`,
      imageFullsize: `/photos/${year}/${desktopFilename}`,
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
      film: "Digital",
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
      { error: err.message || "Failed to process photo upload" },
      { status: 500 }
    );
  }
}
