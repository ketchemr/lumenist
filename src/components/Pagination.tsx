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
  queryParams?: Record<string, string | number | undefined | null>;
  onPageChange?: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 48,
  baseUrl,
  queryParams,
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
    try {
      const url = new URL(baseUrl, "http://localhost");
      if (queryParams) {
        for (const [key, val] of Object.entries(queryParams)) {
          if (val !== undefined && val !== null && val !== "") {
            url.searchParams.set(key, String(val));
          }
        }
      }
      url.searchParams.set("page", page.toString());
      return `${url.pathname}${url.search}`;
    } catch {
      const separator = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${separator}page=${page}`;
    }
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

  const renderNavButton = (
    targetPage: number,
    ariaLabel: string,
    icon: React.ReactNode,
    className: string
  ) => {
    if (baseUrl) {
      return (
        <Link
          href={getPageUrl(targetPage)}
          onClick={(e) => handleClick(e, targetPage)}
          aria-label={ariaLabel}
          className={className}
        >
          {icon}
        </Link>
      );
    }
    return (
      <button
        type="button"
        onClick={(e) => handleClick(e, targetPage)}
        aria-label={ariaLabel}
        className={`${className} cursor-pointer`}
      >
        {icon}
      </button>
    );
  };

  const renderPageItem = (p: number, isCurrent: boolean) => {
    const className = `min-w-[32px] h-8 flex items-center justify-center rounded px-2.5 font-medium transition-all ${
      isCurrent
        ? "bg-accent text-accent-contrast font-semibold shadow-sm"
        : "bg-surface hover:bg-surface-hover border border-surface-border hover:border-accent/40 text-muted hover:text-accent cursor-pointer"
    }`;

    if (baseUrl) {
      return (
        <Link
          key={p}
          href={getPageUrl(p)}
          onClick={(e) => handleClick(e, p)}
          aria-current={isCurrent ? "page" : undefined}
          className={className}
        >
          {p}
        </Link>
      );
    }

    return (
      <button
        key={p}
        type="button"
        onClick={(e) => handleClick(e, p)}
        aria-current={isCurrent ? "page" : undefined}
        className={className}
      >
        {p}
      </button>
    );
  };

  return (
    <div className="flex flex-col items-center space-y-4 pt-10 pb-16">
      {/* Page Controls */}
      <div className="flex items-center space-x-1 sm:space-x-1.5 text-xs select-none">
        {/* First Page ( |<< ) */}
        {currentPage > 1 ? (
          renderNavButton(
            1,
            "First page",
            <ChevronsLeft className="w-3.5 h-3.5" />,
            "p-2 rounded bg-surface hover:bg-surface-hover border border-surface-border hover:border-accent/40 text-muted hover:text-accent transition-colors"
          )
        ) : (
          <span className="p-2 rounded bg-surface/50 border border-surface-border/50 text-muted/40 cursor-not-allowed">
            <ChevronsLeft className="w-3.5 h-3.5" />
          </span>
        )}

        {/* Previous Page ( < ) */}
        {currentPage > 1 ? (
          renderNavButton(
            currentPage - 1,
            "Previous page",
            <ChevronLeft className="w-3.5 h-3.5" />,
            "p-2 rounded bg-surface hover:bg-surface-hover border border-surface-border hover:border-accent/40 text-muted hover:text-accent transition-colors"
          )
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
            return renderPageItem(p, isCurrent);
          })}
        </div>

        {/* Next Page ( > ) */}
        {currentPage < totalPages ? (
          renderNavButton(
            currentPage + 1,
            "Next page",
            <ChevronRight className="w-3.5 h-3.5" />,
            "p-2 rounded bg-surface hover:bg-surface-hover border border-surface-border hover:border-accent/40 text-muted hover:text-accent transition-colors"
          )
        ) : (
          <span className="p-2 rounded bg-surface/50 border border-surface-border/50 text-muted/40 cursor-not-allowed">
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        )}

        {/* Last Page ( >>| ) */}
        {currentPage < totalPages ? (
          renderNavButton(
            totalPages,
            "Last page",
            <ChevronsRight className="w-3.5 h-3.5" />,
            "p-2 rounded bg-surface hover:bg-surface-hover border border-surface-border hover:border-accent/40 text-muted hover:text-accent transition-colors"
          )
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
