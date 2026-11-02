# Network Risk Profile

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

Network Risk Profile is the current network posture workspace. Header networks and snapshot constrain the model. Tabs are Network Risk Profile, Network Explorer and Compliance Heatmap. Network Explorer is a searchable/filterable scrollable table with all matching networks, without pagination. Every explorer row drill-through opens a new browser tab. Selecting a network name opens its Network Details panel in the new tab, with that network and the same resolved snapshot selected. CI counts, SPI/discovery coverage and finding counts retain their destination-specific presets, including severity and duration. The original explorer keeps its scope, review focus, search and sort.

Risk summaries and finding counts derive from the scoped model rather than duplicated page calculations. Critical/high findings over time can expand to a Settings-sized chart modal. Finding severity, priority, duration and compliance must retain their separate meanings. Counts and drill-through share the same scope/date.

Compliance Heatmap maps individual devices to configured SPIs: green compliant, red non-compliant, orange unknown. Default cells are 40px and can scale. Text search and result filters narrow devices. Device ordering groups compliance states; SPI severity increases towards the right. The retired network-to-SPI aggregate heatmap is not a separate tab/page.

The /networks route redirects to the current profile with scope/date; it is not the old overview page. Sources: app/network-risk-profile/page.tsx, lib/network-risk-profile.ts, lib/risk-profile.ts, components/risk-profile.tsx and compliance-heatmap.tsx. Tests: network-risk-profile, network-risk-profile-page, compliance-heatmap and posture-page-redirects.

The network SQL model no longer stores the unused apm_number field (migration 027). Network ATO/DIIS, contacts, description, linked systems, discovery and topology relationships remain unchanged. APP-ID continues to belong to ICT systems.
