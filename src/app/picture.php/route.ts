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

  // 1. Direct photoID param (e.g. ?photoID=d20031126003 or ?id=d20031126003)
  const photoIdParam = url.searchParams.get("photoID") || url.searchParams.get("id");
  if (photoIdParam && /^d[a-zA-Z0-9_-]+$/i.test(photoIdParam)) {
    return NextResponse.redirect(
      new URL(`/photo/${encodeURIComponent(photoIdParam)}`, baseUrl),
      301
    );
  }

  // 2. Query string containing photo ID pattern dYYYY... (e.g. ?/d20031126003 or ?d20031126003)
  const photoMatch = search.match(/(d\d{10,})/i);
  if (photoMatch) {
    return NextResponse.redirect(new URL(`/photo/${photoMatch[1]}`, baseUrl), 301);
  }

  // 3. Fallback to galleries catalog
  return NextResponse.redirect(new URL("/galleries", baseUrl), 301);
}
