import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPhotosByCategory, sortPhotos } from "@/lib/photos";
import { getSettings } from "@/lib/settings";
import { PaginatedGallery } from "@/components/PaginatedGallery";
import { Folder, Images } from "lucide-react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BackButton } from "@/components/BackButton";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
  searchParams: Promise<{
    page?: string;
    sort?: string;
  }>;
}

function cleanCategoryString(raw: string): string {
  let decoded = raw;
  try {
    while (decoded.includes("%")) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
  }
  return decoded;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const decodedCategory = cleanCategoryString(category);
  const isAll = decodedCategory.toLowerCase() === "all";
  const title = isAll ? "All Photographs" : decodedCategory;

  return {
    title,
    description: isAll
      ? "Complete fine-art photography archive across all years and subjects."
      : `Photographs curated in the ${decodedCategory} collection.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category } = await params;
  const { page, sort } = await searchParams;

  const decodedCategory = cleanCategoryString(category);
  const isAll = decodedCategory.toLowerCase() === "all";
  const rawPhotos = getPhotosByCategory(decodedCategory);
  const settings = getSettings();

  if (rawPhotos.length === 0) {
    notFound();
  }

  const activeSort = sort || settings.defaultSortOrder || "date-desc";
  const allCategoryPhotos = sortPhotos(rawPhotos, activeSort);

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
        <div className="flex items-center justify-between">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: title },
            ]}
          />
          <BackButton fallback="/" label="Back" />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light text-foreground tracking-tight flex items-center space-x-2.5">
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
        defaultView={settings.defaultGalleryView || "large"}
        currentSort={activeSort}
        showWatermark={settings.showWatermarkOverlay ?? false}
        copyrightNotice={
          settings.copyrightOverlay ||
          (settings.artistName ? `© ${settings.artistName}` : "© Randal R. Ketchem")
        }
        baseUrl={
          isAll
            ? "/galleries/All"
            : `/galleries/${encodeURIComponent(decodedCategory)}`
        }
      />
    </div>
  );
}
