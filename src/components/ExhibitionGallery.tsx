"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Photo } from "@/types/photo";
import { WatermarkBadge } from "@/components/WatermarkBadge";

interface ExhibitionGalleryProps {
  photos: Photo[];
  gap?: number;
  showWatermark?: boolean;
  copyrightNotice?: string;
}

export function ExhibitionGallery({
  photos,
  gap = 32,
  showWatermark = false,
  copyrightNotice = "© Randal R. Ketchem",
}: ExhibitionGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(1200);

  // Responsive width tracking via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measured = el.getBoundingClientRect().width;
    if (measured > 0) {
      setContainerWidth(measured);
    }

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

  // Determine number of columns: 1 on mobile (<640px), 2 on desktop (Nigel Danson exhibition layout)
  const numColumns = useMemo(() => {
    if (containerWidth < 640) return 1;
    return 2;
  }, [containerWidth]);

  // Height-balanced masonry distribution
  // Distributes each photo into the column with the current lowest total height
  // to ensure both columns end evenly, while preserving chronological/curated left-to-right reading order.
  const columns = useMemo(() => {
    if (photos.length === 0) return [];
    if (numColumns === 1) {
      return [photos.map((photo, idx) => ({ photo, globalIndex: idx }))];
    }

    const cols: { photo: Photo; globalIndex: number }[][] = [[], []];
    const colHeights = [0, 0];

    photos.forEach((photo, idx) => {
      const rawAr = photo.size?.aspectRatio || 1.5;
      const ar = Math.max(0.4, Math.min(4.0, rawAr));
      const normHeight = 1 / ar; // Proportional height for a fixed column width

      const targetCol = colHeights[0] <= colHeights[1] ? 0 : 1;
      cols[targetCol].push({ photo, globalIndex: idx });
      colHeights[targetCol] += normHeight;
    });

    return cols;
  }, [photos, numColumns]);

  if (photos.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="w-full">
      <div
        className="grid grid-cols-1 sm:grid-cols-2 items-start"
        style={{
          gap: numColumns === 1 ? "24px" : `${gap}px`,
        }}
      >
        {columns.map((columnPhotos, colIdx) => (
          <div
            key={colIdx}
            className="flex flex-col"
            style={{
              gap: numColumns === 1 ? "24px" : `${gap}px`,
            }}
          >
            {columnPhotos.map(({ photo, globalIndex }) => {
              const rawAr = photo.size?.aspectRatio || 1.5;
              const ar = Math.max(0.4, Math.min(4.0, rawAr));

              // Curate clean metadata line (Camera, Lens, Film, Year)
              const metaParts: string[] = [];
              if (photo.dateTaken?.year) {
                metaParts.push(String(photo.dateTaken.year));
              }
              if (photo.camera) {
                metaParts.push(photo.camera);
              } else if (photo.film && photo.film !== "Digital") {
                metaParts.push(photo.film);
              }
              if (photo.lens) {
                metaParts.push(photo.lens);
              }

              return (
                <article key={photo.photoID} className="group">
                  <Link
                    href={`/photo/${photo.photoID}`}
                    className="block space-y-3 cursor-pointer select-none"
                    title={`${photo.title} (${photo.dateTaken?.year || ""})`}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {/* Uncropped Photograph Frame with Inset Keyline */}
                    <div
                      className="relative w-full overflow-hidden bg-black/80 rounded-[2px] photo-frame select-none"
                      style={{ aspectRatio: ar }}
                    >
                      <img
                        src={`/api/thumbnail?src=${encodeURIComponent(
                          photo.imageDesktop
                        )}&w=1200&fmt=webp`}
                        alt={photo.title}
                        loading={globalIndex < 4 ? "eager" : "lazy"}
                        fetchPriority={globalIndex < 2 ? "high" : "auto"}
                        decoding="async"
                        draggable={false}
                        onContextMenu={(e) => e.preventDefault()}
                        className="w-full h-full block object-contain transition-transform duration-500 ease-out group-hover:scale-[1.012] pointer-events-none select-none"
                      />
                      {/* Copyright watermark & protection shield */}
                      <WatermarkBadge
                        show={showWatermark}
                        notice={copyrightNotice}
                        size="md"
                        withShield={true}
                      />
                    </div>

                    {/* Exhibition Typography (Fine-Art Caption) */}
                    <div className="pt-1 px-0.5 space-y-1">
                      <div className="flex items-baseline justify-between gap-4">
                        <h2 className="text-base sm:text-lg font-light text-foreground tracking-tight group-hover:text-accent transition-colors truncate">
                          {photo.title}
                        </h2>
                        {photo.dateTaken?.year && (
                          <span className="text-xs font-mono text-muted shrink-0">
                            {photo.dateTaken.year}
                          </span>
                        )}
                      </div>

                      {/* Subtle Secondary Detail Line */}
                      <div className="flex items-center space-x-2 text-xs text-muted font-light truncate">
                        {metaParts.length > 1 && (
                          <span className="truncate">{metaParts.slice(1).join(" · ")}</span>
                        )}
                        {metaParts.length > 1 && photo.categories.length > 0 && (
                          <span>·</span>
                        )}
                        {photo.categories.length > 0 && (
                          <span className="truncate text-muted/80">
                            {photo.categories.slice(0, 2).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
