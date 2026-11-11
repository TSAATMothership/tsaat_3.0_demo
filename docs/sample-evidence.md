# Shared weekly evidence

The committed tsaat-aligned-evidence-v1 sample bundle contains eight weekly snapshots from 2026-09-19 through 2026-11-07; data/current.json equals week-08.json. Both storage-v2 setup paths consume this exact evidence. At least four complete weeks, valid observations, applicable attributes and deliberate unknown/inapplicable states remain required.

The feature retirement projects out only findings/SPI/KPI/reference-version payloads, target-state inventories, server patch observations and OS major-version/N-minus inputs. Retained endpoint/software/vulnerability/CMDB/topology evidence and dates are unchanged. Discovery applicability/detection rules are retained.

Run npm run evidence:check (seed:validate is an alias). The former random SPI/finding seed generator, finding enrichment, evidence:prepare and populate:patches commands are retired. Existing sample stores may use populate:nosql, populate:vulnerabilities and the paired append-sample-evidence tools after their v2 upgrade. Preview first; apply only with explicit sample/demo acknowledgement and a full backup. Never seed or reset operational SQL from these commands.

Real provider parity is tests/inventory-provider-parity.test.ts, selected by TSAAT_EVIDENCE_PARITY_DATABASE=TSAAT_EvidenceParity_<unique> and an isolated absolute TSAAT_JSON_DATA_DIR. It compares all eight dates and identical scopes. Topology and CMDB have additional provider-specific coverage. A skipped SQL test is not a pass. See [upgrade/recovery](feature-retirement.md) and [data providers](data-providers.md).
