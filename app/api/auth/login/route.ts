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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = readCredentialField((body as Record<string, unknown>)?.username);
    const password = readCredentialField((body as Record<string, unknown>)?.password);

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const user = await authenticateAppUser(username, password);
    if (!user) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const token = await createSessionTokenForUser(user);
    const response = NextResponse.json({
      authenticated: true,
      username: user.username
    });
    writeSessionCookie(response, token);
    return response;
  } catch {
    return NextResponse.json({ error: "Login request is invalid." }, { status: 400 });
  }
}
