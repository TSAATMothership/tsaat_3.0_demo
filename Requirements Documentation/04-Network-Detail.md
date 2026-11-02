# Network Details panel

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

Selecting a Network Explorer name opens an in-place right-hand panel, not a separate network drill-through page. The panel contains description, Operational Contacts, ATO details, DIIS details, Linked ICT Systems and Asset Footprint Summary. Values come from the current scoped snapshot; missing values are explicit.

Linked ICT system names open a new TSAAT browser tab with that system selected in the header and the same data date. The linked table omits Security Domain. ATO/DIIS numbers remain; the removed Cyber GRC Record and DIIS Record rows are not rendered. Assets are deduplicated and footprint counts cover the canonical types.

Network attributes live in managed_network and snapshot relationships, including description, owner, support_email, service_catalogue_url, ato_number and diis_id. Legacy /networks/[networkId] resolves to the current profile/details request. Migration 026 populates missing demo descriptions/contacts only, using labeled sample metadata and example.test addresses.

Sources: lib/network-details.ts, lib/risk-entity-details.ts, components/network-details-panel.tsx, risk-entity-details-panel.tsx and the legacy redirect route. Tests: network-details-redirect, network-risk-profile and risk-entity-panel-details-sql. Verify new-tab scope, date retention, focus return and narrow layout.
