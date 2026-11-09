import Link from "next/link";
import { siteConfig } from "@/config/site";

export function Header() {
  return (
    <header className="border-b border-surface-border bg-black/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="group">
          <h1 className="text-lg sm:text-xl font-medium tracking-tight text-white group-hover:text-accent transition-colors">
            {siteConfig.siteTitle}
          </h1>
          <p className="text-xs text-muted hidden sm:block tracking-wide">
            {siteConfig.tagline}
          </p>
        </Link>

        <nav className="flex items-center space-x-6 sm:space-x-8 text-sm">
          {siteConfig.navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-gray-300 hover:text-accent transition-colors font-medium"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
