import { NextResponse } from "next/server";
export function retiredFeatureResponse() {
  return NextResponse.json({ error: "This feature has been retired." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
