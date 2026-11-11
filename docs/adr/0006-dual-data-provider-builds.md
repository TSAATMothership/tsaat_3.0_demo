# ADR 0006: One app with SQL and JSON compilation paths

Status: Accepted, 2026-11-02. Supersedes [ADR 0005](0005-standalone-browser-demo.md).

## Context

The user rejected the standalone browser demo and requested two builds of the latest app, with either SQL or JSON data storage. Independent browser adapters created an additional runtime boundary and did not meet the intended behavior.

## Decision

Remove Demo and its bundler/adapters. Keep the existing Next.js application, authentication, API routes, UI and report builders. Select a typed data provider at build time and compile into separate .next-sql and .next-nosql folders. Preserve standard SQL defaults and strict TLS. JSON snapshots/reference data/settings live on the server filesystem; settings use locked atomic writes and survive restarts.

Use explicit data-loader and CMDB facades rather than bundler aliases. Compile-time operation parity, reviewed SQL calculation hashes, regression tests, both production builds and a real authenticated No-SQL browser smoke are release gates. SDLC, PR guidance and CI require both providers in the same change.

## Consequences

Both builds have the same app behavior and normal server/login requirements. No-SQL removes the SQL dependency, not the app server. It retains Windows authentication setup dependencies. The JSON store is single-host local storage and needs explicit backup, schema evolution and data-import procedures. Current seed data is sample JSON, not an operational SQL export. Calculation changes require an equivalent JSON evaluator; arbitrary new SQL expressions cannot run automatically in No-SQL. Existing stores are never reset by compilation.
