# Contributing

Create a short-lived branch from main. Define the problem, scope and acceptance criteria; review the applicable solution design and docs/maintenance.json mapping.

Implement code and meaningful regression tests together. Update feature, design, architecture and data docs in the same change; use an ADR for significant decisions. Every change must work in both compilation paths: SQL and JSON-backed No-SQL. Use shared UI/API/report code and data facades. Review both calculations, persisted data formats and CMDB mappings when contracts change. See [data providers](docs/data-providers.md).

After updating human-written docs, run npm run docs:generate, npm run check, npm run build:all and npm run test:nosql, plus relevant disposable-SQL integration and browser/PDF checks. Do not reset existing JSON stores or operational SQL data to make a build pass. Keep secrets, mutable data and generated outputs outside Git.

Use the PR template to present behavior, validation for both builds and migration/recovery notes. Merge after review and passing checks. The repository owner must configure protected main and required CI in the chosen hosting service; local files cannot enforce hosting controls. See [the SDLC](docs/sdlc.md).
