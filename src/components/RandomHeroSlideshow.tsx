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

  // Crossfade state: holds the outgoing photo during the 700ms dissolve
  const [outgoingPhoto, setOutgoingPhoto] = useState<Photo | null>(null);
  const [transitionId, setTransitionId] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingLoadCleanupRef = useRef<(() => void) | null>(null);
  const nextRandomIndexRef = useRef<number | null>(null);

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

  // Helper to pick a random photo index different from the current photo
  const pickRandomIndex = useCallback(
    (excludeIndex: number) => {
      if (photos.length <= 1) return 0;
      let next = Math.floor(Math.random() * photos.length);
      while (next === excludeIndex && photos.length > 1) {
        next = Math.floor(Math.random() * photos.length);
      }
      return next;
    },
    [photos.length]
  );

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

  const current = photos[currentIndex] || photos[0];

  // Background Preloader: pre-fetches upcoming and previous slides into browser cache
  useEffect(() => {
    if (photos.length === 0) return;

    // 1. If we can go back in history, preload the previous photo
    if (state.index > 0 && state.list[state.index - 1] !== undefined) {
      const prevPhoto = photos[state.list[state.index - 1]];
      if (prevPhoto?.imageDesktop) {
        const img = new Image();
        img.src = prevPhoto.imageDesktop;
      }
    }

    // 2. If we can step forward in history, preload the next photo
    if (
      state.index < state.list.length - 1 &&
      state.list[state.index + 1] !== undefined
    ) {
      const nextPhoto = photos[state.list[state.index + 1]];
      if (nextPhoto?.imageDesktop) {
        const img = new Image();
        img.src = nextPhoto.imageDesktop;
      }
    } else {
      // 3. At tip of history: pre-pick the upcoming random slide and preload it in advance
      const currentIdx = state.list[state.index] ?? 0;
      const nextRand = pickRandomIndex(currentIdx);
      nextRandomIndexRef.current = nextRand;
      const randPhoto = photos[nextRand];
      if (randPhoto?.imageDesktop) {
        const img = new Image();
        img.src = randPhoto.imageDesktop;
      }
    }
  }, [state.index, state.list, photos, pickRandomIndex]);

  // Clean up all pending timers on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
      if (pendingLoadCleanupRef.current) {
        pendingLoadCleanupRef.current();
      }
    };
  }, []);

  // Photographic crossfade orchestrator:
  // Verifies image readiness, captures outgoing photo, and initiates two-layer dissolve
  const triggerTransition = useCallback(
    (targetIndex: number, newList: number[], newIndex: number) => {
      const targetPhoto = photos[targetIndex];
      const activePhoto =
        photos[
          state.list.length > 0 && state.list[state.index] !== undefined
            ? state.list[state.index]
            : 0
        ] || photos[0];

      if (!targetPhoto || targetPhoto.photoID === activePhoto.photoID) return;

      // Cancel any ongoing image wait
      if (pendingLoadCleanupRef.current) {
        pendingLoadCleanupRef.current();
        pendingLoadCleanupRef.current = null;
      }

      const startCrossfade = () => {
        if (cleanupTimerRef.current) {
          clearTimeout(cleanupTimerRef.current);
          cleanupTimerRef.current = null;
        }

        setOutgoingPhoto(activePhoto);
        setState({ list: newList, index: newIndex });
        setTransitionId((prev) => prev + 1);

        // Schedule cleanup after the 700ms dissolve finishes
        cleanupTimerRef.current = setTimeout(() => {
          setOutgoingPhoto(null);
          cleanupTimerRef.current = null;
        }, 700);
      };

      // Check if the image is already cached / decoded in browser memory
      const img = new Image();
      img.src = targetPhoto.imageDesktop;

      if (img.complete) {
        startCrossfade();
      } else {
        let started = false;
        const onReady = () => {
          if (started) return;
          started = true;
          if (pendingLoadCleanupRef.current) {
            pendingLoadCleanupRef.current = null;
          }
          startCrossfade();
        };

        img.onload = onReady;
        img.onerror = onReady;
        const safetyTimer = setTimeout(onReady, 1000);

        pendingLoadCleanupRef.current = () => {
          started = true;
          clearTimeout(safetyTimer);
          img.onload = null;
          img.onerror = null;
        };
      }
    },
    [photos, state]
  );

  // Advance to Next:
  // If we navigated back in history, move forward to the next already-visited slide.
  // If at the tip of history, uses the preloaded random slide or picks fresh.
  const advanceToNext = useCallback(() => {
    if (photos.length <= 1) return;

    if (state.list.length === 0) {
      triggerTransition(0, [0], 0);
      return;
    }

    // Stepping forward in already-seen history
    if (state.index < state.list.length - 1) {
      const newIndex = state.index + 1;
      const targetIdx = state.list[newIndex];
      triggerTransition(targetIdx, state.list, newIndex);
      return;
    }

    // At the tip: use the preloaded next random slide if valid, or pick fresh
    const currentPhotoIdx = state.list[state.index] ?? 0;
    let next = nextRandomIndexRef.current;
    if (
      next === null ||
      next === currentPhotoIdx ||
      next < 0 ||
      next >= photos.length
    ) {
      next = pickRandomIndex(currentPhotoIdx);
    }
    nextRandomIndexRef.current = null; // reset for next cycle

    const newList = [...state.list, next];
    const newIndex = state.list.length;
    triggerTransition(next, newList, newIndex);
  }, [photos, state, triggerTransition, pickRandomIndex]);

  // Advance to Prev:
  // Moves back to the exact photograph that was shown right before this one!
  // If at the start of history, seamlessly picks and prepends a random photo so Prev always works.
  const advanceToPrev = useCallback(() => {
    if (photos.length <= 1) return;

    if (state.list.length === 0) {
      triggerTransition(0, [0], 0);
      return;
    }

    // Step back in history
    if (state.index > 0) {
      const newIndex = state.index - 1;
      const targetIdx = state.list[newIndex];
      triggerTransition(targetIdx, state.list, newIndex);
      return;
    }

    // At start of history: pick a random photo not equal to current and prepend
    const currentPhotoIdx = state.list[0] ?? 0;
    const prevRandom = pickRandomIndex(currentPhotoIdx);
    const newList = [prevRandom, ...state.list];
    triggerTransition(prevRandom, newList, 0);
  }, [photos, state, triggerTransition, pickRandomIndex]);

  // Reset remaining time counter whenever slide changes
  useEffect(() => {
    remainingTimeRef.current = intervalSeconds * 1000;
    startedAtRef.current = Date.now();
  }, [current?.photoID, intervalSeconds]);

  // Slide transition timer: pauses gracefully and resumes with remaining time
  useEffect(() => {
    if (photos.length <= 1) return;

    if (isPaused) {
      const elapsed = Date.now() - startedAtRef.current;
      remainingTimeRef.current = Math.max(
        100,
        remainingTimeRef.current - elapsed
      );
      return;
    }

    startedAtRef.current = Date.now();
    const timer = setTimeout(() => {
      advanceToNext();
    }, remainingTimeRef.current);

    return () => clearTimeout(timer);
  }, [isPaused, current?.photoID, advanceToNext, photos.length]);

  // Keyboard navigation: Left/Right arrows and Space to pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === "input" ||
        activeTag === "textarea" ||
        activeTag === "select"
      ) {
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

  return (
    <section
      className="relative w-full flex-1 flex flex-col justify-between items-center h-[calc(100vh-4rem)] h-[calc(100dvh-4rem)] min-h-[500px] max-h-[1100px] overflow-hidden bg-background select-none pt-3 sm:pt-4 md:pt-6"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Random Featured Photograph Slideshow"
    >
      {/* Full-Screen Photograph Canvas */}
      <div className="w-full flex-1 min-h-0 flex items-center justify-center px-3 sm:px-6 pb-3 sm:pb-4 relative">
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
          {/* Two-layer crossfade stage: stacks outgoing and incoming images at the exact same center */}
          <div className="relative inline-grid grid-cols-1 grid-rows-1 place-items-center max-w-full max-h-full">
            {/* Outgoing photo dissolving out */}
            {outgoingPhoto && (
              <div
                key={`outgoing-${outgoingPhoto.photoID}-${transitionId}`}
                className="col-start-1 row-start-1 relative justify-self-center self-center max-w-full max-h-full inline-flex items-center justify-center animate-hero-fade-out z-0 pointer-events-none"
              >
                <img
                  src={outgoingPhoto.imageDesktop}
                  alt={outgoingPhoto.title}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="max-w-full max-h-[calc(100vh-17rem)] sm:max-h-[calc(100vh-18rem)] md:max-h-[calc(100vh-19rem)] w-auto h-auto object-contain mx-auto rounded-[2px] shadow-2xl photo-frame select-none pointer-events-none"
                />
                <WatermarkBadge
                  show={showWatermark}
                  notice={copyrightNotice}
                  size="md"
                  withShield={false}
                />
              </div>
            )}

            {/* Current/Incoming photo dissolving in */}
            <div
              key={`current-${current.photoID}-${transitionId}`}
              className={`col-start-1 row-start-1 relative justify-self-center self-center max-w-full max-h-full inline-flex items-center justify-center ${
                outgoingPhoto ? "animate-hero-fade-in z-[1]" : "opacity-100 z-0"
              }`}
            >
              <img
                src={current.imageDesktop}
                alt={current.title}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="max-w-full max-h-[calc(100vh-17rem)] sm:max-h-[calc(100vh-18rem)] md:max-h-[calc(100vh-19rem)] w-auto h-auto object-contain mx-auto rounded-[2px] shadow-2xl photo-frame select-none pointer-events-none"
              />
              {/* Protection shield & Watermark overlay */}
              <WatermarkBadge
                show={showWatermark}
                notice={copyrightNotice}
                size="md"
                withShield={true}
              />
            </div>
          </div>
        </Link>
      </div>

      {/* Slideshow Controls Bar Below the Image */}
      <div className="w-full pb-4 pt-2 flex items-center justify-center shrink-0 z-20 relative">
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
            title={
              isPaused ? "Resume rotation (Space)" : "Pause rotation (Space)"
            }
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
