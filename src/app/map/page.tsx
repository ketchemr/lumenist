import { getAllPhotos, getAllCategories } from "@/lib/photos";
import { GlobalMap } from "@/components/GlobalMap";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default function MapPage() {
  const photos = getAllPhotos();
  const categories = getAllCategories()
    .filter((c) => c.slug !== "All")
    .map((c) => c.name);

  const geotaggedCount = photos.filter((p) => p.location).length;

  return (
    <div className="space-y-6">
      <div className="border-b border-surface-border pb-4 space-y-2">
        <Breadcrumbs items={[{ label: "Map" }]} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light text-foreground tracking-tight flex items-center space-x-2.5">
              <MapPin className="w-6 h-6 text-accent" />
              <span>Interactive Geographic Map</span>
            </h1>
            <p className="text-sm text-muted pt-1">
              Explore {geotaggedCount} geotagged capture locations across the Pacific Northwest, Appalachia, the Gulf Coast, and beyond.
            </p>
          </div>
        </div>
      </div>

      <GlobalMap photos={photos} categories={categories} />
    </div>
  );
}
