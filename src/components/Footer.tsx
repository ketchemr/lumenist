import Link from "next/link";
import { siteConfig } from "@/config/site";
import { SiteSettings } from "@/types/settings";

interface FooterProps {
  settings?: SiteSettings;
}

export function Footer({ settings }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const artistName = settings?.artistName || siteConfig.artistName;

  return (
    <footer className="border-t border-surface-border bg-black mt-20 py-12 text-center text-xs text-muted">
      <div className="max-w-7xl mx-auto px-4 space-y-3">
        <p className="tracking-wide">
          &copy; 2003–{currentYear} {artistName}. All rights reserved.
        </p>
        <p className="text-[11px] text-gray-500">
          All photographs on this site are protected by United States and international copyright laws.
          Unauthorized use or reproduction without express written consent is prohibited.
        </p>
        <p className="pt-2 text-[10px] text-gray-600 flex items-center justify-center space-x-3">
          <span>
            Powered by <span className="text-gray-400 font-medium">Lumenist</span> — The Open-Source Fine-Art Photography CMS
          </span>
          <span>·</span>
          <Link href="/admin/upload" className="hover:text-gray-400 transition-colors">
            Admin Uploader
          </Link>
        </p>
      </div>
    </footer>
  );
}
