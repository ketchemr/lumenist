"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Share2, Check, AlertCircle } from "lucide-react";

interface ShareButtonProps {
  /** Direct URL to share */
  url?: string;
  /** Relative path resolved against window.location.origin (e.g. "/photo/123") */
  path?: string;
  /** Lazy URL builder (sync or async, e.g. creating a short Explore share link) */
  getUrl?: () => string | Promise<string>;
  /** Title passed to native Web Share API on touch devices */
  title?: string;
  /** Description passed to native Web Share API on touch devices */
  text?: string;
  /** Visible button label */
  label?: string;
  /** Confirmation text shown after copying */
  copiedLabel?: string;
  /** Visual variant matching site controls */
  variant?: "button" | "ghost";
  /** Tooltip text */
  tooltip?: string;
  className?: string;
}

// Track last announced message across instances so VoiceOver announces repeated copies
let lastAnnouncement = "";

function legacyCopy(text: string): boolean {
  const field = Object.assign(document.createElement("textarea"), {
    value: text,
  });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;inset-block-start:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

export function ShareButton({
  url,
  path,
  getUrl,
  title,
  text,
  label = "Share",
  copiedLabel = "Link copied",
  variant = "button",
  tooltip = "Copy shareable link",
  className = "",
}: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [announcement, setAnnouncement] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const report = useCallback(
    (ok: boolean, customMessage?: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      let message = customMessage || (ok ? copiedLabel : "Copy failed");
      if (message === lastAnnouncement) {
        message += "\u00A0";
      }
      lastAnnouncement = message;

      setStatus(ok ? "copied" : "failed");
      setAnnouncement("");
      requestAnimationFrame(() => {
        setAnnouncement(message);
      });

      timerRef.current = setTimeout(() => {
        setStatus("idle");
        setAnnouncement("");
      }, 2200);
    },
    [copiedLabel]
  );

  const resolveUrl = useCallback((): string | Promise<string> => {
    if (getUrl) return getUrl();
    if (url) return url;
    if (typeof window !== "undefined") {
      if (path) {
        return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
      }
      return window.location.href;
    }
    return path || "";
  }, [getUrl, url, path]);

  const handleShare = async () => {
    const resolved = resolveUrl();
    const isAsync = typeof resolved !== "string";

    // On touch/mobile devices, prefer the native OS share sheet when available
    const isTouchDevice =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;

    if (
      isTouchDevice &&
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        const shareUrl = await resolved;
        if (!shareUrl) return;
        await navigator.share({
          title: title || document.title,
          text: text || undefined,
          url: shareUrl,
        });
        report(true, "Shared");
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        // Fall through to clipboard copy if Web Share fails
      }
    }

    // For async URL builders (e.g. POST /api/share), pass a Promise Blob to
    // ClipboardItem synchronously so Safari preserves user-gesture activation.
    if (
      isAsync &&
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === "function" &&
      typeof ClipboardItem !== "undefined"
    ) {
      try {
        const item = new ClipboardItem({
          "text/plain": Promise.resolve(resolved).then(
            (u) => new Blob([u], { type: "text/plain" })
          ),
        });
        await navigator.clipboard.write([item]);
        report(true);
        return;
      } catch {
        // Fall through to writeText / legacyCopy
      }
    }

    let shareUrl = "";
    try {
      shareUrl = await resolved;
    } catch {
      report(false);
      return;
    }
    if (!shareUrl) return;

    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(shareUrl);
        report(true);
        return;
      }
      if (legacyCopy(shareUrl)) {
        report(true);
      } else {
        report(false);
      }
    } catch {
      if (legacyCopy(shareUrl)) {
        report(true);
      } else {
        report(false);
      }
    }
  };

  const baseClasses =
    variant === "button"
      ? `min-w-[24px] min-h-[24px] px-3 py-1.5 rounded-sm border text-xs flex items-center space-x-1.5 transition-colors cursor-pointer ${
          status === "copied"
            ? "bg-accent/15 border-accent text-accent font-medium shadow-sm"
            : status === "failed"
            ? "bg-red-950/20 border-red-500/60 text-red-400"
            : "bg-surface hover:bg-surface-hover border-surface-border text-foreground hover:border-accent/40"
        }`
      : `min-w-[24px] min-h-[24px] inline-flex items-center space-x-1 text-xs transition-colors cursor-pointer ${
          status === "copied"
            ? "text-accent font-medium"
            : status === "failed"
            ? "text-red-400"
            : "text-muted hover:text-accent"
        }`;

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleShare}
        data-copied={status === "copied" ? "" : undefined}
        data-failed={status === "failed" ? "" : undefined}
        title={tooltip}
        className={`${baseClasses} ${className}`}
      >
        {status === "copied" ? (
          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        ) : status === "failed" ? (
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className={variant === "ghost" ? "sr-only sm:not-sr-only" : ""}>
          {status === "copied"
            ? "Copied"
            : status === "failed"
            ? "Failed"
            : label}
        </span>
      </button>

      {/* Live region & visual confirmation bubble kept outside the button */}
      <span
        role="status"
        className={`pointer-events-none absolute top-full right-0 mt-1.5 z-50 whitespace-nowrap rounded-sm border px-2 py-1 text-[11px] font-medium shadow-lg transition-opacity duration-150 motion-reduce:transition-none ${
          status === "copied"
            ? "opacity-100 bg-surface border-accent text-accent"
            : status === "failed"
            ? "opacity-100 bg-surface border-red-500/60 text-red-400"
            : "opacity-0 border-transparent"
        }`}
      >
        {announcement}
      </span>
    </span>
  );
}
