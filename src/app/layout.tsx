import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { siteConfig } from "@/config/site";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSettings, getThemeCssVariables, isLightModeActive } from "@/lib/settings";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings();
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://rrkphoto.com"
  ).replace(/\/+$/, "");

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: settings.siteTitle || siteConfig.siteTitle,
      template: `%s | ${settings.siteTitle || siteConfig.siteTitle}`,
    },
    description: settings.siteTagline || siteConfig.tagline,
    icons: {
      icon: [
        { url: "/icon.svg?v=3", type: "image/svg+xml" },
        { url: "/favicon.ico?v=3" },
      ],
      apple: "/apple-icon.png?v=3",
    },
    openGraph: {
      title: settings.siteTitle || siteConfig.siteTitle,
      description: settings.siteTagline || siteConfig.tagline,
      url: siteUrl,
      siteName: settings.siteTitle || siteConfig.siteTitle,
      locale: "en_US",
      type: "website",
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = getSettings();
  const themeCss = getThemeCssVariables(settings);
  const isLight = isLightModeActive(settings);
  const gaId = process.env.NEXT_PUBLIC_GA_ID || "G-62W7T3TYLK";

  return (
    <html lang="en" className={isLight ? "light" : "dark"} data-theme={isLight ? "light" : "dark"}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-accent/30 selection:text-foreground">
        <Header settings={settings} />
        <main className="flex-1 w-full flex flex-col min-h-0">
          {children}
        </main>
        <Footer settings={settings} />
      </body>
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}
