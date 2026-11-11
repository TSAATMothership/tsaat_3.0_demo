# ADR 0014: Retire application login

Date: 2026-11-04. Status: accepted.

The user requested removal of user logon and the Signed in header section, then explicitly approved removing authentication from both pages and APIs with the resulting access behavior explained.

Remove the application middleware gate, client session polling, credential/token implementation, login form, Logout action, Password Settings and setup:login command. Both SQL and JSON builds open directly. Anyone able to reach the app can use data, reports and settings APIs. Any deployment access restriction is provided outside the application.

Keep compatibility routes without processing credentials: /login redirects to a validated local next destination or /; login/password API writes return 410; the session endpoint reports that authentication is not required without inventing a user; logout only expires the obsolete cookie. Old password-settings bookmarks open the storage settings tab.

SQL DB_config encryption, database credentials, strict TLS, input validation, header scope, snapshot selection and provider operations are unchanged. No SQL or JSON migration is required. Published auth migrations remain historical records. Existing local logindetails files are not read, overwritten or deleted, and remain excluded from Git.

Validation covers safe legacy redirects, retired endpoints, pages/APIs without cookies, settings/report operations, absence of account controls/session polling, both compilation paths and the credential-free compiled No-SQL smoke. Offline installation and dependency integrity remain supported.
