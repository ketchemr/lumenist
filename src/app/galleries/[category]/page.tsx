import { notFound } from "next/navigation";
import Link from "next/link";
import { getPhotosByCategory, getAllCategories } from "@/lib/photos";
import { PhotoCard } from "@/components/PhotoCard";
import { ArrowLeft, Folder } from "lucide-react";

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const decodedCategory = decodeURIComponent(category);
  const photos = getPhotosByCategory(decodedCategory);

  if (photos.length === 0) {
    notFound();
  }

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-light text-white tracking-tight flex items-center space-x-2.5">
            <Folder className="w-6 h-6 text-accent" />
            <span>{decodedCategory}</span>
          </h1>
          <span className="text-xs text-muted font-mono">
            {photos.length} {photos.length === 1 ? "work" : "works"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {photos.map((photo) => (
          <PhotoCard key={photo.photoID} photo={photo} />
        ))}
      </div>
    </div>
  );
}
