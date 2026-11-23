"use client";

import React, { useMemo, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  FileJson,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

type DuplicateMode = "skip" | "merge" | "overwrite";

interface ParsedPreviewRow {
  matchKey: string;
  title?: string;
  albums?: string;
  tags?: string;
  location?: string;
}

interface ImportResultRow {
  photoID: string;
  filename: string;
  status: "imported" | "updated" | "merged" | "skipped" | "error";
  message?: string;
}

interface ImportSummary {
  imported: number;
  updated: number;
  merged: number;
  skipped: number;
  errors: number;
}

function simpleCsvPreview(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    if (rows[r].every((c) => !c.trim())) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = (rows[r][c] || "").trim();
    }
    out.push(obj);
  }
  return out;
}

const SAMPLE_CSV = `filename,photoID,title,description,albums,tags,latitude,longitude,year,month,day,tripod,availability
sunset-beach.jpg,d20261122180000,"Golden Hour on the Coast","Warm sunset light over the shoreline.","Coast, Sunsets","beach, golden hour, ocean, sunset",30.272148,-87.553747,2026,11,22,"Carbon Tripod","Available for Order"
forest-bridge.jpg,d20261122143000,"Footbridge in Autumn","A rustic wooden bridge framed by fall foliage.","Fall Color, Structures","autumn, bridge, forest, leaves",35.585223,-83.844426,2026,11,22,"None","Available for Order"
`;

