#!/usr/bin/env tsx
/**
 * Lumenist CLI Batch Importer (Images + optional CSV/JSON manifest)
 *
 * Usage:
 *   npm run import:batch -- /path/to/images
 *   npm run import:batch -- /path/to/images --meta /path/to/manifest.csv
 *   npm run import:batch -- /path/to/images --meta /path/to/manifest.json --duplicates merge
 */

import fs from "fs";
import path from "path";
import { Photo } from "../src/types/photo";
import { resolvePhotosDir } from "../src/lib/adminCatalog";
import {
  DuplicateMode,
  ImportManifestRow,
  matchManifestRow,
  parseManifestFile,
  processImageImport,
} from "../src/lib/bulkImport";

const SUPPORTED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

function collectImages(dir: string): string[] {
  const out: string[] = [];
  function walk(curr: string) {
    for (const entry of fs.readdirSync(curr, { withFileTypes: true })) {
      const full = path.join(curr, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (SUPPORTED_EXTS.has(path.extname(entry.name).toLowerCase())) {
        out.push(full);
      }
    }
  }
  walk(dir);
  return out.sort();
}

async function main() {
  const args = process.argv.slice(2);
  let inputDir = "";
  let metaPath = "";
  let duplicateMode: DuplicateMode = "skip";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "--meta" || arg === "-m") && args[i + 1]) {
      metaPath = args[++i];
    } else if ((arg === "--duplicates" || arg === "-d") && args[i + 1]) {
      const val = args[++i].toLowerCase();
      if (val === "skip" || val === "merge" || val === "overwrite") {
        duplicateMode = val;
      }
    } else if (!arg.startsWith("-") && !inputDir) {
      inputDir = arg;
    }
  }

  if (!inputDir) {
    console.error(
      "Usage: npm run import:batch -- <images-dir> [--meta manifest.csv|json] [--duplicates skip|merge|overwrite]"
    );
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputDir);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: Directory not found: ${resolvedInput}`);
    process.exit(1);
  }

  let manifestRows: ImportManifestRow[] = [];
  if (metaPath) {
    const resolvedMeta = path.resolve(metaPath);
    if (!fs.existsSync(resolvedMeta)) {
      console.error(`Error: Manifest file not found: ${resolvedMeta}`);
      process.exit(1);
    }
    manifestRows = parseManifestFile(
      resolvedMeta,
      fs.readFileSync(resolvedMeta, "utf-8")
    );
    console.log(`Loaded ${manifestRows.length} manifest rows from ${resolvedMeta}`);
  }

  const imagePaths = collectImages(resolvedInput);
  if (imagePaths.length === 0) {
    console.log("No supported image files found.");
    process.exit(0);
  }

  const catalogPath = path.join(process.cwd(), "data", "photos.json");
  let catalog: Photo[] = [];
  if (fs.existsSync(catalogPath)) {
    try {
      catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
    } catch {
      catalog = [];
    }
  }

  const existingById = new Map<string, Photo>(
    catalog.map((p) => [p.photoID, p])
  );
  const photosRoot = resolvePhotosDir();
  if (!fs.existsSync(photosRoot)) {
    fs.mkdirSync(photosRoot, { recursive: true });
  }

  console.log(
    `\n📷 Lumenist Batch Importer\nImages: ${imagePaths.length} | Duplicates: ${duplicateMode} | Target: ${photosRoot}\n`
  );

  const summary = { imported: 0, updated: 0, merged: 0, skipped: 0, errors: 0 };

  for (let i = 0; i < imagePaths.length; i++) {
    const imgPath = imagePaths[i];
    const filename = path.basename(imgPath);
    const buffer = fs.readFileSync(imgPath);
    const row = matchManifestRow(filename, manifestRows);

    try {
      const res = await processImageImport({
        buffer,
        originalFilename: filename,
        manifestRow: row,
        photosRoot,
        existingById,
        duplicateMode,
      });
      if (res.photo) existingById.set(res.photo.photoID, res.photo);
      if (res.status === "imported") summary.imported++;
      else if (res.status === "updated") summary.updated++;
      else if (res.status === "merged") summary.merged++;
      else if (res.status === "skipped") summary.skipped++;
      else summary.errors++;

      console.log(
        `[${i + 1}/${imagePaths.length}] ${res.status.toUpperCase()} ${res.photoID} (${filename})${
          res.message ? ` — ${res.message}` : ""
        }`
      );
    } catch (err: any) {
      summary.errors++;
      console.error(`[${i + 1}/${imagePaths.length}] ERROR ${filename}: ${err?.message || err}`);
    }
  }

  const nextCatalog = Array.from(existingById.values());
  nextCatalog.sort((a, b) => {
    const aDate =
      (a.dateTaken?.year || 0) * 10000 +
      (a.dateTaken?.month || 0) * 100 +
      (a.dateTaken?.day || 0);
    const bDate =
      (b.dateTaken?.year || 0) * 10000 +
      (b.dateTaken?.month || 0) * 100 +
      (b.dateTaken?.day || 0);
    if (bDate !== aDate) return bDate - aDate;
    return b.photoID.localeCompare(a.photoID);
  });

  fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
  fs.writeFileSync(catalogPath, JSON.stringify(nextCatalog, null, 2), "utf-8");

  console.log("\n========================================");
  console.log(
    `✅ Imported: ${summary.imported} | Merged: ${summary.merged} | Updated: ${summary.updated} | Skipped: ${summary.skipped} | Errors: ${summary.errors}`
  );
  console.log(`💾 Catalog saved: ${catalogPath} (${nextCatalog.length} total photos)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
