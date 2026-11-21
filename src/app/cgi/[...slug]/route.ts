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
  const photoID = url.searchParams.get("photoID") || url.searchParams.get("id");
  const category = url.searchParams.get("category");
  const baseUrl = getBaseUrl(request);

  // Showimage or technical details
  if (photoID) {
    return NextResponse.redirect(
      new URL(`/photo/${encodeURIComponent(photoID)}`, baseUrl),
      301
    );
  }

  // Gallery category
  if (category) {
    return NextResponse.redirect(
      new URL(`/galleries/${encodeURIComponent(category)}`, baseUrl),
      301
    );
  }

  // Gallery entry or general search
  if (url.pathname.includes("search")) {
    return NextResponse.redirect(new URL("/explore", baseUrl), 301);
  }

  if (url.pathname.includes("gallery")) {
    return NextResponse.redirect(new URL("/galleries", baseUrl), 301);
  }

  return NextResponse.redirect(new URL("/", baseUrl), 301);
}
