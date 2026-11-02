# Validation records

## Dual-provider builds - 2026-11-02

Validation used Windows, Node 24 and installed Chrome. No operational SQL data or configuration was changed. The original TSAAT repository remained clean.

| Check | Result |
| --- | --- |
| Source/documentation gates | npm run check passed: hygiene, reachability, docs, lint, strict types, 573 regression tests passed; 11 opt-in SQL tests skipped |
| Tooling | Four tests passed |
| Production compilation | npm run build:all passed; distinct .next-sql and .next-nosql artifacts contain the expected compiled provider constants |
| Compiled No-SQL runtime | Authentication and 16 views passed with no DB_config and an unavailable SQL executable |
| Interactions | Both heatmaps/searches, entity details, CMDB, both worker analysers and all Settings tabs passed; no SQL administration fetches from No-SQL UI |
| Reports/exports | 44 PDF responses parsed with pages and six XLSX exports validated, including findings Affected CIs |
| Persistence | Risk, priority and discovery settings saved to JSON; priority affected findings; settings survived a fresh app process and login |
| File-store safety | Unit tests covered concurrent writers, traversal rejection, unknown schema versions, nonempty-directory protection, preservation of existing stores and per-type mapping reloads |
| SQL preservation | Both SQL implementations match their previous content exactly behind the new facades; schema, seed datasets and strict TLS were unchanged |
| Removed distribution | Demo folder and standalone build/test adapters removed; runtime JSON and compiled outputs ignored by Git |

SQL integration was not rerun for this storage split and remains opt-in against a disposable database. Earlier trusted-certificate constraints are described below; no TLS exception was introduced. The current smoke validates PDF structure/content delivery, not a new visual audit of every report. The existing Browserslist data-age notice remains. Local validation logs are under .local/dual-build-*.log and are not tracked.


## Cleanup release - 2026-11-02

Validation used Windows, Node 24.13.1 and local SQL Server Express. Cleanup removed 42 unreachable modules plus unused private declarations and server calculations; seven obsolete test files and retired assertions were removed with their implementations.

| Check | Result |
| --- | --- |
| Full development gates | npm run check passed: hygiene/reachability, documentation, lint, strict TypeScript, 556 tests passed and 11 opt-in SQL tests skipped |
| Tooling tests | Four passed, including worker/dynamic-import reachability and test-only orphan detection |
| Production build | npm run build passed; existing Browserslist data-age notice remains |
| Production startup | Temporary port 3103: root 307, login 200, unauthenticated protected API 401; test server stopped |
| Fresh database | Complete schema, migrations 001-027, current reference imports and eight demo snapshots provisioned successfully |
| SQL integration | Nine KPI/CMDB/entity-panel cases passed on the upgraded disposable copy before the strict local app connection was saved |
| Migration guards | Native SQL tests refused custom calculation/report bindings and confirmed full transaction rollback; rerun of 027 succeeded |
| KPI parity | Exact before/after results across eight snapshots: 78 bulk scopes and five individual calls each (624 bulk scopes, 40 calls), including all networks/systems, duplicate IDs, empty/unknown IDs, global scope and high-priority findings |
| Data preservation | Exact SHA-256 content hashes for all 64 retained tables outside the deliberate configuration changes; network apm_number and rowversion excluded from comparison |
| Approved database copy | TSAAT_UI3 restored from a fresh verified COPY_ONLY/CHECKSUM backup of TSAAT, migration 027 applied, DBCC CHECKDB and constraint checks passed; release parity also matched |
| Original installation | Original repository and TSAAT database retained; its 10 calculation records remain, versus two in TSAAT_UI3 |
| Saved connection | Git-ignored CurrentUser-encrypted DB_config targets TSAAT_UI3 with Windows authentication and strict TLS; certificate validation remains enabled |
| Test cleanup | The three databases created exclusively for validation were dropped after checks; recovery backups retained |

The SQL Server certificate is not trusted by Windows. The user chose to configure a trusted server certificate. Until then the new strict application connection cannot complete the TLS handshake; further SQL integration through that app connection and authenticated end-to-end checks remain dependent on the certificate. No exception was saved. The last attempt to rerun the app-adapter SQL guard suite after saving strict settings failed at TLS, not at migration execution; those guard cases were separately verified with native SQL on the disposable copy.

This cleanup changes unused code and SQL configuration rather than current UI layout. It does not claim a new visual review of every page/PDF. Current UI/report unit and route contracts passed. Local logs, comparison captures and exact recovery backup location are in .local/cleanup-audit (excluded from Git); deployment.json identifies the source backup and applied migration.

## Imported baseline - 2026-11-02

This evidence applies to the imported TSAAT UI 3 baseline, using Windows and Node 24.13.1. Future changes need fresh validation.

| Check | Result |
| --- | --- |
| Independent locked installation | npm ci succeeded; no sibling repository dependency |
| Application fidelity | 271 files identical at import; final trailing-blank-line normalization in eight text files only |
| Strict TypeScript | Passed after correcting inherited fixture types and the seed generator IP-node guard |
| Default regression suite | 599 passed, 0 failed, 7 opt-in SQL checks skipped; 119 test files |
| Documentation tooling | 3 tests passed: SQL extraction, mapped documentation impact, fingerprints and link checks |
| Production compilation | Next.js 14.2.35 build completed successfully |
| Production startup | Root redirects to login (307); login renders (200); protected API rejects unauthenticated access (401) |
| Database changes | None applied; original database and local credentials were not copied or modified |

The default suite exercises authentication helpers in isolated temporary directories, domain calculations, route contracts and exports. SQL integration was deliberately not enabled against the existing database. Run those checks against an explicitly provisioned disposable target before a database-affecting release.

The copied app includes the previously browser-verified compliance popup redesign. New-repository verification additionally covers production startup and unauthenticated login/API boundaries; it does not claim a new authenticated end-to-end review of every screen or production deployment approval.

The build reports an existing stale Browserslist dataset notice. Dependencies were kept at the source lockfile versions; a dependency refresh is separate reviewed work. Local build/test logs remain ignored under .local/validation and are not release artifacts.
