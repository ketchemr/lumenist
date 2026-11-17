"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getGalleryReturnUrl } from "@/lib/galleryState";

interface BackButtonProps {
  targetUrl?: string;
  fallbackCategory?: string;
  fallback?: string;
  label?: string;
  className?: string;
}

export function BackButton({
  targetUrl,
  fallbackCategory,
  fallback = "/",
  label = "Back",
  className = "",
}: BackButtonProps) {
  const router = useRouter();
  const [resolvedHref, setResolvedHref] = useState<string>(() => {
    if (targetUrl) return targetUrl;
    if (label.toLowerCase().includes("gallery")) {
      return fallbackCategory
        ? fallbackCategory.toLowerCase() === "all"
          ? "/galleries/All"
          : `/galleries/${encodeURIComponent(fallbackCategory)}`
        : "/galleries";
    }
    return fallback;
  });

  useEffect(() => {
    if (label.toLowerCase().includes("gallery")) {
      setResolvedHref(getGalleryReturnUrl(fallbackCategory));
    } else if (targetUrl) {
      setResolvedHref(targetUrl);
    }
  }, [label, fallbackCategory, targetUrl]);

  const handleClick = (e: React.MouseEvent) => {
    // When returning to Gallery, navigate directly to the originating gallery
    if (label.toLowerCase().includes("gallery")) {
      e.preventDefault();
      const dest = getGalleryReturnUrl(fallbackCategory);
      router.push(dest);
      return;
    }

    if (targetUrl) {
      e.preventDefault();
      router.push(targetUrl);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    } else {
      e.preventDefault();
      router.push(fallback);
    }
  };

  return (
    <Link
      href={resolvedHref}
      onClick={handleClick}
      className={`inline-flex items-center space-x-1.5 text-xs text-muted hover:text-accent transition-colors cursor-pointer ${className}`}
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>{label}</span>
    </Link>
  );
}
