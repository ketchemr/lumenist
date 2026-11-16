import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const photoID = url.searchParams.get("photoID") || url.searchParams.get("id");
  const category = url.searchParams.get("category");

  // Showimage or technical details
  if (photoID) {
    return NextResponse.redirect(new URL(`/photo/${photoID}`, request.url), 301);
  }

  // Gallery category
  if (category) {
    return NextResponse.redirect(
      new URL(`/galleries/${encodeURIComponent(category)}`, request.url),
      301
    );
  }

  // Gallery entry or general search
  if (url.pathname.includes("search")) {
    return NextResponse.redirect(new URL("/explore", request.url), 301);
  }

  if (url.pathname.includes("gallery")) {
    return NextResponse.redirect(new URL("/galleries", request.url), 301);
  }

  return NextResponse.redirect(new URL("/", request.url), 301);
}
