import "server-only";

import { createHash } from "crypto";
import os from "os";
import { NextRequest, NextResponse } from "next/server";
import { AuthenticatedAppUser, loadActiveUserSession } from "@/lib/app-auth";
import {
  AUTH_SESSION_COOKIE_NAME,
  buildSessionPayload,
  createSignedSessionToken,
  verifySignedSessionToken
} from "@/lib/auth-session-token";

const DEFAULT_SESSION_HOURS = 12;
const MAX_SESSION_HOURS = 168;

function resolveSessionDurationSeconds(): number {
  const raw = process.env.TSAAT_AUTH_SESSION_HOURS;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_SESSION_HOURS) {
    return parsed * 60 * 60;
  }

  return DEFAULT_SESSION_HOURS * 60 * 60;
}

function resolveSessionSecret(): string {
  const explicit = (process.env.TSAAT_AUTH_SESSION_SECRET ?? "").trim();
  if (explicit) {
    if (explicit.length < 32) {
      throw new Error("TSAAT_AUTH_SESSION_SECRET must be at least 32 characters.");
    }
    return explicit;
  }

  return createHash("sha256")
    .update(`${os.hostname()}|${process.cwd()}|TSAAT_AUTH_SESSION_SECRET_V1`)
    .digest("hex");
}

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds
  };
}

export async function createSessionTokenForUser(user: AuthenticatedAppUser): Promise<string> {
  const durationSeconds = resolveSessionDurationSeconds();
  const payload = buildSessionPayload({
    username: user.username,
    sessionVersion: user.sessionVersion,
    nowEpochSeconds: nowEpochSeconds(),
    lifetimeSeconds: durationSeconds
  });

  return createSignedSessionToken(payload, resolveSessionSecret());
}

export function writeSessionCookie(response: NextResponse, token: string): void {
  const durationSeconds = resolveSessionDurationSeconds();
  response.cookies.set(AUTH_SESSION_COOKIE_NAME, token, sessionCookieOptions(durationSeconds));
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(AUTH_SESSION_COOKIE_NAME, "", sessionCookieOptions(0));
}

export async function resolveAuthenticatedSessionFromToken(token: string | null | undefined): Promise<AuthenticatedAppUser | null> {
  if (!token) {
    return null;
  }

  const payload = await verifySignedSessionToken(token, resolveSessionSecret(), nowEpochSeconds());
  if (!payload) {
    return null;
  }

  const user = await loadActiveUserSession(payload.sub);
  if (!user) {
    return null;
  }

  if (user.sessionVersion !== payload.sv) {
    return null;
  }

  return user;
}

export async function resolveAuthenticatedSessionFromRequest(
  request: Pick<NextRequest, "cookies">
): Promise<AuthenticatedAppUser | null> {
  const token = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value ?? null;
  return resolveAuthenticatedSessionFromToken(token);
}
