# Authentication and Login

**Page Paths:** `/login` and authenticated application routes

## 1. Overview
- **Purpose:** enforce application-wide sign-in before users can access TSAAT pages and protected APIs.
- **User outcome:** users must log in with username/password, can see who is logged in, can log out, and can change password from Settings.
- **Primary roles:** application administrators and authorized operators.

## 2. Scope
- First app load redirects unauthenticated users to `/login`.
- Login is handled by `POST /api/auth/login`.
- Session status is validated by `GET /api/auth/session`.
- Logout is handled by `POST /api/auth/logout`.
- Password changes are handled by `PUT /api/settings/password`.
- Middleware protects all app routes and APIs except auth endpoints and framework static paths.

## 3. Data Model Contract
- Credentials are stored in `tsaat.app_user`.
- Password storage is salted one-way hash:
  - `hash_algorithm = PBKDF2-HMAC-SHA256`
  - per-user random `password_salt`
  - configurable `iteration_count` (minimum enforced at schema/check level)
- Session invalidation uses `session_version`:
  - incremented on password change
  - cookie payload must match current database `session_version`
- Initial seeded user:
  - username: `tsaatuser`
  - password seed: `tsaatuser123` (stored as salted hash only, never plaintext in DB)

## 4. Security Rules
- Plaintext passwords are never persisted to disk or SQL tables.
- API responses and diagnostics never return plaintext passwords or hashes.
- Session cookie is HTTP-only and same-site `lax`.
- Password change requires current password verification.
- Successful password change clears the current cookie and requires re-login.

## 5. UI Behaviour
- `/login` shows username/password form and validates credentials against SQL-backed user data.
- Authenticated header shows signed-in username.
- Navigation includes logout action.
- Settings includes `Password Settings` tab with current/new/confirm fields.

## 6. Dependencies
- `middleware.ts`
- `lib/app-auth.ts`
- `lib/auth-password.ts`
- `lib/auth-session.ts`
- `lib/auth-session-token.ts`
- `app/api/auth/*`
- `app/api/settings/password/route.ts`
- `components/login-panel.tsx`
- `components/menu-navigation.tsx`
- `components/password-settings-panel.tsx`
