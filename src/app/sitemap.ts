import type { MetadataRoute } from "next";
import { getAllPhotos, getAllCategories } from "@/lib/photos";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://rrkphoto.com"
  ).replace(/\/+$/, "");

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
    const imageUrl = `${baseUrl}/api/thumbnail?id=${photo.photoID}&size=600`;

    return {
      url: photoUrl,
      lastModified: lastMod,
      changeFrequency: "monthly",
      priority: 0.6,
      images: [imageUrl],
    };
  });

  return [...staticRoutes, ...galleryRoutes, ...photoRoutes];
}
