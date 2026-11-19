import type { LayerMode } from "@/components/GlobalMap";

export type FilmFilterMode = "All" | "Film" | "Digital";
export type ViewMode = "large" | "compact";

export interface MapViewport {
  lat: number;
  lng: number;
  zoom: number;
}

export interface ExploreShareState {
  searchQuery: string;
  selectedCategory: string;
  selectedTags: string[];
  filmFilter: FilmFilterMode;
  photoSort: string;
  viewMode: ViewMode;
  currentPage: number;
  showMap: boolean;
  filterByMapBounds: boolean;
  mapLayer: LayerMode;
  mapViewport: MapViewport | null;
  lassoVertices: [number, number][] | null;
  selectedSiteKey: string | null;
}

export interface ParsedExploreParams {
  searchQuery: string;
  selectedCategory: string;
  selectedTags: string[];
  filmFilter: FilmFilterMode;
  photoSort: string | null;
  viewMode: ViewMode | null;
  currentPage: number;
  showMap: boolean;
  filterByMapBounds: boolean;
  mapLayer: LayerMode;
  mapViewport: MapViewport | null;
  lassoVertices: [number, number][] | null;
  selectedSiteKey: string | null;
}

const VALID_SORTS = new Set([
  "date-desc",
  "date-asc",
  "title-asc",
  "title-desc",
  "created-desc",
]);

const VALID_LAYERS = new Set<LayerMode>(["dark", "topo", "satellite"]);

export function parseTagsFromParams(params: URLSearchParams): string[] {
  const raw = params.getAll("tag");
  const tags: string[] = [];
  for (const item of raw) {
    for (const piece of item.split(",")) {
      const trimmed = piece.trim();
      if (
        trimmed &&
        !tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())
      ) {
        tags.push(trimmed);
      }
    }
  }
  return tags;
}

function parseFilmFilter(raw: string | null): FilmFilterMode {
  if (!raw) return "All";
  const lower = raw.toLowerCase();
  if (lower === "film") return "Film";
  if (lower === "digital") return "Digital";
  return "All";
}

function parseViewport(params: URLSearchParams): MapViewport | null {
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");
  const zRaw = params.get("z");
  if (latRaw === null || lngRaw === null || zRaw === null) return null;

  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const zoom = Number(zRaw);

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

  return { lat, lng, zoom };
}

function parseLasso(raw: string | null): [number, number][] | null {
  if (!raw) return null;
  const pairs = raw.split(";");
  const vertices: [number, number][] = [];

  for (const pair of pairs) {
    const parts = pair.split(",");
    if (parts.length !== 2) continue;
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      vertices.push([lat, lng]);
    }
  }

  return vertices.length >= 3 ? vertices : null;
}

function simplifyPolygon(
  vertices: [number, number][],
  maxPoints = 36
): [number, number][] {
  if (vertices.length <= maxPoints) return vertices;
  const result: [number, number][] = [];
  const step = vertices.length / maxPoints;
  for (let i = 0; i < maxPoints; i++) {
    result.push(vertices[Math.floor(i * step)]);
  }
  return result;
}

export function parseExploreParams(params: URLSearchParams): ParsedExploreParams {
  const searchQuery = params.get("q") || "";
  const selectedCategory = params.get("category") || "All";
  const selectedTags = parseTagsFromParams(params);
  const filmFilter = parseFilmFilter(params.get("medium"));

  const sortParam = params.get("sort");
  const photoSort = sortParam && VALID_SORTS.has(sortParam) ? sortParam : null;

  const viewParam = params.get("view");
  const viewMode: ViewMode | null =
    viewParam === "large" || viewParam === "compact" ? viewParam : null;

  const pageRaw = Number(params.get("page"));
  const currentPage =
    Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const showMap = params.get("map") !== "0";
  const filterByMapBounds = params.get("bounds") !== "0";

  const layerParam = params.get("layer") as LayerMode | null;
  const mapLayer: LayerMode =
    layerParam && VALID_LAYERS.has(layerParam) ? layerParam : "dark";

  const mapViewport = parseViewport(params);
  const lassoVertices = parseLasso(params.get("lasso"));

  const siteRaw = params.get("site");
  const selectedSiteKey =
    siteRaw && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(siteRaw.trim())
      ? siteRaw.trim()
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

export function buildExploreShareUrl(
  origin: string,
  pathname: string,
  state: ExploreShareState
): string {
  const params = new URLSearchParams();

  if (state.selectedTags.length > 0) {
    params.set("tag", state.selectedTags.join(","));
  }
  if (state.searchQuery.trim()) {
    params.set("q", state.searchQuery.trim());
  }
  if (state.selectedCategory && state.selectedCategory !== "All") {
    params.set("category", state.selectedCategory);
  }
  if (state.filmFilter !== "All") {
    params.set("medium", state.filmFilter.toLowerCase());
  }
  if (state.photoSort && state.photoSort !== "date-desc") {
    params.set("sort", state.photoSort);
  }
  if (state.viewMode && state.viewMode !== "large") {
    params.set("view", state.viewMode);
  }
  if (state.currentPage > 1) {
    params.set("page", String(state.currentPage));
  }
  if (!state.showMap) {
    params.set("map", "0");
  } else {
    if (!state.filterByMapBounds) {
      params.set("bounds", "0");
    }
    if (state.mapLayer && state.mapLayer !== "dark") {
      params.set("layer", state.mapLayer);
    }
    if (state.mapViewport) {
      params.set("lat", state.mapViewport.lat.toFixed(4));
      params.set("lng", state.mapViewport.lng.toFixed(4));
      params.set("z", String(Math.round(state.mapViewport.zoom)));
    }
    if (state.lassoVertices && state.lassoVertices.length >= 3) {
      const simplified = simplifyPolygon(state.lassoVertices, 36);
      const encoded = simplified
        .map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`)
        .join(";");
      params.set("lasso", encoded);
    }
  }
  if (state.selectedSiteKey) {
    params.set("site", state.selectedSiteKey);
  }

  const qs = params.toString();
  const base = `${origin.replace(/\/+$/, "")}${pathname}`;
  return qs ? `${base}?${qs}` : base;
}
