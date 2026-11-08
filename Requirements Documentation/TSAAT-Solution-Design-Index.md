# TSAAT solution design index

The feature contracts below describe both SQL and JSON-backed No-SQL builds of the current application. Both use the same app server with direct page/API access, pages, APIs and reports; storage-specific details follow the [data provider contract](../docs/data-providers.md). Exact interfaces, SQL fields and API methods are linked through the generated inventories. The former combined specification is an entrypoint rather than a duplicate copy.

- [Workspace, navigation and scope](01-Home-Redirect.md)
- [Governance Insights executive briefing](15-Governance-Insights.md)
- [Governance Trends management briefing](17-Governance-Trends.md)
- [Cyber Security and impact analysers](02-Cyber-COP.md)
- [Network Risk Profile](03-Networks.md)
- [Network Details panel](04-Network-Detail.md)
- [ICT System Risk Profile](05-ICT-Systems.md)
- [ICT System Details panel](06-ICT-System-Detail.md)
- [Discovery workspace](07-Discovery.md)
- [Topology Explorer lookup and recorded paths](20-Topology-Explorer.md)
- [Installed Software Dashboard and Governance Insights](18-Installed-Software-Insights.md)
- [Life Cycle Management](16-Life-Cycle-Management.md)
- [Measures Summary, KPIs and SPIs](08-Measures.md)
- [Discovery Insights briefing](21-Discovery-Insights.md)
- [End Point Insights briefing](22-End-Point-Insights.md)
- [Security Vulnerability Insights briefing](23-Security-Vulnerability-Insights.md)
- [Measures Trends and period comparisons](19-Measures-Trends.md)
- [Findings Register and evidence](09-Findings-and-Evidence.md)
- [Briefs & Reports and export contracts](10-Report-Catalogue.md)
- [Settings](11-Settings.md)
- [Asset taxonomy and applicability](12-Asset-Taxonomy-and-SPI-Applicability.md)
- [Application access and retired login](13-Authentication-and-Login.md)

Cross-cutting: [Architecture](../docs/architecture.md), [UI design](../docs/ui-design.md), [Database lifecycle](../docs/database.md), [CMDB mappings](../docs/cmdb-asset-type-attributes.md), [Application inventory](../docs/generated/application-inventory.md), [Schema catalogue](../docs/generated/database-catalogue.md).

Update behavior, implementation references and validation expectations together. This index includes retired URL compatibility; it does not restore retired sidebar pages.

Mandatory cross-cutting acceptance: [Offline compilation](14-Offline-Compilation.md). Every future feature and dependency change must retain offline installation and both production builds from repository-contained packages and assets.
