# Software development lifecycle

## Change flow

1. Define the problem, scope and acceptance criteria. Identify UI, data, report and compatibility impacts.
2. Review/update requirements and design before or alongside implementation. Record substantial decisions in an ADR.
3. Develop on a short-lived branch with meaningful tests. Add reviewed numbered database migrations and align fresh-install schema/reference data.
4. Update human-written docs and CHANGELOG, regenerate inventories, then run `npm run check` and `npm run build`. Add relevant browser, PDF and SQL evidence.
5. Request independent review of behavior, maintainability, scope/security, accessibility, documentation and migration/recovery notes.
6. Merge after checks/review. Release from a specific commit/tag with the operations runbook and record post-deployment checks.

## Documentation contract

Requirements Documentation describes visible behavior/rules. Architecture and UI documents cover shared boundaries/interactions. Database Schema retains SQL, ERD and mapping documents. `docs/maintenance.json` maps source areas to maintained documents.

`docs:generate` writes deterministic inventories and a normalized source checksum baseline. `docs:check` rejects drift, broken local Markdown links and missing PR documentation updates. In a pull request, DOCS_BASE_REF identifies the base commit; changes in mapped source areas require an associated human-written document change. Generated files alone do not satisfy that gate.

Where behavior is unchanged, document the reason and validation in the relevant document; do not use meaningless edits. Automation verifies freshness and coverage, not semantic accuracy. Reviewers remain responsible for alignment.

## Definition of done

Acceptance criteria, compatibility and security boundaries are preserved; tests/lint/types/build pass; feature/design/architecture/database/operations docs match; relevant UI/report states are inspected; migrations/recovery are reviewable; no secrets or generated artifacts are tracked.

## Responsibilities and hosting controls

Authors own implementation/docs; reviewers own independent acceptance; database reviewers own data safety; release owners own deployment/recovery evidence. These are responsibilities, not invented account assignments.

After choosing a remote, the repository owner must enable protected main, required CI, review approval, restricted deployment credentials and the organization's dependency/vulnerability policy. A local Git repository cannot enable those hosting settings.

## Ongoing maintenance

Triage defects against reproducible snapshots. Review dependency advisories and plan supported-version upgrades separately from this baseline. Keep published migrations append-only. Exercise restore/deployment in disposable environments. Baseline results are evidence for this commit, not permanent release certification.
