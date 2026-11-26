"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Photo } from "@/types/photo";
import { WatermarkBadge } from "@/components/WatermarkBadge";
import { VideoPlayBadge } from "@/components/VideoPlayBadge";
import { isVideoPhoto } from "@/lib/media";

interface ExhibitionGalleryProps {
  photos: Photo[];
  gap?: number;
  showWatermark?: boolean;
  copyrightNotice?: string;
  categoryName?: string;
}

export function ExhibitionGallery({
  photos,
  gap = 32,
  showWatermark = false,
  copyrightNotice = "© Photographer",
  categoryName,
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
              const photoHref = `/photo/${photo.photoID}${
                categoryName ? `?from=${encodeURIComponent(categoryName)}` : ""
              }`;

              return (
                <article key={photo.photoID} className="group space-y-3">
                  <Link
                    href={photoHref}
                    className="block cursor-pointer select-none"
                    title={`${photo.title} (${photo.dateTaken?.year || ""})`}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {/* Uncropped Photograph Frame with Inset Keyline */}
                    <div
                      className="relative w-full overflow-hidden bg-surface dark:bg-black/80 rounded-[2px] photo-frame select-none"
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
                      {/* Video indicator */}
                      {isVideoPhoto(photo) && <VideoPlayBadge size="md" />}
                      {/* Copyright watermark & protection shield */}
                      <WatermarkBadge
                        show={showWatermark}
                        notice={copyrightNotice}
                        size="md"
                        withShield={true}
                      />
                    </div>
                  </Link>

                  {/* Exhibition Typography (Fine-Art Caption) */}
                  <div className="pt-1 px-0.5 space-y-1 select-text">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="text-base sm:text-lg font-light text-foreground tracking-tight transition-colors truncate select-text">
                        <Link
                          href={photoHref}
                          draggable={false}
                          onClick={(e) => {
                            if (window.getSelection()?.toString()) {
                              e.preventDefault();
                            }
                          }}
                          className="hover:text-accent group-hover:text-accent transition-colors select-text cursor-pointer"
                          title={`${photo.title} (${photo.dateTaken?.year || ""})`}
                        >
                          {photo.title}
                        </Link>
                      </h2>
                      {photo.dateTaken?.year && (
                        <span className="text-xs font-mono text-muted shrink-0 select-text cursor-text">
                          {photo.dateTaken.year}
                        </span>
                      )}
                    </div>

                    {/* Secondary Detail Line: ID and Album Memberships */}
                    <div className="flex items-center space-x-2 text-xs text-muted font-light truncate select-text cursor-text">
                      <span className="font-mono shrink-0 select-text">{photo.photoID}</span>
                      {photo.categories && photo.categories.length > 0 && (
                        <>
                          <span className="text-muted/60 select-none">·</span>
                          <span className="truncate text-muted/80 select-text">
                            {photo.categories.map((cat, idx) => (
                              <span key={cat}>
                                <Link
                                  href={`/galleries/${encodeURIComponent(cat)}`}
                                  draggable={false}
                                  onClick={(e) => {
                                    if (window.getSelection()?.toString()) {
                                      e.preventDefault();
                                    }
                                  }}
                                  className="hover:text-accent select-text cursor-pointer transition-colors underline decoration-transparent hover:decoration-accent/40"
                                >
                                  {cat}
                                </Link>
                                {idx < photo.categories.length - 1 && ", "}
                              </span>
                            ))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