const SAMPLE_JSON = JSON.stringify(
  [
    {
      filename: "sunset-beach.jpg",
      photoID: "d20261122180000",
      title: "Golden Hour on the Coast",
      description: "Warm sunset light over the shoreline.",
      albums: ["Coast", "Sunsets"],
      tags: ["beach", "golden hour", "ocean", "sunset"],
      latitude: 30.272148,
      longitude: -87.553747,
      year: 2026,
      month: 11,
      day: 22,
      tripod: "Carbon Tripod",
      availability: "Available for Order",
    },
  ],
  null,
  2
);

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportPanel({
  onImportComplete,
}: {
  onImportComplete?: () => void;
}) {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [manifestRows, setManifestRows] = useState<ParsedPreviewRow[]>([]);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("skip");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [results, setResults] = useState<ImportResultRow[]>([]);

  const handleImagesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    setImageFiles((prev) => {
      const byName = new Map(prev.map((f) => [f.name, f]));
      for (const f of incoming) byName.set(f.name, f);
      return Array.from(byName.values());
    });
    setSummary(null);
    setResults([]);
    setImportError(null);
  };

  const handleManifestSelected = async (file: File | null) => {
    setManifestFile(file);
    setManifestError(null);
    setManifestRows([]);
    if (!file) return;

    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      let rawList: Record<string, any>[] = [];
      if (lower.endsWith(".json")) {
        const parsed = JSON.parse(text);
        rawList = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.photos)
          ? parsed.photos
          : Array.isArray(parsed?.items)
          ? parsed.items
          : [];
        if (rawList.length === 0) {
          throw new Error("JSON must be an array of photo objects or { photos: [...] }.");
        }
      } else if (lower.endsWith(".csv")) {
        rawList = simpleCsvPreview(text);
      } else {
        throw new Error("Please select a .csv or .json file.");
      }

      const preview: ParsedPreviewRow[] = rawList.map((r) => {
        const lm: Record<string, any> = {};
        for (const [k, v] of Object.entries(r)) lm[k.trim().toLowerCase()] = v;
        const rawFn = String(lm.filename || lm.file || lm.image || "").trim();
        const rawId = String(lm.photoid || lm.photo_id || lm.id || "").trim();
        const matchKey = (rawFn || rawId).toLowerCase();
        const albumsVal = lm.albums ?? lm.categories ?? lm.category ?? "";
        const tagsVal = lm.tags ?? lm.keywords ?? lm.keyword ?? "";
        const lat = lm.latitude ?? lm.lat ?? lm.location?.latitude;
        const lon = lm.longitude ?? lm.lon ?? lm.lng ?? lm.location?.longitude;
        return {
          matchKey,
          title: lm.title ? String(lm.title) : undefined,
          albums: Array.isArray(albumsVal) ? albumsVal.join(", ") : String(albumsVal || ""),
          tags: Array.isArray(tagsVal) ? tagsVal.join(", ") : String(tagsVal || ""),
          location:
            lat !== undefined && lon !== undefined && lat !== "" && lon !== ""
              ? `${lat}, ${lon}`
              : typeof lm.location === "string"
              ? lm.location
              : undefined,
        };
      });
      setManifestRows(preview);
    } catch (err: any) {
      setManifestError(err?.message || "Could not parse manifest file.");
    }
  };

  const matchedPreview = useMemo(() => {
    return imageFiles.map((f) => {
      const baseLower = f.name.toLowerCase();
      const stemLower = baseLower.replace(/\.[^.]+$/, "").replace(/_desktop$/, "");
      const match = manifestRows.find((r) => {
        const rk = r.matchKey.split("/").pop() || r.matchKey;
        const rkStem = rk.replace(/\.[^.]+$/, "").replace(/_desktop$/, "");
        return rk === baseLower || rkStem === stemLower;
      });
      return { file: f, match };
    });
  }, [imageFiles, manifestRows]);

  const matchedCount = matchedPreview.filter((x) => Boolean(x.match)).length;

  const handleRunImport = async () => {
    if (imageFiles.length === 0) return;
    setIsImporting(true);
    setImportError(null);
    setSummary(null);
    setResults([]);

    try {
      const fd = new FormData();
      fd.append("duplicateMode", duplicateMode);
      for (const f of imageFiles) {
        fd.append("files", f);
      }
      if (manifestFile) {
        fd.append("manifest", manifestFile);
      }

      const res = await fetch("/api/admin/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setSummary(data.summary);
      setResults(data.results || []);
      if (onImportComplete) onImportComplete();
    } catch (err: any) {
      setImportError(err?.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border border-neutral-800 bg-neutral-950/60 p-5 rounded-sm">
        <div>
          <h2 className="text-lg font-serif text-neutral-100">
            Bulk Import (Images + CSV / JSON)
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Upload multiple images with an optional CSV or JSON manifest. Rows match by{" "}
            <code className="text-neutral-300">filename</code> or{" "}
            <code className="text-neutral-300">photoID</code>; EXIF camera, date, and GPS fill in
            automatically for any missing fields.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href="/api/admin/export?format=json"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-700 hover:border-neutral-500 text-neutral-200 rounded-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </a>
          <a
            href="/api/admin/export?format=csv"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-700 hover:border-neutral-500 text-neutral-200 rounded-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      {/* Step 1 & 2 Pickers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Images Picker */}
        <div className="border border-neutral-800 bg-neutral-950/40 p-5 rounded-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
              <Upload className="w-4 h-4 text-accent" />
              1. Select Images ({imageFiles.length})
            </h3>
            {imageFiles.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setImageFiles([]);
                  setSummary(null);
                  setResults([]);
                }}
                className="text-xs text-neutral-400 hover:text-neutral-200"
              >
                Clear all
              </button>
            )}
          </div>

          <label className="block border border-dashed border-neutral-700 hover:border-accent/60 rounded-sm p-6 text-center cursor-pointer transition-colors">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="hidden"
              onChange={(e) => handleImagesSelected(e.target.files)}
            />
            <Upload className="w-6 h-6 text-neutral-500 mx-auto mb-2" />
            <p className="text-xs text-neutral-300">
              Click to select multiple images (.jpg, .png, .webp, .avif, .gif)
            </p>
            <p className="text-[11px] text-neutral-500 mt-1">
              For very large batches (100+ photos), use{" "}
              <code className="text-neutral-400">npm run import:batch</code>
            </p>
          </label>
        </div>

        {/* Manifest Picker */}
        <div className="border border-neutral-800 bg-neutral-950/40 p-5 rounded-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-accent" />
              2. Optional CSV or JSON Metadata
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadTextFile(
                    "lumenist-import-template.csv",
                    SAMPLE_CSV,
                    "text/csv;charset=utf-8"
                  )
                }
                className="text-[11px] text-neutral-400 hover:text-accent underline"
              >
                Sample CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadTextFile(
                    "lumenist-import-template.json",
                    SAMPLE_JSON,
                    "application/json;charset=utf-8"
                  )
                }
                className="text-[11px] text-neutral-400 hover:text-accent underline"
              >
                Sample JSON
              </button>
            </div>
          </div>

          <label className="block border border-dashed border-neutral-700 hover:border-accent/60 rounded-sm p-6 text-center cursor-pointer transition-colors">
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="hidden"
              onChange={(e) => handleManifestSelected(e.target.files?.[0] || null)}
            />
            <FileJson className="w-6 h-6 text-neutral-500 mx-auto mb-2" />
            {manifestFile ? (
              <div className="flex items-center justify-center gap-2 text-xs text-neutral-200">
                <span>
                  {manifestFile.name} ({manifestRows.length} rows)
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleManifestSelected(null);
                  }}
                  className="text-neutral-400 hover:text-red-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-neutral-300">
                  Click to attach a .csv or .json metadata manifest (optional)
                </p>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Supported fields: filename, photoID, title, description, albums, tags, latitude,
                  longitude, year, month, day, film, tripod
                </p>
              </>
            )}
          </label>

          {manifestError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {manifestError}
            </p>
          )}
        </div>
      </div>

      {/* Duplicate Mode + Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-neutral-800 bg-neutral-950/40 p-4 rounded-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-neutral-400">If photoID already exists:</span>
          {(["skip", "merge", "overwrite"] as DuplicateMode[]).map((mode) => (
            <label
              key={mode}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border cursor-pointer ${
                duplicateMode === mode
                  ? "border-accent text-accent bg-accent/10"
                  : "border-neutral-800 text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <input
                type="radio"
                name="duplicateMode"
                value={mode}
                checked={duplicateMode === mode}
                onChange={() => setDuplicateMode(mode)}
                className="hidden"
              />
              {mode === "skip"
                ? "Skip"
                : mode === "merge"
                ? "Merge tags & albums"
                : "Overwrite"}
            </label>
          ))}
        </div>

        <button
          type="button"
          disabled={imageFiles.length === 0 || isImporting || Boolean(manifestError)}
          onClick={handleRunImport}
          className="inline-flex items-center justify-center gap-2 px-5 py-2 text-xs uppercase tracking-widest bg-accent text-neutral-950 font-medium rounded-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
        >
          {isImporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Importing {imageFiles.length} image{imageFiles.length === 1 ? "" : "s"}...
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              Import {imageFiles.length} Image{imageFiles.length === 1 ? "" : "s"}
            </>
          )}
        </button>
      </div>

      {/* Error / Summary Banner */}
      {importError && (
        <div className="p-4 border border-red-500/40 bg-red-950/30 text-red-200 text-xs rounded-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {importError}
        </div>
      )}

      {summary && (
        <div className="p-4 border border-emerald-500/40 bg-emerald-950/20 text-emerald-200 text-xs rounded-sm flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Import complete:
          </span>
          <span>Imported: {summary.imported}</span>
          {summary.merged > 0 && <span>Merged: {summary.merged}</span>}
          {summary.updated > 0 && <span>Overwritten: {summary.updated}</span>}
          {summary.skipped > 0 && <span>Skipped: {summary.skipped}</span>}
          {summary.errors > 0 && <span className="text-red-300">Errors: {summary.errors}</span>}
        </div>
      )}

      {/* Preview / Results Table */}
      {imageFiles.length > 0 && (
        <div className="border border-neutral-800 rounded-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-neutral-900/60 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
            <span>
              Selected files: <strong className="text-neutral-200">{imageFiles.length}</strong>
              {manifestFile && (
                <>
                  {" "}
                  &bull; Matched manifest rows:{" "}
                  <strong className="text-neutral-200">
                    {matchedCount}/{imageFiles.length}
                  </strong>
                </>
              )}
            </span>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Manifest</th>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Albums</th>
                  <th className="px-3 py-2 font-medium">Tags</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {matchedPreview.map(({ file, match }) => {
                  const res = results.find((r) => r.filename === file.name);
                  return (
                    <tr key={file.name} className="hover:bg-neutral-900/30">
                      <td className="px-3 py-2 font-mono text-neutral-200">{file.name}</td>
                      <td className="px-3 py-2">
                        {match ? (
                          <span className="text-emerald-400">Matched</span>
                        ) : (
                          <span className="text-neutral-500">EXIF only</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-neutral-300">{match?.title || "—"}</td>
                      <td className="px-3 py-2 text-neutral-400">{match?.albums || "—"}</td>
                      <td className="px-3 py-2 text-neutral-400 max-w-xs truncate">
                        {match?.tags || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {res ? (
                          <span
                            className={
                              res.status === "error"
                                ? "text-red-400"
                                : res.status === "skipped"
                                ? "text-amber-400"
                                : "text-emerald-400"
                            }
                          >
                            {res.status}
                            {res.message ? ` (${res.message})` : ""}
                          </span>
                        ) : (
                          <span className="text-neutral-500">Ready</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
