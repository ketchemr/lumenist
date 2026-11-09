"use client";

import { useState, useMemo } from "react";
import { Photo } from "@/types/photo";
import { PhotoCard } from "@/components/PhotoCard";
import { Search, SlidersHorizontal, Film } from "lucide-react";

interface ExploreGalleryProps {
  initialPhotos: Photo[];
  categories: { name: string; count: number }[];
}

export function ExploreGallery({ initialPhotos, categories }: ExploreGalleryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [filmFilter, setFilmFilter] = useState<"All" | "Film" | "Digital">("All");

  const filteredPhotos = useMemo(() => {
    return initialPhotos.filter((p) => {
      // Search term match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesDesc = p.description.toLowerCase().includes(query);
        const matchesCamera = p.camera.toLowerCase().includes(query);
        const matchesKeywords = p.keywords.some((k) => k.toLowerCase().includes(query));
        const matchesCategory = p.categories.some((c) => c.toLowerCase().includes(query));

        if (!matchesTitle && !matchesDesc && !matchesCamera && !matchesKeywords && !matchesCategory) {
          return false;
        }
      }

      // Category match
      if (selectedCategory !== "All") {
        if (!p.categories.includes(selectedCategory)) {
          return false;
        }
      }

      // Film / Digital match
      if (filmFilter === "Film") {
        if (!p.film || p.film.toLowerCase() === "digital") return false;
      } else if (filmFilter === "Digital") {
        if (p.film && p.film.toLowerCase() !== "digital") return false;
      }

      return true;
    });
  }, [initialPhotos, searchQuery, selectedCategory, filmFilter]);

  return (
    <div className="space-y-8">
      {/* Controls Bar */}
      <div className="space-y-4 bg-surface border border-surface-border p-4 sm:p-6 rounded-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by subject, location, camera, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black border border-surface-border rounded-sm text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Film / Digital toggle */}
          <div className="flex items-center space-x-1 border border-surface-border rounded-sm p-1 bg-black text-xs">
            <button
              onClick={() => setFilmFilter("All")}
              className={`px-3 py-1.5 rounded-sm transition-colors ${
                filmFilter === "All" ? "bg-surface-hover text-white font-medium" : "text-muted hover:text-gray-200"
              }`}
            >
              All Formats
            </button>
            <button
              onClick={() => setFilmFilter("Digital")}
              className={`px-3 py-1.5 rounded-sm transition-colors ${
                filmFilter === "Digital" ? "bg-surface-hover text-white font-medium" : "text-muted hover:text-gray-200"
              }`}
            >
              Digital
            </button>
            <button
              onClick={() => setFilmFilter("Film")}
              className={`px-3 py-1.5 rounded-sm transition-colors flex items-center space-x-1 ${
                filmFilter === "Film" ? "bg-surface-hover text-amber-300 font-medium" : "text-muted hover:text-gray-200"
              }`}
            >
              <Film className="w-3 h-3 text-amber-300" />
              <span>Analog Film</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`whitespace-nowrap px-3 py-1 rounded-full border transition-colors ${
              selectedCategory === "All"
                ? "bg-accent/20 border-accent text-accent font-medium"
                : "bg-black border-surface-border text-gray-400 hover:text-white"
            }`}
          >
            All Categories ({initialPhotos.length})
          </button>
          {categories.slice(0, 12).map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`whitespace-nowrap px-3 py-1 rounded-full border transition-colors ${
                selectedCategory === cat.name
                  ? "bg-accent/20 border-accent text-accent font-medium"
                  : "bg-black border-surface-border text-gray-400 hover:text-white"
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Showing <span className="text-white font-medium">{filteredPhotos.length}</span> photographs
        </span>
        {(searchQuery || selectedCategory !== "All" || filmFilter !== "All") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("All");
              setFilmFilter("All");
            }}
            className="text-accent hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Full Thumbnail Flex Gallery */}
      {filteredPhotos.length > 0 ? (
        <div className="flex flex-wrap gap-2 sm:gap-2.5 items-center justify-start">
          {filteredPhotos.map((photo) => (
            <PhotoCard key={photo.photoID} photo={photo} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-surface border border-surface-border rounded-sm space-y-3">
          <p className="text-gray-400 text-sm">No photographs found matching your criteria.</p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("All");
              setFilmFilter("All");
            }}
            className="text-accent text-xs underline"
          >
            Reset all filters
          </button>
        </div>
      )}
    </div>
  );
}
