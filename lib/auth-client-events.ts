export const AUTH_CLIENT_EVENT_STORAGE_KEY = "tsaat:auth:event";
export const AUTH_CLIENT_LOGOUT_EVENT = "logout";

export function broadcastLogoutEvent(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      AUTH_CLIENT_EVENT_STORAGE_KEY,
      JSON.stringify({
        type: AUTH_CLIENT_LOGOUT_EVENT,
        at: Date.now()
      })
    );
  } catch {
    // Cross-tab logout broadcast is best effort. The active tab still redirects.
  }
}

export function isLogoutStorageEvent(event: StorageEvent): boolean {
  if (event.key !== AUTH_CLIENT_EVENT_STORAGE_KEY || !event.newValue) {
    return false;
  }

  try {
    const parsed = JSON.parse(event.newValue) as { type?: unknown };
    return parsed.type === AUTH_CLIENT_LOGOUT_EVENT;
  } catch {
    return false;
  }
}
