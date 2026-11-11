# Software development lifecycle

## Assess impact before selecting validation

Every change starts with its problem, scope and acceptance criteria, followed by an impact assessment. Assess behavior, not just filenames. Record these categories as affected or not affected, with a short reason in the PR/change summary:

| Impact | Checks and evidence when affected |
| --- | --- |
| UI, navigation or scoped application behavior | Lint/type checking, focused regression tests and relevant browser, keyboard, narrow-layout, loading/error/empty-state checks. Inspect report output when report presentation changes. |
| SQL or JSON data/structures, queries, rules, scope calculations, persistence, settings or CMDB mappings | Review both provider implementations and the calculation contract; focused provider tests, storage:check, both builds and compiled No-SQL smoke. Run applicable SQL parity/migration checks on an explicitly selected disposable database. Provide migrations/recovery only where needed. |
| Documentation or generated inventories | Review/update only affected documents. Run docs:generate when routes/navigation, API methods, dependencies, schema/migrations or seed catalogue changes alter generated inventories; then docs:check. Documentation-only edits normally need docs:check without regeneration. |
| Tooling or CI | Focused tooling tests, command/selection regression tests and configuration syntax review. Application/provider suites are needed only if those behaviors are affected. |
| Dependencies, installation, compiler/build configuration or offline assets | Archive/provenance verification, fresh empty-cache offline installation, full source checks and both guarded builds; compiled No-SQL smoke. |
| Shared/security-sensitive behavior, broad refactoring or uncertain impact | Expand regression tests to cover consumers and authentication/scope boundaries. Use the full gate when a focused selection cannot establish confidence. |
| Release candidate | Full release gate against the exact release commit, including offline evidence and relevant disposable-SQL/browser/report checks. |

If SQL and JSON data, structures and behavior are unaffected, do not force storage checks, SQL parity, data migrations, dual builds or the full No-SQL smoke solely because a file changed. If documentation and inventories are unaffected, do not force documentation edits, regeneration or checks. Preserve both-provider compatibility and offline capability in all cases; an obligation to preserve behavior is not an obligation to repeat every check.

Select the smallest sufficient checks before implementation, then reassess after the final diff. Add checks when scope grows, failures expose another affected area or reviewer evidence warrants it. Do not run the full suite merely by habit, and do not add meaningless documentation changes to satisfy a path match.

## Coordinated SQL and No-SQL data-change gate

Data, fields, structures, schema, relationships, mappings, calculations, snapshots/history, reference data and seed/population/import/export changes are one cross-provider change. SQL and No-SQL must ship together; implementing one path and deferring the other is not complete.

1. Name the affected feature and record its field/relationship, identity, null/unknown, scope/domain, temporal and persistence contracts. Review `lib/types.ts`, both provider implementations, CMDB mappings and `NoSQL/calculation-contract.json`.
2. Change both readers/writers and the common evidence source in the same PR. Bundled SQL and JSON setup consume the same reviewed weekly snapshots, including all applicable attributes and evidence. Keep at least four complete weeks (five weekly boundaries minimum); the standard fixture contains eight weekly snapshots. Historical observations cannot use future detections. Unknown and inapplicable states must be explicit and meaningful, not fabricated completion.
3. Pair forward SQL migrations with versioned JSON upgrades whenever structures change. Pair SQL sample-data updates with JSON sample-data updates when evidence changes. Supply preview, selected-target guards, backup, idempotency, interruption/recovery and rollback instructions. New seeds alone do not upgrade existing installations. Builds must never overwrite existing stores or provision operational SQL.
4. Run focused provider/feature/regression tests, `npm run evidence:check`, `npm run storage:check`, both guarded builds and the compiled No-SQL smoke. Compare SQL and No-SQL against the same explicitly selected disposable SQL database and isolated JSON store, using multiple weekly dates, network/system/domain scopes, discovery calculations, Explorers, CMDB, retained reports and settings where affected. Validate fresh setup and existing-store upgrade; record intentional representation differences and prove identical app meaning.
5. Record actual results, snapshot dates, targets and remaining limitations. Missing infrastructure or unperformed parity is a blocker to claiming aligned data acceptance. Refresh pinned hashes only after reviewing behavior and parity evidence. Preserve settings, credentials, history and intentional missing/inapplicable states during upgrades.

`storage:check` validates the pinned calculation contract and executes the common evidence audit, which verifies applicable attributes, temporal consistency, weekly coverage, current/latest equality, retained relationships and absence of retired fields. CI data-impact selection must include new sample/snapshot/import/export tooling; update its classifiers and tests when adding a new path. Changes confined to presentation still follow the selective checks above.

## Implementation flow

