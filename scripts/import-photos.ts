import fs from "fs";
import path from "path";
import { parseTxtMetadata } from "../src/lib/parseTxt";
import { Photo } from "../src/types/photo";
import exifr from "exifr";

const DEFAULT_SOURCE_DIR =
  process.env.PHOTOS_SOURCE_DIR ||
  process.env.LOCAL_PHOTO_DIR ||
  path.join(process.cwd(), "public", "photos");

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
      let imagePath = path.join(subPath, `${baseName}.jpg`);
      if (!fs.existsSync(imagePath)) {
        imagePath = path.join(subPath, `${baseName}_desktop.jpg`);
      }
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const photo = parseTxtMetadata(content, baseName, imagePath);

        // Adjust image path to preserve folder structure
        const imageFilename = fs.existsSync(path.join(subPath, `${baseName}.jpg`))
          ? `${photo.photoID}.jpg`
          : `${photo.photoID}_desktop.jpg`;
        photo.imageDesktop = `/photos/${sub}/${imageFilename}`;

        // Automatically extract technical metadata from JPEG EXIF/XMP (overriding manual txt values)
        if (fs.existsSync(imagePath)) {
          try {
            const data = await exifr.parse(imagePath, {
              tiff: true,
              exif: true,
              xmp: true,
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
