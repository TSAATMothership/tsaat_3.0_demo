# Security domain scope

The header offers PROTECTED, SECRET and UNKNOWN. All three are selected initially. Changes use the existing Update interaction and retain the selected snapshot and network/ICT-system scope. Selecting none is an explicit empty result; it never means all. Network and ICT options are narrowed by their own domain, while selected options remain available for removal. Keyboard dismissal returns focus to the trigger. Navigation, compatibility links, impact windows, reports and inventory exports retain applied domains.

Each endpoint, ICT system and managed-network model has a required securityDomain. It describes that entity, independently of its parent: mixed-domain inventories remain possible. Endpoint and observation views filter the endpoint's domain; model lists filter the model's domain. UNKNOWN represents unavailable or unsupported classification. This filter does not change authentication or grant access. Domain selection alone does not replace the required network/system workspace scope.

## Representation and compatibility

Canonical JSON/TypeScript values and SQL security_domain values are PROTECTED, SECRET, UNKNOWN. Legacy Secret and Protected normalize to uppercase; Unclassified, missing and unsupported values normalize to UNKNOWN. Networks without a domain derive it from classification: Protected becomes PROTECTED, Restricted becomes SECRET (the existing seed rule), and other/missing classifications become UNKNOWN. Explicit network domains take precedence. Classification is retained as a separate attribute. Historical observation values, IDs, dates, findings and settings are unchanged.

URLs omit securityDomain for all three, use a canonical comma-separated subset otherwise, and use NONE for an explicitly empty selection. Legacy names and repeated URL parameters are accepted; export bodies reject invalid values. Provider cache keys include the selection. JSON reads normalize old stores in memory without writing; fresh-store setup normalizes new snapshots. Build/setup never migrate an existing store.

## Upgrade

SQL: back up the selected database and apply forward migration Database Schema/migrations/030_security_domains.sql after 029 during a maintenance window. It is transactional and rerunnable, adds the network column, normalizes all snapshots, and enforces non-null canonical domains/default UNKNOWN on all three entity tables. Do not apply database-schema.sql or seed loaders to an operational database. Fresh disposable databases use the updated schema and loader. SQL exports include network domains. Existing strict TLS policy remains required.

JSON: preview with npm run migrate:security-domains -- --target <store-directory>. Apply the explicit command npm run migrate:security-domains -- --target <store-directory> --apply --backup-directory <new-backup-directory>. This explicit format migration does not require the sample-population flag. It backs up the whole store, preserves settings/source provenance, writes new immutable snapshot files and atomically switches the manifest. Snapshot IDs/dates remain stable; the manifest records security-domains-v1 in dataMigrations. A repeat is a no-op. Restore the complete backup with the compatible prior application to roll back. Never manually delete an active writer lock.

## Verification

Regression coverage includes normalization/default/none semantics, independent entity partitions, navigation/date preservation, SQL query and cache isolation, JSON explorer partitions and non-destructive/idempotent migration. The production JSON smoke tests exercise the header, staged Update, keyboard focus, empty selection and sidebar query retention. Offline dependencies are unchanged.

Live SQL migration parity is opt-in: explicitly select an empty disposable TSAAT_DomainParity_* database using TSAAT_DOMAIN_PARITY_SERVER and TSAAT_DOMAIN_PARITY_DATABASE, then run npx vitest run tests/security-domain-sql.test.ts. The test uses trusted TLS, creates a legacy fixture and runs migration 030 twice within a rolled-back transaction. It refuses an existing tsaat schema. An unconfigured target skips this integration test and does not establish live SQL parity.
