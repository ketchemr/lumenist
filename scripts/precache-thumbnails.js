const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT_DIR = process.cwd();
const PHOTOS_JSON = path.join(ROOT_DIR, "data", "photos.json");
const THUMB_DIR = path.join(ROOT_DIR, ".thumbnails");

if (!fs.existsSync(THUMB_DIR)) {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
}

if (!fs.existsSync(PHOTOS_JSON)) {
  console.error("photos.json not found at:", PHOTOS_JSON);
  process.exit(1);
}

const photos = JSON.parse(fs.readFileSync(PHOTOS_JSON, "utf-8"));
console.log(`Starting thumbnail pre-caching for ${photos.length} photos...`);

// Resolve photo file path on disk
function resolvePhotoPath(src) {
  let cleanSrc = decodeURIComponent(src).replace(/^\/+/, "");
  let fullPath = path.join(ROOT_DIR, "public", cleanSrc);

  if (!fs.existsSync(fullPath)) {
    const gdriveDir =
      "/Users/ketchemr/Library/CloudStorage/GoogleDrive-ketchemr@gmail.com/My Drive/www/rrkphoto.com";
    fullPath = path.join(gdriveDir, cleanSrc);
  }

  if (fs.existsSync(fullPath)) {
    return { fullPath, cleanSrc };
  }
  return null;
}

// Generate thumbnail task
async function generateThumbnail(fullPath, cleanSrc, width, format) {
  const stats = fs.statSync(fullPath);
  const ext = format === "webp" ? "webp" : "jpg";
  const safeKey = cleanSrc.replace(/[^a-zA-Z0-9_-]/g, "_") + `_${stats.mtimeMs}_w${width}.${ext}`;
  const targetPath = path.join(THUMB_DIR, safeKey);

  if (fs.existsSync(targetPath)) {
    return { generated: false, path: targetPath };
  }

  let pipeline = sharp(fullPath).resize(width, null, {
    kernel: sharp.kernel.lanczos3,
    withoutEnlargement: true,
  });

  if (format === "webp") {
    pipeline = pipeline.webp({ quality: 80, effort: 4 });
  } else {
    pipeline = pipeline.jpeg({ quality: 84, mozjpeg: true });
  }

  await pipeline.toFile(targetPath);
  return { generated: true, path: targetPath };
}

async function run() {
  const widths = [600]; // 600px is the primary gallery size
  const concurrency = 6;
  let totalTasks = 0;
  let generatedCount = 0;
  let skippedCount = 0;
  let missingFiles = 0;

  const tasks = [];
  for (const photo of photos) {
    const resolved = resolvePhotoPath(photo.imageDesktop);
    if (!resolved) {
      missingFiles++;
      continue;
    }

    for (const w of widths) {
      tasks.push({ fullPath: resolved.fullPath, cleanSrc: resolved.cleanSrc, width: w, format: "webp" });
      tasks.push({ fullPath: resolved.fullPath, cleanSrc: resolved.cleanSrc, width: w, format: "jpg" });
    }
  }

  totalTasks = tasks.length;
  console.log(`Queued ${totalTasks} thumbnail targets (WebP & JPEG).`);

  let currentIndex = 0;
  async function worker() {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      const task = tasks[taskIndex];
      try {
        const res = await generateThumbnail(task.fullPath, task.cleanSrc, task.width, task.format);
        if (res.generated) {
          generatedCount++;
        } else {
          skippedCount++;
        }
      } catch (err) {
        console.error(`Error generating ${task.cleanSrc} (w=${task.width}):`, err.message);
      }

      if ((taskIndex + 1) % 100 === 0 || taskIndex === tasks.length - 1) {
        const pct = (((taskIndex + 1) / totalTasks) * 100).toFixed(1);
        process.stdout.write(`\rProgress: ${taskIndex + 1}/${totalTasks} (${pct}%) - Created: ${generatedCount}, Cached: ${skippedCount}`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  console.log(`\n\nThumbnail pre-warming completed!`);
  console.log(`- Newly generated: ${generatedCount}`);
  console.log(`- Already cached: ${skippedCount}`);
  if (missingFiles > 0) {
    console.log(`- Source files missing: ${missingFiles}`);
  }
}

run().catch((err) => {
  console.error("Fatal pre-warm error:", err);
  process.exit(1);
});
