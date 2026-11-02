# Repository working instructions

- Start with README.md, docs/README.md and the relevant feature specification.
- Preserve header scope, selected snapshot dates, configurable SQL definitions, authentication and compatibility routes.
- Update code, meaningful tests, feature/design/architecture documentation and SQL documentation in the same change. Record user-visible changes in CHANGELOG.md.
- Run `npm run docs:generate` after documentation review, then `npm run check` and `npm run build`. Fix failures rather than disabling checks, ignoring build errors or adding blanket casts.
- Run SQL integration only against an explicitly selected disposable database. Never apply database-schema.sql or seed loaders to an operational database. Add forward migrations; do not rewrite published migration files.
- Never commit DB_config, logindetails, .env files, dependencies, runtimes, build outputs or logs. `npm ci` is the installation contract.
- Use FindingsDataTable, WorkspaceTabs, native modal patterns and app/globals.css conventions. Preserve keyboard support, focus return, narrow layouts and loading/error/empty states.
- Document significant decisions in docs/adr. Keep validation claims tied to actual checks and avoid unrelated cleanup.
