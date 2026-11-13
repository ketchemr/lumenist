"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Photo } from "@/types/photo";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import { WatermarkBadge } from "@/components/WatermarkBadge";

interface RandomHeroSlideshowProps {
  photos: Photo[];
  intervalSeconds?: number;
  showWatermark?: boolean;
  copyrightNotice?: string;
}

interface SlideshowState {
  list: number[];
  index: number;
}

export function RandomHeroSlideshow({
  photos,
  intervalSeconds = 10,
  showWatermark = false,
  copyrightNotice = "© Randal R. Ketchem",
}: RandomHeroSlideshowProps) {
  // Slideshow History: stores the exact chronological order of random slides shown
  const [state, setState] = useState<SlideshowState>({
    list: [],
    index: 0,
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const remainingTimeRef = useRef<number>(intervalSeconds * 1000);
  const startedAtRef = useRef<number>(Date.now());
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const didSwipeRef = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Detect horizontal swipe: distance > 45px and predominantly horizontal
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      didSwipeRef.current = true;
      if (deltaX < 0) {
        advanceToNext();
      } else {
        advanceToPrev();
      }
      setTimeout(() => {
        didSwipeRef.current = false;
      }, 350);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Initialize from sessionStorage or pick initial random photo on mount
  useEffect(() => {
    if (photos.length === 0) return;

    try {
      const saved = sessionStorage.getItem("lumenist_slideshow_state");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed.list) &&
          parsed.list.length > 0 &&
          typeof parsed.index === "number" &&
          parsed.list.every((i: number) => i >= 0 && i < photos.length)
        ) {
          setState(parsed);
          return;
        }
      }
    } catch {}

    const initial = Math.floor(Math.random() * photos.length);
    setState({
      list: [initial],
      index: 0,
    });
  }, [photos.length]);

  // Persist history state to sessionStorage so it survives back-navigation
  useEffect(() => {
    if (state.list.length > 0) {
      try {
        sessionStorage.setItem(
          "lumenist_slideshow_state",
          JSON.stringify(state)
        );
      } catch {}
    }
  }, [state]);

  const currentIndex =
    state.list.length > 0 && state.list[state.index] !== undefined
      ? state.list[state.index]
      : 0;

  // Advance to Next:
  // If we navigated back in history, move forward to the next already-visited slide.
  // If we are at the latest slide, pick a new random slide and append to history.
  const advanceToNext = useCallback(() => {
    if (photos.length <= 1) return;
    setIsTransitioning(true);

    setTimeout(() => {
      setState((prev) => {
        if (prev.list.length === 0) {
          return { list: [0], index: 0 };
        }

        // Stepping forward in already-seen history
        if (prev.index < prev.list.length - 1) {
          return {
            list: prev.list,
            index: prev.index + 1,
          };
        }

        // At the tip: pick a new random photo not equal to current
        const currentPhoto = prev.list[prev.index];
        let next = Math.floor(Math.random() * photos.length);
        while (next === currentPhoto && photos.length > 1) {
          next = Math.floor(Math.random() * photos.length);
        }

        return {
          list: [...prev.list, next],
          index: prev.list.length,
        };
      });

      setIsTransitioning(false);
    }, 200);
  }, [photos]);

  // Advance to Prev:
  // Moves back to the exact photograph that was shown right before this one!
  // If at the start of history, seamlessly picks and prepends a random photo so Prev always works.
  const advanceToPrev = useCallback(() => {
    if (photos.length <= 1) return;
    setIsTransitioning(true);

    setTimeout(() => {
      setState((prev) => {
        if (prev.index > 0) {
          return {
            list: prev.list,
            index: prev.index - 1,
          };
        }

        // At the start of history: pick a new random photo and prepend to history
        const currentPhoto = prev.list.length > 0 ? prev.list[0] : 0;
        let prevRandom = Math.floor(Math.random() * photos.length);
        while (prevRandom === currentPhoto && photos.length > 1) {
          prevRandom = Math.floor(Math.random() * photos.length);
        }
        return {
          list: [prevRandom, ...prev.list],
          index: 0,
        };
      });

      setIsTransitioning(false);
    }, 200);
  }, [photos]);

  // Reset remaining time counter whenever slide changes
  useEffect(() => {
    remainingTimeRef.current = intervalSeconds * 1000;
    startedAtRef.current = Date.now();
  }, [state.index, intervalSeconds]);

  // Slide transition timer: pauses gracefully and resumes with remaining time
  useEffect(() => {
    if (photos.length <= 1) return;

    if (isPaused) {
      // Record elapsed time and deduct from remaining balance
      const elapsed = Date.now() - startedAtRef.current;
      remainingTimeRef.current = Math.max(
        100,
        remainingTimeRef.current - elapsed
      );
      return;
    }

    // Resume / Start: stamp current time and schedule for remaining milliseconds
    startedAtRef.current = Date.now();
    const timer = setTimeout(() => {
      advanceToNext();
    }, remainingTimeRef.current);

    return () => clearTimeout(timer);
  }, [isPaused, state.index, advanceToNext, photos.length]);

  // Keyboard navigation: Left/Right arrows and Space to pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        advanceToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        advanceToNext();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceToPrev, advanceToNext]);

  if (!photos || photos.length === 0) return null;

  const current = photos[currentIndex] || photos[0];

  return (
    <section
      className="relative w-full flex-1 flex flex-col justify-between items-center h-[calc(100vh-4rem)] h-[calc(100dvh-4rem)] min-h-[500px] max-h-[1100px] overflow-hidden bg-background select-none pt-4 sm:pt-6 md:pt-8"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Random Featured Photograph Slideshow"
    >
      {/* Full-Screen Photograph Canvas */}
      <div className="w-full flex-1 min-h-0 flex items-center justify-center px-3 sm:px-6 pb-2 relative">
        <Link
          href={`/photo/${current.photoID}`}
          onClick={(e) => {
            if (didSwipeRef.current) {
              e.preventDefault();
            }
          }}
          className="relative inline-flex items-center justify-center max-w-full max-h-full cursor-pointer"
          title={`View "${current.title}" details`}
          aria-label={`View "${current.title}" details`}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={current.imageDesktop}
            alt={current.title}
            key={current.photoID}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className={`max-w-full max-h-[calc(100vh-14rem)] sm:max-h-[calc(100vh-15rem)] w-auto h-auto object-contain mx-auto rounded-[2px] shadow-2xl transition-all duration-500 photo-frame select-none pointer-events-none ${
              isTransitioning ? "opacity-20 scale-[0.99]" : "opacity-100 scale-100"
            }`}
          />
          {/* Protection shield & Watermark overlay */}
          <WatermarkBadge
            show={showWatermark}
            notice={copyrightNotice}
            size="md"
            withShield={true}
          />
        </Link>
      </div>

      {/* Slideshow Controls Bar Below the Image */}
      <div className="w-full pb-4 pt-1 flex items-center justify-center shrink-0">
        <div className="inline-flex items-center space-x-1.5 bg-surface border border-surface-border rounded-full p-1 shadow-sm">
          <button
            type="button"
            onClick={advanceToPrev}
            aria-label="Previous photograph"
            title="Previous photograph (Left Arrow)"
            className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs text-muted hover:text-foreground hover:bg-surface-hover active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <div className="w-px h-3.5 bg-surface-border" />

          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? "Resume rotation" : "Pause rotation"}
            title={isPaused ? "Resume rotation (Space)" : "Pause rotation (Space)"}
            className="p-1.5 rounded-full text-muted hover:text-foreground hover:bg-surface-hover active:scale-95 transition-all cursor-pointer"
          >
            {isPaused ? (
              <Play className="w-3.5 h-3.5 text-accent" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>

          <div className="w-px h-3.5 bg-surface-border" />

          <button
            type="button"
            onClick={advanceToNext}
            aria-label="Next photograph"
            title="Next photograph (Right Arrow)"
            className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium text-foreground hover:text-accent hover:bg-surface-hover active:scale-95 transition-all cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
