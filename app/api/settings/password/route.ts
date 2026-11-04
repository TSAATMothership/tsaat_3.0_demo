import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT() {
  return NextResponse.json({ error: "Application password settings have been retired." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
