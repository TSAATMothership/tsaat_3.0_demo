# ICT Systems

**Page Path:** `/systems`

## 1. Page Overview
- **Page name:** ICT Systems
- **Purpose:** provide system-scoped overview, remediation, and posture roll-up reporting.
- **User outcome:** the user can compare ICT systems, identify modelling and discovery gaps, and drill into one system.
- **Primary user roles:** ICT system owners, cyber operations analysts, service delivery teams, governance users.

## 2. Page Summary
This page is the ICT-system equivalent of `/networks`. It provides `overview`, `action`, and `posture` tabs.

Major dependencies:

- `getTrendAppData()`
- `SystemsTabs`
- `SystemsOverviewPanel`, `SystemsActionPanel`, `SystemsPostureKpiSummary`
- `SystemsTable`
- `/api/systems/remediation-report`

Important hidden behaviour:

- the page explicitly strips the `network` query parameter before loading data so the systems view remains system-centric.

## 3. Feature Breakdown
### Feature: Shared ICT System Filter Scope
- **What it does:** filters the page by ICT system, criticality, security domain, environment, asset type, mission capability, business service, and date.
- **User perspective:** the user scopes the estate to the relevant systems and supporting context.
- **System behaviour:** the page hides the managed-network selector and removes any incoming `network` query parameter before data loading.
- **Outcome:** the page does not act as a network-filtered derivative view.

### Feature: Overview Tab
- **What it does:** shows overall posture, modelling coverage, risk profile, and trends for the current ICT system scope.
- **User perspective:** the user gets a system-focused summary.
- **System behaviour:** runtime calculations aggregate findings and evaluations by system.
- **Outcome:** users can compare posture and pressure at system level.

### Feature: Action Tab
- **What it does:** shows remediation pressure, backlog age, oldest findings, quick wins, and a remediation report link.
- **User perspective:** the user can turn posture into an action plan for ICT systems.
- **System behaviour:** the page calculates system-scoped backlog metrics and assembles a report URL using current filters.
- **Outcome:** the action surface matches current filters exactly.

### Feature: Posture Tab
- **What it does:** shows system KPI cards, blast radius chart inputs, a searchable system table, summary slideout, and drill-down links.
- **User perspective:** the user can compare systems, inspect a quick summary, or navigate to the full detail page.
- **System behaviour:** each row includes overall posture, production posture, compliance score, discovery score, and drill-down link.
- **Outcome:** this page is the main routing surface for `/systems/[systemId]`.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ICT Systems | Tab routing | Switches among overview, action, posture | Click tab | Updates `systemsTab` query parameter | `systemsTab` | Different tab layout | overview is default | unsupported values fall back to overview | `SystemsTabs` | Bookmarkable tab state | |
| ICT Systems | Shared scope | Common filter scope for systems | Apply filters | Re-runs analytics without using incoming `network` filter | filter query params except `network` | Filtered systems view | page ignores managed network as a controlling input | query parsing only | `FilterBar`, `getTrendAppData()` | System-centric view | hidden implementation rule |
| ICT Systems | Overview | System posture dashboard | Open tab | Builds system compliance, modelling, and risk summaries | systems, findings, evaluations | Dashboard cards and charts | system scope only | zero-safe percentages | analytics and trend snapshots | System summary | |
| ICT Systems | Action | Remediation board | Open tab or generate report | Calculates backlog and links to report endpoint | findings, lifecycle, modelling flags | Action board and PDF link | report reflects current filters | none beyond scope parsing | `/api/systems/remediation-report` | Action planning | |
| ICT Systems | Posture table | Roll-up comparison and drill-down surface | Search, open slideout, drill down | Builds row model for each system | system rows, rollups, scores | Table, slideout, drill-down link | one row per system | search is client-side | `SystemsTable`, `SystemsTableClient` | Compare systems and navigate | slideout uses fallback metadata |

