# Deployment, release and recovery

## Release preparation

Choose an approved commit; run npm ci, npm run check, npm run build:all and npm run test:nosql. Review CHANGELOG, SQL migration needs, affected APIs/reports and dependency advisories. Browser-check relevant scopes/dates and run SQL integration on a disposable database. Default CI builds both artifacts and browser-tests No-SQL without provisioning SQL.

## Deployment

Package the release source/lockfile/build through the organization's delivery process. Install dependencies reproducibly; runtimes and artifacts belong outside Git. Run both builds on Windows with Node 24 and PowerShell. The SQL build additionally needs sqlcmd; configure SQLCMD_PATH when needed.

Provision logindetails, and DB_config for SQL only, under the service identity, or use supported approved secret provisioning. Do not copy another identity's DPAPI files. Use a service manager and HTTPS reverse proxy in front of npm run start:sql or npm run start:nosql for the matching artifact. Production cookies are secure; plain HTTP is not a valid production login test.

Restrict configuration/database access. Apply separately reviewed migrations to the explicit database before switching traffic when required. Compilation does not seed a database.

For cleanup migration 027, stop app traffic to the selected database, retain a verified pre-upgrade backup, apply 027 using sqlcmd -b, then deploy UI 3 and verify scoped measures, explorers and exports. Do not point an older TSAAT build at this cleaned schema: older loaders select the removed network apm_number column. An isolated restored copy lets the older installation continue using its original database. Recovery restores both the database backup and previous compatible app.

## Smoke checks

Verify login/logout/expiry, empty workspace, header Update, both scope types and dates. Check risk profiles, explorers/details, heatmaps, Service Impact tabs and both diagram analysers. Confirm CMDB and Settings-sized compliance dialogs, evidence/remediation and keyboard/focus behavior. Check Measures Summary, the two KPIs, configured SPIs, findings, discovery and representative PDF/workbook exports. Confirm saved severity/priority settings affect subsequent evaluation.

## Observability and recovery

Retain process/application and migration logs in the deployment platform, excluding secrets and operational reports from Git. Enable existing performance/cache debug flags only when needed. Diagnose startup failures through Windows identity, DPAPI readability, SQL target/TLS and schema compatibility.

Keep the previous artifact and a tested database backup. Stop rollout on failed smoke checks. Restore the previous application when schema-compatible; otherwise follow the approved database recovery plan before returning traffic. Record incidents and regression tests. No automatic deployment or hosting controls are created by the local baseline.

## No-SQL deployment and recovery

Deploy the normal app with .next-nosql and use npm run start:nosql. Set TSAAT_JSON_DATA_DIR to a stable absolute path outside disposable release directories. Initial setup uses repository sample JSON only when no store exists; build/start never replaces existing data. No DB_config or SQL service is needed. Use the same login/session and HTTPS controls as SQL. Do not distribute the removed Demo folder.

Back up the entire JSON data directory with the compatible release while app processes are stopped. Include snapshots, references, current settings and setting history. Review JSON schema/data upgrades alongside SQL migrations for every release. Incompatible versions must have an explicit migration and rollback procedure. Restore the previous compatible app and complete JSON backup together if needed.

A stale write lock after a crash requires stopping all writers, backing up and validating the store, and confirming no active PID owns the lock before removing it. Current settings files are authoritative if a revision exists without a successful current-file replacement. Full format, single-host limits and recovery details are in [data providers](data-providers.md).
