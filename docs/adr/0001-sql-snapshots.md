# ADR 0001 — SQL and snapshot ownership

Status: accepted baseline, 2026-11-02.

Context: historical posture and configurable rules require consistent snapshot/scope evaluation.

Decision: SQL Server remains the runtime authority. Retain explicit snapshot/scope, typed server models, version-aware caches, public APIs and redirects for retired UI routes. JSON remains import/test/reference material.

Consequences: SQL lifecycle and Windows/sqlcmd checks remain required. Frontend changes must preserve calculations and denominators. A driver/datastore replacement requires a separate decision and parity tests.

Alternative: browser/JSON-owned evaluation would fork deployed SQL behavior and is outside this baseline. See [architecture](../architecture.md) and [database lifecycle](../database.md).