1. Define the change and record its impact assessment and intended checks.
2. Review relevant requirements/design; update them only when affected. Record substantial decisions in an ADR.
3. Implement with meaningful regression coverage. Preserve header scope, dates, configurable definitions, the current application access model, compatibility routes and shared data facades.
4. Run the selected checks; record actual results and reasons for omitted categories. Treat unavailable SQL infrastructure as an explicit limitation, not a passing test. Never silently downgrade the selected TLS policy or use operational databases for validation. Interactive setup uses the explicitly requested SQL login/no-SSL workflow in [ADR 0017](adr/0017-dedicated-database-login.md); advanced TLS choices remain available and connection failures never trigger a TLS downgrade.
5. Request independent review of behavior, impact assessment, maintainability, security/accessibility and applicable documentation/migration/recovery notes.
6. Merge after the selected CI checks and review pass. Before release, complete the full release gate for the specific commit/tag and record post-deployment checks.

## Local and CI selection

Run node scripts/change-impact.mjs to inspect a conservative plan for tracked edits and untracked files. Use --base <commit> to assess the committed change range instead. It does not run checks unless --run is supplied. --data, --docs and --full broaden an assessment.

The planner is a starting point, not semantic proof. It selects documentation checks for documentation/inventory paths, data gates for known provider/rule paths, lint/types and changed/import-related tests for ordinary source changes, and Node regression tests for tooling. Dependencies/build configuration, deleted runtime source, unclassified files or an unavailable comparison base select full validation. Related-test discovery cannot identify every dynamic import or test that reads source files; explicitly run those tests when relevant. A source change with no related tests still needs review and appropriate manual/regression evidence.

CI applies this plan to pull requests and pushes to main. PR labels validation:data, validation:docs and validation:full can broaden it; label changes retrigger CI. Documentation-only CI does not install application packages. CI installs from local archives when selected checks require packages. The full offline firewall/empty-cache gate is selected for dependency/build risk, explicit full validation and workflow_dispatch; the manual workflow is the release gate. No live SQL database is provisioned automatically. A semantic data/documentation change outside known paths must be identified in review and escalated with the corresponding label.

npm run check remains an explicitly requested comprehensive source gate. compileApp.cmd also remains a deliberate clean install/validation/build command; neither is the default command for a small edit. Local work can run focused commands directly instead of the planner's conservative defaults.

## Documentation contract

Requirements Documentation describes visible behavior/rules. Architecture/UI documents describe shared boundaries/interactions; Database Schema retains SQL, ERD and mapping documentation. docs/maintenance.json suggests documents to review for a source area.

docs:generate writes deterministic inventories and a source fingerprint snapshot. docs:check validates generated inventories, local Markdown links and required document paths. Source fingerprints are informational and do not force regeneration after unrelated implementation edits. When DOCS_BASE_REF is supplied, mapped source changes print documentation-review suggestions; they do not require a human-written document edit when meaning is unchanged. Record a no-impact rationale in the PR instead. Reviewers remain responsible for semantic accuracy.

## Full release gate

On a clean, disposable checkout with the supported host tools, use a new empty npm cache, then run:

~~~powershell
npm run install:offline -- --cache .local/release-proof-unique
node --test tests/change-impact.test.mjs
npm run check
npm run build:all
npm run test:nosql
~~~

Use a never-before-used cache path. Full CI denies outbound Node traffic during installation, checks and both compilations. Missing/corrupt archives or network attempts fail the release. Add applicable SQL parity/migration tests on a trusted disposable database and inspect relevant browser/PDF output. Do not automatically regenerate documentation in CI to hide drift.

## Definition of done

Acceptance criteria and compatibility/security boundaries are preserved; the impact assessment matches the final change; selected checks pass; affected documentation and migration/recovery steps are current; skipped categories have a reason and unavailable checks are disclosed. No secrets, operational extracts, mutable stores or unapproved generated artifacts are tracked. Full offline release evidence is required for release acceptance, not every routine contribution. Neither build output nor NoSQL/data is committed, and there is no third standalone demo build.

## Responsibilities and ongoing maintenance

Authors own the assessment, implementation and evidence; reviewers challenge omitted checks and verify semantic/documentation impact. Database reviewers own applicable data safety; release owners own full release and recovery evidence. Configure protected main, required CI and review approval in the hosting service; local files cannot establish those controls.

Keep published migrations append-only. Version incompatible JSON changes and provide upgrades for existing stores; seed changes alone are not upgrades. Review calculation behavior before refreshing hashes. Exercise restore/deployment in disposable environments. Evidence applies to the tested commit and scope, not permanent certification. See [ADR 0013](adr/0013-impact-based-validation.md), [provider contracts](data-providers.md) and [offline requirements](offline-builds.md).
