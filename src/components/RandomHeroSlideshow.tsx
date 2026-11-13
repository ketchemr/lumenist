"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Photo } from "@/types/photo";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Camera,
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

  const descScrollRef = useRef<HTMLDivElement>(null);
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

  // Reset description scroll position when slide changes
  useEffect(() => {
    if (descScrollRef.current) {
      descScrollRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

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

  if (!photos || photos.length === 0) return null;

  const current = photos[currentIndex] || photos[0];

  return (
    <section className="relative rounded-sm overflow-hidden border border-surface-border bg-surface group w-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center p-4 sm:p-6 lg:p-8 lg:h-[520px]">
        {/* Photo Column: Photo Frame with Controls Living Directly Under the Image */}
        <div className="lg:col-span-8 flex flex-col justify-between h-[360px] sm:h-[440px] lg:h-[470px]">
          {/* Photo Display: Constant Width & Constant Height Frame with dark matting (Zero overlay clutter) */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="flex-1 w-full overflow-hidden rounded-sm bg-black/95 border border-surface-border relative flex items-center justify-center touch-pan-y"
          >
            <Link
              href={`/photo/${current.photoID}`}
              onClick={(e) => {
                if (didSwipeRef.current) {
                  e.preventDefault();
                }
              }}
              className="w-full h-full flex items-center justify-center p-2 relative"
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="relative inline-flex items-center justify-center max-w-full max-h-full">
                <img
                  src={current.imageDesktop}
                  alt={current.title}
                  key={current.photoID}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`max-h-[290px] sm:max-h-[370px] lg:max-h-[400px] max-w-full w-auto h-auto object-contain mx-auto rounded shadow-2xl transition-all duration-500 photo-frame select-none pointer-events-none ${
                    isTransitioning
                      ? "opacity-20 scale-[0.99]"
                      : "opacity-100 scale-100"
                  }`}
                />
                {/* Protection shield & Watermark overlay (Toggleable via Admin Settings) */}
                <WatermarkBadge
                  show={showWatermark}
                  notice={copyrightNotice}
                  size="md"
                  withShield={true}
                />
              </div>
            </Link>
          </div>

          {/* Navigation Controls: Living directly under the image */}
          <div className="flex items-center justify-between pt-2.5 px-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPaused ? "bg-muted" : "bg-accent animate-pulse"
                }`}
              />
              <span className="font-mono text-[11px] uppercase tracking-wider">
                {isPaused ? "Rotation Paused" : "Random Selection"}
              </span>
            </div>

            {/* Navigation & Rotation Toolbar */}
            <div className="inline-flex items-center gap-1 bg-surface-hover/80 border border-surface-border rounded-full p-1 shadow-sm">
              <button
                type="button"
                onClick={advanceToPrev}
                aria-label="Previous photo"
                title="Previous photo"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted hover:text-foreground hover:bg-surface active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="w-px h-3.5 bg-surface-border" />

              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                aria-label={isPaused ? "Resume rotation" : "Pause rotation"}
                title={isPaused ? "Resume rotation" : "Pause rotation"}
                className="p-1 rounded-full text-muted hover:text-foreground hover:bg-surface active:scale-95 transition-all cursor-pointer"
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
                aria-label="Next random photo"
                title="Next random photo"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-foreground hover:text-accent hover:bg-surface active:scale-95 transition-all cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Narrative & Details Column: Top Justified */}
        <div className="lg:col-span-4 h-full flex flex-col justify-start py-2 space-y-4">
          <div
            className={`space-y-4 transition-opacity duration-300 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {/* Title */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-light text-foreground tracking-tight">
                <Link
                  href={`/photo/${current.photoID}`}
                  className="hover:text-accent transition-colors"
                >
                  {current.title}
                </Link>
              </h2>
            </div>

            {/* Description (Scrollable container for long stories) */}
            <div
              ref={descScrollRef}
              className="max-h-[160px] sm:max-h-[190px] overflow-y-auto pr-2 space-y-2 select-text"
            >
              <p className="text-sm text-muted leading-relaxed font-normal">
                {current.description ||
                  "A fine art landscape photograph exploring natural light and form."}
              </p>
            </div>

            {/* Categories */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {current.categories.map((c) => (
                <Link
                  key={c}
                  href={`/galleries/${encodeURIComponent(c)}`}
                  className="text-xs bg-surface hover:bg-surface-hover border border-surface-border hover:border-accent px-2.5 py-1 rounded text-muted hover:text-foreground transition-colors"
                >
                  {c}
                </Link>
              ))}
            </div>

            {/* Camera & Year Metadata */}
            <div className="flex items-center space-x-3 text-xs text-muted font-mono pt-1">
              {current.camera && (
                <span className="flex items-center space-x-1">
                  <Camera className="w-3.5 h-3.5 text-muted" />
                  <span>{current.camera.replace("ILCE-", "A")}</span>
                </span>
              )}
              {current.dateTaken.year > 0 && (
                <span>· {current.dateTaken.year}</span>
              )}
            </div>

            {/* Exhibition Link */}
            <div className="pt-2">
              <Link
                href={`/photo/${current.photoID}`}
                className="inline-flex items-center space-x-2 text-sm text-accent hover:text-accent-light transition-colors font-medium group/link"
              >
                <span>View Full Exhibition & Technicals</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Progress Bar: Freezes on pause, resumes smoothly */}
      <div className="w-full bg-surface-border/40 h-0.5 relative overflow-hidden">
        <div
          key={state.index}
          className="bg-accent h-0.5 animate-progress-bar"
          style={{
            animationDuration: `${intervalSeconds}s`,
            animationPlayState: isPaused ? "paused" : "running",
          }}
        />
      </div>
    </section>
  );
}
