import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center space-x-1.5 text-xs text-muted"
    >
      <Link
        href="/"
        className="flex items-center space-x-1 hover:text-accent transition-colors"
        title="Home"
      >
        <Home className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Home</span>
      </Link>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <div key={idx} className="flex items-center space-x-1.5">
            <ChevronRight className="w-3 h-3 text-muted/60 flex-shrink-0" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-accent transition-colors truncate max-w-[180px] sm:max-w-none"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-none">
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
