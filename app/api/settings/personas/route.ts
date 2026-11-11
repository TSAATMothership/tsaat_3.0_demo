import { NextResponse } from "next/server";
import { loadPersonaSettings } from "@/lib/data-loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try { return NextResponse.json({ settings: await loadPersonaSettings() }, { headers }); }
  catch { return NextResponse.json({ error: "Unable to load personas. Check storage availability and, for SQL, migration 031." }, { status: 500, headers }); }
}
export async function PUT() {
  return NextResponse.json({ error: "These settings are read-only." }, { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } });
}
