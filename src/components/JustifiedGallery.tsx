"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Photo } from "@/types/photo";

interface JustifiedGalleryProps {
  photos: Photo[];
  targetRowHeight?: number;
  gap?: number;
}

interface CalculatedPhoto {
  photo: Photo;
  width: number;
  height: number;
}

interface CalculatedRow {
  photos: CalculatedPhoto[];
  height: number;
}

export function JustifiedGallery({
  photos,
  targetRowHeight = 210,
  gap = 8,
}: JustifiedGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Measure container width responsively with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Set initial width
    setContainerWidth(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Responsive target row height (smaller on mobile)
  const effectiveTargetHeight = useMemo(() => {
    if (containerWidth <= 0) return targetRowHeight;
    if (containerWidth < 640) return Math.round(targetRowHeight * 0.72); // ~150px on phone
    if (containerWidth < 1024) return Math.round(targetRowHeight * 0.88); // ~185px on tablet
    return targetRowHeight; // ~210px on desktop
  }, [containerWidth, targetRowHeight]);

  // Compute justified rows
  const rows = useMemo(() => {
    if (containerWidth <= 0 || photos.length === 0) return [];

    const calculatedRows: CalculatedRow[] = [];
    let currentRow: { photo: Photo; ar: number }[] = [];
    let currentArSum = 0;

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      // Default aspect ratio fallback: 1.5 (3:2)
      const ar = photo.size?.aspectRatio || 1.5;

      currentRow.push({ photo, ar });
      currentArSum += ar;

      // Calculate what row height would be needed to stretch current items across containerWidth
      const gapsWidth = (currentRow.length - 1) * gap;
      const availableWidth = containerWidth - gapsWidth;
      const potentialHeight = availableWidth / currentArSum;

      // If potential height is within target height, finalize row to align edges flush
      if (potentialHeight <= effectiveTargetHeight) {
        const rowHeight = Math.round(potentialHeight);
        let remainingWidth = availableWidth;

        const rowPhotos: CalculatedPhoto[] = currentRow.map((item, idx) => {
          const isLastInRow = idx === currentRow.length - 1;
          const itemWidth = isLastInRow
            ? remainingWidth
            : Math.round(rowHeight * item.ar);
          remainingWidth -= itemWidth;

          return {
            photo: item.photo,
            width: itemWidth,
            height: rowHeight,
          };
        });

        calculatedRows.push({ photos: rowPhotos, height: rowHeight });
        currentRow = [];
        currentArSum = 0;
      }
    }

    // Handle leftover photos in the last row (keep them at target height without stretching)
    if (currentRow.length > 0) {
      const rowPhotos: CalculatedPhoto[] = currentRow.map((item) => ({
        photo: item.photo,
        width: Math.round(effectiveTargetHeight * item.ar),
        height: effectiveTargetHeight,
      }));
      calculatedRows.push({
        photos: rowPhotos,
        height: effectiveTargetHeight,
      });
    }

    return calculatedRows;
  }, [photos, containerWidth, effectiveTargetHeight, gap]);

  return (
    <div ref={containerRef} className="w-full">
      {/* If container width is not yet measured, render an initial clean fallback */}
      {containerWidth === 0 && (
        <div className="flex flex-wrap gap-2 opacity-0">
          {photos.slice(0, 16).map((p) => (
            <div
              key={p.photoID}
              className="h-[200px] w-[300px] bg-neutral-900"
            />
          ))}
        </div>
      )}

      {/* Justified rows with flush left & right margins */}
      <div className="space-y-2" style={{ gap: `${gap}px` }}>
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="flex items-center"
            style={{
              height: `${row.height}px`,
              gap: `${gap}px`,
              marginBottom: `${gap}px`,
            }}
          >
            {row.photos.map(({ photo, width, height }) => (
              <Link
                key={photo.photoID}
                href={`/photo/${photo.photoID}`}
                style={{
                  width: `${width}px`,
                  height: `${height}px`,
                }}
                className="relative block overflow-hidden group bg-black shrink-0 transition-transform duration-200 hover:z-10"
                title={`${photo.title} (${photo.dateTaken.year || ""})`}
              >
                {/* 100% full uncropped image */}
                <img
                  src={photo.imageDesktop}
                  alt={photo.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />

                {/* Subtle hover overlay with title */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <p className="text-xs text-white truncate font-medium drop-shadow">
                    {photo.title}
                  </p>
                  {photo.categories.length > 0 && (
                    <p className="text-[10px] text-gray-300 truncate">
                      {photo.categories.slice(0, 2).join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
