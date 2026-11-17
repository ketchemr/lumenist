"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getOriginGallery } from "@/lib/galleryState";

interface PhotoBreadcrumbsProps {
  photoTitle: string;
  defaultCategory?: string;
  fromParam?: string;
}

export function PhotoBreadcrumbs({
  photoTitle,
  defaultCategory,
  fromParam,
}: PhotoBreadcrumbsProps) {
  const [category, setCategory] = useState<string | undefined>(
    fromParam || defaultCategory
  );

  useEffect(() => {
    // 1. Honor fromParam if present in URL
    // 2. Otherwise honor origin gallery recorded in sessionStorage
    // 3. Otherwise fall back to defaultCategory
    const origin = fromParam || getOriginGallery();
    if (origin) {
      setCategory(origin);
    }
  }, [fromParam]);

  const catLabel =
    category?.toLowerCase() === "all" ? "All Photographs" : category;
  const catHref = category
    ? category.toLowerCase() === "all"
      ? "/galleries/All"
      : `/galleries/${encodeURIComponent(category)}`
    : undefined;

  return (
    <Breadcrumbs
      items={[
        ...(category
          ? [
              {
                label: catLabel || category,
                href: catHref,
              },
            ]
          : []),
        { label: photoTitle },
      ]}
    />
  );
}
