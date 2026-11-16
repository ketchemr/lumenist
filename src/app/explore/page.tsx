import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllPhotos, getAllCategories } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import { ExploreGallery } from "@/components/ExploreGallery";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings();
  const siteTitle = settings.siteTitle || "Fine Art Photography";
  return {
    title: "Explore Archive & Map",
    description: `Explore the complete fine art landscape and nature photography archive by ${settings.artistName || "Randal R. Ketchem"}. Search, filter by analog film or digital capture, and discover by geographic location.`,
    alternates: {
      canonical: "/explore",
    },
    openGraph: {
      title: `Explore Archive & Map | ${siteTitle}`,
      description: "Search, filter by analog film or digital capture, and explore photographs by keywords and locations.",
      url: "/explore",
    },
  };
}

export default function ExplorePage() {
  const photos = getAllPhotos();
  const categories = getAllCategories();
  const settings = getSettings();
  const copyrightNotice =
    settings.copyrightOverlay ||
    (settings.artistName ? `© ${settings.artistName}` : "© Randal R. Ketchem");

  return (
    <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-light text-foreground tracking-tight">
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
        <ExploreGallery
          initialPhotos={photos}
          categories={categories}
          showWatermark={settings.showWatermarkOverlay ?? false}
          copyrightNotice={copyrightNotice}
        />
      </Suspense>
    </div>
  );
}
