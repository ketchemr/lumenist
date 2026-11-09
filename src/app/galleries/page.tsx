import Link from "next/link";
import { getAllCategories } from "@/lib/photos";
import { Folder } from "lucide-react";

export default function GalleriesIndexPage() {
  const categories = getAllCategories();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
          Curated Galleries
        </h1>
        <p className="text-sm text-muted pt-1">
          Explore photographs categorized by subject, biome, season, and atmospheric light.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {categories.map((cat) => (
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
                <h2 className="text-base font-medium text-white group-hover:text-accent transition-colors flex items-center space-x-1.5">
                  <Folder className="w-3.5 h-3.5 text-accent" />
                  <span>{cat.name}</span>
                </h2>
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
  );
}
