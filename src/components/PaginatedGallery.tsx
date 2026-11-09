"use client";

import { useState } from "react";
import { Photo } from "@/types/photo";
import { PhotoCard } from "@/components/PhotoCard";
import { ChevronDown } from "lucide-react";

interface PaginatedGalleryProps {
  photos: Photo[];
  initialCount?: number;
  pageSize?: number;
}

export function PaginatedGallery({
  photos,
  initialCount = 36,
  pageSize = 36,
}: PaginatedGalleryProps) {
  const [visibleCount, setVisibleCount] = useState(initialCount);

  const displayedPhotos = photos.slice(0, visibleCount);
  const hasMore = visibleCount < photos.length;
  const remaining = photos.length - visibleCount;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {displayedPhotos.map((photo) => (
          <PhotoCard key={photo.photoID} photo={photo} />
        ))}
      </div>

      {hasMore && (
        <div className="text-center pt-6 pb-12 space-y-3">
          <p className="text-xs text-muted">
            Showing {visibleCount} of {photos.length} photographs
          </p>
          <button
            onClick={() => setVisibleCount((prev) => prev + pageSize)}
            className="inline-flex items-center space-x-2 bg-surface hover:bg-surface-hover border border-surface-border hover:border-accent/40 text-gray-200 hover:text-accent px-6 py-2.5 rounded-sm text-sm font-medium transition-all group"
          >
            <span>Load Next {Math.min(remaining, pageSize)} Works</span>
            <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}
