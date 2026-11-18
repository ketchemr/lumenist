"use client";

import { useState, useMemo, useEffect } from "react";
import { Photo } from "@/types/photo";
import { JustifiedGallery } from "@/components/JustifiedGallery";
import { ExhibitionGallery } from "@/components/ExhibitionGallery";
import { Pagination } from "@/components/Pagination";
import { sortPhotos } from "@/lib/photoSort";
import { recordPhotoClick, getAndClearReturnState } from "@/lib/galleryState";
import { Columns2, LayoutGrid, ArrowUpDown } from "lucide-react";

type GalleryViewMode = "large" | "compact";

interface PaginatedGalleryProps {
  photos: Photo[];
  categoryName?: string;
  pageSize?: number;
  defaultView?: GalleryViewMode;
  initialSort?: string;
  initialPage?: number;
  showWatermark?: boolean;
  copyrightNotice?: string;
}

export function PaginatedGallery({
  photos,
  categoryName = "gallery",
  pageSize = 48,
  defaultView = "large",
  initialSort = "date-desc",
  initialPage = 1,
  showWatermark = false,
  copyrightNotice = "© Randal R. Ketchem",
}: PaginatedGalleryProps) {
  // Density view mode (Exhibition vs Grid)
  const [viewMode, setViewMode] = useState<GalleryViewMode>(defaultView);

  // Active sort order (pure in-memory client state)
  const [currentSort, setCurrentSort] = useState<string>(initialSort);

  // Active page (pure in-memory client state)
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  // Load preferences from localStorage and restore page ONLY when returning from photo view
  useEffect(() => {
    try {
      // 1. View mode
      const savedView = localStorage.getItem("lumenist_gallery_view");
      if (savedView === "compact" || savedView === "large") {
        setViewMode(savedView);
      }

      // 2. Preferred sort order
      const savedSort = localStorage.getItem("lumenist_preferred_sort");
      if (savedSort) {
        setCurrentSort(savedSort);
      }

      // 3. Return state: only restore if returning from a photo view, else reset to page 1 & top
      const returnState = getAndClearReturnState(categoryName);
      if (returnState) {
        setCurrentPage(returnState.page);
        requestAnimationFrame(() => {
          window.scrollTo({ top: returnState.scroll, left: 0, behavior: "instant" });
        });
      } else {
        setCurrentPage(1);
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        });
      }

      // 4. Silently clean any legacy query parameters from URL address bar
      if (window.location.search) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch {
      // Storage unavailable / blocked
    }
  }, [categoryName]);

  const handleViewChange = (mode: GalleryViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("lumenist_gallery_view", mode);
    } catch {}
  };

  const handleSortChange = (newSort: string) => {
    setCurrentSort(newSort);
    setCurrentPage(1);
    try {
      localStorage.setItem("lumenist_preferred_sort", newSort);
    } catch {}
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    if (link) {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("/photo/")) {
        recordPhotoClick(categoryName, currentPage);
      }
    }
  };

  // Instant in-memory client sort
  const sortedPhotos = useMemo(() => {
    return sortPhotos(photos, currentSort);
  }, [photos, currentSort]);

  const totalPages = Math.ceil(sortedPhotos.length / pageSize) || 1;
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIdx = (validPage - 1) * pageSize;
  const pagePhotos = useMemo(() => {
    return sortedPhotos.slice(startIdx, startIdx + pageSize);
  }, [sortedPhotos, startIdx, pageSize]);

  return (
    <div className="space-y-6" onClickCapture={handleContainerClick}>
      {/* View Switcher Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border/60 pb-3">
        <span className="text-xs text-muted font-mono">
          Showing {pagePhotos.length} of {sortedPhotos.length}{" "}
          {sortedPhotos.length === 1 ? "work" : "works"}
        </span>

        <div className="flex items-center space-x-3 self-end sm:self-auto">
          {/* User Sort Order Selector */}
          <div className="flex items-center space-x-1.5 bg-surface border border-surface-border rounded-md px-2.5 py-1 shadow-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-accent shrink-0" />
            <select
              value={currentSort}
              onChange={(e) => handleSortChange(e.target.value)}
              aria-label="Sort photographs by"
              className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer pr-1"
            >
              <option value="date-desc" className="bg-surface text-foreground">
                Date (Newest First)
              </option>
              <option value="date-asc" className="bg-surface text-foreground">
                Date (Oldest First)
              </option>
              <option value="title-asc" className="bg-surface text-foreground">
                Title (A to Z)
              </option>
              <option value="title-desc" className="bg-surface text-foreground">
                Title (Z to A)
              </option>
              <option value="created-desc" className="bg-surface text-foreground">
                Recently Added
              </option>
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
      {viewMode === "large" ? (
        <ExhibitionGallery
          photos={pagePhotos}
          gap={32}
          showWatermark={showWatermark}
          copyrightNotice={copyrightNotice}
          categoryName={categoryName}
        />
      ) : (
        <JustifiedGallery
          photos={pagePhotos}
          targetRowHeight={210}
          gap={8}
          showWatermark={showWatermark}
          copyrightNotice={copyrightNotice}
          categoryName={categoryName}
        />
      )}

      {/* Numbered pagination bar (pure in-memory client navigation) */}
      <Pagination
        currentPage={validPage}
        totalPages={totalPages}
        totalItems={sortedPhotos.length}
        pageSize={pageSize}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
