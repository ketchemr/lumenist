import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Camera, Mail, Instagram, ShoppingBag, Sparkles } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "About Randy | Randal R. Ketchem Photography",
  description: "About Randal R. Ketchem — Fine art landscape and nature photography.",
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-4">
      {/* Top Breadcrumbs */}
      <div className="border-b border-surface-border pb-4">
        <Breadcrumbs items={[{ label: "About Randy" }]} />
      </div>

      {/* Headline Header */}
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
          About Randy
        </h1>
        <p className="text-accent text-sm tracking-wide">
          Landscape and Nature Photography
        </p>
      </div>

      {/* Main Narrative */}
      <div className="space-y-6 text-gray-300 text-sm sm:text-base leading-relaxed">
        <p>
          I have long been interested in photography. I started out with a Minolta XG/M that my brother handed down to me when I was around 14 years old. I never pursued photography seriously, though, until the final semester of my B.S. in Chemistry/Biochemistry. I had not taken any of my electives and my advisor told me there was no getting around it. I asked if I could take astronomy, to which he essentially said, &ldquo;No, you geek! Take pottery or something.&rdquo; So, I took a course in basic black and white photography. I used my old manual Minolta, learned some composition and lighting techniques, plus darkroom methods. I loved it.
        </p>
        <p>
          I bought some cheap darkroom equipment and did some work on my own, but started working on my Ph.D. in Molecular Biophysics (I am indeed a geek) and so had little time to pursue my love of photography. After grad school and a postdoc, I started my first real job and finally had some time again to dedicate to photography. Living in the beauty of God&rsquo;s creation in the Pacific Northwest at that time also made it easy to lean into landscape photography. So, I purchased a Nikon N70 (which I have now upgraded several times) and, well, here we are.
        </p>
        <p className="italic text-gray-400">
          I hope you enjoy the images found here. I tend to spend MUCH more time hiking and collecting images than I do getting them online, so check back from time to time to see the collection grow.
        </p>
      </div>

      {/* Equipment & Gear Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* Cameras & Lenses Card */}
        <div className="bg-surface border border-surface-border rounded-sm p-6 space-y-4">
          <div className="flex items-center space-x-2.5 text-white font-medium border-b border-surface-border pb-3">
            <Camera className="w-4 h-4 text-accent" />
            <h2 className="text-sm uppercase tracking-wider font-semibold">
              Camera Bodies & Lenses
            </h2>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm text-gray-300">
            <li className="flex items-start space-x-2">
              <span className="text-accent">•</span>
              <span>Sony a7R Mark IV (ILCE-7RM4)</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-accent">•</span>
              <span>Sony FE 24-105mm F4 G OSS</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-accent">•</span>
              <span>Sony FE 200-600mm f/5.6-6.3 G OSS</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-accent">•</span>
              <span>Sony FE 1.4x Teleconverter</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-accent">•</span>
              <span>Meike 10mm Extension Tube</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-accent">•</span>
              <span>Meike 16mm Extension Tube</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-accent">•</span>
              <span>AK Diffuser</span>
            </li>
          </ul>
        </div>

        {/* Tripods & Support Card */}
        <div className="bg-surface border border-surface-border rounded-sm p-6 space-y-4">
          <div className="flex items-center space-x-2.5 text-white font-medium border-b border-surface-border pb-3">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="text-sm uppercase tracking-wider font-semibold">
              Tripods & Support
            </h2>
          </div>
          <ul className="space-y-2 text-xs sm:text-sm text-gray-300">
            <li className="flex items-start space-x-2">
              <span className="text-accent">•</span>
              <span>Manfrotto Befree GT XPRO Carbon, 496 ball head</span>
            </li>
          </ul>

          <div className="pt-4 border-t border-surface-border/60 space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-muted">
              Social & Community
            </h3>
            <a
              href="https://www.instagram.com/randalketchemphoto/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-xs sm:text-sm text-accent hover:text-accent-light transition-colors"
            >
              <Instagram className="w-4 h-4" />
              <span>@randalketchemphoto on Instagram ↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Orders & Inquiries Banner */}
      <div className="bg-surface border border-surface-border rounded-sm p-6 sm:p-8 space-y-4">
        <div className="flex items-center space-x-2.5 text-white font-medium">
          <ShoppingBag className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-light tracking-wide">
            Fine Art Print Orders & Inquiries
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed max-w-2xl">
          If you would like to place an order, please contact me via email and include the <strong>image ID</strong> and your desired print size. I will reply with estimated turnaround times and discuss custom sizing and archival media options.
        </p>

        <div className="pt-2">
          <a
            href="mailto:randy@rrkphoto.com"
            className="inline-flex items-center space-x-2 text-sm bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent px-4 py-2 rounded-sm transition-colors font-medium"
          >
            <Mail className="w-4 h-4" />
            <span>randy@rrkphoto.com</span>
          </a>
        </div>
      </div>
    </div>
  );
}
