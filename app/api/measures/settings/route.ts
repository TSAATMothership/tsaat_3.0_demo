import { NextRequest, NextResponse } from "next/server";
import { loadMeasuresSettings, saveMeasuresSettings, loadSpiDefinitions, loadSeverityDefinitions, loadFindingPriorityDefinitions } from "@/lib/data-loader";

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
