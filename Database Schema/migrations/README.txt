SQL migration policy — inventory storage v2

Published migrations 001–032 are historical forward upgrades and must not be rewritten or replayed on a newer database. Some introduce features now retired by 033. Keep them for installations that need reviewed prerequisites, not for fresh-schema replay.

Fresh setup uses database-schema.sql and ONLY freshSchemaMigrations from data/database-build-manifest.json (025 CMDB asset mappings, 031 persona revisions, 032 model-CI mappings). The base schema already has storage version 2 and retained inventory fields. Never apply base DDL/seed loaders to an operational database.

033_retire_analytics_features.sql is the current forward upgrade for existing databases through 032. Stop writers, verify a full native backup, select the exact database and set SESSION_CONTEXT('TSAAT_RETIRE_FEATURES_DATABASE') to DB_NAME() in the same sqlcmd session. The script refuses unreviewed custom dependencies, drops only the reviewed retired objects/fields, prunes known retired persona permissions and records storage version 2 transactionally. It is repeat-safe. Read docs/feature-retirement.md for executable commands, the paired JSON upgrade and recovery.

Do not run demonstration migrations/population scripts against operational imports. Preserve selected authentication/TLS policies. Use sqlcmd -b and retain execution/validation evidence outside Git. Restore the compatible application and verified pre-upgrade backup together for rollback; no automatic down migration is provided.
