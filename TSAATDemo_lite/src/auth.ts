const SESSION_KEY = "tsaat-demo-lite-session";
let authenticated = false;

try {
  authenticated = window.sessionStorage.getItem(SESSION_KEY) === "demo";
} catch {
  authenticated = false;
}

function persistSession(): void {
  try {
    if (authenticated) {
      window.sessionStorage.setItem(SESSION_KEY, "demo");
    } else {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Some browsers restrict storage on file origins; memory state remains valid for this open document.
  }
}

export function isAuthenticated(): boolean {
  return authenticated;
}

export function authenticate(username: unknown, password: unknown): boolean {
  authenticated = String(username ?? "").trim().toLowerCase() === "demo" && String(password ?? "") === "demo123";
  persistSession();
  return authenticated;
}

export function clearAuthentication(): void {
  authenticated = false;
  persistSession();
}
