import { NextRequest, NextResponse } from "next/server";
import { normalizeDatabaseSettingsPayload, testDatabaseConnection } from "@/lib/database-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = normalizeDatabaseSettingsPayload(await request.json());
    const result = await testDatabaseConnection(payload);
    const status = result.success ? 200 : 400;
    return NextResponse.json({ result }, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to test database connection.";
    return NextResponse.json(
      {
        result: {
          success: false,
          summary: "Database connection failed.",
          diagnostics: message
        }
      },
      { status: 400 }
    );
  }
}
