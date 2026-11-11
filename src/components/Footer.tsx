import Link from "next/link";
import { siteConfig } from "@/config/site";
import { SiteSettings } from "@/types/settings";

interface FooterProps {
  settings?: SiteSettings;
}

export function Footer({ settings }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const artistName = settings?.artistName || siteConfig.artistName;
  const copyrightText = settings?.copyrightText
    ? settings.copyrightText.replace(/{year}/g, String(currentYear))
    : `© ${currentYear} ${artistName}. All rights reserved.`;

  return (
    <footer className="border-t border-surface-border bg-background mt-20 py-12 text-center text-xs text-muted">
      <div className="max-w-7xl mx-auto px-4 space-y-3">
        <p className="tracking-wide">{copyrightText}</p>
        <p className="text-[11px] text-gray-500">
          All photographs on this site are protected by United States and international copyright laws.
          Unauthorized use or reproduction without express written consent is prohibited.
        </p>
        <p className="pt-2 text-[10px] text-gray-600 flex items-center justify-center space-x-3">
          <span>
            Powered by{" "}
            <a
              href="https://github.com/ketchemr/lumenist"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-foreground font-medium transition-colors underline-offset-2 hover:underline"
            >
              Lumenist
            </a>{" "}
            — The Open-Source Fine-Art Photography CMS
          </span>
          <span>·</span>
          <Link href="/admin/upload" className="hover:text-gray-400 transition-colors">
            Admin
          </Link>
        </p>
      </div>
    </footer>
  );
}
