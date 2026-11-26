"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Photo } from "@/types/photo";
import { JustifiedGallery } from "@/components/JustifiedGallery";
import { ExhibitionGallery } from "@/components/ExhibitionGallery";
import { Pagination } from "@/components/Pagination";
import { ShareButton } from "@/components/ShareButton";
import type { LayerMode, MapViewportState } from "@/components/GlobalMap";
import {
  parseExploreParams,
  buildExploreShareUrl,
  type ExploreShareState,
  type MapViewport,
} from "@/lib/exploreUrl";
import { sortPhotos } from "@/lib/photoSort";
import {
  Search,
  Film,
  Tag,
  Folder,
  X,
  ChevronDown,
  ChevronUp,
  Columns2,
  LayoutGrid,
  ArrowUpDown,
  MapPin,
  ZoomIn,
  LassoSelect,
} from "lucide-react";

const GlobalMap = dynamic(
  () => import("@/components/GlobalMap").then((mod) => mod.GlobalMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] sm:h-[440px] bg-surface border border-surface-border rounded-sm flex items-center justify-center text-xs text-muted">
        Loading interactive map...
      </div>
    ),
  }
);

interface ExploreGalleryProps {
  initialPhotos: Photo[];
  categories: { name: string; count: number }[];
  showWatermark?: boolean;
  copyrightNotice?: string;
  initialSharedState?: ExploreShareState | null;
}

