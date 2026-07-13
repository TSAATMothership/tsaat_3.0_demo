import { NextRequest, NextResponse } from "next/server";
import { loadMeasuresSettings, saveMeasuresSettings } from "@/lib/data-loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const settings = await loadMeasuresSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await request.json();
    const settings = await saveMeasuresSettings(payload);
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save measures settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
