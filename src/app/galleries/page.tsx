import Link from "next/link";
import { getAllCategories, getAllPhotos } from "@/lib/photos";
import { Folder, Images, ArrowRight } from "lucide-react";

export default function GalleriesIndexPage() {
  const allPhotos = getAllPhotos();
  const categories = getAllCategories();
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

      {/* Featured "All Photographs" Banner */}
      <Link
        href="/galleries/All"
        className="group block rounded-sm overflow-hidden bg-surface border border-surface-border hover:border-accent transition-all p-6 sm:p-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 text-xs text-accent uppercase tracking-wider font-semibold">
              <Images className="w-4 h-4" />
              <span>Full Archive</span>
            </div>
            <h2 className="text-2xl font-light text-white group-hover:text-accent transition-colors">
              All Photographs
            </h2>
            <p className="text-sm text-gray-400 max-w-xl leading-relaxed">
              Browse the complete collection of {allPhotos.length} cataloged fine art photographs, 
              spanning from early medium format and 35mm film transparencies to modern ultra-high-resolution digital captures.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-sm text-accent group-hover:text-accent-light font-medium self-start sm:self-center">
            <span>Explore Complete Archive ({allPhotos.length})</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>

      {/* Category Grid */}
      <div className="space-y-4">
        <h2 className="text-sm uppercase tracking-wider text-muted font-medium">
          Collections by Category ({otherCategories.length})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {otherCategories.map((cat) => (
            <Link
              key={cat.name}
              href={`/galleries/${cat.slug}`}
              className="group block rounded-sm overflow-hidden bg-surface border border-surface-border hover:border-accent/40 transition-all"
            >
              {cat.coverPhoto && (
                <div className="aspect-[3/2] overflow-hidden bg-black">
                  <img
                    src={cat.coverPhoto.imageDesktop}
                    alt={cat.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
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
