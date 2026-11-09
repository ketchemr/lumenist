import { siteConfig } from "@/config/site";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-surface-border bg-black mt-20 py-12 text-center text-xs text-muted">
      <div className="max-w-7xl mx-auto px-4 space-y-3">
        <p className="tracking-wide">
          © 2003–{currentYear} {siteConfig.artistName}. All rights reserved.
        </p>
        <p className="text-[11px] text-gray-500">
          All photographs on this site are protected by United States and international copyright laws.
          Unauthorized use or reproduction without express written consent is prohibited.
        </p>
        <p className="pt-2 text-[10px] text-gray-600">
          Powered by <span className="text-gray-400 font-medium">Lumenist</span> — The Open-Source Fine-Art Photography CMS
        </p>
      </div>
    </footer>
  );
}
