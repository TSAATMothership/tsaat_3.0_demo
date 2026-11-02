# Authentication and login

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

Protected pages/APIs require a valid signed TSAAT session. Unauthenticated page navigation redirects to login and protected API access returns an authentication failure. Logout clears the cookie and communicates sign-out to other tabs; expiry, password rotation and invalidation are checked while the app is open.

Application credentials are file-backed in local logindetails, separate from SQL connection settings. The file uses Windows DPAPI and salted PBKDF2 password metadata; plaintext passwords are not committed. The SQL build separately encrypts DB_config; the No-SQL build has no SQL configuration and retains the same logindetails and session/password controls. Setup/recreation occurs under the Windows identity that will run the app. Unattended provisioning uses supported environment values, never repository secrets.

The current system is a single application-login/session design, not an enterprise identity provider or role-based user-management service. Production session cookies require HTTPS. Authentication, password rotation, redirects, logout, cross-tab notifications and session validation must remain consistent across pages and APIs.

Sources: middleware.ts, app/login/page.tsx, app/api/auth, lib/auth-*.ts, login-details.ts, db-config.ts and scripts/invoke-dpapi.ps1. Tests: auth route/session/token/redirect/middleware suites, login-details, ensure-logindetails-script and password-settings-route. These native Windows tests use isolated temporary files and must not touch deployment credentials.
