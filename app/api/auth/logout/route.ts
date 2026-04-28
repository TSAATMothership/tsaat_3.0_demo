import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  clearSessionCookie(response);
  return response;
}
