"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/config/site";
import { SiteSettings } from "@/types/settings";
import { resetAllGalleryStates } from "@/lib/galleryState";

interface HeaderProps {
  settings?: SiteSettings;
}

export function Header({ settings }: HeaderProps) {
  const pathname = usePathname();
  const title = settings?.siteTitle || siteConfig.siteTitle;
  const tagline = settings?.siteTagline || siteConfig.tagline;

  return (
    <header className="border-b border-surface-border bg-background/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-center sm:justify-between gap-1.5 sm:gap-0">
        <Link
          href="/"
          onClick={() => resetAllGalleryStates()}
          className="group text-center sm:text-left"
        >
          <h1 className="text-base sm:text-lg md:text-xl font-medium tracking-tight text-foreground group-hover:text-accent transition-colors">
            {title}
          </h1>
          <p className="text-xs text-muted hidden sm:block tracking-wide">
            {tagline}
          </p>
        </Link>

        <nav aria-label="Primary" className="flex items-center justify-center space-x-5 sm:space-x-8 text-xs sm:text-sm">
          {siteConfig.navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  resetAllGalleryStates();
                  if (item.href === "/galleries") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                aria-current={isActive ? "page" : undefined}
                className={`transition-colors font-medium py-0.5 sm:py-0 ${
                  isActive
                    ? "text-accent font-semibold"
                    : "text-muted hover:text-accent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
