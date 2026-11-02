# Deployment, release and recovery

## Release preparation

Choose an approved commit; run npm ci, npm run check and npm run build. Review CHANGELOG, SQL migration needs, affected APIs/reports and dependency advisories. Browser-check relevant scopes/dates and run SQL integration on a disposable database. Default CI builds/tests source without provisioning SQL.

## Deployment

Package the release source/lockfile/build through the organization's delivery process. Install dependencies reproducibly; runtimes and artifacts belong outside Git. Run on Windows with Node 24, PowerShell and sqlcmd. Configure SQLCMD_PATH when needed.

Provision DB_config and logindetails under the service identity, or use supported approved secret provisioning. Do not copy another identity's DPAPI files. Use a service manager and HTTPS reverse proxy in front of npm start. Production cookies are secure; plain HTTP is not a valid production login test.

Restrict configuration/database access. Apply separately reviewed migrations to the explicit database before switching traffic when required. Compilation does not seed a database.

For cleanup migration 027, stop app traffic to the selected database, retain a verified pre-upgrade backup, apply 027 using sqlcmd -b, then deploy UI 3 and verify scoped measures, explorers and exports. Do not point an older TSAAT build at this cleaned schema: older loaders select the removed network apm_number column. An isolated restored copy lets the older installation continue using its original database. Recovery restores both the database backup and previous compatible app.

## Smoke checks

Verify login/logout/expiry, empty workspace, header Update, both scope types and dates. Check risk profiles, explorers/details, heatmaps, Service Impact tabs and both diagram analysers. Confirm CMDB and Settings-sized compliance dialogs, evidence/remediation and keyboard/focus behavior. Check Measures Summary, the two KPIs, configured SPIs, findings, discovery and representative PDF/workbook exports. Confirm saved severity/priority settings affect subsequent evaluation.

## Observability and recovery

Retain process/application and migration logs in the deployment platform, excluding secrets and operational reports from Git. Enable existing performance/cache debug flags only when needed. Diagnose startup failures through Windows identity, DPAPI readability, SQL target/TLS and schema compatibility.

Keep the previous artifact and a tested database backup. Stop rollout on failed smoke checks. Restore the previous application when schema-compatible; otherwise follow the approved database recovery plan before returning traffic. Record incidents and regression tests. No automatic deployment or hosting controls are created by the local baseline.
