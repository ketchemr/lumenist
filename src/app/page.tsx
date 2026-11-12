import Link from "next/link";
import { getAllPhotos, getAllCategories } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import { RandomHeroSlideshow } from "@/components/RandomHeroSlideshow";
import { Folder, Images, ArrowRight } from "lucide-react";
import { WatermarkBadge } from "@/components/WatermarkBadge";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const photos = getAllPhotos();
  const categories = getAllCategories();
  const settings = getSettings();
  const allCategory = categories.find((c) => c.slug === "All");
  const otherCategories = categories.filter((c) => c.slug !== "All");

  const copyrightNotice =
    settings.copyrightOverlay ||
    (settings.artistName ? `© ${settings.artistName}` : "© Randal R. Ketchem");
  const showWatermark = settings.showWatermarkOverlay ?? false;

  return (
    <div className="space-y-12">
      {/* Random Hero Slideshow with smooth timed transitions & constant frame */}
      <RandomHeroSlideshow
        photos={photos}
        intervalSeconds={settings.slideshowInterval || 10}
        showWatermark={showWatermark}
        copyrightNotice={copyrightNotice}
      />

      {/* Galleries Collection */}
      <section className="space-y-8">
        {/* Featured "All Photographs" Banner with unique random cover */}
        <Link
          href="/galleries/All"
          className="group block rounded-sm overflow-hidden bg-surface border border-surface-border hover:border-accent transition-all"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 items-center">
            {allCategory?.coverPhoto && (() => {
              const ar = allCategory.coverPhoto.size?.aspectRatio || 1.5;
              const isLandscape = ar >= 1;
              return (
                <div className="md:col-span-5 lg:col-span-4 aspect-square overflow-hidden bg-surface-hover/40 dark:bg-black/80 relative flex items-center justify-center p-3 border-b md:border-b-0 md:border-r border-surface-border select-none">
                  <div
                    className={`relative flex items-center justify-center select-none ${
                      isLandscape ? "w-full max-h-full" : "h-full max-w-full"
                    }`}
                    style={{ aspectRatio: ar }}
                  >
                    <img
                      src={`/api/thumbnail?src=${encodeURIComponent(
                        allCategory.coverPhoto.imageDesktop
                      )}&w=800&fmt=webp`}
                      alt="All Photographs Archive"
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      draggable={false}
                      className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.02] shadow-sm select-none pointer-events-none"
                    />
                    <WatermarkBadge
                      show={showWatermark}
                      notice={copyrightNotice}
                      size="sm"
                      withShield={true}
                    />
                  </div>
                </div>
              );
            })()}
            <div
              className={`p-6 sm:p-8 space-y-3 ${
                allCategory?.coverPhoto
                  ? "md:col-span-7 lg:col-span-8"
                  : "md:col-span-12"
              }`}
            >
              <div className="inline-flex items-center space-x-2 text-xs text-accent uppercase tracking-wider font-semibold">
                <Images className="w-4 h-4" />
                <span>Complete Collection</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-light text-foreground group-hover:text-accent transition-colors">
                All Photographs
              </h2>
              <p className="text-sm text-muted max-w-xl leading-relaxed">
                Browse all {photos.length} fine art photographs across all years, 
                spanning from medium format and 35mm film transparencies to modern digital captures.
              </p>
              <div className="pt-2 flex items-center space-x-2 text-sm text-accent group-hover:text-accent-light font-medium">
                <span>Explore Complete Archive ({photos.length} works)</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </Link>

        {/* The Curated Galleries Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-surface-border pb-2">
            <h2 className="text-sm uppercase tracking-wider text-muted font-medium">
              Curated Galleries ({otherCategories.length})
            </h2>
            <span className="text-xs text-muted">
              Each gallery displays a unique random photograph
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {otherCategories.map((cat, idx) => (
              <Link
                key={cat.name}
                href={`/galleries/${cat.slug}`}
                className="group block rounded-sm overflow-hidden bg-surface border border-surface-border hover:border-accent/40 transition-all"
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
                  <div className="space-y-0.5">
                    <h3 className="text-base font-medium text-foreground group-hover:text-accent transition-colors flex items-center space-x-1.5">
                      <Folder className="w-3.5 h-3.5 text-accent" />
                      <span>{cat.name}</span>
                    </h3>
                    <p className="text-xs text-muted">{cat.count} photographs</p>
                  </div>
                  <span className="text-xs text-muted group-hover:text-accent transition-colors">
                    &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
