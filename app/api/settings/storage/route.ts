import { NextResponse } from "next/server";
import { IS_JSON_BUILD } from "@/lib/data-provider-mode";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  if (!IS_JSON_BUILD) return NextResponse.json({ provider: "sql" });
  try {
    const { jsonStoreDirectory, loadStoreManifest } = await import("@/lib/json-store/files");
    const manifest = await loadStoreManifest();
    return NextResponse.json({ provider: "json", directory: jsonStoreDirectory(), snapshots: manifest.snapshots });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read JSON store." }, { status: 503 }); }
}
