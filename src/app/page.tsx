import type { Metadata } from "next";
import { getAllPhotos } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import { isVideoPhoto } from "@/lib/media";
import { RandomHeroSlideshow } from "@/components/RandomHeroSlideshow";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings();
  const siteTitle = settings.siteTitle || "Randal R. Ketchem Photography";
  const tagline = settings.siteTagline || "Fine Art Landscape and Nature Photography";

  return {
    title: {
      absolute: `${siteTitle} | ${tagline}`,
    },
    description: tagline,
    alternates: {
      canonical: "/",
    },
  };
}

export default function HomePage() {
  const allPhotos = getAllPhotos();
  const stillPhotos = allPhotos.filter((p) => !isVideoPhoto(p));
  const photos = stillPhotos.length > 0 ? stillPhotos : allPhotos;
  const settings = getSettings();

  const copyrightNotice =
    settings.copyrightOverlay ||
    (settings.artistName ? `© ${settings.artistName}` : "© Randal R. Ketchem");
  const showWatermark = settings.showWatermarkOverlay ?? false;

  return (
    <div className="w-full flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      <RandomHeroSlideshow
        photos={photos}
        intervalSeconds={settings.slideshowInterval || 10}
        showWatermark={showWatermark}
        copyrightNotice={copyrightNotice}
      />
    </div>
  );
}
