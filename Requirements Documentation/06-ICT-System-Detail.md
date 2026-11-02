# ICT System Details panel

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

Selecting an ICT System Explorer name opens the shared right-hand entity panel. It shows description, Operational Contacts, ATO details, DIIS details, APP-ID, Linked Networks and Asset Footprint Summary. APP-ID is backed by ict_system.apm_number and labeled APP-ID Number. The removed Cyber GRC Record and DIIS Record rows are absent.

Linked network names open a new TSAAT browser tab with that network selected and the same date. The linked table omits Security Domain. The panel uses canonical declared/assigned/environment relationships to deduplicate linked networks and assets; a network link alone must not broaden unrelated system data.

Stored description, owner, support_email, service_catalogue_url, ato_number, diis_id and apm_number provide details. Missing values remain explicit. Legacy /systems/[systemId] redirects to the current profile/details request. Demo backfill 026 preserves existing identifiers, compliance flags and relationships.

Sources: lib/ict-system-details.ts, lib/risk-entity-details.ts, components/ict-system-details-panel.tsx, shared risk-entity-details-panel and legacy route. Tests: ict-system-details-redirect, ict-system-risk-profile and risk-entity-panel-details-sql.
