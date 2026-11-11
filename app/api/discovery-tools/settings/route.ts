import { NextResponse } from "next/server";
import { loadDiscoveryToolsSettings } from "@/lib/data-loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const settings = await loadDiscoveryToolsSettings();
  return NextResponse.json({ settings });
}

export async function PUT() {
  return NextResponse.json({ error: "These settings are read-only." }, { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } });
}
