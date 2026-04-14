import { NextRequest, NextResponse } from "next/server";
import {
  loadDatabaseSettingsDefaults,
  normalizeDatabaseSettingsPayload,
  saveDatabaseSettings,
  testDatabaseConnection,
  testDatabaseSchema
} from "@/lib/database-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const settings = await loadDatabaseSettingsDefaults();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  try {
    const payload = normalizeDatabaseSettingsPayload(await request.json());
    const connectionResult = await testDatabaseConnection(payload);
    const schemaResult = connectionResult.success ? await testDatabaseSchema(payload) : null;

    if (!connectionResult.success || !schemaResult?.success) {
      return NextResponse.json(
        {
          error: "Cannot save database settings until connection and schema validation both pass.",
          connectionResult,
          schemaResult
        },
        { status: 400 }
      );
    }

    const connectionString = await saveDatabaseSettings(payload);
    const settings = await loadDatabaseSettingsDefaults();

    return NextResponse.json({
      settings,
      connectionString,
      connectionResult,
      schemaResult
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save database settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
