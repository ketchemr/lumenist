import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/admin",
          "/api/admin/",
          "/api/share",
          "/api/share/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
