import { NextResponse } from "next/server";
import { loadMeasuresSettings, loadSpiDefinitions, loadSeverityDefinitions, loadFindingPriorityDefinitions } from "@/lib/data-loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const [spiDefinitions, severityDefinitions, priorityDefinitions] = await Promise.all([
      loadSpiDefinitions(), loadSeverityDefinitions(), loadFindingPriorityDefinitions()
    ]);
    const settings = await loadMeasuresSettings(spiDefinitions, severityDefinitions, priorityDefinitions);
    return NextResponse.json({ settings, spiDefinitions: spiDefinitions.map(({ spiId, description }) => ({ spiId, description })), severityDefinitions, priorityDefinitions });
  } catch {
    return NextResponse.json({ error: "Unable to load SPI risk matrix settings." }, { status: 503 });
  }
}

export async function PUT() {
  return NextResponse.json({ error: "These settings are read-only." }, { status: 405, headers: { Allow: "GET", "Cache-Control": "no-store" } });
}
