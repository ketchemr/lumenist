import type { Metadata } from "next";
import Link from "next/link";
import { getAllCategories, getAllPhotos } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import { Folder, Images } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { WatermarkBadge } from "@/components/WatermarkBadge";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings();
  const title = "Curated Galleries";
  const desc =
    settings.siteTagline ||
    "Explore fine art landscape and nature photography curated into thematic collections.";

  return {
    title,
    description: desc,
  };
}

export default function GalleriesIndexPage() {
  const categories = getAllCategories();
  const photos = getAllPhotos();
  const settings = getSettings();

  const copyrightNotice =
    settings.copyrightOverlay ||
    (settings.artistName ? `© ${settings.artistName}` : "© Randal R. Ketchem");
  const showWatermark = settings.showWatermarkOverlay ?? false;

  return (
    <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Breadcrumb Trail */}
      <div className="border-b border-surface-border pb-4 space-y-2">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Galleries" }]} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light text-foreground tracking-tight flex items-center space-x-2.5">
              <Images className="w-6 h-6 text-accent" />
              <span>Curated Galleries</span>
            </h1>
            <p className="text-xs text-muted pt-1">
              Explore fine art photography archives curated by region, season, and atmospheric subject
            </p>
          </div>
          <span className="text-xs text-muted font-mono self-start sm:self-auto">
            {categories.length} Collections · {photos.length} Works
          </span>
        </div>
      </div>

      {/* Grid of All Curated Galleries */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {categories.map((cat, idx) => (
          <Link
            key={cat.name}
            href={`/galleries/${cat.slug}`}
            className="group block rounded-sm overflow-hidden bg-surface border border-surface-border hover:border-accent/50 transition-all shadow-sm"
          >
            {cat.coverPhoto && (() => {
              const ar = cat.coverPhoto.size?.aspectRatio || 1.5;
              const isLandscape = ar >= 1;
              return (
                <div className="aspect-square overflow-hidden bg-surface-hover/40 dark:bg-black/80 relative flex items-center justify-center p-3 border-b border-surface-border select-none">
                  <div
                    className={`relative flex items-center justify-center select-none ${
                      isLandscape ? "w-full max-h-full" : "h-full max-w-full"
                    }`}
                    style={{ aspectRatio: ar }}
                  >
                    <img
                      src={`/api/thumbnail?src=${encodeURIComponent(
                        cat.coverPhoto.imageDesktop
                      )}&w=600&fmt=webp`}
                      alt={cat.coverPhoto.title || cat.name}
                      loading={idx < 4 ? "eager" : "lazy"}
                      decoding="async"
                      draggable={false}
                      className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.02] shadow-sm select-none pointer-events-none"
                    />
                    <WatermarkBadge
                      show={showWatermark}
                      notice={copyrightNotice}
                      size="xs"
                      withShield={true}
                    />
                    <div className="photo-overlay absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <p className="text-[11px] text-white truncate text-center font-light">
                        {cat.coverPhoto.title}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="p-4 flex items-center justify-between">
              <div className="space-y-0.5 min-w-0 flex-1">
                <h2 className="text-base font-medium text-foreground group-hover:text-accent transition-colors flex items-center space-x-1.5 truncate">
                  {cat.slug === "All" ? (
                    <Images className="w-3.5 h-3.5 text-accent shrink-0" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-accent shrink-0" />
                  )}
                  <span className="truncate">{cat.name}</span>
                </h2>
                <p className="text-xs text-muted font-mono">{cat.count} photographs</p>
              </div>
              <span className="text-xs text-muted group-hover:text-accent transition-colors ml-2">
                &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
