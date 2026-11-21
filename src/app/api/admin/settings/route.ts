import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSettings, saveSettings, SiteSettings } from "@/lib/settings";
import { isAuthenticatedAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = getSettings();
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  try {
    const isAuthed = await isAuthenticatedAdmin();
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const updated = saveSettings(body as Partial<SiteSettings>);

    try {
      revalidatePath("/", "layout");
    } catch (e) {
      console.warn("Settings revalidation warning:", e);
    }

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
