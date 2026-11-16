import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getBaseUrl(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    return `${proto}://${host}`;
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://rrkphoto.com"
  ).replace(/\/+$/, "");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const search = url.search;
  const baseUrl = getBaseUrl(request);

  // 1. Direct photoID param (e.g. ?photoID=d20031126003 or ?id=d20031126003)
  const photoIdParam = url.searchParams.get("photoID") || url.searchParams.get("id");
  if (photoIdParam && photoIdParam.startsWith("d")) {
    return NextResponse.redirect(new URL(`/photo/${photoIdParam}`, baseUrl), 301);
  }

  // 2. Query string containing photo ID pattern dYYYY... (e.g. ?/d20031126003 or ?d20031126003)
  const photoMatch = search.match(/(d\d{10,})/i);
  if (photoMatch) {
    return NextResponse.redirect(new URL(`/photo/${photoMatch[1]}`, baseUrl), 301);
  }

  // 3. Fallback to galleries catalog
  return NextResponse.redirect(new URL("/galleries", baseUrl), 301);
}
