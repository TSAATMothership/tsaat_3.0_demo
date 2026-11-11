# ADR 0013: Select validation by change impact

Status: Accepted, 2026-11-04.

## Context

The previous contribution rules required documentation edits, full source tests, fresh offline installation, both builds and No-SQL smoke for every change. That duplicated work for presentation, documentation and tooling edits without corresponding data or build risk.

## Decision

Assess the final change's semantic impact before selecting checks. Use focused validation for scoped changes; require provider/data validation only when SQL/JSON data, structures, rules or persistence are affected. Check/update documentation only when its meaning or generated inventories are affected. Preserve full validation for release candidates and dependency/build risk, expanding checks when uncertainty warrants it.

CI selects checks from changed paths with conservative fallback and explicit escalation labels. Path classification assists review; it cannot establish semantic non-impact. Documentation mappings become review suggestions, and source checksum snapshots become informational. Actual generated inventory drift, missing maintained documents and broken links still fail documentation checks when run.

This decision supersedes the every-contribution validation frequency in ADRs 0006/0007 and related SDLC wording. Their dual-provider compatibility, data safety, local dependency archives and offline release requirements remain in force. npm run check and the full offline CI gate remain available; no dependency, schema or runtime behavior changes are required.

## Alternatives

Retaining all checks for every edit wastes effort on unaffected areas. Author-selected unchecked skips alone provide too little automated guidance. A conservative path plan plus documented semantic review and escalation offers proportionate validation without claiming filenames prove safety.

## Consequences

Routine UI and documentation work avoids unrelated database/build checks. Authors and reviewers must state reasons and include tests that import analysis cannot find, including tests that read source files. Release evidence remains comprehensive. An unknown diff or unclassified source change falls back to the full gate.

Affected documents: [SDLC](../sdlc.md), [development](../development.md), [offline builds](../offline-builds.md), [data providers](../data-providers.md) and [contributing](../../CONTRIBUTING.md).
