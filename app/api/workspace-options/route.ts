import { NextRequest, NextResponse } from "next/server";
import { loadWorkspaceFilterOptionsForDate } from "@/lib/data-loader";
import { normalizeDataDate } from "@/lib/data-date";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const options = await loadWorkspaceFilterOptionsForDate(normalizeDataDate(request.nextUrl.searchParams.get("dataDate")));
    return NextResponse.json(options, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load workspace options." }, { status: 503 });
  }
}
