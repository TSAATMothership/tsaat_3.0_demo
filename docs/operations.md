# Deployment, release and recovery

## Release preparation

Choose an approved commit; run npm run install:offline, npm run check, npm run build:all and npm run test:nosql. The installer stops recognized app servers from this checkout before running guarded npm ci. Verify npm run offline:check and record an empty-cache install before release. Review CHANGELOG, SQL migration needs, affected APIs/reports and dependency advisories. Browser-check relevant scopes/dates and run SQL integration on a disposable database. The manual workflow_dispatch/full CI gate builds both artifacts and browser-tests No-SQL without provisioning SQL. Run it for the exact release commit; ordinary PR/push CI selects checks by impact and is not complete release evidence.

## Deployment

To deliver Node/npm with the application source, use [offline-package.ps1](offline-builds.md#package-nodejs-for-a-disconnected-machine) after release validation. Its ZIP includes source, npm archives and verified portable Node 24.13.1/npm 11.8.0, without compiled output or machine data. Transfer its SHA-256 sidecar too. The destination supplies Windows x64/PowerShell; run .\install-offline.cmd, then use .\tsaat-npm.cmd for builds and application commands. Node/npm need no separate provisioning for this distribution. Runtime binaries and generated packages remain outside Git.

Package the release source, complete vendor/npm archives/manifest, lockfile and compiled output through the organization's delivery process. An offline source delivery must include the actual archives, not links or Git LFS pointers. Install dependencies reproducibly with npm run install:offline (the preflight for npm ci --offline); host runtimes and compiled outputs belong outside Git. Run both builds on Windows with Node 24 and PowerShell. Compilation needs no SQL service, sqlcmd, database credentials or network. SQL runtime additionally needs sqlcmd and its configured database; configure SQLCMD_PATH when needed. Pre-provision Node/npm, Windows/PowerShell and Chrome/Edge for runtime/browser validation on disconnected hosts. See [offline build and upgrade procedures](offline-builds.md).

Provision DB_config for SQL only under the service identity; do not copy another identity's DPAPI file. Use a service manager and HTTPS reverse proxy in front of the matching start command. Pages and APIs, including settings and exports, no longer enforce application authentication. Deployment access controls are external to TSAAT.

Restrict configuration/database access. Apply separately reviewed migrations to the explicit database before switching traffic when required. Compilation does not seed a database.

For cleanup migration 027, stop app traffic to the selected database, retain a verified pre-upgrade backup, apply 027 using sqlcmd -b, then deploy UI 3 and verify scoped measures, explorers and exports. Do not point an older TSAAT build at this cleaned schema: older loaders select the removed network apm_number column. An isolated restored copy lets the older installation continue using its original database. Recovery restores both the database backup and previous compatible app.

## Smoke checks

Verify direct page/API access without cookies, safe legacy-login redirects, the header without account controls, empty workspace, header Update, both scope types and dates. Check risk profiles, explorers/details, heatmaps, Service Impact selection/graph popup and the ICT impact and dependency diagrams. Confirm CMDB and Settings-sized compliance/impact dialogs, evidence/remediation and keyboard/focus behavior. The Service Impact browser regression checks Settings dimensions, table/selection scope, graph search/expansion/drag/zoom, nested findings, empty scope and narrow layouts; it also runs in the compiled No-SQL smoke. Check Measures Summary, the two KPIs, configured SPIs, findings, discovery and representative PDF/workbook exports. Confirm saved severity/priority settings affect subsequent evaluation.

The graph regression also checks severity selection/empty selection, inclusive finding-count ranges, filtered finding details, every layout family/direction, intermediate animation frames, rapid layout switching, reduced motion and generated/custom coordinate stability across filters. These are focused UI checks over the shared model; repeat provider/build/offline gates when their behavior changes or for a release, as defined by the SDLC.

## Observability and recovery

Retain process/application and migration logs in the deployment platform, excluding secrets and operational reports from Git. Enable existing performance/cache debug flags only when needed. Diagnose startup failures through Windows identity, DPAPI readability, SQL target/TLS and schema compatibility.

Keep the previous artifact and a tested database backup. Stop rollout on failed smoke checks. Restore the previous application when schema-compatible; otherwise follow the approved database recovery plan before returning traffic. Record incidents and regression tests. No automatic deployment or hosting controls are created by the local baseline.

## No-SQL deployment and recovery

Deploy the normal app with .next-nosql and use npm run start:nosql. Set TSAAT_JSON_DATA_DIR to a stable absolute path outside disposable release directories. Initial setup uses repository sample JSON only when no store exists; build/start never replaces existing data. No DB_config or SQL service is needed. Use the same deployment access and HTTPS controls as SQL. Do not distribute the removed Demo folder.

Back up the entire JSON data directory with the compatible release while app processes are stopped. Include snapshots, references, current settings and setting history. Review JSON schema/data upgrades alongside SQL migrations for every release. Incompatible versions must have an explicit migration and rollback procedure. Restore the previous compatible app and complete JSON backup together if needed.

A stale write lock after a crash requires stopping all writers, backing up and validating the store, and confirming no active PID owns the lock before removing it. Current settings files are authoritative if a revision exists without a successful current-file replacement. Full format, single-host limits and recovery details are in [data providers](data-providers.md).
