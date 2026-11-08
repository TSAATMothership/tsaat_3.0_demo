import { NextRequest, NextResponse } from "next/server";
import { loadPersonaSettings, savePersonaSettings } from "@/lib/data-loader";
import { PersonaConflictError, PersonaValidationError, parsePersonaSettings } from "@/lib/personas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try { return NextResponse.json({ settings: await loadPersonaSettings() }, { headers }); }
  catch { return NextResponse.json({ error: "Unable to load personas. Check storage availability and, for SQL, migration 031." }, { status: 500, headers }); }
}
export async function PUT(request: NextRequest) {
  let settings;
  try { settings = parsePersonaSettings(await request.json(), { forWrite: true }); }
  catch (error) {
    return NextResponse.json({ error: error instanceof PersonaValidationError ? error.message : "Invalid persona settings JSON." }, { status: 400, headers });
  }
  try { return NextResponse.json({ settings: await savePersonaSettings(settings) }, { headers }); }
  catch (error) {
    if (error instanceof PersonaConflictError) return NextResponse.json({ error: error.message }, { status: 409, headers });
    return NextResponse.json({ error: "Unable to save personas. Check storage availability and, for SQL, migration 031, then retry." }, { status: 500, headers });
  }
}
