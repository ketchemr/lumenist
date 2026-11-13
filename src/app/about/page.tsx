import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Camera, Mail, Instagram, ShoppingBag, Sparkles } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings();
  const artistName = settings.artistName || siteConfig.artistName;
  const siteTitle = settings.siteTitle || siteConfig.siteTitle;
  const aboutTitle =
    settings.aboutTitle || (artistName ? `About ${artistName}` : "About");
  const description =
    settings.aboutSubheading ||
    settings.siteTagline ||
    siteConfig.tagline ||
    "Fine art photography.";

  return {
    title: `${aboutTitle} | ${siteTitle}`,
    description: `${aboutTitle} — ${description}`,
  };
}

export default function AboutPage() {
  const settings = getSettings();
  const artistName = settings.artistName || siteConfig.artistName;
  const aboutTitle =
    settings.aboutTitle ||
    (artistName ? `About ${artistName}` : "About the Artist");
  const aboutSubheading =
    settings.aboutSubheading ||
    settings.siteTagline ||
    siteConfig.tagline ||
    "Fine Art Photography";
  const bio = settings.artistBio || siteConfig.bio || "";
  const paragraphs = bio ? bio.split(/\n\n+/).filter(Boolean) : [];
  const contactEmail = settings.contactEmail || siteConfig.contactEmail;
  const instagramHandle = settings.instagramHandle;
  const instagramUrl =
    settings.instagramUrl ||
    (instagramHandle
      ? `https://www.instagram.com/${instagramHandle.replace(/^@/, "")}/`
      : "");
  const gearList = settings.gearList || [];
  const supportGearList = settings.supportGearList || [];
  const hasGear =
    gearList.length > 0 || supportGearList.length > 0 || Boolean(instagramUrl);

  return (
    <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Top Breadcrumbs */}
      <div className="border-b border-surface-border pb-4">
        <Breadcrumbs items={[{ label: aboutTitle }]} />
      </div>

      {/* Headline Header */}
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-light text-foreground tracking-tight">
          {aboutTitle}
        </h1>
        <p className="text-accent text-sm tracking-wide">{aboutSubheading}</p>
      </div>

      {/* Main Narrative */}
      {paragraphs.length > 0 && (
        <div className="space-y-6 text-foreground/80 text-sm sm:text-base leading-relaxed">
          {paragraphs.map((p, idx) => (
            <p
              key={idx}
              className={
                idx === paragraphs.length - 1 && paragraphs.length > 1
                  ? "italic text-muted"
                  : ""
              }
            >
              {p}
            </p>
          ))}
        </div>
      )}

      {/* Equipment & Gear Section */}
      {hasGear && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Cameras & Lenses Card */}
          {gearList.length > 0 && (
            <div className="bg-surface border border-surface-border rounded-sm p-6 space-y-4">
              <div className="flex items-center space-x-2.5 text-foreground font-medium border-b border-surface-border pb-3">
                <Camera className="w-4 h-4 text-accent" />
                <h2 className="text-sm uppercase tracking-wider font-semibold">
                  Camera Bodies & Lenses
                </h2>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-muted">
                {gearList.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="text-accent">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tripods, Support & Social Card */}
          {(supportGearList.length > 0 || instagramUrl) && (
            <div className="bg-surface border border-surface-border rounded-sm p-6 space-y-4">
              {supportGearList.length > 0 && (
                <>
                  <div className="flex items-center space-x-2.5 text-foreground font-medium border-b border-surface-border pb-3">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <h2 className="text-sm uppercase tracking-wider font-semibold">
                      Tripods & Support
                    </h2>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-muted">
                    {supportGearList.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <span className="text-accent">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {instagramUrl && (
                <div
                  className={`${
                    supportGearList.length > 0
                      ? "pt-4 border-t border-surface-border/60"
                      : ""
                  } space-y-2`}
                >
                  <h3 className="text-xs uppercase tracking-wider font-semibold text-muted">
                    Social & Community
                  </h3>
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-xs sm:text-sm text-accent hover:text-accent-light transition-colors"
                  >
                    <Instagram className="w-4 h-4" />
                    <span>
                      {instagramHandle
                        ? `${instagramHandle} on Instagram ↗`
                        : "Instagram ↗"}
                    </span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Orders & Inquiries Banner */}
      <div className="bg-surface border border-surface-border rounded-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-center space-x-2.5 text-foreground font-medium">
          <ShoppingBag className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-light tracking-wide">
            Fine Art Print Orders & Inquiries
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-2xl">
          If you would like to place an order or inquire about licensing, please
          contact via email with the <strong>image ID</strong> and your desired
          print size or usage requirements.
        </p>

        {contactEmail && (
          <div className="pt-2">
            <a
              href={`mailto:${contactEmail}`}
              className="inline-flex items-center space-x-2 text-sm bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent px-4 py-2 rounded-sm transition-colors font-medium"
            >
              <Mail className="w-4 h-4" />
              <span>{contactEmail}</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
