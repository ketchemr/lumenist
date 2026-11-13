"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route Error:", error);
  }, [error]);

  return (
    <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-4">
      <h2 className="text-3xl font-light text-foreground tracking-tight">Something Went Wrong</h2>
      <p className="text-sm text-muted">An error occurred while loading this page.</p>
      <div className="pt-4 flex items-center justify-center space-x-4">
        <button
          onClick={() => reset()}
          className="inline-flex items-center space-x-2 text-sm text-accent hover:text-accent-light cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
        <span className="text-surface-border">|</span>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return Home</span>
        </Link>
      </div>
    </div>
  );
}
