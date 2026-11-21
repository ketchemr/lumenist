import fs from "fs";
import path from "path";
import { parseTxtMetadata, getJpegDimensions } from "../src/lib/parseTxt";
import { Photo } from "../src/types/photo";
import exifr from "exifr";

const DEFAULT_SOURCE_DIR =
  process.env.PHOTOS_SOURCE_DIR ||
  process.env.LOCAL_PHOTO_DIR ||
  path.join(process.cwd(), "public", "photos");

const DEFAULT_FULLSIZE_DIR =
  process.env.PHOTOS_FULLSIZE_DIR ||
  process.env.FULLSIZE_DIR ||
  "/Users/ketchemr/Library/CloudStorage/GoogleDrive-ketchemr@gmail.com/My Drive/Photography/rrkphoto/RRKPhoto_fullsize";

function indexFullsize(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(dir)) return map;

  function scan(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        scan(full);
      } else if (e.name.toLowerCase().endsWith(".jpg")) {
        let key = e.name.replace(/\.jpg$/i, "");
        if (key.endsWith("_fullsize")) {
          key = key.replace(/_fullsize$/, "");
        }
        if (!map.has(key)) {
          map.set(key, full);
        }
      }
    }
  }
  scan(dir);
  return map;
}

function cleanCameraName(make?: string, model?: string): string {
  if (!model && !make) return "Unknown Camera";
  let m = (model || "").trim();
  let mk = (make || "").trim();

  // Normalize vendor strings
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

async function main() {
  const sourceDir = process.argv[2] || DEFAULT_SOURCE_DIR;
  console.log(`\n📷 Lumenist Importer`);
  console.log(`Scanning directory: ${sourceDir}\n`);

  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Source directory does not exist: ${sourceDir}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const subDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  console.log(`Found ${subDirs.length} folders: ${subDirs.join(", ")}`);

  const fullsizeDir =
    process.env.PHOTOS_FULLSIZE_DIR ||
    process.env.FULLSIZE_DIR ||
    DEFAULT_FULLSIZE_DIR;
  const fullsizeMap = indexFullsize(fullsizeDir);
  console.log(`Indexed ${fullsizeMap.size} master fullsize images from: ${fullsizeDir}`);

  const photos: Photo[] = [];
  const categoriesCount = new Map<string, number>();
  const filmStocks = new Set<string>();
  const cameras = new Set<string>();
  let geoCount = 0;

  for (const sub of subDirs) {
    const subPath = path.join(sourceDir, sub);
    const files = fs.readdirSync(subPath);
    const txtFiles = files.filter(
      (f) => f.endsWith(".txt") && !f.endsWith("_desktop.txt")
    );

    let countInFolder = 0;
    for (const txtFile of txtFiles) {
      const filePath = path.join(subPath, txtFile);
      const baseName = path.parse(txtFile).name;
      const imageCandidates = [
        `${baseName}.jpg`,
        `${baseName}.jpeg`,
        `${baseName}.png`,
        `${baseName}.webp`,
        `${baseName}.avif`,
        `${baseName}.gif`,
        `${baseName}_desktop.jpg`,
      ];
      let imageFilename = `${baseName}.jpg`;
      let imagePath = path.join(subPath, imageFilename);
      for (const cand of imageCandidates) {
        const candPath = path.join(subPath, cand);
        if (fs.existsSync(candPath)) {
          imageFilename = cand;
          imagePath = candPath;
          break;
        }
      }

      const videoCandidates = [
        `${baseName}.mp4`,
        `${baseName}.webm`,
        `${baseName}.mov`,
        `${baseName}.m4v`,
      ];
      let videoFilename: string | null = null;
      for (const cand of videoCandidates) {
        if (fs.existsSync(path.join(subPath, cand))) {
          videoFilename = cand;
          break;
        }
      }

      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const photo = parseTxtMetadata(content, baseName, imagePath);

        if (videoFilename) {
          photo.mediaType = "video";
          photo.videoSrc = photo.videoSrc || `/photos/${sub}/${videoFilename}`;
        }

        if (fs.existsSync(imagePath)) {
          try {
            const stat = fs.statSync(imagePath);
            const mtimeSec = Math.floor(stat.mtimeMs / 1000);
            photo.updatedAt = mtimeSec;
            photo.imageDesktop = `/photos/${sub}/${imageFilename}?v=${mtimeSec}`;
          } catch {
            photo.imageDesktop = `/photos/${sub}/${imageFilename}`;
          }
        } else {
          photo.imageDesktop = `/photos/${sub}/${imageFilename}`;
        }

        // Master Dimensions & Aspect Ratio:
        // Always derive from actual fullsize or web JPG, ignoring stale/incorrect txt values
        const fullsizeFile = fullsizeMap.get(photo.photoID);
        if (fullsizeFile && fs.existsSync(fullsizeFile)) {
          const dims = getJpegDimensions(fullsizeFile);
          if (dims) {
            const aspectRatio = parseFloat((dims.width / dims.height).toFixed(3));
            const orientation =
              dims.width === dims.height
                ? "square"
                : dims.height > dims.width
                ? "vertical"
                : "horizontal";
            photo.size = {
              width: dims.width,
              height: dims.height,
              aspectRatio,
              orientation,
            };
          }
        } else if (fs.existsSync(imagePath)) {
          const dims = getJpegDimensions(imagePath);
          if (dims) {
            const aspectRatio = parseFloat((dims.width / dims.height).toFixed(3));
            const orientation =
              dims.width === dims.height
                ? "square"
                : dims.height > dims.width
                ? "vertical"
                : "horizontal";
            if (
              !photo.size ||
              Math.abs(photo.size.aspectRatio - aspectRatio) > 0.05 ||
              photo.size.orientation !== orientation
            ) {
              photo.size = {
                width: dims.width,
                height: dims.height,
                aspectRatio,
                orientation,
              };
            }
          }
        }

        // Automatically extract technical metadata from JPEG EXIF/XMP (overriding manual txt values)
        if (fs.existsSync(imagePath)) {
          try {
            const data = await exifr.parse(imagePath, {
              tiff: true,
              exif: true,
              xmp: true,
              gps: true,
            });
            if (data) {
              // 1. Camera
              if (data.Model || data.Make) {
                photo.camera = cleanCameraName(data.Make, data.Model);
              }
              // 2. Lens
              if (data.LensModel || data.Lens) {
                photo.lens = (data.LensModel || data.Lens).trim();
              }
              // 3. Focal Length
              if (data.FocalLength) {
                photo.focalLength = `${data.FocalLength} mm`;
              }
              // 4. Shutter Speed
              if (data.ExposureTime) {
                photo.shutterspeed =
                  data.ExposureTime >= 1
                    ? `${data.ExposureTime} s`
                    : `1/${Math.round(1 / data.ExposureTime)} s`;
              }
              // 5. Aperture
              if (data.FNumber) {
                photo.aperture = `f${data.FNumber}`;
              }
              // 6. ISO
              if (data.ISO) {
                photo.sensitivity = `ISO ${data.ISO}`;
              }
              // 7. Exposure Compensation
              if (data.ExposureCompensation !== undefined) {
                const ec = Number(data.ExposureCompensation);
                photo.exposureCompensation =
                  ec === 0
                    ? "0 Ev"
                    : `${ec > 0 ? "+" : ""}${ec.toFixed(1).replace(/\.0$/, "")} Ev`;
              }
              // 8. White Balance
              if (data.Temperature) {
                photo.whiteBalance = `${data.Temperature}${
                  data.Tint !== undefined
                    ? ` ${data.Tint >= 0 ? "+" : ""}${data.Tint}`
                    : ""
                }`;
              } else if (data.WhiteBalance) {
                photo.whiteBalance = String(data.WhiteBalance);
              }
              // 9. Digital Medium
              if (data.Model || data.Make || data.ExposureTime) {
                if (
                  !photo.film ||
                  photo.film === "Unknown" ||
                  photo.film.toLowerCase() === "digital"
                ) {
                  photo.film = "Digital";
                }
              }
              // 10. Date and Time derived from EXIF (overriding manual txt values)
              const dateVal =
                data.DateTimeOriginal || data.DateCreated || data.CreateDate;
              if (dateVal) {
                const d =
                  dateVal instanceof Date ? dateVal : new Date(dateVal);
                if (!isNaN(d.getTime())) {
                  photo.dateTaken = {
                    year: d.getFullYear(),
                    month: d.getMonth() + 1,
                    day: d.getDate(),
                    hour: d.getHours(),
                    minute: d.getMinutes(),
                    second: d.getSeconds(),
                    iso: d.toISOString(),
                  };
                }
              }
              // 11. GPS Coordinates derived from EXIF (overriding manual txt values if present in EXIF)
              if (
                data.latitude !== undefined &&
                data.longitude !== undefined &&
                !isNaN(Number(data.latitude)) &&
                !isNaN(Number(data.longitude))
              ) {
                photo.location = {
                  latitude: Number(data.latitude),
                  longitude: Number(data.longitude),
                };
              }
            }
          } catch {
            // ignore
          }
        }

        photos.push(photo);
        countInFolder++;

        if (photo.location) geoCount++;
        if (photo.film) filmStocks.add(photo.film);
        if (photo.camera) cameras.add(photo.camera);

        for (const cat of photo.categories) {
          categoriesCount.set(cat, (categoriesCount.get(cat) || 0) + 1);
        }
      } catch (err) {
        console.warn(`Warning: failed to parse ${filePath}:`, err);
      }
    }
    console.log(`  📁 ${sub}: imported ${countInFolder} photos`);
  }

  // Sort photos down to the second (YYYYMMDDHHMMSS) newest first, tie-breaking by photoID
  photos.sort((a, b) => {
    const timeA =
      String(a.dateTaken.year || 0).padStart(4, "0") +
      String(a.dateTaken.month || 0).padStart(2, "0") +
      String(a.dateTaken.day || 0).padStart(2, "0") +
      String(a.dateTaken.hour || 0).padStart(2, "0") +
      String(a.dateTaken.minute || 0).padStart(2, "0") +
      String(a.dateTaken.second || 0).padStart(2, "0");

    const timeB =
      String(b.dateTaken.year || 0).padStart(4, "0") +
      String(b.dateTaken.month || 0).padStart(2, "0") +
      String(b.dateTaken.day || 0).padStart(2, "0") +
      String(b.dateTaken.hour || 0).padStart(2, "0") +
      String(b.dateTaken.minute || 0).padStart(2, "0") +
      String(b.dateTaken.second || 0).padStart(2, "0");

    if (timeA !== timeB) return timeB.localeCompare(timeA);
    return b.photoID.localeCompare(a.photoID);
  });

  // Ensure output directory exists
  const outDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "photos.json");
  fs.writeFileSync(outPath, JSON.stringify(photos, null, 2), "utf-8");

  console.log(`\n========================================`);
  console.log(`✅ Successfully imported ${photos.length} photos!`);
  console.log(`💾 Saved catalog to: ${outPath}`);
  console.log(`📍 Geotagged photos: ${geoCount}`);
  console.log(`🎞️  Film & Digital types (${filmStocks.size}):`, Array.from(filmStocks).join(", "));
  console.log(`📸 Cameras (${cameras.size}):`, Array.from(cameras).join(", "));
  console.log(`📂 Categories (${categoriesCount.size}):`);
  const sortedCategories = Array.from(categoriesCount.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [cat, count] of sortedCategories.slice(0, 15)) {
    console.log(`   - ${cat}: ${count}`);
  }
  if (sortedCategories.length > 15) {
    console.log(`   ... and ${sortedCategories.length - 15} more`);
  }
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error("Importer failed:", err);
  process.exit(1);
});
