import { notFound } from "next/navigation";
import Link from "next/link";
import { getPhotoById, getAdjacentPhotos } from "@/lib/photos";
import { TechnicalDetails } from "@/components/TechnicalDetails";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BackButton } from "@/components/BackButton";
import { ChevronLeft, ChevronRight, Tag, Folder } from "lucide-react";

interface PhotoPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PhotoPage({ params }: PhotoPageProps) {
  const { id } = await params;
  const photo = getPhotoById(id);

  if (!photo) {
    notFound();
  }

  const { prev, next } = getAdjacentPhotos(photo.photoID);

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      {/* Top Navigation & Breadcrumb Trail */}
      <div className="flex items-center justify-between text-xs text-muted border-b border-surface-border pb-4">
        <div className="flex items-center space-x-3">
          <BackButton fallback="/galleries" label="Back to Gallery" />
          <span className="text-gray-700 hidden sm:inline">|</span>
          <div className="hidden sm:block">
            <Breadcrumbs
              items={[
                { label: "Galleries", href: "/galleries" },
                ...(photo.categories[0]
                  ? [
                      {
                        label: photo.categories[0],
                        href: `/galleries/${encodeURIComponent(photo.categories[0])}`,
                      },
                    ]
                  : []),
                { label: photo.title },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {prev ? (
            <Link
              href={`/photo/${prev.photoID}`}
              className="inline-flex items-center space-x-1 hover:text-accent transition-colors"
              title={`Previous: ${prev.title}`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </Link>
          ) : (
            <span className="opacity-30 cursor-not-allowed inline-flex items-center space-x-1">
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </span>
          )}

          <span className="text-gray-600">|</span>

          {next ? (
            <Link
              href={`/photo/${next.photoID}`}
              className="inline-flex items-center space-x-1 hover:text-accent transition-colors"
              title={`Next: ${next.title}`}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <span className="opacity-30 cursor-not-allowed inline-flex items-center space-x-1">
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </span>
          )}
        </div>
      </div>

      {/* Main Photographic Presentation */}
      <div className="flex justify-center items-center bg-black/90 rounded-sm p-2 sm:p-6 border border-surface-border">
        <img
          src={photo.imageDesktop}
          alt={photo.title}
          className="max-h-[82vh] w-auto max-w-full object-contain mx-auto rounded-sm shadow-2xl photo-frame"
        />
      </div>

      {/* Story & Narrative */}
      <div className="space-y-4 max-w-3xl mx-auto text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
          {photo.title}
        </h1>

        {photo.description && (
          <p className="text-gray-300 leading-relaxed text-sm sm:text-base font-normal">
            {photo.description}
          </p>
        )}

        {/* Categories & Keywords */}
        <div className="pt-2 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
          {photo.categories.map((cat) => (
            <Link
              key={cat}
              href={`/galleries/${encodeURIComponent(cat)}`}
              className="inline-flex items-center space-x-1 text-xs bg-surface hover:bg-surface-hover border border-surface-border px-2.5 py-1 rounded text-accent transition-colors"
            >
              <Folder className="w-3 h-3" />
              <span>{cat}</span>
            </Link>
          ))}

          {photo.keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center space-x-1 text-xs text-gray-400 bg-surface/50 border border-surface-border/50 px-2 py-0.5 rounded"
            >
              <Tag className="w-2.5 h-2.5 text-gray-500" />
              <span>{kw}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Deep Photographic Technical Details */}
      <div className="pt-6">
        <TechnicalDetails photo={photo} />
      </div>
    </div>
  );
}
