"use client";

import { useState, useMemo } from "react";
import { Photo } from "@/types/photo";
import { JustifiedGallery } from "@/components/JustifiedGallery";
import { Pagination } from "@/components/Pagination";
import { Search, Film, Tag, X, ChevronDown, ChevronUp } from "lucide-react";

interface ExploreGalleryProps {
  initialPhotos: Photo[];
  categories: { name: string; count: number }[];
}

export function ExploreGallery({ initialPhotos, categories }: ExploreGalleryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [filmFilter, setFilmFilter] = useState<"All" | "Film" | "Digital">("All");
  const [showTagCloud, setShowTagCloud] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 48;

  // Compute tag frequencies across all photos, focusing on meaningful keywords
  const popularTags = useMemo(() => {
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
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [initialPhotos]);

  const filteredPhotos = useMemo(() => {
    return initialPhotos.filter((p) => {
      // Search term match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesDesc = p.description.toLowerCase().includes(query);
        const matchesCamera = p.camera.toLowerCase().includes(query);
        const matchesKeywords = p.keywords.some((k) =>
          k.toLowerCase().includes(query)
        );
        const matchesCategory = p.categories.some((c) =>
          c.toLowerCase().includes(query)
        );

        if (
          !matchesTitle &&
          !matchesDesc &&
          !matchesCamera &&
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

      // Tag filter match
      if (selectedTag) {
        const hasTag = p.keywords.some(
          (k) => k.toLowerCase() === selectedTag.toLowerCase()
        );
        if (!hasTag) {
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
  }, [initialPhotos, searchQuery, selectedCategory, selectedTag, filmFilter]);

  const totalPages = Math.ceil(filteredPhotos.length / pageSize);
  const paginatedPhotos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPhotos.slice(start, start + pageSize);
  }, [filteredPhotos, currentPage, pageSize]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setCurrentPage(1);
  };

  const handleTagToggle = (tag: string) => {
    if (selectedTag?.toLowerCase() === tag.toLowerCase()) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
    }
    setCurrentPage(1);
  };

  const handleFilmChange = (val: "All" | "Film" | "Digital") => {
    setFilmFilter(val);
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("All");
    setSelectedTag(null);
    setFilmFilter("All");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedCategory !== "All" ||
    selectedTag !== null ||
    filmFilter !== "All";

  const displayedTags = showAllTags ? popularTags.slice(0, 100) : popularTags.slice(0, 36);

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
              className={`px-3 py-2 rounded-sm border text-xs flex items-center space-x-1.5 transition-colors ${
                showTagCloud || selectedTag
                  ? "bg-accent/15 border-accent text-accent font-medium"
                  : "bg-black border-surface-border text-gray-300 hover:text-white"
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Tag Cloud</span>
              {selectedTag && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              )}
            </button>

            {/* Film / Digital toggle */}
            <div className="flex items-center space-x-1 border border-surface-border rounded-sm p-1 bg-black text-xs">
              <button
                onClick={() => handleFilmChange("All")}
                className={`px-3 py-1.5 rounded-sm transition-colors ${
                  filmFilter === "All"
                    ? "bg-surface-hover text-white font-medium"
                    : "text-muted hover:text-gray-200"
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleFilmChange("Digital")}
                className={`px-3 py-1.5 rounded-sm transition-colors ${
                  filmFilter === "Digital"
                    ? "bg-surface-hover text-white font-medium"
                    : "text-muted hover:text-gray-200"
                }`}
              >
                Digital
              </button>
              <button
                onClick={() => handleFilmChange("Film")}
                className={`px-3 py-1.5 rounded-sm transition-colors flex items-center space-x-1 ${
                  filmFilter === "Film"
                    ? "bg-surface-hover text-amber-300 font-medium"
                    : "text-muted hover:text-gray-200"
                }`}
              >
                <Film className="w-3 h-3 text-amber-300" />
                <span>Film</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills (Sorted Alphabetically, All first) */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => handleCategoryChange("All")}
            className={`whitespace-nowrap px-3 py-1 rounded-full border transition-colors ${
              selectedCategory === "All"
                ? "bg-accent/20 border-accent text-accent font-medium"
                : "bg-black border-surface-border text-gray-400 hover:text-white"
            }`}
          >
            All Categories ({initialPhotos.length})
          </button>
          {categories
            .filter((c) => c.name !== "All Photographs" && c.name !== "All")
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleCategoryChange(cat.name)}
                className={`whitespace-nowrap px-3 py-1 rounded-full border transition-colors ${
                  selectedCategory === cat.name
                    ? "bg-accent/20 border-accent text-accent font-medium"
                    : "bg-black border-surface-border text-gray-400 hover:text-white"
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
        </div>

        {/* Tag Cloud Section */}
        {showTagCloud && (
          <div className="border-t border-surface-border pt-4 mt-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-muted">
                <Tag className="w-3.5 h-3.5 text-accent" />
                <span className="uppercase tracking-wider font-semibold text-gray-300">
                  Tag Cloud ({popularTags.length} keywords)
                </span>
                {selectedTag && (
                  <span className="text-accent">
                    &bull; Filtered by <strong className="text-white">&ldquo;{selectedTag}&rdquo;</strong>
                  </span>
                )}
              </div>
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag(null)}
                  className="text-xs text-accent hover:underline flex items-center space-x-1"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Tag</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto pr-1">
              {displayedTags.map(({ tag, count }) => {
                const isSelected =
                  selectedTag?.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`text-xs px-2.5 py-1 rounded border transition-all ${
                      isSelected
                        ? "bg-accent text-black font-semibold border-accent shadow-sm scale-105"
                        : "bg-black/60 border-surface-border text-gray-300 hover:border-accent hover:text-white"
                    }`}
                  >
                    <span>{tag}</span>
                    <span
                      className={`ml-1.5 text-[10px] ${
                        isSelected ? "text-neutral-900" : "text-muted"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {popularTags.length > 36 && (
              <div className="text-right">
                <button
                  onClick={() => setShowAllTags(!showAllTags)}
                  className="text-[11px] text-muted hover:text-accent inline-flex items-center space-x-1"
                >
                  <span>{showAllTags ? "Show fewer tags" : `Show more tags (${popularTags.length} total)`}</span>
                  {showAllTags ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Header with Active Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex items-center space-x-2">
          <span>
            Showing <strong className="text-white font-medium">{filteredPhotos.length}</strong> photographs
          </span>
          {selectedTag && (
            <span className="inline-flex items-center space-x-1 bg-accent/20 border border-accent/40 text-accent px-2 py-0.5 rounded-full text-[11px]">
              <Tag className="w-3 h-3" />
              <span>{selectedTag}</span>
              <button
                onClick={() => setSelectedTag(null)}
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-accent hover:underline flex items-center space-x-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear all filters</span>
          </button>
        )}
      </div>

      {/* Justified Flush Gallery */}
      {paginatedPhotos.length > 0 ? (
        <div className="space-y-6">
          <JustifiedGallery photos={paginatedPhotos} targetRowHeight={210} gap={8} />

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
          <p className="text-gray-400 text-sm">
            No photographs found matching your criteria.
          </p>
          <button
            onClick={clearAllFilters}
            className="text-accent text-xs underline"
          >
            Reset all filters
          </button>
        </div>
      )}
    </div>
  );
}
