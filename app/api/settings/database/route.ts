import { NextRequest, NextResponse } from "next/server";
import {
  loadDatabaseSettingsDefaults,
  normalizeDatabaseSettingsPayloadForProcessing,
  saveDatabaseSettings,
  testDatabaseConnection,
  testDatabaseSsl,
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
    const payload = await normalizeDatabaseSettingsPayloadForProcessing(await request.json());
    const connectionResult = await testDatabaseConnection(payload);
    const sslResult = connectionResult.success && payload.sslEnabled ? await testDatabaseSsl(payload) : null;
    const schemaResult =
      connectionResult.success && (!payload.sslEnabled || sslResult?.success) ? await testDatabaseSchema(payload) : null;

    if (!connectionResult.success || (payload.sslEnabled && !sslResult?.success) || !schemaResult?.success) {
      return NextResponse.json(
        {
          error:
            payload.sslEnabled
              ? "Cannot save database settings until connection, SSL, and schema validation all pass."
              : "Cannot save database settings until connection and schema validation both pass.",
          connectionResult,
          sslResult,
          schemaResult
        },
        { status: 400 }
      );
    }

    await saveDatabaseSettings(payload);
    const settings = await loadDatabaseSettingsDefaults();

    return NextResponse.json({
      settings,
      connectionResult,
      sslResult,
      schemaResult
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save database settings.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
