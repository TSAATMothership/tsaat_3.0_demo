# Cyber Security and impact analysers

Current contract: TSAAT UI 3 baseline, 2026-11-02. Maintain with related source changes; see [SDLC](../docs/sdlc.md).

Visible entrypoints are the two risk profiles, Service Impact Analyser and Network/ICT System Impact Analysers. app/cyber-cop/page.tsx selects the analyser via copView. The overview value remains a compatibility route, not a sidebar page.

Service Impact has Scope & Selection and Explore the Impact tabs. The first owns scope controls, counts, business/mission selection, ICT system selection and guidance. The second owns SPI findings, server risk heatmap, environments and service/mission impact. Selection/search state persists across tabs; Explore selection opens the analysis tab. The default critical/high focus is explicit. Model builders deduplicate assets and findings, preserve canonical system attribution and keep empty selections from broadening scope. Finding counts open details with Findings, Affected CIs, High-risk CVEs and Finding duration tabs.

Network/ICT diagrams are run-gated and use lazy data APIs, worker filtering and scalable Canvas/WebGL rendering. Source/related asset metadata, directed modeled relationships and the active snapshot determine diagram scope. Selecting an eligible asset exposes separate CMDB and compliance actions.

The shared asset compliance view uses the native settings-popup dimensions. Security Posture, Findings and Discovery Coverage tabs use the standard table controls. SPIs start with lowest compliance; result pills have equal widths. Summary bars show compliance/non-compliance/unknown and a numeric percentage, with N/A for no scored data. Discovery score excludes unavailable values from its denominator, as explained in the UI. Findings support priority, severity, workflow, timestamp and numeric Duration filters/sorts. Expanded findings show evidence/remediation. SPI details expose evaluation evidence and all reasons. Discovery rows retain tool value, owner and operations manager.

Escape closes table menus before SPI detail and the outer modal; focus returns to its trigger. Search persists across normal tabs. Count shortcuts open the appropriate scope. Loading, abort, retry and empty states do not fabricate compliance.

Sources: lib/service-impact.ts, lib/server-compliance.ts, components/service-impact-analyser.tsx, service-impact-findings-panel.tsx, ict-system-impact-analyser-2.tsx and server-compliance-view.tsx. Tests: service-impact, service-impact-page, server-compliance, cyber-cop-impact-analyser-2, cyber-cop-network-diagram. Validate keyboard/modal behavior and both diagram entrypoints in a browser.
