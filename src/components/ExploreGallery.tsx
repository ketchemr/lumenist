"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Photo } from "@/types/photo";
import { JustifiedGallery } from "@/components/JustifiedGallery";
import { ExhibitionGallery } from "@/components/ExhibitionGallery";
import { Pagination } from "@/components/Pagination";
import { sortPhotos } from "@/lib/photoSort";
import { Search, Film, Tag, Folder, X, ChevronDown, ChevronUp, Columns2, LayoutGrid, ArrowUpDown } from "lucide-react";

interface ExploreGalleryProps {
  initialPhotos: Photo[];
  categories: { name: string; count: number }[];
  showWatermark?: boolean;
  copyrightNotice?: string;
}

function parseTagsFromParams(params: URLSearchParams): string[] {
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

export function ExploreGallery({
  initialPhotos,
  categories,
  showWatermark = false,
  copyrightNotice = "© Randal R. Ketchem",
}: ExploreGalleryProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlQuery = searchParams.get("q") || "";
  const urlCategory = searchParams.get("category") || "All";

  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    parseTagsFromParams(searchParams)
  );
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(urlCategory);
  const [filmFilter, setFilmFilter] = useState<"All" | "Film" | "Digital">("All");
  const [tagSort, setTagSort] = useState<"alpha" | "count">("alpha");
  const [tagSearch, setTagSearch] = useState("");
  const [showTagCloud, setShowTagCloud] = useState(true);
  const [showAllTags, setShowAllTags] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"large" | "compact">("large");
  const [photoSort, setPhotoSort] = useState<string>("date-desc");
  const pageSize = 48;

  // Load persistent user preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lumenist_gallery_view");
      if (saved === "compact" || saved === "large") {
        setViewMode(saved);
      }
      const savedSort = localStorage.getItem("lumenist_preferred_sort");
      if (savedSort) {
        setPhotoSort(savedSort);
      }
    } catch {}
  }, []);

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

  // Sync state when URL params change (e.g. from clicking photo tags or browser back/forward)
  useEffect(() => {
    const tags = parseTagsFromParams(searchParams);
    const currentQ = searchParams.get("q") || "";
    const currentCat = searchParams.get("category") || "All";

    setSelectedTags(tags);
    if (tags.length > 0) {
      setShowTagCloud(true);
    }
    setSearchQuery(currentQ);
    setSelectedCategory(currentCat);
    setCurrentPage(1);
  }, [searchParams]);

  const updateUrlParams = useCallback(
    (tags: string[], q: string, cat: string) => {
      const params = new URLSearchParams();
      if (tags.length > 0) {
        params.set("tag", tags.join(","));
      }
      if (q.trim()) params.set("q", q.trim());
      if (cat && cat !== "All") params.set("category", cat);

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  // Compute tag frequencies across all photos, focusing on meaningful keywords
  const allKeywords = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of initialPhotos) {
      for (const k of p.keywords || []) {
        const trimmed = k.trim();
        // Skip purely technical orientation/color boilerplate tags
        const lower = trimmed.toLowerCase();
        if (
          trimmed &&
          lower !== "color" &&
          lower !== "horizontal" &&
          lower !== "vertical"
        ) {
          counts[trimmed] = (counts[trimmed] || 0) + 1;
        }
      }
    }
    return Object.entries(counts).map(([tag, count]) => ({ tag, count }));
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

  const sortedPhotos = useMemo(() => {
    return sortPhotos(filteredPhotos, photoSort);
  }, [filteredPhotos, photoSort]);

  const totalPages = Math.ceil(sortedPhotos.length / pageSize);
  const paginatedPhotos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedPhotos.slice(start, start + pageSize);
  }, [sortedPhotos, currentPage, pageSize]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
    updateUrlParams(selectedTags, val, selectedCategory);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
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
    setCurrentPage(1);
    updateUrlParams(nextTags, searchQuery, selectedCategory);
  };

  const handleRemoveTag = (tag: string) => {
    const nextTags = selectedTags.filter(
      (t) => t.toLowerCase() !== tag.toLowerCase()
    );
    setSelectedTags(nextTags);
    setCurrentPage(1);
    updateUrlParams(nextTags, searchQuery, selectedCategory);
  };

  const handleClearAllTags = () => {
    setSelectedTags([]);
    setCurrentPage(1);
    updateUrlParams([], searchQuery, selectedCategory);
  };

  const handleFilmChange = (val: "All" | "Film" | "Digital") => {
    setFilmFilter(val);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedTags([]);
    setFilmFilter("All");
    setCurrentPage(1);
    router.replace(pathname, { scroll: false });
  };

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== "All" ||
    selectedTags.length > 0 ||
    filmFilter !== "All";


  return (
    <div className="space-y-8">
      {/* Controls Bar */}
      <div className="space-y-4 bg-surface border border-surface-border p-4 sm:p-6 rounded-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by subject, location, camera, or keyword..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black border border-surface-border rounded-sm text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center space-x-2">
            {/* Tag Cloud Toggle */}
            <button
              onClick={() => setShowTagCloud(!showTagCloud)}
              className={`px-3 py-2 rounded-sm border text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
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

            {/* Film / Digital toggle */}
            <div className="flex items-center space-x-1 border border-surface-border rounded-sm p-1 bg-surface text-xs">
              <button
                onClick={() => handleFilmChange("All")}
                className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                  filmFilter === "All"
                    ? "bg-surface-hover text-foreground font-medium shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleFilmChange("Digital")}
                className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                  filmFilter === "Digital"
                    ? "bg-surface-hover text-foreground font-medium shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Digital
              </button>
              <button
                onClick={() => handleFilmChange("Film")}
                className={`px-3 py-1.5 rounded-sm transition-colors flex items-center space-x-1 cursor-pointer ${
                  filmFilter === "Film"
                    ? "bg-surface-hover text-accent font-medium shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Film className="w-3 h-3 text-accent" />
                <span>Film</span>
              </button>
            </div>
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
                  onClick={() => handleCategoryChange("All")}
                  className="text-xs text-accent hover:underline cursor-pointer ml-1"
                >
                  Reset to All
                </button>
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-80 overflow-y-auto pr-1 text-xs">
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
            <div className="flex flex-wrap gap-1.5 max-h-80 overflow-y-auto pr-1">
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

      {/* Results Header with Active Filters & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted border-b border-surface-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Showing <strong className="text-foreground font-medium">{filteredPhotos.length}</strong> photographs
          </span>
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center space-x-1 bg-accent/20 border border-accent/40 text-accent px-2 py-0.5 rounded-full text-[11px]"
            >
              <Tag className="w-3 h-3" />
              <span>{tag}</span>
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-white cursor-pointer ml-0.5"
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
                  : "text-muted hover:text-foreground border border-transparent"
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
                  : "text-muted hover:text-foreground border border-transparent"
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
            totalItems={filteredPhotos.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        <div className="text-center py-20 bg-surface border border-surface-border rounded-sm space-y-3">
          <p className="text-muted text-sm">
            No photographs found matching your criteria.
          </p>
          <button
            onClick={clearAllFilters}
            className="text-accent text-xs underline cursor-pointer"
          >
            Reset all filters
          </button>
        </div>
      )}
    </div>
  );
}
