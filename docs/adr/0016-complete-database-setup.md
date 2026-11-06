# 0016: Complete database setup and encrypted certificate-trust defaults

Status: Accepted, 2026-11-06. Implements the explicit request to replace the previous strict-default guidance for new SQL connections.

## Context and decision

Configuration-only setup left users with a separate schema/data bootstrap and an unusable app until both were completed. `setup:database` now collects connection details and initializes only a missing database through the guarded bootstrap. It reuses the application's connection/TLS/schema checks and writes the DPAPI configuration only after success. Existing databases are read-only validation targets; migrations and operational imports remain separately reviewed operations. Failed partial creation is retained for inspection, never automatically dropped or reloaded.

New settings, bootstrap and loader use encryption with Trust Server Certificate. This deliberately skips certificate validation while encrypting traffic. Strict validation remains available and saved choices take precedence. Encrypted connections use TCP, not local shared memory. There is no failure-driven downgrade. SQL Server installation/protocol changes remain host administration tasks.

The CLI uses existing tsx and Next packages, with a CLI-only server-marker mapping, and passes credentials over stdin to shared diagnostics. Bootstrap/loader SQL passwords use the scoped SQLCMDPASSWORD environment instead of process arguments. The app access model and DPAPI format are unchanged.

## Alternatives and consequences

Keeping two commands failed the requested one-command workflow. Automatically rebuilding an existing database would risk data loss, so reruns validate it instead. Automatically installing or reconfiguring SQL Server would require host-level authority beyond database setup. SQL diagnostics require visibility of the current connection DMV. Remote SQL data load streams client JSON without server-side shares.

Schema, migrations, seed contents, calculations and JSON formats remain unchanged. No SQL or JSON upgrade or checksum refresh is required. Builds never invoke setup and retain existing JSON stores.

## Validation scope

Selected: setup orchestration/failure/rerun tests, TLS/default/password tests, settings schema/SSL diagnostics, provider regression, lint/types, storage contract, both guarded builds, compiled No-SQL smoke, documentation checks and disposable SQL setup where available. Inspect the settings copy/options and keyboard controls. Documentation inventories need regeneration only if their derived content changes.

No calculation, scope/date, report or authentication rules change, so new rule/parity fixtures and report-specific tests are unnecessary. No dependency versions, archives or application compiler settings change; a fresh empty-cache reinstall is not selected for this tooling change. Both builds still verify offline archives and reject build networking. See [database lifecycle](../database.md), [settings contract](../../Requirements%20Documentation/11-Settings.md) and [SDLC](../sdlc.md).
