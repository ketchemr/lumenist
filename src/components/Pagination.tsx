"use client";

import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  baseUrl?: string;
  onPageChange?: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 48,
  baseUrl,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  // Generate page numbers with ellipses
  const pageNumbers: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else if (currentPage <= 4) {
    pageNumbers.push(1, 2, 3, 4, 5, "...", totalPages);
  } else if (currentPage >= totalPages - 3) {
    pageNumbers.push(
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages
    );
  } else {
    pageNumbers.push(
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages
    );
  }

  const getPageUrl = (page: number) => {
    if (!baseUrl) return "#";
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}page=${page}`;
  };

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    page: number
  ) => {
    if (onPageChange) {
      e.preventDefault();
      onPageChange(page);
    }
    // Smooth scroll to top of gallery container
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : currentPage * pageSize;

  return (
    <div className="flex flex-col items-center space-y-4 pt-10 pb-16">
      {/* Page Controls */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 text-xs select-none">
        {/* First Page ( |<< ) */}
        {currentPage > 1 ? (
          <Link
            href={getPageUrl(1)}
            onClick={(e) => handleClick(e, 1)}
            aria-label="First page"
            className="p-2 rounded bg-surface hover:bg-surface-hover border border-surface-border text-muted hover:text-foreground transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className="p-2 rounded bg-surface/50 border border-surface-border/50 text-muted/40 cursor-not-allowed">
            <ChevronsLeft className="w-3.5 h-3.5" />
          </span>
        )}

        {/* Previous Page ( < ) */}
        {currentPage > 1 ? (
          <Link
            href={getPageUrl(currentPage - 1)}
            onClick={(e) => handleClick(e, currentPage - 1)}
            aria-label="Previous page"
            className="p-2 rounded bg-surface hover:bg-surface-hover border border-surface-border text-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className="p-2 rounded bg-surface/50 border border-surface-border/50 text-muted/40 cursor-not-allowed">
            <ChevronLeft className="w-3.5 h-3.5" />
          </span>
        )}

        {/* Page Numbers */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 px-1 sm:px-2">
          {pageNumbers.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-muted font-mono tracking-widest"
                >
                  ...
                </span>
              );
            }

            const isCurrent = p === currentPage;
            return (
              <Link
                key={p}
                href={getPageUrl(p)}
                onClick={(e) => handleClick(e, p)}
                aria-current={isCurrent ? "page" : undefined}
                className={`min-w-[32px] h-8 flex items-center justify-center rounded px-2.5 font-medium transition-all ${
                  isCurrent
                    ? "bg-accent text-accent-contrast font-semibold shadow-sm"
                    : "bg-surface hover:bg-surface-hover border border-surface-border text-muted hover:text-foreground"
                }`}
              >
                {p}
              </Link>
            );
          })}
        </div>

        {/* Next Page ( > ) */}
        {currentPage < totalPages ? (
          <Link
            href={getPageUrl(currentPage + 1)}
            onClick={(e) => handleClick(e, currentPage + 1)}
            aria-label="Next page"
            className="p-2 rounded bg-surface hover:bg-surface-hover border border-surface-border text-muted hover:text-foreground transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className="p-2 rounded bg-surface/50 border border-surface-border/50 text-muted/40 cursor-not-allowed">
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        )}

        {/* Last Page ( >>| ) */}
        {currentPage < totalPages ? (
          <Link
            href={getPageUrl(totalPages)}
            onClick={(e) => handleClick(e, totalPages)}
            aria-label="Last page"
            className="p-2 rounded bg-surface hover:bg-surface-hover border border-surface-border text-muted hover:text-foreground transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className="p-2 rounded bg-surface/50 border border-surface-border/50 text-muted/40 cursor-not-allowed">
            <ChevronsRight className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      {/* Item Range Text */}
      {totalItems && (
        <p className="text-[11px] text-muted">
          Showing <span className="text-foreground font-medium">{startItem}–{endItem}</span> of{" "}
          <span className="text-foreground font-medium">{totalItems}</span> photographs (Page {currentPage} of {totalPages})
        </p>
      )}
    </div>
  );
}
