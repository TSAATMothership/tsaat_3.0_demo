# 0021 - CMDB drill-through for recorded model CIs

Status: Accepted, 2026-11-07.

Business services and mission capabilities already have stable IDs, names and criticality in SQL snapshot system-association tables and the corresponding JSON system collections. Topology renders these as model nodes, but CMDB previously accepted only endpoint types.

Recognise `business-service` and `mission-capability` as CMDB CI classes using their existing records. Resolve a CI by type plus ID, retain the selected snapshot, and show only associations within the requested network/system/domain context. Criticality may vary by related system; display the recorded values and system attribution. Do not fabricate endpoint-specific attributes or a model CI's security domain from an associated system. Endpoint taxonomy and measure populations remain unchanged.

Reuse the CMDB route, attribute-loader facade, persona permission and native modal. Add optional model-type request metadata and topology navigation identity while preserving endpoint callers. Both Impact Topology inspectors expose the action. External dependency model context supplies its recorded system scope without changing the header during inspection.

SQL migration 032 extends only CMDB configuration and records installation so reruns preserve deleted/empty sets. A paired explicit JSON reference upgrade uses a writer lock, backup and atomic replacement, preserving existing keys. Fresh setup includes aligned defaults; builds retain existing stores. Validate historical/domain parity on a disposable SQL database and isolated JSON store, upgrade preservation, API identity and nested modal keyboard behavior.
