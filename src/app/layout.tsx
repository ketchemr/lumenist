import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSettings, getThemeCssVariables, isLightModeActive } from "@/lib/settings";
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
  const isLight = isLightModeActive(settings);

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
    </html>
  );
}
