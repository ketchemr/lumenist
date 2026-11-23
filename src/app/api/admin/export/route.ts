import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAuthenticatedAdmin } from "@/lib/auth";
import { Photo } from "@/types/photo";
import { catalogToCsv } from "@/lib/bulkImport";

export async function GET(req: NextRequest) {
  const isAuthed = await isAuthenticatedAdmin();
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = (req.nextUrl.searchParams.get("format") || "json")
    .trim()
    .toLowerCase();

  const catalogPath = path.join(process.cwd(), "data", "photos.json");
  let catalog: Photo[] = [];
  if (fs.existsSync(catalogPath)) {
    try {
      catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
    } catch {
      catalog = [];
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const csv = catalogToCsv(catalog);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lumenist-catalog-${stamp}.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(catalog, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="lumenist-catalog-${stamp}.json"`,
    },
  });
}
