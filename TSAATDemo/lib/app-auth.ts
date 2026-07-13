import "server-only";

const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "demo123";
const DEMO_SESSION_VERSION = 1;

export interface AuthenticatedAppUser {
  username: string;
  sessionVersion: number;
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function demoUser(): AuthenticatedAppUser {
  return {
    username: DEMO_USERNAME,
    sessionVersion: DEMO_SESSION_VERSION
  };
}

export async function authenticateAppUser(
  usernameInput: string,
  password: string
): Promise<AuthenticatedAppUser | null> {
  if (normalizeUsername(usernameInput) !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
    return null;
  }

  return demoUser();
}

export async function loadActiveUserSession(usernameInput: string): Promise<AuthenticatedAppUser | null> {
  return normalizeUsername(usernameInput) === DEMO_USERNAME ? demoUser() : null;
}
