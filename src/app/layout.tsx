import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSettings, getThemeCssVariables } from "@/lib/settings";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings();
  return {
    title: {
      default: settings.siteTitle || siteConfig.siteTitle,
      template: `%s | ${settings.siteTitle || siteConfig.siteTitle}`,
    },
    description: settings.siteTagline || siteConfig.tagline,
    icons: {
      icon: "/favicon.ico",
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

  return (
    <html lang="en" className="dark">
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss }} />
      </head>
      <body className="min-h-screen flex flex-col bg-background text-gray-100 antialiased selection:bg-accent/30 selection:text-white">
        <Header settings={settings} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <Footer settings={settings} />
      </body>
    </html>
  );
}
