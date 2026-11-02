# Baseline validation — 2026-11-02

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
