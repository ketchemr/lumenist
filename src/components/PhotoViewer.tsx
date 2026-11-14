"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Shrink,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  Monitor,
} from "lucide-react";
import { Photo } from "@/types/photo";
import { WatermarkBadge } from "@/components/WatermarkBadge";

interface PhotoViewerProps {
  photo: Photo;
  prevPhoto: Photo | null;
  nextPhoto: Photo | null;
  copyrightNotice?: string;
  showWatermark?: boolean;
}

export function PhotoViewer({
  photo,
  prevPhoto,
  nextPhoto,
  copyrightNotice = "© Randal R. Ketchem",
  showWatermark = false,
}: PhotoViewerProps) {
  const router = useRouter();

  // Fullscreen states
  const [isWindowFullscreen, setIsWindowFullscreen] = useState(false);
  const [isMonitorFullscreen, setIsMonitorFullscreen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isPhone, setIsPhone] = useState(false);
  const [mounted, setMounted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce to prevent ghost clicks / touch leakage from immediately closing the overlay
  const openedAtRef = useRef<number>(0);

  // Touch and swipe gesture tracking
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const maxDistanceMoved = useRef<number>(0);
  const wasSwipeRef = useRef<boolean>(false);
  const isClosingRef = useRef<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect mobile phone viewport / touch device
  useEffect(() => {
    const checkIfPhone = () => {
      const isMobileUA =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
          navigator.userAgent
        );
      const hasTouch =
        window.matchMedia("(pointer: coarse)").matches ||
        "ontouchstart" in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      const isSmallViewport =
        window.innerWidth < 768 || window.innerHeight < 500;

      setIsPhone(isMobileUA || (hasTouch && isSmallViewport) || isSmallViewport);
    };

    checkIfPhone();
    window.addEventListener("resize", checkIfPhone);
    window.addEventListener("orientationchange", checkIfPhone);
    return () => {
      window.removeEventListener("resize", checkIfPhone);
      window.removeEventListener("orientationchange", checkIfPhone);
    };
  }, []);

  // Sync native monitor fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFs = !!document.fullscreenElement;
      setIsMonitorFullscreen(isNativeFs);
      if (isNativeFs) {
        setIsWindowFullscreen(true);
      } else {
        // If native fullscreen was exited, reset monitor mode
        const savedMode = sessionStorage.getItem("lumenist_view_mode");
        if (savedMode === "monitor") {
          setIsMonitorFullscreen(false);
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    // If page loaded/transitioned while already in fullscreen
    if (document.fullscreenElement) {
      setIsMonitorFullscreen(true);
      setIsWindowFullscreen(true);
    } else {
      const savedMode = sessionStorage.getItem("lumenist_view_mode");
      if (savedMode === "monitor") {
        setIsMonitorFullscreen(true);
        setIsWindowFullscreen(true);
      } else if (savedMode === "window") {
        setIsWindowFullscreen(true);
      }
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  // Enter / Exit Fullscreen methods
  const openWindowFullscreen = useCallback(() => {
    openedAtRef.current = Date.now();
    setIsWindowFullscreen(true);
    setIsMonitorFullscreen(false);
    sessionStorage.setItem("lumenist_view_mode", "window");
  }, []);

  const closeWindowFullscreen = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsWindowFullscreen(false);
    setIsMonitorFullscreen(false);
    sessionStorage.removeItem("lumenist_view_mode");
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen().catch(() => {});
      }
    }
    if (window.history.state?.lumenistViewerFullscreen) {
      window.history.back();
    }
    setTimeout(() => {
      isClosingRef.current = false;
    }, 250);
  }, []);

  const toggleMonitorFullscreen = useCallback(async () => {
    try {
      openedAtRef.current = Date.now();
      if (!isMonitorFullscreen && !document.fullscreenElement) {
        // Request fullscreen on documentElement so routing doesn't break fullscreen
        if (document.documentElement.requestFullscreen) {
          try {
            await document.documentElement.requestFullscreen();
          } catch (e) {
            // Mobile browsers may reject or omit requestFullscreen
          }
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          try {
            await (document.documentElement as any).webkitRequestFullscreen();
          } catch (e) {}
        }
        setIsWindowFullscreen(true);
        setIsMonitorFullscreen(true);
        sessionStorage.setItem("lumenist_view_mode", "monitor");
      } else {
        if (document.fullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          }
        }
        setIsMonitorFullscreen(false);
        sessionStorage.setItem("lumenist_view_mode", "window");
      }
    } catch (err) {
      console.error("Fullscreen toggle error:", err);
      setIsWindowFullscreen(true);
      setIsMonitorFullscreen(true);
      sessionStorage.setItem("lumenist_view_mode", "monitor");
    }
  }, [isMonitorFullscreen]);

  // Handle browser back navigation / back gesture in fullscreen
  useEffect(() => {
    if (!isWindowFullscreen) return;

    window.history.pushState({ lumenistViewerFullscreen: true }, "");

    const handlePopState = () => {
      if (isClosingRef.current) return;
      setIsWindowFullscreen(false);
      setIsMonitorFullscreen(false);
      sessionStorage.removeItem("lumenist_view_mode");
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isWindowFullscreen]);

  // Navigate to adjacent photos
  const goToPrev = useCallback(() => {
    if (prevPhoto) {
      router.push(`/photo/${prevPhoto.photoID}`);
    }
  }, [prevPhoto, router]);

  const goToNext = useCallback(() => {
    if (nextPhoto) {
      router.push(`/photo/${nextPhoto.photoID}`);
    }
  }, [nextPhoto, router]);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleMonitorFullscreen();
      } else if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        if (isWindowFullscreen && !isMonitorFullscreen) {
          closeWindowFullscreen();
        } else {
          openWindowFullscreen();
        }
      } else if (e.key === "Escape") {
        if (isWindowFullscreen) {
          closeWindowFullscreen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    goToPrev,
    goToNext,
    toggleMonitorFullscreen,
    openWindowFullscreen,
    closeWindowFullscreen,
    isWindowFullscreen,
    isMonitorFullscreen,
  ]);

  // Auto-hide controls during mouse inactivity in fullscreen
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isWindowFullscreen) {
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2600);
    }
  }, [isWindowFullscreen]);

  // Prevent background scroll and completely hide site header when fullscreen is active
  useEffect(() => {
    if (isWindowFullscreen) {
      openedAtRef.current = Date.now();
      document.body.classList.add("viewer-fullscreen-active");
      document.documentElement.classList.add("viewer-fullscreen-active");

      const prevBodyOverflow = document.body.style.overflow;
      const prevDocOverflow = document.documentElement.style.overflow;
      const prevBodyOverscroll = document.body.style.overscrollBehavior;
      const prevDocOverscroll = document.documentElement.style.overscrollBehavior;

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      document.documentElement.style.overscrollBehavior = "none";

      const header = document.querySelector("header");
      const prevHeaderDisplay = header ? header.style.display : "";
      if (header) {
        header.style.setProperty("display", "none", "important");
      }

      return () => {
        document.body.classList.remove("viewer-fullscreen-active");
        document.documentElement.classList.remove("viewer-fullscreen-active");
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevDocOverflow;
        document.body.style.overscrollBehavior = prevBodyOverscroll;
        document.documentElement.style.overscrollBehavior = prevDocOverscroll;
        if (header) {
          header.style.display = prevHeaderDisplay;
        }
      };
    }
  }, [isWindowFullscreen]);

  // Touch and swipe gestures for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    maxDistanceMoved.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDistanceMoved.current) {
      maxDistanceMoved.current = dist;
    }
  }, []);

  const handleTouchCancel = useCallback(() => {
    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTime.current = 0;
    maxDistanceMoved.current = 0;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const totalDistance = Math.hypot(deltaX, deltaY);
    const maxDist = Math.max(maxDistanceMoved.current, totalDistance);
    const elapsed = Date.now() - touchStartTime.current;

    touchStartX.current = null;
    touchStartY.current = null;

    // Ignore gestures that began before or during the fullscreen opening transition
    if (touchStartTime.current <= openedAtRef.current + 100) {
      return;
    }

    // 1. Horizontal swipe: Left or Right for navigation
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      wasSwipeRef.current = true;
      setTimeout(() => {
        wasSwipeRef.current = false;
      }, 350);

      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
      return;
    }

    // 2. Vertical swipe: Flick down or up to exit fullscreen (natural mobile photo gesture)
    if (Math.abs(deltaY) > 50 && Math.abs(deltaY) > Math.abs(deltaX) * 1.3) {
      wasSwipeRef.current = true;
      setTimeout(() => {
        wasSwipeRef.current = false;
      }, 350);
      closeWindowFullscreen();
      return;
    }

    // 3. Tap detection:
    // If the touch moved less than 35px and was released within 600ms, it is a single tap -> exit fullscreen!
    if (maxDist < 35 && elapsed < 600) {
      closeWindowFullscreen();
      return;
    }
  }, [goToNext, goToPrev, closeWindowFullscreen]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (wasSwipeRef.current) return;
      if (Date.now() - openedAtRef.current < 250) return;

      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest(".photo-info-drawer")) {
        return;
      }

      closeWindowFullscreen();
    },
    [closeWindowFullscreen]
  );

  const isPhoneOnlyPicture = isPhone || isMonitorFullscreen;

  return (
    <>
      {/* 1. Normal In-Page Presentation Frame */}
      <div className="relative bg-surface dark:bg-black/90 rounded-sm p-2 sm:p-4 md:p-5 border border-surface-border overflow-hidden select-none">
        <div className="flex justify-center items-center">
          <div className="relative inline-flex items-center justify-center max-w-full">
            <img
              src={photo.imageDesktop}
              alt={photo.title}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="max-h-[82vh] w-auto max-w-full object-contain mx-auto rounded-sm shadow-2xl photo-frame select-none"
            />
            {/* Transparent Click & Protection Shield */}
            <div
              className="absolute inset-0 z-10 cursor-pointer select-none"
              onClick={(e) => {
                e.stopPropagation();
                openWindowFullscreen();
              }}
              onContextMenu={(e) => e.preventDefault()}
              title="Click to view full screen (Shortcut: W, Monitor: F)"
            />
            {/* Elegant Copyright Watermark Overlay (Toggleable via Admin Settings) */}
            <WatermarkBadge
              show={showWatermark}
              notice={copyrightNotice}
              size="lg"
            />
          </div>
        </div>

        {/* Fit / Extend text in the lower right corner of the margin outside of the image */}
        <div className="flex justify-end items-center space-x-2 pt-2.5 pr-1 text-xs text-muted font-mono">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openWindowFullscreen();
            }}
            className="hover:text-accent transition-colors cursor-pointer"
            title="Full screen within browser window (Shortcut: W)"
          >
            Fit Window
          </button>
          <span className="text-gray-700">/</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMonitorFullscreen();
            }}
            className="hover:text-accent transition-colors cursor-pointer"
            title="Extend to full monitor screen (Shortcut: F)"
          >
            Extend to Monitor
          </button>
        </div>
      </div>

      {/* 2. Fullscreen Theater / Monitor Presentation Overlay */}
      {isWindowFullscreen && mounted && typeof document !== "undefined" && createPortal(
        <div
          ref={containerRef}
          data-theater="true"
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onClick={handleOverlayClick}
          style={{ touchAction: "none" }}
          className={`fixed inset-0 top-0 left-0 w-screen h-screen h-[100dvh] z-[99999] bg-black flex items-center justify-center select-none photo-theater cursor-pointer ${
            showControls && !isPhoneOnlyPicture ? "md:cursor-default" : "cursor-pointer"
          }`}
        >
          {/* Main Fullscreen Photograph */}
          <div
            className={`relative w-full h-full flex items-center justify-center pointer-events-none ${
              isPhoneOnlyPicture ? "p-0" : "p-2 sm:p-4"
            }`}
          >
            <div className="relative w-full h-full flex items-center justify-center pointer-events-auto">
              <img
                src={photo.imageDesktop}
                alt={photo.title}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="max-h-full max-w-full w-auto h-auto object-contain mx-auto transition-transform duration-200 cursor-pointer photo-frame select-none"
                style={{
                  touchAction: "none",
                  WebkitTouchCallout: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
              />
              {/* Transparent Protection Shield */}
              <div
                className="absolute inset-0 z-10 cursor-pointer select-none"
                onContextMenu={(e) => e.preventDefault()}
              />
              {/* Fullscreen Copyright Watermark Overlay (Toggleable via Admin Settings) */}
              <WatermarkBadge
                show={showWatermark}
                notice={copyrightNotice}
                size="lg"
              />
            </div>
          </div>

          {/* Top Control Bar (Hidden when on a phone or in Extend to Monitor mode) */}
          {!isPhoneOnlyPicture && (
            <div
              className={`fixed top-0 inset-x-0 z-[10000] p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 hidden md:flex ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Title & Date Caption */}
              <div className="space-y-0.5 max-w-md truncate">
                <h2 className="text-white text-sm sm:text-base font-medium truncate drop-shadow-md">
                  {photo.title}
                </h2>
                <p className="text-xs text-gray-400 font-mono">
                  {photo.dateTaken.year}-{String(photo.dateTaken.month).padStart(2, "0")}-{String(photo.dateTaken.day).padStart(2, "0")} · {photo.camera}
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center space-x-2 bg-black/70 backdrop-blur-md border border-white/10 rounded-sm p-1 shadow-md">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInfo((prev) => !prev);
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    showInfo
                      ? "bg-accent text-accent-contrast font-medium"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                  title="Toggle Photo Details"
                >
                  <Info className="w-4 h-4" />
                </button>

                <span className="text-gray-700">|</span>

                {/* Monitor Fullscreen Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMonitorFullscreen();
                  }}
                  className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                  title={
                    isMonitorFullscreen
                      ? "Exit Monitor Fullscreen (Return to window)"
                      : "Extend to physical monitor (Shortcut: F)"
                  }
                >
                  {isMonitorFullscreen ? (
                    <>
                      <Shrink className="w-4 h-4 text-accent" />
                      <span className="hidden sm:inline">Exit Monitor</span>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-4 h-4 text-accent" />
                      <span className="hidden sm:inline">Extend to Monitor</span>
                    </>
                  )}
                </button>

                <span className="text-gray-700">|</span>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWindowFullscreen();
                  }}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
                  title="Exit Fullscreen (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Left Arrow (Previous Photo) */}
          {!isPhoneOnlyPicture && prevPhoto && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className={`fixed left-4 top-1/2 -translate-y-1/2 z-[10000] p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 hover:border-accent text-white/80 hover:text-white transition-all backdrop-blur-sm shadow-2xl hidden md:block cursor-pointer ${
                showControls ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
              }`}
              title={`Previous: ${prevPhoto.title} (← Left Arrow)`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Right Arrow (Next Photo) */}
          {!isPhoneOnlyPicture && nextPhoto && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className={`fixed right-4 top-1/2 -translate-y-1/2 z-[10000] p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 hover:border-accent text-white/80 hover:text-white transition-all backdrop-blur-sm shadow-2xl hidden md:block cursor-pointer ${
                showControls ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
              }`}
              title={`Next: ${nextPhoto.title} (→ Right Arrow)`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Optional Info Drawer Overlay */}
          {!isPhoneOnlyPicture && showInfo && (
            <div className="fixed bottom-6 left-6 z-[10000] bg-black/90 backdrop-blur-md border border-white/15 rounded-sm p-4 max-w-md text-xs text-gray-300 space-y-2 shadow-2xl hidden md:block">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-semibold text-white">{photo.title}</span>
                <span className="text-gray-400 font-mono">{photo.photoID}</span>
              </div>
              {photo.description && (
                <p className="text-gray-300 leading-relaxed font-light">{photo.description}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 font-mono pt-1">
                <div>Camera: {photo.camera}</div>
                <div>Lens: {photo.lens}</div>
                <div>Shutter: {photo.shutterspeed || (photo as any).shutterSpeed}</div>
                <div>Aperture: {photo.aperture}</div>
                <div>ISO: {photo.sensitivity || (photo as any).iso}</div>
                <div>Focal: {photo.focalLength}</div>
              </div>
            </div>
          )}

          {/* Bottom subtle keyboard shortcuts hint */}
          {!isPhoneOnlyPicture && (
            <div
              className={`fixed bottom-3 inset-x-0 z-[10000] text-center text-[11px] text-gray-500 font-mono pointer-events-none transition-opacity duration-300 hidden md:block ${
                showControls ? "opacity-70" : "opacity-0"
              }`}
            >
              Use ← → arrow keys to navigate · F for Monitor Fullscreen · Esc to exit
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
