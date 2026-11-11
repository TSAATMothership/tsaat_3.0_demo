import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Old clients may discard their legacy cookie; no application session is created. */
export async function POST() {
  const response = NextResponse.json({ authenticationRequired: false, authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set("tsaat_session", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
