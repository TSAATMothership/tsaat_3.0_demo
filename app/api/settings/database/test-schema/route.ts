import { IS_JSON_BUILD } from "@/lib/data-provider-mode";
import { NextRequest, NextResponse } from "next/server";
import {
  normalizeDatabaseSettingsPayloadForProcessing,
  testDatabaseConnection,
  testDatabaseSchema
} from "@/lib/database-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (IS_JSON_BUILD) return NextResponse.json({ error: "SQL configuration is unavailable in the No-SQL build." }, { status: 409 });
  try {
    const payload = await normalizeDatabaseSettingsPayloadForProcessing(await request.json());
    const connectionResult = await testDatabaseConnection(payload);
    if (!connectionResult.success) {
      return NextResponse.json(
        {
          result: {
            success: false,
            summary: "Schema validation failed.",
            diagnostics: `${connectionResult.diagnostics}\n\nRun a successful connection test first.`
          },
          connectionResult
        },
        { status: 400 }
      );
    }

    const result = await testDatabaseSchema(payload);
    const status = result.success ? 200 : 400;
    return NextResponse.json({ result, connectionResult }, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to test database schema.";
    return NextResponse.json(
      {
        result: {
          success: false,
          summary: "Schema validation failed.",
          diagnostics: message
        }
      },
      { status: 400 }
    );
  }
}
