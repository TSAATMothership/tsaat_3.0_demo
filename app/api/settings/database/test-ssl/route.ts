import { NextRequest, NextResponse } from "next/server";
import { normalizeDatabaseSettingsPayload, testDatabaseConnection, testDatabaseSsl } from "@/lib/database-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = normalizeDatabaseSettingsPayload(await request.json());
    if (!payload.sslEnabled) {
      return NextResponse.json(
        {
          result: {
            success: true,
            summary: "SSL test skipped (SSL disabled).",
            diagnostics: "SSL test skipped because SSL is disabled in settings."
          }
        },
        { status: 200 }
      );
    }

    const connectionResult = await testDatabaseConnection(payload);
    if (!connectionResult.success) {
      return NextResponse.json(
        {
          result: {
            success: false,
            summary: "SSL test failed.",
            diagnostics: `${connectionResult.diagnostics}\n\nRun a successful connection test first.`
          },
          connectionResult
        },
        { status: 400 }
      );
    }

    const result = await testDatabaseSsl(payload);
    const status = result.success ? 200 : 400;
    return NextResponse.json({ result, connectionResult }, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to test database SSL settings.";
    return NextResponse.json(
      {
        result: {
          success: false,
          summary: "SSL test failed.",
          diagnostics: message
        }
      },
      { status: 400 }
    );
  }
}
