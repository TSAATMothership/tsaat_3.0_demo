# Deployment, release and recovery

## Release preparation

Choose an approved commit; run npm run install:offline, npm run check, npm run build:all and npm run test:nosql. The installer stops recognized app servers from this checkout before running guarded npm ci. Verify npm run offline:check and record an empty-cache install before release. Review CHANGELOG, SQL migration needs, affected APIs/reports and dependency advisories. Browser-check relevant scopes/dates and run SQL integration on a disposable database. The manual workflow_dispatch/full CI gate builds both artifacts and browser-tests No-SQL without provisioning SQL. Run it for the exact release commit; ordinary PR/push CI selects checks by impact and is not complete release evidence.

## Deployment

To deliver Node/npm with the application source, use [offline-package.ps1](offline-builds.md#package-nodejs-for-a-disconnected-machine) after release validation. Its ZIP includes source, npm archives and verified portable Node 24.13.1/npm 11.8.0, without compiled output or machine data. Transfer its SHA-256 sidecar too. The destination supplies Windows x64/PowerShell; run .\install-offline.cmd, then use .\tsaat-npm.cmd for builds and application commands. Node/npm need no separate provisioning for this distribution. Runtime binaries and generated packages remain outside Git.

Package the release source, complete vendor/npm archives/manifest, lockfile and compiled output through the organization's delivery process. An offline source delivery must include the actual archives, not links or Git LFS pointers. Install dependencies reproducibly with npm run install:offline (the preflight for npm ci --offline); host runtimes and compiled outputs belong outside Git. Run both builds on Windows with Node 24 and PowerShell. Compilation needs no SQL service, sqlcmd, database credentials or network. SQL runtime additionally needs sqlcmd and its configured database; configure SQLCMD_PATH when needed. Pre-provision Node/npm, Windows/PowerShell and Chrome/Edge for runtime/browser validation on disconnected hosts. See [offline build and upgrade procedures](offline-builds.md).

Provision DB_config for SQL only under the service identity; do not copy another identity's DPAPI file. Use a service manager and HTTPS reverse proxy in front of the matching start command. Pages and APIs, including settings and exports, no longer enforce application authentication. Deployment access controls are external to TSAAT.

Restrict configuration/database access. Apply separately reviewed migrations to the explicit database before switching traffic when required. Compilation does not seed a database.

For the current release, apply the [inventory v2 paired upgrade](feature-retirement.md) to explicitly selected, backed-up stores before switching traffic. Migration 033 removes retired analytics structures. Never use setup:database, base DDL or seed loaders as an upgrade. Keep the compatible old application and backup together for rollback.

## Smoke checks

Verify direct access without cookies, legacy-login redirects, both scope types, security domains, selected dates and empty results. Check all three Governance Insights, the five Discovery Explorers, the software Dashboard compatibility view and retained PDF/Excel downloads. Exercise CMDB keyboard opening/Escape/focus return and Topology layout/filter/selection/full-screen behavior. Settings has only read-only Personas and Discovery Tools; removed API routes return 410 and old pages explain retirement.

The compiled provider smoke uses matching history/scopes. Run test:nosql, then scripts/test-sql-evidence.mjs with TSAAT_EVIDENCE_PARITY_DATABASE explicitly selecting a disposable TSAAT_EvidenceParity_* database. A missing SQL run is not parity evidence. Test current and historical inventory, domain filtering, settings persistence after restart, downloads and browser errors. Record real provider integration results with the release.

## Observability and recovery

Retain process/application and migration logs in the deployment platform, excluding secrets and operational reports from Git. Enable existing performance/cache debug flags only when needed. Diagnose startup failures through Windows identity, DPAPI readability, SQL target/TLS and schema compatibility.

Keep the previous artifact and a tested database backup. Stop rollout on failed smoke checks. Restore the previous application when schema-compatible; otherwise follow the approved database recovery plan before returning traffic. Record incidents and regression tests. No automatic deployment or hosting controls are created by the local baseline.

## No-SQL deployment and recovery

Deploy the normal app with .next-nosql and use npm run start:nosql. Set TSAAT_JSON_DATA_DIR to a stable absolute path outside disposable release directories. Initial setup uses repository sample JSON only when no store exists; build/start never replaces existing data. No DB_config or SQL service is needed. Use the same deployment access and HTTPS controls as SQL. Do not distribute the removed Demo folder.

Back up the entire JSON data directory with the compatible release while app processes are stopped. Include snapshots, references, current settings and setting history. Review JSON schema/data upgrades alongside SQL migrations for every release. Incompatible versions must have an explicit migration and rollback procedure. Restore the previous compatible app and complete JSON backup together if needed.

A stale write lock after a crash requires stopping all writers, backing up and validating the store, and confirming no active PID owns the lock before removing it. Current settings files are authoritative if a revision exists without a successful current-file replacement. Full format, single-host limits and recovery details are in [data providers](data-providers.md).
