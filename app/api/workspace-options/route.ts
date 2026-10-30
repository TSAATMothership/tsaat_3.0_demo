import { NextRequest, NextResponse } from "next/server";
import { loadDatasetForDate } from "@/lib/data-loader";
import { normalizeDataDate } from "@/lib/data-date";
import { buildFilterOptions } from "@/lib/selectors";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const dataset = await loadDatasetForDate(normalizeDataDate(request.nextUrl.searchParams.get("dataDate")), { profile: "summary" });
    const { networks, systems } = buildFilterOptions(dataset.managedNetworks, dataset.ictSystems);
    const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);
    return NextResponse.json({ networks: networks.sort(byLabel), systems: systems.sort(byLabel) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load workspace options." }, { status: 503 });
  }
}
