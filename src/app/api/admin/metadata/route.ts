import { NextResponse } from "next/server";
import { getAllPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

export async function GET() {
  const photos = getAllPhotos();

  // Aggregate alphabetical albums / categories
  const categorySet = new Set<string>();
  const tagCounts: Record<string, number> = {};
  const tripodSet = new Set<string>();

  for (const p of photos) {
    for (const c of p.categories || []) {
      const trimmed = c.trim();
      if (trimmed && trimmed.toLowerCase() !== "all") {
        categorySet.add(trimmed);
      }
    }

    for (const k of p.keywords || []) {
      const trimmed = k.trim();
      if (trimmed) {
        tagCounts[trimmed] = (tagCounts[trimmed] || 0) + 1;
      }
    }

    if (p.tripod) {
      const trimmed = p.tripod.trim();
      if (trimmed && trimmed.toLowerCase() !== "none" && trimmed.toLowerCase() !== "handheld") {
        tripodSet.add(trimmed);
      }
    }
  }

  // Sorted albums strictly A-Z
  const albums = Array.from(categorySet).sort((a, b) => a.localeCompare(b));

  // Top tags sorted by usage count descending
  const popularTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([tag, count]) => ({ tag, count }));

  // All tags sorted alphabetically for autocomplete
  const allTags = Object.keys(tagCounts).sort((a, b) => a.localeCompare(b));

  // Common tripods
  const commonTripods = [
    "Handheld / None",
    "Manfrotto Befree GT XPRO Carbon, 496 ball head",
    "Gitzo GT3542XLS, Really Right Stuff BH-55",
    "Gitzo G1228, Arca-Swiss Monoball",
    ...Array.from(tripodSet).filter(
      (t) =>
        !t.includes("Manfrotto Befree GT XPRO") &&
        !t.includes("Gitzo GT3542XLS") &&
        !t.includes("Gitzo G1228")
    ),
  ];

  return NextResponse.json({
    albums,
    popularTags,
    allTags,
    commonTripods,
  });
}
