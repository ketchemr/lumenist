import Link from "next/link";
import { getAllCategories, getAllPhotos } from "@/lib/photos";
import { Folder, Images, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default function GalleriesIndexPage() {
  const allPhotos = getAllPhotos();
  const categories = getAllCategories();
  const allCategory = categories.find((c) => c.slug === "All");
  const otherCategories = categories.filter((c) => c.slug !== "All");

  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
          Curated Galleries
        </h1>
        <p className="text-sm text-muted pt-1">
          Explore photographs categorized by subject, biome, season, and atmospheric light.
        </p>
      </div>

      {/* Featured "All Photographs" Banner with unique random cover */}
      <Link
        href="/galleries/All"
        className="group block rounded-sm overflow-hidden bg-surface border border-surface-border hover:border-accent transition-all"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 items-center">
          {allCategory?.coverPhoto && (
            <div className="md:col-span-5 lg:col-span-4 aspect-[3/2] overflow-hidden bg-black">
              <img
                src={allCategory.coverPhoto.imageDesktop}
                alt="All Photographs Archive"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
          )}
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
            <h2 className="text-2xl sm:text-3xl font-light text-white group-hover:text-accent transition-colors">
              All Photographs
            </h2>
            <p className="text-sm text-gray-400 max-w-xl leading-relaxed">
              Browse all {allPhotos.length} cataloged fine art photographs across all years, 
              spanning from early medium format and 35mm film transparencies to modern ultra-high-resolution digital captures.
            </p>
            <div className="pt-2 flex items-center space-x-2 text-sm text-accent group-hover:text-accent-light font-medium">
              <span>Explore Complete Archive ({allPhotos.length} works)</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </Link>

      {/* Category Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-2">
          <h2 className="text-sm uppercase tracking-wider text-muted font-medium">
            Curated Categories ({otherCategories.length})
          </h2>
          <span className="text-xs text-muted">
            Each gallery shows a unique random photograph
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {otherCategories.map((cat) => (
            <Link
              key={cat.name}
              href={`/galleries/${cat.slug}`}
              className="group block rounded-sm overflow-hidden bg-surface border border-surface-border hover:border-accent/40 transition-all"
            >
              {cat.coverPhoto && (
                <div className="aspect-[3/2] overflow-hidden bg-black relative">
                  <img
                    src={cat.coverPhoto.imageDesktop}
                    alt={cat.coverPhoto.title || cat.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[11px] text-gray-200 truncate">
                      {cat.coverPhoto.title}
                    </p>
                  </div>
                </div>
              )}
              <div className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-base font-medium text-white group-hover:text-accent transition-colors flex items-center space-x-1.5">
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
    </div>
  );
}
