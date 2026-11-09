const fs = require("fs");
const path = require("path");

const filesList = fs.readFileSync("/tmp/structures_files.txt", "utf-8").split("\n").filter(Boolean);
const photoIDs = filesList.map(f => f.replace(/\.[^.]+$/, ""));

const catalogPath = path.join(process.cwd(), "data", "photos.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
const photosRoot = fs.realpathSync(path.join(process.cwd(), "public", "photos"));

console.log(`Processing ${photoIDs.length} photos for 'Structures' album...`);

let txtUpdatedCount = 0;
let jsonUpdatedCount = 0;

function updateTxtFile(txtPath) {
  if (!fs.existsSync(txtPath)) return false;
  let content = fs.readFileSync(txtPath, "utf-8");
  const lines = content.split(/\r?\n/);
  let categoryLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();
    if (
      trimmed.startsWith("category:") ||
      trimmed.startsWith("categories:") ||
      trimmed.startsWith("albums:") ||
      trimmed.startsWith("album:")
    ) {
      categoryLineIndex = i;
      break;
    }
  }

  let categories = [];
  let prefix = "category:";
  if (categoryLineIndex >= 0) {
    prefix = lines[categoryLineIndex].split(":")[0] + ":";
    const existingStr = lines[categoryLineIndex].slice(lines[categoryLineIndex].indexOf(":") + 1).trim();
    if (existingStr) {
      categories = existingStr.split(",").map(c => c.trim()).filter(Boolean);
    }
  }

  if (!categories.some(c => c.toLowerCase() === "structures")) {
    categories.push("Structures");
    categories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    const newLine = `${prefix}${categories.join(",")}`;

    if (categoryLineIndex >= 0) {
      lines[categoryLineIndex] = newLine;
    } else {
      lines.push(newLine);
    }

    fs.writeFileSync(txtPath, lines.filter((l, idx) => idx < lines.length - 1 || l.trim().length > 0).join("\n") + "\n", "utf-8");
    return true;
  }
  return false;
}

for (const id of photoIDs) {
  const photo = catalog.find(p => p.photoID === id);
  if (!photo) {
    console.warn(`Photo not found in catalog: ${id}`);
    continue;
  }

  // 1. Update .txt file on disk
  let txtPath = null;
  if (photo.imageDesktop && photo.imageDesktop.startsWith("/photos/")) {
    const rel = photo.imageDesktop.replace(/^\/photos\//, "");
    const full = path.join(photosRoot, rel);
    const candidate = path.join(path.dirname(full), id + ".txt");
    if (fs.existsSync(candidate)) txtPath = candidate;
  }
  if (!txtPath && photo.dateTaken?.year) {
    const candidate = path.join(photosRoot, String(photo.dateTaken.year), id + ".txt");
    if (fs.existsSync(candidate)) txtPath = candidate;
  }

  if (txtPath) {
    const wasUpdated = updateTxtFile(txtPath);
    if (wasUpdated) txtUpdatedCount++;
  } else {
    console.warn(`No txt file found for ${id}`);
  }

  // 2. Update catalog entry
  photo.categories = photo.categories || [];
  if (!photo.categories.some(c => c.toLowerCase() === "structures")) {
    photo.categories.push("Structures");
    photo.categories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    jsonUpdatedCount++;
  }
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");

console.log(`✅ Successfully updated ${txtUpdatedCount} .txt files on disk.`);
console.log(`✅ Successfully updated ${jsonUpdatedCount} photos in data/photos.json.`);
