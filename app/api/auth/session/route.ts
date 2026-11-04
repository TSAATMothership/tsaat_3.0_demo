import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ authenticationRequired: false, authenticated: false }, { headers: { "Cache-Control": "no-store" } });
}
