import fs from "fs";
import path from "path";
import { parseTxtMetadata } from "../src/lib/parseTxt";
import { Photo } from "../src/types/photo";
import exifr from "exifr";

const DEFAULT_SOURCE_DIR =
  "/Users/ketchemr/Library/CloudStorage/GoogleDrive-ketchemr@gmail.com/My Drive/www/rrkphoto.com/photos";

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
      const imagePath = path.join(subPath, `${baseName}_desktop.jpg`);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const photo = parseTxtMetadata(content, baseName, imagePath);

        // Adjust desktop image path to preserve folder structure
        photo.imageDesktop = `/photos/${sub}/${photo.photoID}_desktop.jpg`;

        // Automatically populate missing technical specs directly from JPEG EXIF/XMP
        if (fs.existsSync(imagePath)) {
          const needsExif =
            photo.camera === "Unknown Camera" ||
            !photo.lens ||
            !photo.shutterspeed ||
            !photo.aperture ||
            !photo.sensitivity ||
            !photo.dateTaken.year;

          if (needsExif) {
            try {
              const data = await exifr.parse(imagePath, {
                tiff: true,
                exif: true,
                xmp: true,
              });
              if (data) {
                if (photo.camera === "Unknown Camera" && (data.Model || data.Make)) {
                  photo.camera =
                    data.Model && data.Make && !data.Model.includes(data.Make)
                      ? `${data.Make} ${data.Model}`
                      : data.Model || data.Make || "Digital";
                }
                if (!photo.lens && (data.LensModel || data.Lens)) {
                  photo.lens = data.LensModel || data.Lens;
                }
                if (!photo.focalLength && data.FocalLength) {
                  photo.focalLength = `${data.FocalLength} mm`;
                }
                if (!photo.shutterspeed && data.ExposureTime) {
                  photo.shutterspeed =
                    data.ExposureTime >= 1
                      ? `${data.ExposureTime} s`
                      : `1/${Math.round(1 / data.ExposureTime)} s`;
                }
                if (!photo.aperture && data.FNumber) {
                  photo.aperture = `f${data.FNumber}`;
                }
                if (!photo.sensitivity && data.ISO) {
                  photo.sensitivity = `ISO ${data.ISO}`;
                }
                if (!photo.exposureCompensation && data.ExposureCompensation !== undefined) {
                  photo.exposureCompensation = `${data.ExposureCompensation} Ev`;
                }
                if (!photo.whiteBalance && data.Temperature) {
                  photo.whiteBalance = `${data.Temperature}${
                    data.Tint !== undefined
                      ? ` ${data.Tint >= 0 ? "+" : ""}${data.Tint}`
                      : ""
                  }`;
                }
                if (!photo.dateTaken.year && (data.DateTimeOriginal || data.CreateDate)) {
                  const d = new Date(data.DateTimeOriginal || data.CreateDate);
                  photo.dateTaken = {
                    year: d.getUTCFullYear(),
                    month: d.getUTCMonth() + 1,
                    day: d.getUTCDate(),
                    hour: d.getUTCHours(),
                    minute: d.getUTCMinutes(),
                    second: d.getUTCSeconds(),
                    iso: d.toISOString(),
                  };
                }
              }
            } catch {
              // ignore
            }
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
