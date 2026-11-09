import Link from "next/link";
import { getAllPhotos, getAllCategories } from "@/lib/photos";
import { PhotoCard } from "@/components/PhotoCard";
import { siteConfig } from "@/config/site";
import { ArrowRight, Compass, Sparkles } from "lucide-react";

export default function HomePage() {
  const photos = getAllPhotos();
  const categories = getAllCategories();

  // First photo as featured hero
  const featured = photos[0];
  const recentPhotos = photos.slice(1, 13);
  const topCategories = categories.slice(0, 8);

  return (
    <div className="space-y-16">
      {/* Featured / Hero Section */}
      {featured && (
        <section className="relative rounded-sm overflow-hidden border border-surface-border bg-black">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center p-6 sm:p-10">
            <div className="lg:col-span-8 overflow-hidden rounded-sm bg-neutral-950 flex items-center justify-center">
              <Link href={`/photo/${featured.photoID}`} className="block w-full">
                <img
                  src={featured.imageDesktop}
                  alt={featured.title}
                  className="w-full h-auto max-h-[70vh] object-contain mx-auto rounded shadow-2xl transition-transform duration-300 hover:scale-[1.01]"
                />
              </Link>
            </div>

            <div className="lg:col-span-4 space-y-4">
              <div className="inline-flex items-center space-x-1.5 text-xs text-accent font-medium tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Featured Exhibition</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
                {featured.title}
              </h2>
              <p className="text-sm text-gray-400 line-clamp-4 leading-relaxed">
                {featured.description || "A fine art landscape photograph exploring natural light and form."}
              </p>
              
              <div className="pt-2 flex flex-wrap gap-2">
                {featured.categories.map((c) => (
                  <Link
                    key={c}
                    href={`/galleries/${encodeURIComponent(c)}`}
                    className="text-xs bg-surface hover:bg-surface-hover border border-surface-border px-2.5 py-1 rounded text-gray-300 transition-colors"
                  >
                    {c}
                  </Link>
                ))}
              </div>

              <div className="pt-4">
                <Link
                  href={`/photo/${featured.photoID}`}
                  className="inline-flex items-center space-x-2 text-sm text-accent hover:text-accent-light transition-colors font-medium group"
                >
                  <span>View Full Exhibition & Technicals</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Category Pills / Exploration */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <h2 className="text-lg font-medium text-white tracking-tight flex items-center space-x-2">
            <Compass className="w-4 h-4 text-accent" />
            <span>Curated Galleries</span>
          </h2>
          <Link
            href="/galleries"
            className="text-xs text-muted hover:text-accent transition-colors flex items-center space-x-1"
          >
            <span>All {categories.length} Categories</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
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

      {/* Recent Photographs Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-surface-border pb-3">
          <div>
            <h2 className="text-xl font-light text-white tracking-tight">
              Recent Photographs
            </h2>
            <p className="text-xs text-muted pt-0.5">
              Showing recent fine art captures from {photos.length} cataloged works
            </p>
          </div>
          <Link
            href="/galleries"
            className="text-xs text-accent hover:text-accent-light transition-colors"
          >
            Browse All &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {recentPhotos.map((photo) => (
            <PhotoCard key={photo.photoID} photo={photo} />
          ))}
        </div>
      </section>
    </div>
  );
}
