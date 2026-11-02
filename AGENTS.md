# Repository working instructions

- Start with README.md, docs/README.md and the relevant feature specification.
- Preserve header scope, selected snapshot dates, configurable measure definitions, authentication and compatibility routes.
- Update code, meaningful tests, feature/design/architecture documentation and data documentation in the same change. Record user-visible changes in CHANGELOG.md.
- Support both compilation paths of this app: SQL and JSON-backed No-SQL. Read docs/data-providers.md. Keep all pages, APIs, calculations, reports, settings and CMDB mappings compatible with both. Use the shared lib/data-loader.ts and lib/cmdb-attribute-loader.ts facades; do not bypass them from feature code.
- For data/rule/schema changes, review both providers and the NoSQL/calculation-contract.json guard. Never refresh checksums without reviewing behavior and regression tests. Provide SQL migrations and JSON format/data migration instructions where needed; never overwrite existing JSON stores during a build.
- Run npm run docs:generate after documentation review, then npm run check, npm run build:all and npm run test:nosql. Fix failures rather than disabling checks, ignoring build errors or adding blanket casts. Add relevant SQL parity checks using an explicitly selected disposable database.
- Never apply database-schema.sql or seed loaders to an operational database. Add forward migrations; do not rewrite published migration files. Preserve the existing strict TLS policy.
- Never commit DB_config, logindetails, .env files, dependencies, runtimes, build outputs, logs or NoSQL/data. There is no standalone Demo folder or generated-build exception. npm ci is the installation contract.
- Use FindingsDataTable, WorkspaceTabs, native modal patterns and app/globals.css conventions. Preserve keyboard support, focus return, narrow layouts and loading/error/empty states.
- Document significant decisions in docs/adr. Keep validation claims tied to actual checks and avoid unrelated cleanup.
