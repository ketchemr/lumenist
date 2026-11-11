import fs from "fs";
import path from "path";

/**
 * Synchronizes photo metadata from the old rrkphoto (Piwigo MySQL database dump)
 * into Lumenist's data/photos.json and the source .txt files.
 */
export async function syncPiwigoData(tsvPath: string) {
  if (!fs.existsSync(tsvPath)) {
    throw new Error(`TSV file not found: ${tsvPath}`);
  }

  const tsv = fs.readFileSync(tsvPath, "utf-8");
  const lines = tsv.split("\n");

  const piwigo = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const file = parts[1];
    let name = parts[2] === "NULL" ? "" : parts[2].trim();
    const comment = parts[3] === "NULL" ? "" : parts[3].trim();
    const date_creation = parts[4] === "NULL" ? "" : parts[4].trim();
    const latitude = parts[5] === "NULL" ? null : parseFloat(parts[5]);
    const longitude = parts[6] === "NULL" ? null : parseFloat(parts[6]);
    const categories = parts[7] === "NULL" || !parts[7] ? [] : parts[7].split("|").map(s => s.trim()).filter(Boolean);
    const tags = parts[8] === "NULL" || !parts[8] ? [] : parts[8].split("|").map(s => s.trim()).filter(Boolean);

    let photoID = file.replace(/\.[^/.]+$/, "");
    if (photoID === "d20080719123359") photoID = "d20080719123355";

    // Fix known missing "Anna" prefix in Piwigo
    if (name.startsWith("Ruby Falls,")) {
      name = "Anna " + name;
    }

    piwigo.set(photoID, { name, comment, date_creation, latitude, longitude, categories, tags });
  }

  const photosPath = path.join(process.cwd(), "data", "photos.json");
  const photos = JSON.parse(fs.readFileSync(photosPath, "utf-8"));

  let updatedCount = 0;
  for (const p of photos) {
    const pi = piwigo.get(p.photoID);
    if (!pi) continue;

    let changed = false;

    if (pi.name && pi.name !== p.title) {
      p.title = pi.name;
      changed = true;
    }

    const piDesc = pi.comment.replace(/\\r\\n|\\n|\\r|\r\n|\n|\r/g, " ").trim();
    const luDesc = (p.description || "").replace(/\\r\\n|\\n|\\r|\r\n|\n|\r/g, " ").trim();
    if (piDesc && piDesc !== luDesc) {
      p.description = piDesc;
      changed = true;
    }

    const piCatsStr = [...pi.categories].sort().join(", ");
    const luCatsStr = [...(p.categories || [])].sort().join(", ");
    if (piCatsStr && piCatsStr !== luCatsStr) {
      p.categories = pi.categories;
      changed = true;
    }

    if (pi.tags.length > 0) {
      p.keywords = pi.tags;
      changed = true;
    }

    if (pi.latitude && pi.longitude) {
      if (!p.location || Math.abs(p.location.latitude - pi.latitude) > 0.0001 || Math.abs(p.location.longitude - pi.longitude) > 0.0001) {
        p.location = { latitude: pi.latitude, longitude: pi.longitude };
        changed = true;
      }
    }

    if (changed) updatedCount++;
  }

  fs.writeFileSync(photosPath, JSON.stringify(photos, null, 2));
  console.log(`Successfully synced ${updatedCount} photos from Piwigo into ${photosPath}`);
}

if (require.main === module) {
  const tsvFile = process.argv[2] || "/tmp/piwigo_dump.tsv";
  syncPiwigoData(tsvFile).catch(console.error);
}
