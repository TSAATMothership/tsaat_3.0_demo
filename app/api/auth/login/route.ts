import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Credentials are no longer accepted or processed. */
export async function POST() {
  return NextResponse.json({ authenticationRequired: false, error: "Application login has been retired. Open the workspace directly." },
    { status: 410, headers: { "Cache-Control": "no-store" } });
}
