# Patch Management Explorer

Discovery places this page immediately after Security Vulnerability Explorer at `/discovery-coverage?discoveryView=patch-management`. It is a read-only server maintenance register, with applied network or ICT-system scope and the resolved historical snapshot. Device names open the shared CMDB panel.

Discovery Insights reuses these canonical rows for status, verified percentage, overdue actions and unknown-evidence summaries. Its links initialize validated `discoveryFilters` on Patch posture (status facets or overdue numeric ranges), preserving network/system scope and the actual snapshot. The initial filters remain in that tab when changing views and apply to its Excel export. Malformed or oversized payloads open the unfiltered default view.

## Views and interpretation

Patch posture shows status, next focus, OS, installed/target patch levels, missing security/critical update counts, last installation, due date, overdue days, support status and environment. Restart & evidence shows the restart requirement, last boot, uptime, installation verification, latest assessment, validity end, evidence age and source. Planning & ownership contains network/system context, responsible team, planned date, maintenance window, change reference and time-bounded exceptions. Known-exploited CVE observation counts cover all installed software; they are not a list of missing OS patches or a fresh CISA feed.

The page follows End Point Explorer: a scope/snapshot hero, four compact interactive bar charts and a bounded results panel with matching toolbar, cell spacing and pagination. Scope-wide verified and overdue totals remain in the hero. Posture charts show status, next focus, OS support and environment; restart charts show status, restart requirement, evidence freshness and source; planning charts show status, network, owner and exceptions. Bars toggle the same column filters as table headers. Counts respect search, numeric ranges and other column filters while ignoring their own column selection, matching End Point Explorer's faceting.

Tabs sit beside the chart caption on desktop to reserve room for rows. Evidence and export guidance lives in a keyboard-operable native details disclosure below the table; it explains patch status and exports without a demo-data notice.

Each tab preserves its own search, chart/column selections and numeric ranges; numeric columns support sorting. Search also includes asset ID, hostname and IP. Excel re-queries the shared provider at the actual snapshot, reapplies that tab's filters and returns every matching server in a versioned JSON document model. The browser worker creates the XLSX file with all view fields and a UTC export timestamp, regardless of pagination. The shared Generating Document animation tracks stages and supports cancellation, retry and focus return. Tabs support arrow/Home/End keys. The table fills the available desktop panel and scrolls internally instead of growing with every row; at narrower widths its body is capped at 34rem, matching End Point Explorer. Charts stack and tabs wrap. Existing loading/error boundaries, empty states and CMDB keyboard/focus return apply. Pages and export APIs open without an application session. Evidence-source values remain available in the table.

Status is evaluated relative to the selected snapshot's end of day in UTC, never the current wall clock. Current evidence requires an assessment timestamp, a source and an explicit `assessmentValidUntil` date covering the snapshot. Incomplete, stale, contradictory or future observations produce Unknown. Historical timestamps after the selected snapshot are not displayed as past events. Nullable counts and restart state remain unknown, not zero/false.

With current evidence, status precedence is Failed deployment, Restart required, In progress, Not patched (positive missing-update count), then Patched. Patched requires zero missing security and critical updates, `deploymentStatus=Succeeded`, explicit `restartRequired=false`, a recorded successful patch date and verification at or after that installation. Installation/boot/verification cannot post-date the assessment. Patch-level strings are labels, not an ordering or proof of compliance. OS support is a separate risk flag; a patched unsupported OS still needs lifecycle action. Uptime is informational, not a restart deadline.

Overdue days compare the recorded due date with the snapshot for any server not verified Patched. Exceptions retain this count; reason and expiry show None, Active, Expired or Missing expiry. Planned future dates never imply installation. No universal patching SLA, Essential Eight maturity score or new KPI/SPI definition is introduced. Existing configurable measures and findings remain authoritative and unchanged.

## Guidance used in the design

