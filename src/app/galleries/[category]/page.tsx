import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllCategories, getPhotosByCategory } from "@/lib/photos";
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
  searchParams?: Promise<{
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

function resolveCanonicalCategory(decodedCategory: string): {
  isAll: boolean;
  canonicalName: string;
  canonicalSlug: string;
} {
  const lower = decodedCategory.toLowerCase();
  if (lower === "all" || lower === "all photographs") {
    return {
      isAll: true,
      canonicalName: "All",
      canonicalSlug: "All",
    };
  }
  const matched = getAllCategories().find(
    (cat) => cat.name.toLowerCase() === lower
  );
  if (matched) {
    return {
      isAll: false,
      canonicalName: matched.name,
      canonicalSlug: matched.slug,
    };
  }
  return {
    isAll: false,
    canonicalName: decodedCategory,
    canonicalSlug: encodeURIComponent(decodedCategory),
  };
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const decodedCategory = cleanCategoryString(category);
  const { isAll, canonicalName, canonicalSlug } =
    resolveCanonicalCategory(decodedCategory);
  const title = isAll ? "All Photographs" : canonicalName;

  return {
    title,
    description: isAll
      ? "Complete fine-art photography archive across all years and subjects."
      : `Photographs curated in the ${canonicalName} collection.`,
    alternates: {
      canonical: `/galleries/${canonicalSlug}`,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category } = await params;
  const { page, sort } = (await searchParams) || {};

  const decodedCategory = cleanCategoryString(category);
  const isAll = decodedCategory.toLowerCase() === "all";
  const rawPhotos = getPhotosByCategory(decodedCategory);
  const settings = getSettings();

  if (rawPhotos.length === 0) {
    notFound();
  }

  const title = isAll ? "All Photographs" : decodedCategory;
  const description = isAll
    ? "Complete fine-art photography archive across all years and subjects."
    : `Photographs curated in the ${decodedCategory} collection.`;

  return (
    <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="border-b border-surface-border pb-4 space-y-2">
        <div className="flex items-center justify-between">
          <Breadcrumbs
            items={[
              { label: "Galleries", href: "/galleries" },
              { label: title },
            ]}
          />
          <BackButton targetUrl="/galleries" fallback="/galleries" label="Back" />
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
            {rawPhotos.length}{" "}
            {rawPhotos.length === 1 ? "work" : "works"}
          </span>
        </div>
      </div>

      <PaginatedGallery
        photos={rawPhotos}
        categoryName={decodedCategory}
        pageSize={48}
        defaultView={settings.defaultGalleryView || "large"}
        initialSort={sort || settings.defaultSortOrder || "date-desc"}
        initialPage={parseInt(page || "1", 10) || 1}
        showWatermark={settings.showWatermarkOverlay ?? false}
        copyrightNotice={
          settings.copyrightOverlay ||
          (settings.artistName ? `© ${settings.artistName}` : "© Photographer")
        }
      />
    </div>
  );
}
