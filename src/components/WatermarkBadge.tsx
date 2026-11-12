"use client";

import React from "react";

export interface WatermarkBadgeProps {
  show?: boolean;
  notice?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  withShield?: boolean;
}

export function WatermarkBadge({
  show = true,
  notice = "© Randal R. Ketchem",
  size = "sm",
  className = "",
  withShield = true,
}: WatermarkBadgeProps) {
  const sizeClasses = {
    xs: "text-[9px] px-1.5 py-0.5 bottom-1.5 right-1.5 tracking-tight",
    sm: "text-[10px] px-1.5 py-0.5 bottom-1.5 right-2 tracking-wide",
    md: "text-[11px] sm:text-xs px-2 py-0.5 bottom-2 right-2.5 tracking-wider",
    lg: "text-xs sm:text-sm px-2.5 py-1 bottom-3 right-3 sm:right-4 tracking-wider shadow-lg",
  }[size];

  return (
    <>
      {withShield && (
        <div
          className="absolute inset-0 z-10 select-none cursor-pointer"
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
      {show && (
        <div
          className={`absolute z-20 pointer-events-none select-none rounded bg-black/60 backdrop-blur-[2px] border border-white/10 text-white/85 font-sans shadow ${sizeClasses} ${className}`}
          aria-hidden="true"
        >
          {notice}
        </div>
      )}
    </>
  );
}
