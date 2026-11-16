"use client";

import { useEffect } from "react";
import { resetAllGalleryStates } from "@/lib/galleryState";

export function ResetGalleryScroll({ resetState = true }: { resetState?: boolean }) {
  useEffect(() => {
    if (resetState) {
      resetAllGalleryStates();
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const rafId = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(rafId);
  }, [resetState]);

  return null;
}
