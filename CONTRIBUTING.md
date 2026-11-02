# Contributing

Create a short-lived branch from main. Define the problem, scope and acceptance criteria; review the applicable solution design and docs/maintenance.json mapping.

Implement code and meaningful regression tests together. Update affected feature, design, architecture and database docs in the same change; use an ADR for significant decisions. Run `npm run docs:generate`, `npm run check` and `npm run build`, plus relevant SQL/browser/PDF checks.

Use the pull request template to present behavior, evidence and migration/recovery notes. Merge after review and passing checks. The repository owner must configure protected main and required CI in the selected hosting service; local files cannot enforce hosting controls. See [the SDLC](docs/sdlc.md).
