import Link from "next/link";
import { Photo } from "@/types/photo";

interface PhotoCardProps {
  photo: Photo;
  heightClass?: string;
}

export function PhotoCard({
  photo,
  heightClass = "h-[160px] sm:h-[200px] md:h-[220px]",
}: PhotoCardProps) {
  return (
    <Link
      href={`/photo/${photo.photoID}`}
      className={`relative inline-block ${heightClass} overflow-hidden group bg-black shrink-0 transition-transform duration-200 hover:z-10 rounded-[1px]`}
      title={photo.title}
    >
      {/* Full, uncropped photograph thumbnail */}
      <img
        src={photo.imageDesktop}
        alt={photo.title}
        loading="lazy"
        className="h-full w-auto block object-contain transition-transform duration-300 group-hover:scale-[1.02]"
      />

      {/* Subtle hover overlay with title */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-xs text-white truncate font-medium drop-shadow-md">
          {photo.title}
        </p>
        {photo.categories.length > 0 && (
          <p className="text-[10px] text-gray-300 truncate">
            {photo.categories.slice(0, 2).join(" · ")}
          </p>
        )}
      </div>
    </Link>
  );
}
