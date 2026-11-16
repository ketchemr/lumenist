import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const search = url.search;

  // 1. Category in query param or path query (e.g. ?category=Mountains or ?/category/Mountains)
  const catParam = url.searchParams.get("category");
  if (catParam) {
    return NextResponse.redirect(
      new URL(`/galleries/${encodeURIComponent(catParam)}`, request.url),
      301
    );
  }

  const catMatch = search.match(/\/category\/([^&/?]+)/i);
  if (catMatch && catMatch[1]) {
    try {
      const decoded = decodeURIComponent(catMatch[1]);
      return NextResponse.redirect(
        new URL(`/galleries/${encodeURIComponent(decoded)}`, request.url),
        301
      );
    } catch {
      return NextResponse.redirect(
        new URL(`/galleries/${catMatch[1]}`, request.url),
        301
      );
    }
  }

  // 2. Tag or search in query string
  if (
    url.searchParams.has("tag") ||
    url.searchParams.has("q") ||
    url.searchParams.has("search") ||
    search.includes("/tags/") ||
    search.includes("/search/")
  ) {
    const tag = url.searchParams.get("tag") || url.searchParams.get("q") || "";
    const dest = tag ? `/explore?tag=${encodeURIComponent(tag)}` : "/explore";
    return NextResponse.redirect(new URL(dest, request.url), 301);
  }

  // 3. Photo ID match
  const photoMatch = search.match(/(d\d{10,})/i);
  if (photoMatch) {
    return NextResponse.redirect(new URL(`/photo/${photoMatch[1]}`, request.url), 301);
  }

  // 4. Default: homepage
  return NextResponse.redirect(new URL("/", request.url), 301);
}
