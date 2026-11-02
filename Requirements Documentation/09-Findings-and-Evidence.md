# Findings Register and evidence

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

Findings Register is the sole Findings sidebar page; Findings Summary and the former Overview tab are removed. Page-wide filters and the JSON export option are absent. Standard table search/header facets remain the shared interaction model rather than the removed standalone filter blocks.

The SPI column combines measure ID and description. Priority sits immediately before Severity and is not embedded in measure text. The recommendation-action column is removed; remediation remains available in appropriate detail/report contexts. Duration counts calendar days open since the finding timestamp at the selected snapshot. Closed findings have no open duration; invalid dates remain unknown and future timestamps clamp to zero. Duration header controls provide a numeric range and ascending/descending numeric sorting.

Affected CI drill-through shows Device Name, Device IP, Device Model, Last Discovered Date, Discovered By and Asset Type. The workbook export includes an affected-CI sheet based on the same scoped drill-through. Device actions open CMDB. Removed CI change/incident assignment groups and owner are not invented attributes; entity operational contacts remain separate.

Finding evidence, workflow and timestamp are distinct from current evaluation status. Priority and severity follow configured database mappings. Preserve the selected scope/date, canonical device metadata, deduplication and status filtering across register, drill-through and export. Generated files use existing safe text/CSV handling.

Sources: app/findings/page.tsx, lib/findings-register-data.ts, findings-duration.ts, findings-assets.ts, findings-export.ts, findings-workbook.ts, findings-config.ts and API handlers. Tests: findings-duration, findings-filter-dropdowns, findings-workbook, findings-asset-details-route and related export/configuration tests; generated inventory lists actual route files.
