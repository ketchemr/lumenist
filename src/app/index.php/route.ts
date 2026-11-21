import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getBaseUrl(request: NextRequest): string {
  const configured = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    ""
  ).trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const host = (request.headers.get("host") || "").trim();
  const protoHeader = (request.headers.get("x-forwarded-proto") || "https")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const proto = protoHeader === "http" ? "http" : "https";

  if (
    host &&
    /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(host) &&
    !host.startsWith("localhost") &&
    !host.startsWith("127.0.0.1")
  ) {
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const search = url.search;
  const baseUrl = getBaseUrl(request);

  // 1. Category in query param or path query (e.g. ?category=Mountains or ?/category/Mountains)
  const catParam = url.searchParams.get("category");
  if (catParam) {
    return NextResponse.redirect(
      new URL(`/galleries/${encodeURIComponent(catParam)}`, baseUrl),
      301
    );
  }

  const catMatch = search.match(/\/category\/([^&/?]+)/i);
  if (catMatch && catMatch[1]) {
    try {
      const decoded = decodeURIComponent(catMatch[1]);
      return NextResponse.redirect(
        new URL(`/galleries/${encodeURIComponent(decoded)}`, baseUrl),
        301
      );
    } catch {
      return NextResponse.redirect(
        new URL(`/galleries/${catMatch[1]}`, baseUrl),
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
    return NextResponse.redirect(new URL(dest, baseUrl), 301);
  }

  // 3. Photo ID match
  const photoMatch = search.match(/(d\d{10,})/i);
  if (photoMatch) {
    return NextResponse.redirect(new URL(`/photo/${photoMatch[1]}`, baseUrl), 301);
  }

  // 4. Default: homepage
  return NextResponse.redirect(new URL("/", baseUrl), 301);
}
