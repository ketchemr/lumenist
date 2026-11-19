import { NextRequest, NextResponse } from "next/server";
import { createShare } from "@/lib/shares";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = createShare(body);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid share payload" },
        { status: 400 }
      );
    }
    return NextResponse.json({ id });
  } catch {
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 }
    );
  }
}
