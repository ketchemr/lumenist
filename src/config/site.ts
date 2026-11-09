import { SiteConfig } from "../types/photo";

export const siteConfig: SiteConfig = {
  siteTitle: "Randal R. Ketchem Photography",
  artistName: "Randal R. Ketchem",
  tagline: "Fine Art Landscape, Nature, and Pacific Northwest Photography",
  bio: "Fine art photography exploring the quiet grandeur, intricate details, and atmospheric light of natural landscapes, mountains, and historic places.",
  copyrightText: "© Randal R. Ketchem. All rights reserved.",
  theme: {
    backgroundColor: "#000000",
    accentColor: "#9999FF",
  },
  navigation: [
    { label: "Galleries", href: "/galleries" },
    { label: "Explore", href: "/explore" },
    { label: "Map", href: "/map" },
    { label: "About", href: "/about" },
  ],
};
