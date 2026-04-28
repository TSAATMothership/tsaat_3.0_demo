import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedSessionFromRequest } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await resolveAuthenticatedSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    username: user.username
  });
}
