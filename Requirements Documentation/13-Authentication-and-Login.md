# Authentication and Login

**Page Paths:** `/login` and authenticated application routes

## 1. Overview
- **Purpose:** enforce application-wide sign-in before users can access TSAAT pages and protected APIs.
- **User outcome:** users log in with file-backed username/password credentials, can see who is logged in, can log out, and can change password from Settings.
- **Primary roles:** application administrators and authorized operators.

## 2. Scope
- First app load redirects unauthenticated users to `/login`.
- Login is handled by `POST /api/auth/login`.
- Session status is validated by `GET /api/auth/session`.
- Logout is handled by `POST /api/auth/logout`.
- Password changes are handled by `PUT /api/settings/password`.
- Middleware protects all app routes and APIs except auth endpoints and framework static paths.
- A client-side session guard rechecks authenticated pages after initial render so expired, cleared, or cross-tab invalidated sessions return to `/login`.

## 3. Credential Contract
- Credentials are stored in repository root `logindetails`, not in SQL Server.
- `compileApp.cmd` creates `logindetails` when missing and recreates it when the existing file cannot be decrypted/validated by the current Windows identity.
- Interactive compile prompts for non-empty credentials; unattended compile requires both `TSAAT_LOGIN_USERNAME` and `TSAAT_LOGIN_PASSWORD`.
- `logindetails` is a DPAPI `CurrentUser` encrypted JSON envelope:
  - `format = tsaat-logindetails`
  - `keyProvider = dpapi-current-user`
  - `algorithm = dpapi`
  - encrypted payload contains username, PBKDF2-HMAC-SHA256 password hash, salt, iteration count, timestamps, and `sessionVersion`.
- Password storage is salted one-way hash material:
  - `hashAlgorithm = PBKDF2-HMAC-SHA256`
  - per-file random password salt
  - iteration count defaults to 210000 and must be at least 100000.
- Session invalidation uses `sessionVersion` from `logindetails`; password changes increment it and old cookies stop matching.
- Auth API responses set `Cache-Control: no-store`.

## 4. Security Rules
- Plaintext application login passwords are never persisted to SQL tables or plaintext files.
- `logindetails` is ignored by git and must be generated locally.
- The Windows user that creates `logindetails` must be the user that runs/decrypts it because DPAPI scope is `CurrentUser`.
- If a copied `logindetails` cannot be decrypted, compile-time recreation sets a new application login credential because the old password hash material cannot be recovered.
- API responses and diagnostics never return plaintext passwords or hashes.
- Session cookie is HTTP-only and same-site `lax`.
- Direct protected page requests without a valid session redirect to `/login?next=<path>`.
- Direct protected API requests without a valid session return `401`.
- Authenticated visits to `/login` redirect to a safe `next` path or `/cyber-cop`.
- Password change requires current password verification.
- Successful password change clears the current cookie and requires re-login.
- Logout clears the session cookie, broadcasts logout to other open tabs, and uses replace-style navigation to `/login`.

## 5. UI Behaviour
- `/login` shows username/password form and validates credentials against encrypted `logindetails`.
- Authenticated header shows signed-in username.
- Navigation includes logout action.
- Authenticated pages call `/api/auth/session` with `no-store` on load, route changes, browser focus/visibility return, and logout broadcasts.
- Settings includes `Password Settings` tab with current/new/confirm fields.

## 6. Dependencies
- `compileApp.cmd`
- `scripts/ensure-logindetails.ps1`
- `scripts/invoke-dpapi.ps1`
- `lib/login-details.ts`
- `lib/app-auth.ts`
- `lib/auth-password.ts`
- `lib/auth-session.ts`
- `lib/auth-session-token.ts`
- `lib/auth-redirect.ts`
- `lib/auth-client-events.ts`
- `app/api/auth/*`
- `app/api/settings/password/route.ts`
- `middleware.ts`
- `components/authenticated-session-guard.tsx`
- `components/login-panel.tsx`
- `components/menu-navigation.tsx`
- `components/password-settings-panel.tsx`
