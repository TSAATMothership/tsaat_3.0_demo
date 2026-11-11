# Application access and retired login

Current contract: 2026-11-04. See [ADR 0014](../docs/adr/0014-retire-application-login.md) and [SDLC](../docs/sdlc.md).

SQL and No-SQL pages and APIs open directly without application credentials or a session cookie. This includes data, reports and settings operations. Any deployment access restriction is external to the app. The Signed in section, Logout button, login form, session polling and Password Settings are removed. Header scope, security domains, date selection and Settings remain available.

Existing /login bookmarks redirect to the validated local next URL or the workspace root. Redirects reject external URLs, control characters, backslashes, encoded redirect escapes and login loops while retaining valid scope/date query parameters. POST /api/auth/login and PUT /api/settings/password return 410 without reading credentials. GET /api/auth/session returns authenticationRequired=false and authenticated=false, with no username or new cookie. POST /api/auth/logout only clears an obsolete session cookie. Compatibility responses remain dynamic/no-store. Old password-settings links fall back to storage settings.

setup:login and credential provisioning are retired. Existing logindetails files are unused and are not modified or deleted by this change; keep them outside Git. SQL connection credentials, encrypted DB_config and Windows DPAPI remain separate from application access. SQL TLS defaults and complete database setup follow [the database lifecycle](../docs/database.md#one-command-database-setup). No SQL/JSON data structures or calculations change, and published migrations remain intact.

Sources: app/login/page.tsx, app/api/auth, app/api/settings/password, lib/auth-redirect.ts, components/menu-navigation.tsx and settings components. Tests: auth-retirement, dynamic-route-cache-policy, workspace-scope and the compiled No-SQL smoke without cookies or logindetails.
