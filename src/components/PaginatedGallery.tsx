"use client";

import { Photo } from "@/types/photo";
import { JustifiedGallery } from "@/components/JustifiedGallery";
import { Pagination } from "@/components/Pagination";

interface PaginatedGalleryProps {
  photos: Photo[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  baseUrl: string;
}

export function PaginatedGallery({
  photos,
  currentPage,
  totalPages,
  totalItems,
  pageSize = 48,
  baseUrl,
}: PaginatedGalleryProps) {
  return (
    <div className="space-y-6">
      {/* Justified gallery with flush aligned edges and zero cropping */}
      <JustifiedGallery photos={photos} targetRowHeight={210} gap={8} />

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