## 5. Database Mapping
The page reads the shared snapshot dataset, then re-aggregates it around ICT systems rather than managed networks.

Primary data dependencies:

- `tsaat.ict_system`
- `tsaat.system_mission_capability` and `tsaat.system_business_service`
- `tsaat.system_environment` and `tsaat.system_environment_asset`
- `tsaat.asset` and child posture tables
- `tsaat.finding`
- measures and discovery settings tables

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ICT Systems | System identity | `tsaat` | `ict_system` | `system_id`, `name`, `criticality`, `security_domain`, `modelling_status`, `diis_defined`, detail columns | mixed | row identity, posture context, slideout data | Read | assets and findings join via `system_id` | fallback metadata allowed | direct display and rollups | |
| ICT Systems | Mission and service context | `tsaat` | `system_mission_capability`, `system_business_service` | IDs, names, criticality | string | posture table columns and slideout context | Read | one system to many capabilities and services | none | joined into comma-separated labels | |
| ICT Systems | Environment scope | `tsaat` | `system_environment`, `system_environment_asset` | `environment_id`, `environment_type`, `asset_id` | string | production posture and discovery scope | Read | environment rows tie systems to assets | none | environment-aware counts | |
| ICT Systems | Asset posture | `tsaat` | `asset` and child posture tables | asset identity, lifecycle, OS, software, vulnerability columns | mixed | compliance scores, discovery scores, action metrics | Read | system-scoped through asset context | filtered through shared scope | runtime evaluation and counts | canonical `asset_type` values are `server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other` |
| ICT Systems | Findings | `tsaat` | `finding` | scope columns, severity, priority, timestamps | mixed | risk summaries and action metrics | Read | grouped by `system_id` | severity remap applies | runtime only | |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Systems compliance | overview tile | compliant system rollup counts divided by total system rollup counts | runtime system rollups | Runtime | backend | zero-safe |
| Compliance score by system | posture table | compliant statuses in system divided by total statuses in system | runtime evaluations | Runtime | backend | separate from overall posture precedence |
| Discovery compliance by system | posture table | compliant discovery evaluations in system divided by total evaluations in system | runtime evaluations | Runtime | backend | requires at least one evaluated asset |
| Production posture | posture table | `deriveOverallStatus()` over production environment rollups for the system | environment rollups | Runtime | backend | returns `Unknown` if no production rollups |
| Modelled system coverage | overview modelling card | systems with `modellingStatus = true` divided by total systems | `ict_system.modelling_status` | Runtime | backend | not limited to `diis_defined` here |
| Immediate action | action tab | open High Risk + open Critical Exposure findings | findings | Runtime | backend | severity remap already applied |
| Non-compliant OS count | action tab | count server and workstation evaluations with SPI 1 or 2 = `Non-compliant` in system scope | runtime evaluations | Runtime | backend | `network-device`, `storage-device`, `printer-device`, and `other` are excluded because they do not evaluate SPI 1/2 |
| Quick wins | action tab | group open findings by identical recommended action text and count affected systems | findings | Runtime | backend | missing action text grouped to a default label |

## 8. Non-Database Calculations
- The page strips `network` from incoming query parameters before data loading.
- Blast-radius selection and table search are client-side only.
- Slideout data comes from the in-memory row model, not an extra API call.
- Report links are assembled from the current query string and executed only when opened.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped.
- The visible filter bar intentionally hides the managed-network selector.
- The server implementation also ignores incoming `network` filters.
- Slideouts may show fallback-generated metadata where source system fields are blank.

## 10. Open Questions / Gaps
- **Open question:** should the page continue to ignore incoming `network` filters, or should cross-navigation from a network view be able to scope systems by parent network?
- **Open question:** should overview `DPE` and `DSE` labels use environment type or security domain? The implementation follows environment type, which differs from KPI definitions.
- **Open question:** should the production-posture column explain that it is calculated from production environment rollups rather than a separate stored field?
