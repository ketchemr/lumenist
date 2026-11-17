/**
 * Gallery navigation state management.
 *
 * Ensures that when a user leaves a gallery and then clicks through to Gallery again,
 * both position (scroll) and page are completely reset to 1 and top (0).
 *
 * State is only temporarily retained for immediate back-navigation when a user
 * clicks into a photograph to view it and then returns via "Back to Gallery" / browser back.
 */

const NAV_KEY = "lumenist_photo_nav";
const PAGE_PREFIX = "lumenist_page_";
const SCROLL_PREFIX = "lumenist_scroll_";

export function recordPhotoClick(categoryName: string, page: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(NAV_KEY, categoryName);
    sessionStorage.setItem(`${PAGE_PREFIX}${categoryName}`, page.toString());
    sessionStorage.setItem(`${SCROLL_PREFIX}${categoryName}`, window.scrollY.toString());
  } catch {}
}

export function getAndClearReturnState(categoryName: string): { page: number; scroll: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const navCategory = sessionStorage.getItem(NAV_KEY);
    if (navCategory === categoryName) {
      const pageStr = sessionStorage.getItem(`${PAGE_PREFIX}${categoryName}`);
      const scrollStr = sessionStorage.getItem(`${SCROLL_PREFIX}${categoryName}`);

      // Consume one-time return state so subsequent navigations start fresh
      sessionStorage.removeItem(NAV_KEY);
      sessionStorage.removeItem(`${PAGE_PREFIX}${categoryName}`);
      sessionStorage.removeItem(`${SCROLL_PREFIX}${categoryName}`);

      const page = pageStr ? parseInt(pageStr, 10) : 1;
      const scroll = scrollStr ? parseInt(scrollStr, 10) : 0;
      return {
        page: page > 0 ? page : 1,
        scroll: scroll >= 0 ? scroll : 0,
      };
    } else {
      // Not returning from a photo view: wipe any lingering keys for this category
      sessionStorage.removeItem(NAV_KEY);
      sessionStorage.removeItem(`${PAGE_PREFIX}${categoryName}`);
      sessionStorage.removeItem(`${SCROLL_PREFIX}${categoryName}`);
      return null;
    }
  } catch {
    return null;
  }
}

export function resetAllGalleryStates(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(NAV_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith(PAGE_PREFIX) || key.startsWith(SCROLL_PREFIX))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  } catch {}
}

export function getOriginGallery(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(NAV_KEY);
  } catch {
    return null;
  }
}

/**
 * Resolves the destination URL for "Back to Gallery".
 * Returns the originating gallery (if arrived from one), or the fallback category gallery,
 * or "/galleries".
 */
export function getGalleryReturnUrl(fallbackCategory?: string): string {
  if (typeof window !== "undefined") {
    try {
      const origin = sessionStorage.getItem(NAV_KEY);
      if (origin) {
        return origin.toLowerCase() === "all"
          ? "/galleries/All"
          : `/galleries/${encodeURIComponent(origin)}`;
      }
    } catch {}
  }
  if (fallbackCategory) {
    return fallbackCategory.toLowerCase() === "all"
      ? "/galleries/All"
      : `/galleries/${encodeURIComponent(fallbackCategory)}`;
  }
  return "/galleries";
}

