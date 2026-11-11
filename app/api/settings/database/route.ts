import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Database Settings is no longer available in the application." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}

export async function PUT() {
  return NextResponse.json({ error: "Database Settings is no longer available in the application." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
