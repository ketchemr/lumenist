import fs from "fs";
import path from "path";
import crypto from "crypto";
import type {
  ExploreShareState,
  FilmFilterMode,
  ViewMode,
  MapViewport,
} from "@/lib/exploreUrl";
import type { LayerMode } from "@/components/GlobalMap";

interface StoredShareRecord {
  state: ExploreShareState;
  createdAt: number;
}

type SharesStore = Record<string, StoredShareRecord>;

const MAX_SHARES = 5000;
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

const VALID_SORTS = new Set([
  "date-desc",
  "date-asc",
  "title-asc",
  "title-desc",
  "created-desc",
]);
const VALID_LAYERS = new Set<LayerMode>(["dark", "topo", "satellite"]);
const VALID_FILMS = new Set<FilmFilterMode>(["All", "Film", "Digital"]);
const VALID_VIEWS = new Set<ViewMode>(["large", "compact"]);

function getSharesFilePath(): string {
  return path.join(process.cwd(), "data", "shares.json");
}

function readStore(): SharesStore {
  const filePath = getSharesFilePath();
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SharesStore;
    }
    return {};
  } catch {
    return {};
  }
}

function writeStore(store: SharesStore): void {
  const filePath = getSharesFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

function hashToShortId(canonicalJson: string, length = 8): string {
  const digest = crypto.createHash("sha256").update(canonicalJson).digest();
  let id = "";
  for (let i = 0; i < length; i++) {
    id += BASE62[digest[i] % BASE62.length];
  }
  return id;
}

function sanitizeViewport(raw: unknown): MapViewport | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const lat = Number(obj.lat);
  const lng = Number(obj.lng);
  const zoom = Number(obj.zoom);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(zoom) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    zoom < 1 ||
    zoom > 20
  ) {
    return null;
  }
  return {
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
    zoom: Math.round(zoom),
  };
}

function sanitizeLasso(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw)) return null;
  const vertices: [number, number][] = [];
  const limit = Math.min(raw.length, 500);
  for (let i = 0; i < limit; i++) {
    const pt = raw[i];
    if (!Array.isArray(pt) || pt.length !== 2) continue;
    const lat = Number(pt[0]);
    const lng = Number(pt[1]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      vertices.push([Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
    }
  }
  return vertices.length >= 3 ? vertices : null;
}

export function sanitizeExploreShareState(raw: unknown): ExploreShareState | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const searchQuery =
    typeof obj.searchQuery === "string" ? obj.searchQuery.trim().slice(0, 200) : "";
  const selectedCategory =
    typeof obj.selectedCategory === "string" && obj.selectedCategory.trim()
      ? obj.selectedCategory.trim().slice(0, 120)
      : "All";

  const selectedTags: string[] = [];
  if (Array.isArray(obj.selectedTags)) {
    for (const item of obj.selectedTags.slice(0, 50)) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim().slice(0, 100);
      if (
        trimmed &&
        !selectedTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())
      ) {
        selectedTags.push(trimmed);
      }
    }
  }

  const filmFilter: FilmFilterMode =
    typeof obj.filmFilter === "string" &&
    VALID_FILMS.has(obj.filmFilter as FilmFilterMode)
      ? (obj.filmFilter as FilmFilterMode)
      : "All";

  const photoSort =
    typeof obj.photoSort === "string" && VALID_SORTS.has(obj.photoSort)
      ? obj.photoSort
      : "date-desc";

  const viewMode: ViewMode =
    typeof obj.viewMode === "string" && VALID_VIEWS.has(obj.viewMode as ViewMode)
      ? (obj.viewMode as ViewMode)
      : "large";

  const pageNum = Number(obj.currentPage);
  const currentPage =
    Number.isInteger(pageNum) && pageNum > 0 && pageNum <= 10000 ? pageNum : 1;

  const showMap = obj.showMap !== false;
  const filterByMapBounds = obj.filterByMapBounds !== false;

  const mapLayer: LayerMode =
    typeof obj.mapLayer === "string" &&
    VALID_LAYERS.has(obj.mapLayer as LayerMode)
      ? (obj.mapLayer as LayerMode)
      : "dark";

  const mapViewport = showMap ? sanitizeViewport(obj.mapViewport) : null;
  const lassoVertices = showMap ? sanitizeLasso(obj.lassoVertices) : null;

  const selectedSiteKey =
    typeof obj.selectedSiteKey === "string" &&
    /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(obj.selectedSiteKey.trim())
      ? obj.selectedSiteKey.trim()
      : null;

  return {
    searchQuery,
    selectedCategory,
    selectedTags,
    filmFilter,
    photoSort,
    viewMode,
    currentPage,
    showMap,
    filterByMapBounds,
    mapLayer,
    mapViewport,
    lassoVertices,
    selectedSiteKey,
  };
}

export function createShare(rawState: unknown): string | null {
  const state = sanitizeExploreShareState(rawState);
  if (!state) return null;

  const canonical = JSON.stringify(state);
  const id = hashToShortId(canonical, 8);
  const store = readStore();

  if (!store[id]) {
    const keys = Object.keys(store);
    if (keys.length >= MAX_SHARES) {
      keys
        .sort((a, b) => (store[a].createdAt || 0) - (store[b].createdAt || 0))
        .slice(0, keys.length - MAX_SHARES + 1)
        .forEach((oldKey) => {
          delete store[oldKey];
        });
    }
    store[id] = {
      state,
      createdAt: Date.now(),
    };
    writeStore(store);
  }

  return id;
}

export function getShare(id: string): ExploreShareState | null {
  if (!id || !/^[a-zA-Z0-9]{6,16}$/.test(id)) return null;
  const store = readStore();
  const record = store[id];
  return record?.state ?? null;
}
