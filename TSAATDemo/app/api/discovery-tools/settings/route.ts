import { NextRequest, NextResponse } from "next/server";
import { loadDiscoveryToolsSettings, saveDiscoveryToolsSettings } from "@/lib/data-loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const settings = await loadDiscoveryToolsSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await request.json();
    const settings = await saveDiscoveryToolsSettings(payload);
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save discovery tools settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

