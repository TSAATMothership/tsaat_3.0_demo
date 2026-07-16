const SESSION_KEY = "tsaat-demo-lite-session";
const SESSION_VERSION = 1;
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

interface PersistedSession {
  version: number;
  username: "demo";
  expiresAt: number;
}

let authenticated = false;
let sessionExpiresAt = 0;

function parsePersistedSession(rawValue: string | null, now = Date.now()): number {
  if (!rawValue) {
    return 0;
  }

  // Migrate the previous per-tab marker without asking an already signed-in
  // tab to authenticate again after upgrading the standalone HTML file.
  if (rawValue === "demo") {
    return now + SESSION_LIFETIME_MS;
  }

  try {
    const session = JSON.parse(rawValue) as Partial<PersistedSession>;
    if (
      session.version === SESSION_VERSION &&
      session.username === "demo" &&
      typeof session.expiresAt === "number" &&
      Number.isFinite(session.expiresAt) &&
      session.expiresAt > now
    ) {
      return session.expiresAt;
    }
  } catch {
    // Invalid browser state is treated as signed out and removed below.
  }

  return 0;
}

function applyPersistedSession(rawValue: string | null): boolean {
  sessionExpiresAt = parsePersistedSession(rawValue);
  authenticated = sessionExpiresAt > Date.now();
  return authenticated;
}

function persistSession(): void {
  const session: PersistedSession = {
    version: SESSION_VERSION,
    username: "demo",
    expiresAt: sessionExpiresAt
  };
  let sharedStorageAvailable = false;

  try {
    if (authenticated) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
    sharedStorageAvailable = true;
  } catch {
    // Some browsers restrict localStorage on file origins. Retain the previous
    // tab-local behavior as a fallback so the active document still works.
  }

  try {
    if (authenticated && !sharedStorageAvailable) {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Memory state remains available when all browser storage is restricted.
  }
}

export function isAuthenticated(): boolean {
  if (authenticated && sessionExpiresAt <= Date.now()) {
    authenticated = false;
    sessionExpiresAt = 0;
    persistSession();
  }
  return authenticated;
}

export function authenticate(username: unknown, password: unknown): boolean {
  authenticated = String(username ?? "").trim().toLowerCase() === "demo" && String(password ?? "") === "demo123";
  sessionExpiresAt = authenticated ? Date.now() + SESSION_LIFETIME_MS : 0;
  persistSession();
  return authenticated;
}

export function clearAuthentication(): void {
  authenticated = false;
  sessionExpiresAt = 0;
  persistSession();
}

function restoreAuthentication(): void {
  try {
    const sharedValue = window.localStorage.getItem(SESSION_KEY);
    if (applyPersistedSession(sharedValue)) {
      persistSession();
      return;
    }
    if (sharedValue !== null) {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Fall through to the tab-local compatibility marker.
  }

  try {
    if (applyPersistedSession(window.sessionStorage.getItem(SESSION_KEY))) {
      persistSession();
      return;
    }
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    authenticated = false;
    sessionExpiresAt = 0;
  }
}

restoreAuthentication();

window.addEventListener("storage", (event) => {
  if (event.key === SESSION_KEY) {
    applyPersistedSession(event.newValue);
  }
});