- [NIST SP 800-40 Rev. 4](https://csrc.nist.gov/pubs/sp/800/40/r4/final) treats patch management as identification, prioritization, installation and verification, with planning across business and technology owners. The page therefore separates deployment from verification and records ownership/planned maintenance.
- [ASD patching applications and operating systems](https://www.cyber.gov.au/publication/patching-applications-and-operating-systems) distinguishes risk and system exposure, encourages defined responsibilities and scanning, and includes replacement of unsupported products. The page retains recorded due dates rather than claiming one timeframe applies to all systems.
- [CISA's risk-based vulnerability management bulletin](https://content.govdelivery.com/accounts/USDHSCISA/bulletins/42b055b) identifies exploitation and exposure as prioritization inputs and points to its [Known Exploited Vulnerabilities catalogue](https://www.cisa.gov/known-exploited-vulnerabilities-catalog). Existing observation evidence is displayed as additional context; this feature does not download or assert current catalogue membership.

These sources were reviewed on 2026-11-03. No source is fetched during installation, compilation, population or page loads. Example assessment validity is seven days solely to demonstrate freshness; production observations must use the organization's approved scan cadence and due dates.

## Data contract and migration

JSON format version 1 gains an optional `patchManagement` object on server assets. SQL migration [029](../Database%20Schema/migrations/029_patch_management_explorer.sql) creates `tsaat.server_patch_observation`, keyed by `(snapshot_id, asset_id)` and joined on both keys. This is separate from network-device `asset_patch_state`, which continues to feed existing SPI rules. Apply the forward migration to an explicitly selected backed-up database using strict TLS and `sqlcmd -b`; do not replay the destructive base schema or seed loader on an operational database.

| JSON field | SQL column | Meaning |
| --- | --- | --- |
| assessmentDate | assessment_date | UTC tool observation time |
| assessmentValidUntil | assessment_valid_until | Policy validity end, inclusive date |
| lastPatchedDate | last_patched_date | Last successful installation, UTC |
| lastRestartedDate | last_restarted_date | Recorded last restart/boot, UTC |
| verifiedDate | verified_date | Post-install validation time, UTC |
| installedPatchLevel / targetPatchLevel | installed_patch_level / target_patch_level | Recorded labels, not inferred version comparisons |
| missingUpdates / missingCriticalUpdates | missing_updates / missing_critical_updates | Nonnegative security update counts; critical cannot exceed total |
| restartRequired | restart_required | Nullable boolean |
| deploymentStatus | deployment_status | Succeeded, Failed, In progress, Scheduled or Unknown |
| dueDate / plannedDate | due_date / planned_date | Policy deadline and planned maintenance date |
| owner / maintenanceWindow / changeReference | owner / maintenance_window / change_reference | Patch owner and controlled maintenance context |
| exceptionReason / exceptionExpiresDate | exception_reason / exception_expires_date | Documented temporary risk acceptance |
| source | source | Evidence provenance |

Fields are nullable and old stores remain readable. No existing JSON store is migrated during a build. Both providers hydrate the same typed Dataset and use one shared projection, status algorithm and export. SQL full hydration also retains the existing OS patch-level field, matching JSON. The SQL-to-JSON converter accepts the new observation table and preserves null/zero/false values; pre-029 exports without the table remain compatible. New exports must include it whenever present. Operational ingestion uses these typed records rather than writing a derived status or repurposing CVEs as patch scans. Import UTC timestamps (`Z` suffix); planned/due/validity/exception fields use `YYYY-MM-DD`.

## Explicit sample population and recovery

Fresh sample stores receive deterministic, visibly labelled observations from `data/sample-patch-profiles.json`. The eight profiles cover verified patched, missing updates, restart required, failed/in-progress deployment, stale evidence, exceptions and incomplete evidence. No external patch feed is contacted. Existing non-null observations, including partial/empty objects, remain authoritative; only missing server observations are added. Installed OS/software, CVEs, dependencies, findings, CMDB mappings and settings are preserved.

For an existing sample No-SQL store, stop app processes and preview `npm run populate:patches`. Apply with `npm run populate:patches -- --apply --demo`; optional `--target` and `--backup-directory` select explicit paths. The writer lock, full backup, immutable snapshot revisions and atomic manifest publication are shared with existing population tools. Repeated application is idempotent. Recover by stopping the app, preserving the failed/current store and restoring the entire reported backup, then restart and verify snapshots/settings.

SQL sample population is separate: in an explicitly selected sample database already at 029, set `SESSION_CONTEXT(N'TSAAT_SAMPLE_PATCH_MANAGEMENT')` to `1` and execute [populate-sample-server-patches.sql](../Database%20Schema/loaders/populate-sample-server-patches.sql) in that session. It is transactional/rerunnable and never replaces existing observations. The guarded NEW disposable-database bootstrap applies it after seed import. Operational deployment applies only migration 029 and imports real tool evidence.

## Verification

Tests cover evidence/future-date boundaries, null counts, status precedence, overdue exceptions, scope and historical dates, SQL hydration, JSON projection, import/export parity, numeric filters, Excel safety and preservation/idempotent population. The production No-SQL smoke exercises tabs, filters, authenticated canonical export, CMDB/focus return, empty/system scope and a 390px viewport, alongside existing reports/settings/restart checks.

Real SQL parity is opt-in: select a disposable sample database whose name begins `TSAAT_PatchParity_`, set `TSAAT_PATCH_PARITY_SERVER` and `TSAAT_PATCH_PARITY_DATABASE`, then run `npm exec -- vitest run tests/patch-management-sql.test.ts`. The test uses strict TLS and Windows authentication, reruns migration/population inside an outer rollback transaction, and compares SQL data with the same JSON transform. It does not provision or select an operational database. The current local SQL certificate is untrusted; live integration/application is not claimed without a trusted test target.
