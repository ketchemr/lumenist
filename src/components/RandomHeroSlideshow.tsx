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

interface RandomHeroSlideshowProps {
  photos: Photo[];
  intervalSeconds?: number;
}

export function RandomHeroSlideshow({
  photos,
  intervalSeconds = 10,
}: RandomHeroSlideshowProps) {
  // Use index state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pick a random photo different from current
  const advanceToRandom = useCallback(() => {
    if (photos.length <= 1) return;
    setIsTransitioning(true);

    setTimeout(() => {
      setCurrentIndex((prev) => {
        let next = prev;
        while (next === prev) {
          next = Math.floor(Math.random() * photos.length);
        }
        return next;
      });
      setIsTransitioning(false);
      setProgress(0);
    }, 300); // 300ms fade transition
  }, [photos]);

  const advanceToNext = useCallback(() => {
    advanceToRandom();
  }, [advanceToRandom]);

  const advanceToPrev = useCallback(() => {
    if (photos.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
      setIsTransitioning(false);
      setProgress(0);
    }, 300);
  }, [photos]);

  // Pick initial random photo once mounted on client (avoids SSR hydration mismatch)
  useEffect(() => {
    if (photos.length > 0) {
      const initial = Math.floor(Math.random() * photos.length);
      setCurrentIndex(initial);
    }
  }, [photos.length]);

  // Progress bar ticker
  useEffect(() => {
    if (isPaused) return;

    const stepMs = 100;
    const totalMs = intervalSeconds * 1000;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (stepMs / totalMs) * 100;
        if (next >= 100) {
          advanceToRandom();
          return 0;
        }
        return next;
      });
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPaused, intervalSeconds, advanceToRandom]);

  if (!photos || photos.length === 0) return null;

  const current = photos[currentIndex] || photos[0];

  return (
    <section
      className="relative rounded-sm overflow-hidden border border-surface-border bg-black group w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center p-4 sm:p-6 lg:p-8 lg:h-[520px]">
        {/* Photo Display: Constant Width & Constant Height Frame */}
        <div className="lg:col-span-8 h-[320px] sm:h-[420px] lg:h-[470px] w-full overflow-hidden rounded-sm bg-black relative flex items-center justify-center">
          <Link
            href={`/photo/${current.photoID}`}
            className="w-full h-full flex items-center justify-center p-2"
          >
            <img
              src={current.imageDesktop}
              alt={current.title}
              key={current.photoID}
              className={`max-w-full max-h-full w-auto h-auto object-contain mx-auto rounded shadow-2xl transition-all duration-500 ${
                isTransitioning ? "opacity-20 scale-[0.99]" : "opacity-100 scale-100"
              }`}
            />
          </Link>

          {/* Navigation Controls Overlay */}
          <div className="absolute inset-y-0 left-0 flex items-center pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.preventDefault();
                advanceToPrev();
              }}
              aria-label="Previous random photo"
              className="p-2 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute inset-y-0 right-0 flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.preventDefault();
                advanceToNext();
              }}
              aria-label="Next random photo"
              className="p-2 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white border border-white/10 backdrop-blur-sm transition-all cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Narrative & Details Column: Top Justified */}
        <div className="lg:col-span-4 h-full flex flex-col justify-start py-2 space-y-4">
          <div
            className={`space-y-4 transition-opacity duration-300 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {/* Title with discreet Pause/Play toggle */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-2xl sm:text-3xl font-light text-white tracking-tight">
                <Link
                  href={`/photo/${current.photoID}`}
                  className="hover:text-accent transition-colors"
                >
                  {current.title}
                </Link>
              </h2>

              <button
                onClick={() => setIsPaused((p) => !p)}
                className="text-xs text-muted hover:text-white flex-shrink-0 flex items-center space-x-1 bg-black border border-surface-border px-2 py-1 rounded transition-colors mt-1 cursor-pointer"
                title={isPaused ? "Resume rotation" : "Pause rotation"}
              >
                {isPaused ? (
                  <>
                    <Play className="w-3 h-3 text-accent" />
                    <span className="hidden sm:inline">Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3 text-gray-400" />
                    <span className="hidden sm:inline">Pause</span>
                  </>
                )}
              </button>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-300 leading-relaxed font-normal">
              {current.description ||
                "A fine art landscape photograph exploring natural light and form."}
            </p>

            {/* Categories */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {current.categories.map((c) => (
                <Link
                  key={c}
                  href={`/galleries/${encodeURIComponent(c)}`}
                  className="text-xs bg-black hover:bg-surface-hover border border-surface-border hover:border-accent px-2.5 py-1 rounded text-gray-300 hover:text-white transition-colors"
                >
                  {c}
                </Link>
              ))}
            </div>

            {/* Camera & Year Metadata */}
            <div className="flex items-center space-x-3 text-xs text-muted font-mono pt-1">
              {current.camera && (
                <span className="flex items-center space-x-1">
                  <Camera className="w-3.5 h-3.5 text-gray-400" />
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

      {/* Subtle Progress Bar */}
      <div className="w-full bg-surface-border h-0.5 relative">
        <div
          className="bg-accent h-0.5 transition-all duration-100 ease-linear"
          style={{ width: `${isPaused ? progress : progress}%` }}
        />
      </div>
    </section>
  );
}
