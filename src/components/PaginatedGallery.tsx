"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Photo } from "@/types/photo";
import { JustifiedGallery } from "@/components/JustifiedGallery";
import { ExhibitionGallery } from "@/components/ExhibitionGallery";
import { Pagination } from "@/components/Pagination";
import { Columns2, LayoutGrid, ArrowUpDown } from "lucide-react";

type GalleryViewMode = "large" | "compact";

interface PaginatedGalleryProps {
  photos: Photo[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  baseUrl: string;
  defaultView?: GalleryViewMode;
  currentSort?: string;
  showWatermark?: boolean;
  copyrightNotice?: string;
}

export function PaginatedGallery({
  photos,
  currentPage,
  totalPages,
  totalItems,
  pageSize = 48,
  baseUrl,
  defaultView = "large",
  currentSort = "date-desc",
  showWatermark = false,
  copyrightNotice = "© Randal R. Ketchem",
}: PaginatedGalleryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Default to large (Exhibition mode) for fine-art impact
  const [viewMode, setViewMode] = useState<GalleryViewMode>(defaultView);

  // Load persistent user preference from localStorage without causing hydration mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lumenist_gallery_view");
      if (saved === "compact" || saved === "large") {
        setViewMode(saved);
      }
      const savedSort = localStorage.getItem("lumenist_preferred_sort");
      if (savedSort && !searchParams.get("sort") && savedSort !== currentSort) {
        router.replace(`${baseUrl}?sort=${savedSort}`);
      }
    } catch {
      // Storage unavailable / blocked
    }
  }, []);

  const handleViewChange = (mode: GalleryViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("lumenist_gallery_view", mode);
    } catch {
      // Storage unavailable
    }
  };

  const handleSortChange = (newSort: string) => {
    try {
      localStorage.setItem("lumenist_preferred_sort", newSort);
    } catch {
      // Storage unavailable
    }
    router.push(`${baseUrl}?sort=${newSort}&page=1`);
  };

  return (
    <div className="space-y-6">
      {/* View Switcher Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border/60 pb-3">
        <span className="text-xs text-muted font-mono">
          Showing {photos.length} of {totalItems} {totalItems === 1 ? "work" : "works"}
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
      {viewMode === "large" ? (
        <ExhibitionGallery
          photos={photos}
          gap={32}
          showWatermark={showWatermark}
          copyrightNotice={copyrightNotice}
        />
      ) : (
        <JustifiedGallery
          photos={photos}
          targetRowHeight={210}
          gap={8}
          showWatermark={showWatermark}
          copyrightNotice={copyrightNotice}
        />
      )}

      {/* Piwigo-style numbered pagination bar */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        baseUrl={baseUrl}
      />
    </div>
  );
}
