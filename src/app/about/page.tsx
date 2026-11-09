import { siteConfig } from "@/config/site";
import { Camera, Mail, Award, MapPin } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-12 py-6">
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-light text-white tracking-tight">
          About {siteConfig.artistName}
        </h1>
        <p className="text-accent text-sm tracking-wide">
          {siteConfig.tagline}
        </p>
      </div>

      <div className="prose prose-invert max-w-none text-gray-300 space-y-6 text-sm sm:text-base leading-relaxed">
        <p>
          {siteConfig.bio}
        </p>
        <p>
          Rooted in the Pacific Northwest and the dramatic terrain of the Cascade Mountains, 
          the photography represents a continuing study in light, form, and natural quietude. 
          Each image is carefully composed in the field—frequently utilizing large-format discipline, 
          sturdy support, and deliberate timing to capture the atmosphere of the land as it exists.
        </p>
        <p>
          Both analog film (Fujichrome Velvia and Provia transparencies) and high-resolution digital 
          capture mediums are utilized, preserving subtle tonal gradations and maximum detail for fine art printmaking.
        </p>
      </div>

      <div className="border-t border-surface-border pt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
        <div className="bg-surface border border-surface-border rounded-sm p-5 space-y-2">
          <div className="flex items-center space-x-2 text-white font-medium">
            <Award className="w-4 h-4 text-accent" />
            <span>Fine Art Prints</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Exhibition-quality archival prints on fine-art rag papers and canvas are available for order. 
            Each print is individually inspected and approved.
          </p>
        </div>

        <div className="bg-surface border border-surface-border rounded-sm p-5 space-y-2">
          <div className="flex items-center space-x-2 text-white font-medium">
            <Mail className="w-4 h-4 text-accent" />
            <span>Contact & Inquiries</span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            For print acquisitions, licensing, or exhibition inquiries, please reach out directly:
          </p>
          <a
            href="mailto:contact@rrkphoto.com"
            className="text-xs text-accent hover:text-accent-light block font-mono"
          >
            contact@rrkphoto.com
          </a>
        </div>
      </div>
    </div>
  );
}
