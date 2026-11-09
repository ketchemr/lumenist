import Link from "next/link";
import { getAllPhotos, getAllCategories } from "@/lib/photos";
import { JustifiedGallery } from "@/components/JustifiedGallery";
import { RandomHeroSlideshow } from "@/components/RandomHeroSlideshow";
import { ArrowRight, Compass } from "lucide-react";

export default function HomePage() {
  const photos = getAllPhotos();
  const categories = getAllCategories();

  // Show recent captures below the random hero
  const recentPhotos = photos.slice(0, 16);
  // Show top categories (excluding 'All Photographs' for the quick row)
  const topCategories = categories.filter((c) => c.slug !== "All").slice(0, 8);

  return (
    <div className="space-y-16">
      {/* Random Hero Slideshow with smooth timed transitions */}
      <RandomHeroSlideshow photos={photos} intervalSeconds={10} />

      {/* Curated Category Shortcuts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <h2 className="text-lg font-medium text-white tracking-tight flex items-center space-x-2">
            <Compass className="w-4 h-4 text-accent" />
            <span>Curated Galleries</span>
          </h2>
          <div className="flex items-center space-x-4 text-xs">
            <Link
              href="/galleries/All"
              className="text-accent hover:underline font-medium"
            >
              All Photographs ({photos.length})
            </Link>
            <span className="text-gray-600">·</span>
            <Link
              href="/galleries"
              className="text-muted hover:text-accent transition-colors flex items-center space-x-1"
            >
              <span>View All Categories</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {topCategories.map((cat) => (
            <Link
              key={cat.name}
              href={`/galleries/${cat.slug}`}
              className="group p-3 rounded-sm bg-surface border border-surface-border hover:border-accent/40 text-center transition-all"
            >
              <div className="text-sm font-medium text-gray-200 group-hover:text-accent transition-colors truncate">
                {cat.name}
              </div>
              <div className="text-[11px] text-muted pt-0.5">
                {cat.count} photos
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Works Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div>
            <h2 className="text-xl font-light text-white tracking-tight">
              Recent Additions
            </h2>
            <p className="text-xs text-muted pt-0.5">
              Chronological fine art additions from the {photos.length} cataloged works
            </p>
          </div>
          <Link
            href="/galleries/All"
            className="text-xs text-accent hover:text-accent-light transition-colors"
          >
            Browse All {photos.length} Photos &rarr;
          </Link>
        </div>

        <JustifiedGallery photos={recentPhotos} targetRowHeight={210} gap={8} />
      </section>
    </div>
  );
}
