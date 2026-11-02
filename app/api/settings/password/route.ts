import { NextRequest, NextResponse } from "next/server";
import { changeAppUserPassword } from "@/lib/app-auth";
import { clearSessionCookie, resolveAuthenticatedSessionFromRequest } from "@/lib/auth-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readField(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export async function PUT(request: NextRequest) {
  const session = await resolveAuthenticatedSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const currentPassword = readField((body as Record<string, unknown>)?.currentPassword);
    const newPassword = readField((body as Record<string, unknown>)?.newPassword);
    const confirmPassword = readField((body as Record<string, unknown>)?.confirmPassword);

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: "Current, new, and confirm password fields are required." }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New password and confirm password must match." }, { status: 400 });
    }

    const updated = await changeAppUserPassword(session.username, currentPassword, newPassword);
    if (!updated) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      requiresReauthentication: true
    });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
