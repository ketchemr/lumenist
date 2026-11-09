import { notFound } from "next/navigation";
import Link from "next/link";
import { getPhotosByCategory } from "@/lib/photos";
import { PaginatedGallery } from "@/components/PaginatedGallery";
import { ArrowLeft, Folder, Images } from "lucide-react";

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category } = await params;
  const { page } = await searchParams;

  const decodedCategory = decodeURIComponent(category);
  const isAll = decodedCategory.toLowerCase() === "all";
  const allCategoryPhotos = getPhotosByCategory(decodedCategory);

  if (allCategoryPhotos.length === 0) {
    notFound();
  }

  const title = isAll ? "All Photographs" : decodedCategory;
  const description = isAll
    ? "Complete fine-art photography archive across all years and subjects."
    : `Photographs curated in the ${decodedCategory} collection.`;

  // Pagination calculations (48 photos per page)
  const pageSize = 48;
  const totalPages = Math.ceil(allCategoryPhotos.length / pageSize);
  const currentPage = Math.min(
    Math.max(1, parseInt(page || "1", 10) || 1),
    Math.max(1, totalPages)
  );

  const startIdx = (currentPage - 1) * pageSize;
  const pagePhotos = allCategoryPhotos.slice(startIdx, startIdx + pageSize);

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
            {allCategoryPhotos.length}{" "}
            {allCategoryPhotos.length === 1 ? "work" : "works"}
          </span>
        </div>
      </div>

      <PaginatedGallery
        photos={pagePhotos}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={allCategoryPhotos.length}
        pageSize={pageSize}
        baseUrl={`/galleries/${encodeURIComponent(category)}`}
      />
    </div>
  );
}
