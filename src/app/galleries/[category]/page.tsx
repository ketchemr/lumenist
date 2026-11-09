import { notFound } from "next/navigation";
import Link from "next/link";
import { getPhotosByCategory } from "@/lib/photos";
import { PaginatedGallery } from "@/components/PaginatedGallery";
import { ArrowLeft, Folder, Images } from "lucide-react";

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const decodedCategory = decodeURIComponent(category);
  const isAll = decodedCategory.toLowerCase() === "all";
  const photos = getPhotosByCategory(decodedCategory);

  if (photos.length === 0) {
    notFound();
  }

  const title = isAll ? "All Photographs" : decodedCategory;
  const description = isAll
    ? "Complete fine-art photography archive across all years and subjects."
    : `Photographs curated in the ${decodedCategory} collection.`;

  return (
    <div className="space-y-8">
      <div className="border-b border-surface-border pb-4 space-y-2">
        <Link
          href="/galleries"
          className="inline-flex items-center space-x-1.5 text-xs text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All Galleries</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight flex items-center space-x-2.5">
              {isAll ? (
                <Images className="w-6 h-6 text-accent" />
              ) : (
                <Folder className="w-6 h-6 text-accent" />
              )}
              <span>{title}</span>
            </h1>
            <p className="text-xs text-muted pt-1">{description}</p>
          </div>
          <span className="text-xs text-muted font-mono self-start sm:self-auto">
            {photos.length} {photos.length === 1 ? "work" : "works"}
          </span>
        </div>
      </div>

      <PaginatedGallery photos={photos} initialCount={36} pageSize={36} />
    </div>
  );
}
