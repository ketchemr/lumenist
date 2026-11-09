import Link from "next/link";
import { Photo } from "@/types/photo";

interface PhotoCardProps {
  photo: Photo;
}

export function PhotoCard({ photo }: PhotoCardProps) {
  return (
    <Link
      href={`/photo/${photo.photoID}`}
      className="group block overflow-hidden rounded-sm bg-surface border border-surface-border transition-all hover:border-accent/40"
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-black flex items-center justify-center">
        {/* Clean, distraction-free photograph */}
        <img
          src={photo.imageDesktop}
          alt={photo.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
        />
      </div>

      <div className="p-3.5 space-y-1.5">
        <h3 className="text-sm font-medium text-white group-hover:text-accent transition-colors truncate">
          {photo.title}
        </h3>
        
        <div className="flex items-center justify-between text-xs text-muted pt-0.5">
          <span className="truncate max-w-[65%]">
            {photo.categories.slice(0, 2).join(" · ") || photo.dateTaken.year}
          </span>
          <span className="text-[11px] text-gray-400">
            {photo.camera ? photo.camera.replace("ILCE-", "A").replace("Nikon ", "") : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
