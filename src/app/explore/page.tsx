import { Suspense } from "react";
import { getAllPhotos, getAllCategories } from "@/lib/photos";
import { ExploreGallery } from "@/components/ExploreGallery";

export default function ExplorePage() {
  const photos = getAllPhotos();
  const categories = getAllCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
          Explore the Archive
        </h1>
        <p className="text-sm text-muted pt-1">
          Search, filter by analog film or digital capture, and explore by keywords and locations.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-muted">
            Loading archive...
          </div>
        }
      >
        <ExploreGallery initialPhotos={photos} categories={categories} />
      </Suspense>
    </div>
  );
}
