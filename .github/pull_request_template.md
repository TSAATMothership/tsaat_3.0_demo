## Problem and resulting behavior

Describe the trigger, previous behavior and result. Link acceptance criteria.

## Validation

- [ ] npm run check
- [ ] npm run build:all (SQL and No-SQL)
- [ ] npm run test:nosql (compiled app, exports, persistent settings and restart)
- [ ] Applicable browser/keyboard/mobile, PDF/export and disposable-SQL checks recorded

## Documentation and provider compatibility

- [ ] Shared UI/API/report behavior works with both storage providers
- [ ] SQL/JSON rules, scope/date behavior, reference data and CMDB mappings reviewed
- [ ] Calculation-contract hashes refreshed only after equivalent behavior is verified
- [ ] Relevant feature/design/architecture/data docs and CHANGELOG updated
- [ ] npm run docs:generate reviewed
- [ ] Authentication and existing API/redirect contracts preserved

## Data and release impact

State SQL migrations and JSON format/data upgrade steps, rollout/recovery and limitations, or explain why none apply. Existing JSON stores must survive builds and upgrades; seed changes alone are not migrations. Never include secrets, mutable stores or operational extracts.

## Mandatory offline compilation

- [ ] All build packages/assets are repository-contained; no registry, CDN, lifecycle or build-time download fallback
- [ ] npm run offline:check passed; dependency changes include reviewed archives, lockfile and provenance manifest
- [ ] Fresh npm ci --offline with an empty cache passed, and both guarded builds passed
- [ ] CI outbound-denial gate passed; any prerequisite or dependency/license change is documented
