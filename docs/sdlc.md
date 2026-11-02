# Software development lifecycle

## Change flow

1. Define the problem, scope and acceptance criteria. Identify UI, data, report, SQL/No-SQL build, offline installation/compilation and compatibility impacts. Offline compilation from repository-contained code is mandatory, not an optional delivery mode.
2. Review/update requirements and design before or alongside implementation. Record substantial decisions in an ADR.
3. Develop on a short-lived branch with meaningful tests. Keep all build code, dependencies and assets local. Dependency changes must update package-lock.json, vendor/npm archives and the provenance manifest together, review licenses/native binaries/lifecycle needs, and pass offline:check. Follow [offline dependency maintenance](offline-builds.md); never use registry fallbacks, lifecycle downloads or remote build assets. Add reviewed numbered database migrations and align fresh-install schema/reference data.
4. Implement and validate both SQL and No-SQL providers in the same change. Review calculations, scope/date behavior, settings persistence, reports, JSON formats and CMDB mappings. Add SQL and JSON migration/recovery steps where needed. Update human-written docs and CHANGELOG, regenerate inventories, then run npm run check, npm run build:all and npm run test:nosql. Add relevant disposable-SQL integration and browser/PDF evidence.
5. Request independent review of behavior, maintainability, scope/security, accessibility, documentation and migration/recovery notes.
6. Require CI evidence of npm ci --offline with an empty cache and Node outbound traffic denied, followed by checks and both builds. Missing/corrupt archives or network attempts fail the release. Merge after checks/review. Release from a specific commit/tag with the operations runbook and record post-deployment checks.

## Documentation contract

Requirements Documentation describes visible behavior/rules. Architecture and UI documents cover shared boundaries/interactions. Database Schema retains SQL, ERD and mapping documents. `docs/maintenance.json` maps source areas to maintained documents.

`docs:generate` writes deterministic inventories and a normalized source checksum baseline. `docs:check` rejects drift, broken local Markdown links and missing PR documentation updates. In a pull request, DOCS_BASE_REF identifies the base commit; changes in mapped source areas require an associated human-written document change. Generated files alone do not satisfy that gate.

Where behavior is unchanged, document the reason and validation in the relevant document; do not use meaningless edits. Automation verifies freshness and coverage, not semantic accuracy. Reviewers remain responsible for alignment.

## Definition of done

Acceptance criteria, compatibility and security boundaries are preserved; tests/lint/types and both builds pass; feature/design/architecture/database/operations docs match; relevant UI/report states are inspected; migrations/recovery are reviewable; no secrets or unapproved generated artifacts are tracked. Fresh-checkout offline installation and both compilations must pass; a warm cache or preinstalled node_modules is not acceptance evidence. All build dependencies must be regular repository archives, not Git LFS pointers or external artifact links. The compiled No-SQL browser smoke must pass, including persistence after restart with SQL unavailable. Neither build output nor mutable JSON data is committed. There is no third standalone demo build.

## Responsibilities and hosting controls

Authors own implementation/docs; reviewers own independent acceptance; database reviewers own data safety; release owners own deployment/recovery evidence. These are responsibilities, not invented account assignments.

After choosing a remote, the repository owner must enable protected main, required CI, review approval, restricted deployment credentials and the organization's dependency/vulnerability policy. A local Git repository cannot enable those hosting settings.

## Ongoing maintenance

Triage defects against reproducible snapshots. Review dependency advisories and plan supported-version upgrades separately from this baseline. Keep published migrations append-only. Maintain the [dual-provider contract](data-providers.md) on every related app change; do not postpone either provider to a later release. Version incompatible JSON changes and provide upgrades for existing stores; new seeds alone are not an upgrade. Review the calculation contract before refreshing hashes. Exercise restore/deployment in disposable environments. Baseline results are evidence for this commit, not permanent release certification.
