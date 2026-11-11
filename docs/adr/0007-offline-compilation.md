# ADR 0007 - Mandatory repository-contained offline compilation

Status: accepted, 2026-11-02. Supersedes the package-vendoring prohibition and external offline-bundle decision in ADR 0002.

## Context

Offline compilation is mandatory. A registry-backed lockfile and source-only checkout cannot install on a disconnected machine with an empty cache. The existing SQL and No-SQL builds share one dependency graph and must remain compatible.

## Decision

Commit every unique locked npm archive, including optional native platform packages, in vendor/npm with original HTTPS registry URLs and SHA-512 provenance. Resolve both lockfile representations to local archives and retain npm ci. Exclude installed node_modules and host runtimes. Disable npm lifecycle scripts; current packaged compiler binaries work without them. Provision Node/npm and Windows/PowerShell separately as host tools.

Verify archive closure/integrity in checks and both builds. Deny network calls in Node compilation processes, fail on recorded attempts even when caught, and disable telemetry. CI uses a fresh empty npm cache and an outbound Node firewall rule. Treat offline preservation as a required feature, dependency, review and release acceptance criterion. Runtime SQL, authentication and JSON storage behavior are unchanged.

## Alternatives

A prewarmed developer cache or external artifact bundle is not contained in the checkout and fails the requirement. Committing node_modules is platform-dependent, larger and obscures package provenance. Reimplementing third-party compilers/frameworks would create an unrelated maintenance burden. Local immutable upstream archives preserve npm's locked installation and upstream license contents.

## Consequences

The repository grows by the package archive size; package updates must include reviewed binary diffs/provenance and cold offline install evidence. Archives are regular Git files, never external/LFS pointers. Connected dependency acquisition is a separate explicit maintenance command. The Node guard is a regression detector, not a security sandbox for arbitrary native programs; CI adds firewall enforcement and reviewers inspect subprocess changes. No operational database or data store is migrated.

See [offline contract](../offline-builds.md), [SDLC](../sdlc.md), [architecture](../architecture.md) and [providers](../data-providers.md).
