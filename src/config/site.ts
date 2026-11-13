import { SiteConfig } from "../types/photo";

export const siteConfig: SiteConfig = {
  siteTitle: "Fine Art Photography",
  artistName: "Photographer",
  tagline: "Fine Art Landscape, Nature, and Architectural Photography",
  bio: "Fine art photography exploring the quiet grandeur, intricate details, and atmospheric light of natural landscapes and places.",
  copyrightText: "© Photographer. All rights reserved.",
  theme: {
    backgroundColor: "#000000",
    accentColor: "#9999FF",
  },
  navigation: [
    { label: "Home", href: "/" },
    { label: "Explore", href: "/explore" },
    { label: "About", href: "/about" },
  ],
};
