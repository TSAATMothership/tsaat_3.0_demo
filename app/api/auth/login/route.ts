import { NextRequest, NextResponse } from "next/server";
import { authenticateAppUser } from "@/lib/app-auth";
import { createSessionTokenForUser, writeSessionCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readCredentialField(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = readCredentialField((body as Record<string, unknown>)?.username);
    const password = readCredentialField((body as Record<string, unknown>)?.password);

    if (!username || !password) {
      return noStore(NextResponse.json({ error: "Username and password are required." }, { status: 400 }));
    }

    const user = await authenticateAppUser(username, password);
    if (!user) {
      return noStore(NextResponse.json({ error: "Invalid username or password." }, { status: 401 }));
    }

    const token = await createSessionTokenForUser(user);
    const response = noStore(NextResponse.json({
      authenticated: true,
      username: user.username
    }));
    writeSessionCookie(response, token);
    return response;
  } catch {
    return noStore(NextResponse.json({ error: "Login request is invalid." }, { status: 400 }));
  }
}
