import { NextRequest, NextResponse } from "next/server";
import { resolveAuthenticatedSessionFromRequest } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const user = await resolveAuthenticatedSessionFromRequest(request);
  if (!user) {
    return noStore(NextResponse.json({ authenticated: false }));
  }

  return noStore(NextResponse.json({
    authenticated: true,
    username: user.username
  }));
}
