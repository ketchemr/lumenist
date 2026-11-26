import type { MetadataRoute } from "next";
import { getAllPhotos, getAllCategories } from "@/lib/photos";
import { getSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getSiteUrl();

  const photos = getAllPhotos();
  const categories = getAllCategories();

  // 1. Static Core Exhibition Pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/galleries`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // 2. Curated Galleries / Collections
  const galleryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${baseUrl}/galleries/${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // 3. Individual Photo Exhibition Pages
  const photoRoutes: MetadataRoute.Sitemap = photos.map((photo) => {
    let lastMod = new Date();
    if (photo.updatedAt) {
      lastMod = new Date(photo.updatedAt * 1000);
    } else if (photo.dateTaken) {
      const { year, month, day } = photo.dateTaken;
      if (year && month && day) {
        lastMod = new Date(year, Math.max(0, month - 1), day);
      }
    }

    const photoUrl = `${baseUrl}/photo/${photo.photoID}`;
    
    // Provide clean static image URL without query string ampersands
    let images: string[] | undefined;
    if (photo.imageDesktop) {
      const cleanSub = photo.imageDesktop.split("?")[0].replace(/^\/+/, "");
      images = [`${baseUrl}/${cleanSub}`];
    }

    return {
      url: photoUrl,
      lastModified: lastMod,
      changeFrequency: "monthly",
      priority: 0.6,
      ...(images ? { images } : {}),
    };
  });

  return [...staticRoutes, ...galleryRoutes, ...photoRoutes];
}
