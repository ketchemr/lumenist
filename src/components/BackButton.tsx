"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  fallback?: string;
  label?: string;
  className?: string;
}

export function BackButton({
  fallback = "/",
  label = "Back",
  className = "",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    // If the user arrived from within our app, navigate back to preserve page & scroll
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center space-x-1.5 text-xs text-muted hover:text-accent transition-colors cursor-pointer ${className}`}
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}
