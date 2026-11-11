# End Point Insights

Governance > **End Point Insights** appears below Discovery Insights at `/governance/end-point-insights`. End Point Explorer remains in Discovery. The briefing follows the Cyber Terrain, Installed Software and Discovery Insights visual system: navy/mint illustrated hero, snapshot/scope strip, four headline figures, five numbered chapter anchors, charts and evidence actions. Its local SVG is conceptual, not measured data.

## Story and interpretation

1. **The estate:** the same scoped records and CI-type/network facets as End Point Explorer, including every CI type it contains. This is the recorded inventory, not an estimate of all devices.
2. **Missing details:** all nine Explorer fields show missing/displayed counts. Empty/whitespace values use the existing Not recorded facet. Discovery dates instead use the existing missing/invalid age bucket. UNKNOWN security domains have their own review link and are not blank values. Field presence does not validate correctness or applicability; name/network identifier fallbacks remain explicit. Overlapping field gaps are never summed into an issue total.
3. **Discovery evidence:** all six discovery-age buckets and recorded source facets. More than 30 days is a review prompt measured against the resolved snapshot, not a new compliance rule. Future dates are separate from recent evidence.
4. **Coverage context:** the unchanged scoped Discovery Compliance inventory, required tool-to-CI checks, weighted coverage percentage, mapping exclusions and per-tool missing counts. Labels distinguish required tool coverage from the number of devices still undiscovered. No applicable checks is N/A. Shadow IT is a separate observation inventory, not an additive endpoint population or proof of undiscovered device counts.
5. **Next steps:** review identity, discovery evidence and coverage chapters, with expandable interpretation notes. Zero gaps never imply correctness, complete discovery or absence of devices.

Every count-bearing evidence link opens matching Explorer filters with applied network/system/domain and the resolved snapshot. Persona-aware links preserve the current access model. Chapter navigation, disclosure and evidence links are keyboard accessible. Charts have visible values; narrow layouts stack without horizontal overflow. Empty data has an explicit message; failed reads show a scoped Retry instead of misleading zeros. No records load before scope selection.

Generate PDF sits beside the snapshot and exports a scoped A4 briefing with these five chapters, complete field checks/distribution appendices, generation timestamp and page numbering. Shared progress, duplicate prevention, retry and keyboard-focus behavior match the other Insights pages. Scoped empty selections still export explicit empty evidence. See [report content, APIs and validation](../docs/inventory-insights-reports.md).

The PDF matches the page's TSAAT logo, endpoint illustration, icons, navy/mint theme and charts, including the coverage ring. Its first page gives half of the content area to an executive summary and half to recommendations. Evidence-grounded narrative paragraphs accompany every section, chart group and table; full scope and detailed evidence follow without changing the underlying measures.

Generation runs in the browser worker. The existing report URL supplies an uncached, versioned JSON job containing the full scoped endpoint projection and summary model; HTML bookmarks open the browser generation page. The **Generating Document** animation tracks preparation and rendered sections with cancellation and focus return. The server supplies data only and never constructs PDF bytes.

## Data and preferences

The route reuses `loadDiscoveryOverview` and the cached `loadEndpointExplorerData` facade at the overview's resolved snapshot. The component presents unchanged `endpointFacetCounts` and overview measures. No provider query, cohort, rule, score, persisted data, schema, settings format or calculation-contract checksum changes. Both compilation paths use these shared facades. No database migration or JSON upgrade is needed.

The new persona page ID is `governance-endpoint-insights`. Defaults include it. Existing saved page selections retain their explicit lists; they do not automatically gain a new page. Enable Governance and End Point Insights in Persona Settings to show it for such a persona. Existing routes and Explorer behavior remain compatible.

## Validation scope

Select page/no-scope/retry, navigation/persona, report/API and count-to-Explorer regression tests, plus the existing endpoint and discovery models. Use lint/types and a guarded compiled build, then browser checks for network/system, historical/domain scopes, keyboard anchors, evidence drill-through, PDF download/retry/focus, narrow layouts and empty state. Render and inspect reports, including complete distributions and long-label pagination. Refresh route/API/navigation inventories and check docs. The existing facet/measure algorithms, SQL/JSON contracts, dependencies and build configuration are unchanged; no new data calculation or storage gate is introduced by presenting these existing values.
