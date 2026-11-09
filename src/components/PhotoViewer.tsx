"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Maximize2,
  Minimize2,
  Expand,
  Shrink,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  Monitor,
} from "lucide-react";
import { Photo } from "@/types/photo";

interface PhotoViewerProps {
  photo: Photo;
  prevPhoto: Photo | null;
  nextPhoto: Photo | null;
}

export function PhotoViewer({
  photo,
  prevPhoto,
  nextPhoto,
}: PhotoViewerProps) {
  const router = useRouter();

  // Fullscreen states
  const [isWindowFullscreen, setIsWindowFullscreen] = useState(false);
  const [isMonitorFullscreen, setIsMonitorFullscreen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync native monitor fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFs = !!document.fullscreenElement;
      setIsMonitorFullscreen(isNativeFs);
      if (isNativeFs) {
        setIsWindowFullscreen(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    // If page loaded/transitioned while already in monitor fullscreen
    if (document.fullscreenElement) {
      setIsMonitorFullscreen(true);
      setIsWindowFullscreen(true);
    } else {
      // Check if user was in window fullscreen before navigating
      const savedMode = sessionStorage.getItem("lumenist_view_mode");
      if (savedMode === "window") {
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
    setIsWindowFullscreen(true);
    sessionStorage.setItem("lumenist_view_mode", "window");
  }, []);

  const closeWindowFullscreen = useCallback(() => {
    setIsWindowFullscreen(false);
    sessionStorage.removeItem("lumenist_view_mode");
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, []);

  const toggleMonitorFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // Request fullscreen on documentElement so routing doesn't break fullscreen
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
        setIsWindowFullscreen(true);
        sessionStorage.setItem("lumenist_view_mode", "monitor");
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        // When exiting monitor fullscreen, stay in window fullscreen or close
        sessionStorage.setItem("lumenist_view_mode", "window");
      }
    } catch (err) {
      console.error("Fullscreen toggle error:", err);
    }
  }, []);

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

  // Prevent background scroll when window fullscreen is open
  useEffect(() => {
    if (isWindowFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isWindowFullscreen]);

  return (
    <>
      {/* 1. Normal In-Page Presentation Frame */}
      <div className="relative bg-black/90 rounded-sm p-2 sm:p-6 border border-surface-border overflow-hidden select-none">
        <div className="flex justify-center items-center">
          <img
            src={photo.imageDesktop}
            alt={photo.title}
            onClick={openWindowFullscreen}
            className="max-h-[82vh] w-auto max-w-full object-contain mx-auto rounded-sm shadow-2xl photo-frame cursor-pointer"
            title="Click to view full screen (Shortcut: W, Monitor: F)"
          />
        </div>

        {/* Fit / Extend text in the lower right corner of the margin outside of the image */}
        <div className="flex justify-end items-center space-x-2 pt-2.5 pr-1 text-xs text-muted font-mono">
          <button
            type="button"
            onClick={openWindowFullscreen}
            className="hover:text-accent transition-colors cursor-pointer"
            title="Full screen within browser window (Shortcut: W)"
          >
            Fit Window
          </button>
          <span className="text-gray-700">/</span>
          <button
            type="button"
            onClick={toggleMonitorFullscreen}
            className="hover:text-accent transition-colors cursor-pointer"
            title="Extend to full monitor screen (Shortcut: F)"
          >
            Extend to Monitor
          </button>
        </div>
      </div>

      {/* 2. Fullscreen Theater / Monitor Presentation Overlay */}
      {isWindowFullscreen && (
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center select-none photo-theater ${
            showControls ? "cursor-default" : "cursor-none"
          }`}
        >
          {/* Main Fullscreen Photograph */}
          <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4">
            <img
              src={photo.imageDesktop}
              alt={photo.title}
              className="max-h-full max-w-full w-auto h-auto object-contain mx-auto transition-transform duration-200"
            />
          </div>

          {/* Top Control Bar (Fades on inactivity) */}
          <div
            className={`fixed top-0 inset-x-0 z-[10000] p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 ${
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
            <div className="flex items-center space-x-2 bg-black/70 backdrop-blur-md border border-white/10 rounded-sm p-1">
              <button
                type="button"
                onClick={() => setShowInfo((prev) => !prev)}
                className={`p-1.5 rounded transition-colors ${
                  showInfo ? "bg-accent text-black" : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
                title="Toggle Photo Details"
              >
                <Info className="w-4 h-4" />
              </button>

              <span className="text-gray-700">|</span>

              {/* Monitor Fullscreen Toggle Button */}
              <button
                type="button"
                onClick={toggleMonitorFullscreen}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors"
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
                onClick={closeWindowFullscreen}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Exit Fullscreen (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Left Arrow (Previous Photo) */}
          {prevPhoto && (
            <button
              type="button"
              onClick={goToPrev}
              className={`fixed left-4 top-1/2 -translate-y-1/2 z-[10000] p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 hover:border-accent text-white/80 hover:text-white transition-all backdrop-blur-sm shadow-2xl ${
                showControls ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
              }`}
              title={`Previous: ${prevPhoto.title} (← Left Arrow)`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Right Arrow (Next Photo) */}
          {nextPhoto && (
            <button
              type="button"
              onClick={goToNext}
              className={`fixed right-4 top-1/2 -translate-y-1/2 z-[10000] p-3 rounded-full bg-black/60 hover:bg-black/90 border border-white/15 hover:border-accent text-white/80 hover:text-white transition-all backdrop-blur-sm shadow-2xl ${
                showControls ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
              }`}
              title={`Next: ${nextPhoto.title} (→ Right Arrow)`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Optional Info Drawer Overlay */}
          {showInfo && (
            <div className="fixed bottom-6 left-6 z-[10000] bg-black/90 backdrop-blur-md border border-surface-border rounded-sm p-4 max-w-md text-xs text-gray-300 space-y-2 shadow-2xl">
              <div className="flex items-center justify-between border-b border-surface-border/60 pb-2">
                <span className="font-semibold text-white">{photo.title}</span>
                <span className="text-gray-500 font-mono">{photo.photoID}</span>
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
          <div
            className={`fixed bottom-3 inset-x-0 z-[10000] text-center text-[11px] text-gray-500 font-mono pointer-events-none transition-opacity duration-300 ${
              showControls ? "opacity-70" : "opacity-0"
            }`}
          >
            Use ← → arrow keys to navigate · F for Monitor Fullscreen · Esc to exit
          </div>
        </div>
      )}
    </>
  );
}