export function ExploreGallery({
  initialPhotos,
  categories,
  showWatermark = false,
  copyrightNotice = "© Photographer",
  initialSharedState = null,
}: ExploreGalleryProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialParsedRef = useRef(
    initialSharedState
      ? {
          searchQuery: initialSharedState.searchQuery,
          selectedCategory: initialSharedState.selectedCategory,
          selectedTags: initialSharedState.selectedTags,
          filmFilter: initialSharedState.filmFilter,
          photoSort: initialSharedState.photoSort,
          viewMode: initialSharedState.viewMode,
          currentPage: initialSharedState.currentPage,
          showMap: initialSharedState.showMap,
          filterByMapBounds: initialSharedState.filterByMapBounds,
          mapLayer: initialSharedState.mapLayer,
          mapViewport: initialSharedState.mapViewport,
          lassoVertices: initialSharedState.lassoVertices,
          selectedSiteKey: initialSharedState.selectedSiteKey,
        }
      : parseExploreParams(searchParams)
  );
  const init = initialParsedRef.current;

  const [selectedTags, setSelectedTags] = useState<string[]>(init.selectedTags);
  const [searchQuery, setSearchQuery] = useState(init.searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    init.selectedCategory
  );
  const [filmFilter, setFilmFilter] = useState<"All" | "Film" | "Digital">(
    init.filmFilter
  );
  const [tagSort, setTagSort] = useState<"alpha" | "count">("alpha");
  const [tagSearch, setTagSearch] = useState("");
  const [showTagCloud, setShowTagCloud] = useState(true);
  const [showAllTags, setShowAllTags] = useState(true);
  const [showMap, setShowMap] = useState(init.showMap);
  const [selectedSiteKey, setSelectedSiteKey] = useState<string | null>(
    init.selectedSiteKey
  );
  const [lassoedPhotos, setLassoedPhotos] = useState<Photo[] | null>(null);
  const [lassoVertices, setLassoVertices] = useState<[number, number][] | null>(
    init.lassoVertices
  );
  const [lassoClearSignal, setLassoClearSignal] = useState(0);
  const [filterByMapBounds, setFilterByMapBounds] = useState(
    init.filterByMapBounds
  );
  const [mapVisiblePhotos, setMapVisiblePhotos] = useState<Photo[] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(init.mapViewport?.zoom ?? 4);
  const [mapLayer, setMapLayer] = useState<LayerMode>(init.mapLayer);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(
    init.mapViewport
  );
  const [currentPage, setCurrentPage] = useState(init.currentPage);
  const [viewMode, setViewMode] = useState<"large" | "compact">(
    init.viewMode ?? "large"
  );
  const [photoSort, setPhotoSort] = useState<string>(
    init.photoSort ?? "date-desc"
  );
  const pageSize = 48;

  // Load persistent user preference from localStorage (URL params take precedence)
  useEffect(() => {
    try {
      if (!init.viewMode) {
        const saved = localStorage.getItem("lumenist_gallery_view");
        if (saved === "compact" || saved === "large") {
          setViewMode(saved);
        }
      }
      if (!init.photoSort) {
        const savedSort = localStorage.getItem("lumenist_preferred_sort");
        if (savedSort) {
          setPhotoSort(savedSort);
        }
      }
    } catch {}
  }, [init.viewMode, init.photoSort]);

  const handleViewChange = (mode: "large" | "compact") => {
    setViewMode(mode);
    try {
      localStorage.setItem("lumenist_gallery_view", mode);
    } catch {}
  };

  const handleSortChange = (newSort: string) => {
    setPhotoSort(newSort);
    setCurrentPage(1);
    try {
      localStorage.setItem("lumenist_preferred_sort", newSort);
    } catch {}
  };

  // Sync state when URL params change after mount (e.g. clicking photo tags or browser back/forward)
  const prevSearchStringRef = useRef(searchParams.toString());
  useEffect(() => {
    const nextSearchString = searchParams.toString();
    if (nextSearchString === prevSearchStringRef.current) return;
    prevSearchStringRef.current = nextSearchString;

    const parsed = parseExploreParams(searchParams);
    setSelectedTags(parsed.selectedTags);
    if (parsed.selectedTags.length > 0) {
      setShowTagCloud(true);
    }
    setSearchQuery(parsed.searchQuery);
    setSelectedCategory(parsed.selectedCategory);
    setFilmFilter(parsed.filmFilter);
    setCurrentPage(parsed.currentPage);
  }, [searchParams]);

  const updateUrlParams = useCallback(
    (
      tags: string[],
      q: string,
      cat: string,
      medium: "All" | "Film" | "Digital" = filmFilter
    ) => {
      const params = new URLSearchParams();
      if (tags.length > 0) {
        params.set("tag", tags.join(","));
      }
      if (q.trim()) params.set("q", q.trim());
      if (cat && cat !== "All") params.set("category", cat);
      if (medium !== "All") params.set("medium", medium.toLowerCase());

      const qs = params.toString();
      prevSearchStringRef.current = qs;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, filmFilter]
  );

  const getShareUrl = useCallback(async () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const state: ExploreShareState = {
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

    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (res.ok) {
        const data = (await res.json()) as { id?: string };
        if (data.id) {
          return `${origin.replace(/\/+$/, "")}${pathname}?s=${encodeURIComponent(data.id)}`;
        }
      }
    } catch {
      // Fall back to direct query-param URL if the share API is unavailable
    }

    return buildExploreShareUrl(origin, pathname, state);
  }, [
    pathname,
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
  ]);

  // Compute tag frequencies across all photos, deduplicating case-insensitively
  const allKeywords = useMemo(() => {
    const groups: Record<
      string,
      { total: number; variants: Record<string, number> }
    > = {};
    for (const p of initialPhotos) {
      const seenInPhoto = new Set<string>();
      for (const k of p.keywords || []) {
        const trimmed = k.trim();
        // Skip purely technical orientation/color boilerplate tags
        const lower = trimmed.toLowerCase();
        if (
          trimmed &&
          lower !== "color" &&
          lower !== "horizontal" &&
          lower !== "vertical" &&
          !seenInPhoto.has(lower)
        ) {
          seenInPhoto.add(lower);
          if (!groups[lower]) {
            groups[lower] = { total: 0, variants: {} };
          }
          groups[lower].total += 1;
          groups[lower].variants[trimmed] =
            (groups[lower].variants[trimmed] || 0) + 1;
        }
      }
    }
    return Object.values(groups).map(({ total, variants }) => {
      // Pick the most frequent casing (tie-break toward capitalized/Title Case)
      const bestTag = Object.entries(variants).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
      )[0][0];
      return { tag: bestTag, count: total };
    });
  }, [initialPhotos]);

  const displayedTags = useMemo(() => {
    let list = [...allKeywords];

    if (tagSearch.trim()) {
      const q = tagSearch.toLowerCase();
      list = list.filter((item) => item.tag.toLowerCase().includes(q));
    }

    if (tagSort === "alpha") {
      list.sort((a, b) =>
        a.tag.localeCompare(b.tag, undefined, { sensitivity: "base" })
      );
    } else {
      list.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    }

    if (!showAllTags && !tagSearch.trim()) {
      return list.slice(0, 48);
    }
    return list;
  }, [allKeywords, tagSearch, tagSort, showAllTags]);

  const filteredPhotos = useMemo(() => {
    return initialPhotos.filter((p) => {
      // Search term match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesId = p.photoID.toLowerCase().includes(query);
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesDesc = p.description.toLowerCase().includes(query);
        const matchesCamera = p.camera.toLowerCase().includes(query);
        const matchesLens = p.lens ? p.lens.toLowerCase().includes(query) : false;
        const matchesKeywords = p.keywords.some((k) =>
          k.toLowerCase().includes(query)
        );
        const matchesCategory = p.categories.some((c) =>
          c.toLowerCase().includes(query)
        );

        if (
          !matchesId &&
          !matchesTitle &&
          !matchesDesc &&
          !matchesCamera &&
          !matchesLens &&
          !matchesKeywords &&
          !matchesCategory
        ) {
          return false;
        }
      }

      // Category match
      if (selectedCategory !== "All") {
        if (!p.categories.includes(selectedCategory)) {
          return false;
        }
      }

      // Multi-tag filter match (all selected tags must match)
      if (selectedTags.length > 0) {
        const photoKeywordsLower = (p.keywords || []).map((k) =>
          k.toLowerCase()
        );
        const matchesAll = selectedTags.every((st) =>
          photoKeywordsLower.includes(st.toLowerCase())
        );
        if (!matchesAll) {
          return false;
        }
      }

      // Film / Digital match
      if (filmFilter === "Film") {
        if (!p.film || p.film.toLowerCase() === "digital") return false;
      } else if (filmFilter === "Digital") {
        if (p.film && p.film.toLowerCase() !== "digital") return false;
      }

      return true;
    });
  }, [initialPhotos, searchQuery, selectedCategory, selectedTags, filmFilter]);

  const geotaggedCount = useMemo(() => {
    return filteredPhotos.filter(
      (p) => p.location?.latitude && p.location?.longitude
    ).length;
  }, [filteredPhotos]);

  const locationClusterPhotos = useMemo(() => {
    if (!selectedSiteKey) return null;
    const matched = filteredPhotos.filter(
      (p) =>
        p.location?.latitude &&
        p.location?.longitude &&
        `${p.location.latitude.toFixed(4)},${p.location.longitude.toFixed(4)}` ===
          selectedSiteKey
    );
    return matched.length > 0 ? matched : null;
  }, [selectedSiteKey, filteredPhotos]);

  const photosForGallery = useMemo(() => {
    if (locationClusterPhotos) {
      return locationClusterPhotos;
    }
    if (lassoedPhotos !== null) {
      return lassoedPhotos;
    }
    if (filterByMapBounds && mapVisiblePhotos !== null) {
      return mapVisiblePhotos;
    }
    return filteredPhotos;
  }, [locationClusterPhotos, lassoedPhotos, filterByMapBounds, mapVisiblePhotos, filteredPhotos]);

  const sortedPhotos = useMemo(() => {
    return sortPhotos(photosForGallery, photoSort);
  }, [photosForGallery, photoSort]);

  const totalPages = Math.ceil(sortedPhotos.length / pageSize);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const paginatedPhotos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedPhotos.slice(start, start + pageSize);
  }, [sortedPhotos, currentPage, pageSize]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSelectedSiteKey(null);
    setCurrentPage(1);
    updateUrlParams(selectedTags, val, selectedCategory);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setSelectedSiteKey(null);
    setCurrentPage(1);
    updateUrlParams(selectedTags, searchQuery, val);
  };

  const handleTagToggle = (tag: string) => {
    const exists = selectedTags.some(
      (t) => t.toLowerCase() === tag.toLowerCase()
    );
    const nextTags = exists
      ? selectedTags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
      : [...selectedTags, tag];

    setSelectedTags(nextTags);
    setSelectedSiteKey(null);
    setCurrentPage(1);
    updateUrlParams(nextTags, searchQuery, selectedCategory);
  };

  const handleRemoveTag = (tag: string) => {
    const nextTags = selectedTags.filter(
      (t) => t.toLowerCase() !== tag.toLowerCase()
    );
    setSelectedTags(nextTags);
    setSelectedSiteKey(null);
    setCurrentPage(1);
    updateUrlParams(nextTags, searchQuery, selectedCategory);
  };

  const handleClearAllTags = () => {
    setSelectedTags([]);
    setSelectedSiteKey(null);
    setCurrentPage(1);
    updateUrlParams([], searchQuery, selectedCategory);
  };

  const handleFilmChange = (val: "All" | "Film" | "Digital") => {
    setFilmFilter(val);
    setSelectedSiteKey(null);
    setCurrentPage(1);
    updateUrlParams(selectedTags, searchQuery, selectedCategory, val);
  };

  const handleClearLasso = () => {
    setLassoedPhotos(null);
    setLassoVertices(null);
    setLassoClearSignal((n) => n + 1);
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedTags([]);
    setFilmFilter("All");
    setSelectedSiteKey(null);
    setLassoedPhotos(null);
    setLassoVertices(null);
    setLassoClearSignal((n) => n + 1);
    setFilterByMapBounds(true);
    setCurrentPage(1);
    prevSearchStringRef.current = "";
    router.replace(pathname, { scroll: false });
  };

  const isMapNarrowingResults =
    filterByMapBounds &&
    mapVisiblePhotos !== null &&
    mapVisiblePhotos.length < filteredPhotos.length;

  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedCategory !== "All" ||
    selectedTags.length > 0 ||
    filmFilter !== "All" ||
    locationClusterPhotos !== null ||
    lassoedPhotos !== null ||
    isMapNarrowingResults;

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="space-y-4 bg-surface border border-surface-border p-4 sm:p-5 rounded-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by subject, location, camera, or keyword..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-surface-border rounded-sm text-sm text-foreground placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tag Cloud Toggle */}
            <button
              type="button"
              onClick={() => setShowTagCloud(!showTagCloud)}
              className={`px-3 py-1.5 rounded-sm border text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
                showTagCloud || selectedTags.length > 0
                  ? "bg-accent/15 border-accent text-accent font-medium shadow-sm"
                  : "bg-surface hover:bg-surface-hover border-surface-border text-foreground hover:border-accent/40"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Tag Cloud</span>
              {selectedTags.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-accent text-accent-contrast rounded-full text-[10px] font-bold">
                  {selectedTags.length}
                </span>
              )}
            </button>

            {/* Map Toggle */}
            <button
              type="button"
              onClick={() => setShowMap(!showMap)}
              className={`px-3 py-1.5 rounded-sm border text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
                showMap
                  ? "bg-accent/15 border-accent text-accent font-medium shadow-sm"
                  : "bg-surface hover:bg-surface-hover border-surface-border text-foreground hover:border-accent/40"
              }`}
              title={showMap ? "Hide interactive map" : "Show interactive map"}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Map</span>
              {geotaggedCount > 0 && (
                <span className="text-[10px] opacity-75">
                  ({geotaggedCount})
                </span>
              )}
            </button>

            {/* Film / Digital toggle */}
            <div className="flex items-center space-x-1 border border-surface-border rounded-sm p-0.5 bg-surface text-xs">
              <button
                type="button"
                onClick={() => handleFilmChange("All")}
                className={`px-2.5 py-1 rounded-sm transition-colors cursor-pointer ${
                  filmFilter === "All"
                    ? "bg-surface-hover text-foreground font-medium shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => handleFilmChange("Digital")}
                className={`px-2.5 py-1 rounded-sm transition-colors cursor-pointer ${
                  filmFilter === "Digital"
                    ? "bg-surface-hover text-foreground font-medium shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Digital
              </button>
              <button
                type="button"
                onClick={() => handleFilmChange("Film")}
                className={`px-2.5 py-1 rounded-sm transition-colors flex items-center space-x-1 cursor-pointer ${
                  filmFilter === "Film"
                    ? "bg-surface-hover text-accent font-medium shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Film className="w-3 h-3 text-accent" />
                <span>Film</span>
              </button>
            </div>

            {/* Share Current Explore State */}
            <ShareButton
              getUrl={getShareUrl}
              title="Explore Archive"
              tooltip="Copy a link to this exact search, tags, filters, and map view"
              variant="button"
            />
          </div>
        </div>

        {/* Album Pills (Rendered as tags, wrapped, no horizontal scroll) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center space-x-1.5 text-xs text-muted">
            <Folder className="w-3.5 h-3.5 text-accent" />
            <span className="uppercase tracking-wider font-semibold text-foreground">
              Albums
            </span>
            {selectedCategory !== "All" && (
              <span className="text-accent flex items-center gap-1.5 ml-1">
                &bull; 1 active
                <button
                  type="button"
                  onClick={() => handleCategoryChange("All")}
                  className="text-xs text-accent hover:underline cursor-pointer ml-1"
                >
                  Reset to All
                </button>
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-28 sm:max-h-32 overflow-y-auto pr-1 text-xs">
            <button
              onClick={() => handleCategoryChange("All")}
              className={`text-xs px-2.5 py-1 rounded border transition-all cursor-pointer ${
                selectedCategory === "All"
                  ? "bg-accent text-accent-contrast font-semibold border-accent shadow-sm"
                  : "bg-surface hover:bg-surface-hover border-surface-border text-foreground hover:border-accent"
              }`}
            >
              <span>All Albums</span>
              <span
                className={`ml-1.5 text-[10px] ${
                  selectedCategory === "All" ? "text-accent-contrast/80" : "text-muted"
                }`}
              >
                {initialPhotos.length}
              </span>
            </button>

            {categories
              .filter((c) => c.name !== "All Photographs" && c.name !== "All")
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((cat) => {
                const isSelected =
                  selectedCategory.toLowerCase() === cat.name.toLowerCase();
                return (
                  <button
                    key={cat.name}
                    onClick={() => handleCategoryChange(cat.name)}
                    className={`text-xs px-2.5 py-1 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-accent text-accent-contrast font-semibold border-accent shadow-sm"
                        : "bg-surface hover:bg-surface-hover border-surface-border text-foreground hover:border-accent"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`ml-1.5 text-[10px] ${
                        isSelected ? "text-accent-contrast/80" : "text-muted"
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Tag Cloud Section */}
        {showTagCloud && (
          <div className="border-t border-surface-border pt-4 mt-2 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <Tag className="w-3.5 h-3.5 text-accent" />
                <span className="uppercase tracking-wider font-semibold text-foreground">
                  Tag Cloud ({allKeywords.length} keywords)
                </span>
                {selectedTags.length > 0 && (
                  <span className="text-accent flex items-center gap-1.5">
                    &bull; {selectedTags.length} active
                    <button
                      onClick={handleClearAllTags}
                      className="text-xs text-accent hover:underline cursor-pointer ml-1"
                    >
                      Clear tags
                    </button>
                  </span>
                )}
              </div>

              {/* Tag Controls: Filter, Sort & Range */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Quick filter input within keywords */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Filter keywords..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className="pl-2.5 pr-6 py-1 bg-surface border border-surface-border rounded text-xs text-foreground placeholder-muted focus:outline-none focus:border-accent w-36 sm:w-44"
                  />
                  {tagSearch && (
                    <button
                      onClick={() => setTagSearch("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Sort Toggle: A-Z vs Count */}
                <div className="flex items-center space-x-1 border border-surface-border rounded p-0.5 bg-surface text-xs">
                  <button
                    onClick={() => setTagSort("alpha")}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      tagSort === "alpha"
                        ? "bg-surface-hover text-accent font-medium shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                    title="Sort alphabetically A to Z"
                  >
                    A–Z
                  </button>
                  <button
                    onClick={() => setTagSort("count")}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      tagSort === "count"
                        ? "bg-surface-hover text-accent font-medium shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                    title="Sort by number of photos"
                  >
                    Count
                  </button>
                </div>

                {/* Show All vs Top 48 Toggle */}
                {!tagSearch && allKeywords.length > 48 && (
                  <button
                    onClick={() => setShowAllTags(!showAllTags)}
                    className="text-xs px-2.5 py-1 bg-surface hover:bg-surface-hover border border-surface-border rounded text-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    {showAllTags ? "Show Top 48" : `Show All (${allKeywords.length})`}
                  </button>
                )}

                {selectedTags.length > 0 && (
                  <button
                    onClick={handleClearAllTags}
                    className="text-xs text-accent hover:underline flex items-center space-x-1 cursor-pointer pl-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear Tags</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Tag Cloud Container */}
            <div className="flex flex-wrap gap-1.5 max-h-32 sm:max-h-36 overflow-y-auto pr-1">
              {displayedTags.map(({ tag, count }) => {
                const isSelected = selectedTags.some(
                  (t) => t.toLowerCase() === tag.toLowerCase()
                );
                return (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`text-xs px-2.5 py-1 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-accent text-accent-contrast font-semibold border-accent shadow-sm scale-105"
                        : "bg-surface hover:bg-surface-hover border-surface-border text-foreground hover:border-accent"
                    }`}
                  >
                    <span>{tag}</span>
                    <span
                      className={`ml-1.5 text-[10px] ${
                        isSelected ? "text-accent-contrast/80" : "text-muted"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
              {displayedTags.length === 0 && (
                <div className="text-xs text-muted py-6 w-full text-center">
                  No keywords matching &ldquo;{tagSearch}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Geographic Map */}
      {showMap ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted px-0.5">
            <div className="flex items-center space-x-2">
              <MapPin className="w-3.5 h-3.5 text-accent" />
              <span className="uppercase tracking-wider font-semibold text-foreground">
                Interactive Map
              </span>
              <span>
                &bull; {geotaggedCount} {geotaggedCount === 1 ? "location" : "locations"}
              </span>
            </div>

            <div className="flex items-center space-x-3">
              {/* Map View Filter Toggle */}
              <label className="flex items-center space-x-1.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterByMapBounds}
                  onChange={(e) => {
                    setFilterByMapBounds(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="rounded border-surface-border text-accent focus:ring-accent accent-accent w-3.5 h-3.5 cursor-pointer"
                />
                <span
                  className={
                    filterByMapBounds
                      ? "text-accent font-medium"
                      : "text-muted hover:text-foreground"
                  }
                >
                  Filter gallery by map zoom & view
                </span>
                {filterByMapBounds && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-accent text-accent-contrast rounded-full font-bold">
                    {photosForGallery.length}
                  </span>
                )}
              </label>

              <button
                type="button"
                onClick={() => setShowMap(false)}
                className="text-xs text-muted hover:text-foreground flex items-center space-x-1 cursor-pointer transition-colors"
                title="Collapse map"
              >
                <span>Hide Map</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <GlobalMap
            photos={filteredPhotos}
            showCategoryFilter={false}
            heightClassName="h-[360px] sm:h-[440px]"
            filterByMapBounds={filterByMapBounds}
            initialViewport={init.mapViewport}
            initialLayer={init.mapLayer}
            initialLassoVertices={init.lassoVertices}
            initialSelectedSiteKey={init.selectedSiteKey}
            lassoClearSignal={lassoClearSignal}
            onToggleFilterByMapBounds={(enabled) => {
              setFilterByMapBounds(enabled);
              setCurrentPage(1);
            }}
            onVisiblePhotosChange={(visible, zoom) => {
              setMapVisiblePhotos(visible);
              setMapZoom(zoom);
            }}
            onMapStateChange={(state: MapViewportState) => {
              setMapViewport({
                lat: state.lat,
                lng: state.lng,
                zoom: state.zoom,
              });
              setMapLayer(state.layer);
            }}
            onLassoSelect={(photos) => {
              setLassoedPhotos(photos);
              setCurrentPage(1);
            }}
            onLassoVerticesChange={(vertices) => {
              setLassoVertices(vertices);
            }}
            onFilterToCluster={(_clusterPhotos, clusterKey) => {
              setSelectedSiteKey(clusterKey || null);
              setCurrentPage(1);
              const el = document.getElementById("gallery-results");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="w-full py-2.5 px-4 bg-surface hover:bg-surface-hover border border-surface-border rounded-sm flex items-center justify-between text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-accent" />
            <span className="font-medium text-foreground">Show Interactive Map</span>
            <span>&bull; {geotaggedCount} {geotaggedCount === 1 ? "location" : "locations"}</span>
          </div>
          <ChevronDown className="w-4 h-4" />
        </button>
      )}

      {/* Results Header with Active Filters & View Switcher */}
      <div id="gallery-results" className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted border-b border-surface-border/60 pb-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Showing <strong className="text-foreground font-medium">{photosForGallery.length}</strong> photographs
            {locationClusterPhotos && (
              <span className="text-muted text-[11px] ml-1">
                (at selected map site of {filteredPhotos.length})
              </span>
            )}
            {lassoedPhotos !== null && !locationClusterPhotos && (
              <span className="text-muted text-[11px] ml-1">
                (in drawn lasso area of {filteredPhotos.length})
              </span>
            )}
            {lassoedPhotos === null && isMapNarrowingResults && !locationClusterPhotos && (
              <span className="text-muted text-[11px] ml-1">
                (in visible map view of {filteredPhotos.length})
              </span>
            )}
          </span>
          {locationClusterPhotos && (
            <span className="inline-flex items-center space-x-1 bg-accent/20 border border-accent/40 text-accent px-2 py-0.5 rounded-full text-[11px]">
              <MapPin className="w-3 h-3" />
              <span>Map Site ({locationClusterPhotos.length})</span>
              <button
                type="button"
                onClick={() => setSelectedSiteKey(null)}
                className="hover:text-foreground cursor-pointer ml-0.5"
                title="Clear site location filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {lassoedPhotos !== null && !locationClusterPhotos && (
            <span className="inline-flex items-center space-x-1 bg-accent/20 border border-accent/40 text-accent px-2 py-0.5 rounded-full text-[11px]">
              <LassoSelect className="w-3 h-3" />
              <span>Drawn Area ({photosForGallery.length})</span>
              <button
                type="button"
                onClick={handleClearLasso}
                className="hover:text-foreground cursor-pointer ml-0.5"
                title="Clear drawn lasso filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {lassoedPhotos === null && isMapNarrowingResults && !locationClusterPhotos && (
            <span className="inline-flex items-center space-x-1 bg-accent/20 border border-accent/40 text-accent px-2 py-0.5 rounded-full text-[11px]">
              <ZoomIn className="w-3 h-3" />
              <span>Map View ({photosForGallery.length})</span>
              <button
                type="button"
                onClick={() => setFilterByMapBounds(false)}
                className="hover:text-foreground cursor-pointer ml-0.5"
                title="Disable map view filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center space-x-1 bg-accent/20 border border-accent/40 text-accent px-2 py-0.5 rounded-full text-[11px]"
            >
              <Tag className="w-3 h-3" />
              <span>{tag}</span>
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-foreground cursor-pointer ml-0.5"
                title={`Remove ${tag} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-accent hover:underline flex items-center space-x-1 ml-2"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear filters</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3 self-end sm:self-auto">
          {/* User Sort Order Selector */}
          <div className="flex items-center space-x-1.5 bg-surface border border-surface-border rounded-md px-2.5 py-1 shadow-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-accent shrink-0" />
            <select
              value={photoSort}
              onChange={(e) => handleSortChange(e.target.value)}
              aria-label="Sort photographs by"
              className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer pr-1"
            >
              <option value="date-desc" className="bg-surface text-foreground">Date (Newest First)</option>
              <option value="date-asc" className="bg-surface text-foreground">Date (Oldest First)</option>
              <option value="title-asc" className="bg-surface text-foreground">Title (A to Z)</option>
              <option value="title-desc" className="bg-surface text-foreground">Title (Z to A)</option>
              <option value="created-desc" className="bg-surface text-foreground">Recently Added</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div
            role="group"
            aria-label="Gallery display density"
            className="inline-flex items-center bg-surface border border-surface-border rounded-md p-0.5 shadow-sm"
          >
            <button
              type="button"
              onClick={() => handleViewChange("large")}
              aria-pressed={viewMode === "large"}
              title="Exhibition View (Large 2-column presentation with breathing room)"
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded text-xs transition-all cursor-pointer ${
                viewMode === "large"
                  ? "bg-surface-hover text-accent font-medium shadow-xs border border-surface-border/80"
                  : "text-muted hover:text-accent border border-transparent"
              }`}
            >
              <Columns2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
              <span className="hidden sm:inline">Exhibition</span>
            </button>

            <button
              type="button"
              onClick={() => handleViewChange("compact")}
              aria-pressed={viewMode === "compact"}
              title="Grid View (Compact justified contact sheet)"
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded text-xs transition-all cursor-pointer ${
                viewMode === "compact"
                  ? "bg-surface-hover text-accent font-medium shadow-xs border border-surface-border/80"
                  : "text-muted hover:text-accent border border-transparent"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Gallery Presentation */}
      {paginatedPhotos.length > 0 ? (
        <div className="space-y-6">
          {viewMode === "large" ? (
            <ExhibitionGallery
              photos={paginatedPhotos}
              gap={32}
              showWatermark={showWatermark}
              copyrightNotice={copyrightNotice}
            />
          ) : (
            <JustifiedGallery
              photos={paginatedPhotos}
              targetRowHeight={210}
              gap={8}
              showWatermark={showWatermark}
              copyrightNotice={copyrightNotice}
            />
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={photosForGallery.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        <div className="text-center py-20 bg-surface border border-surface-border rounded-sm space-y-3">
          <p className="text-muted text-sm">
            {lassoedPhotos !== null
              ? "No photographs found in the drawn lasso area."
              : filterByMapBounds
              ? "No photographs found in the current map view."
              : "No photographs found matching your criteria."}
          </p>
          {lassoedPhotos !== null && (
            <p className="text-xs text-muted">
              Try drawing a wider boundary on the map or clearing the lasso filter.
            </p>
          )}
          {lassoedPhotos === null && filterByMapBounds && (
            <p className="text-xs text-muted">
              Try panning or zooming out on the map, or disable the map view filter.
            </p>
          )}
          <div className="flex items-center justify-center gap-3 pt-1">
            {lassoedPhotos !== null && (
              <button
                onClick={handleClearLasso}
                className="text-accent text-xs underline cursor-pointer"
              >
                Clear drawn area
              </button>
            )}
            {filterByMapBounds && (
              <button
                onClick={() => setFilterByMapBounds(false)}
                className="text-accent text-xs underline cursor-pointer"
              >
                Show all matching photographs
              </button>
            )}
            <button
              onClick={clearAllFilters}
              className="text-muted hover:text-foreground text-xs underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
