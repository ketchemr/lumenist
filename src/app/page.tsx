import { getAllPhotos } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import { RandomHeroSlideshow } from "@/components/RandomHeroSlideshow";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const photos = getAllPhotos();
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
