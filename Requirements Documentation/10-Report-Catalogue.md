# Report Catalogue

**Page Path:** `/report`

## 1. Page Overview
- **Page name:** Report Catalogue
- **Purpose:** provide a filtered launcher page for the application's generated reports and briefs.
- **User outcome:** the user can apply scope filters, locate the required report, and open the generated document for the current scope.
- **Primary user roles:** executives, cyber analysts, governance teams, network owners, ICT system owners, reporting users.

## 2. Page Summary
This page is a report launcher rather than an analytical dashboard. It loads the current snapshot date and shared filter scope, lets the user search within the report catalogue, and constructs report URLs that preserve the active filter context.

Major dependencies:

- `getCoreAppData()`
- `FilterBar`
- report-generation APIs:
  - `/api/report/summary`
  - `/api/networks/remediation-report`
  - `/api/systems/remediation-report`
  - `/api/systems/out-of-support-os-report`
  - `/api/systems/modelling-status-report`
  - `/api/discovery-coverage/remediation-report`

Important hidden behaviour:

- the page does not calculate report contents itself; it only assembles and launches URLs.
- report search is client-entered but server-rendered through the route query parameter `reportSearch`.
- the `Cyber Posture Summary` link always forces `format=pdf`.

## 3. Feature Breakdown
### Feature: Shared Report Filter Scope
- **What it does:** filters the report launcher by network, system, criticality, security domain, environment, asset type, severity, mission capability, and business service.
- **User perspective:** the user sets the report scope before opening a report.
- **System behaviour:** the page converts the current filter object into query-string entries and reuses them in each report URL. Asset-type values use the shared six-type taxonomy (`server`, `workstation`, `network-device`, `storage-device`, `printer-device`, `other`).
- **Outcome:** all reports open against the same selected scope.

### Feature: Text Search Reports
- **What it does:** filters the visible report catalogue rows by report name, description, and audience.
- **User perspective:** the user can quickly find the right report without changing the underlying report scope.
- **System behaviour:** the route preserves current scope parameters and adds or removes `reportSearch`.
- **Outcome:** text search changes the visible catalogue list only.

### Feature: Report Catalogue Table
- **What it does:** lists report name, description, audience, and a launch link for each report.
- **User perspective:** the user selects a report and opens it in a new browser tab.
- **System behaviour:** each row builds a specific API URL and appends the current filter scope.
- **Outcome:** the page acts as the central report-launch surface.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Report Catalogue | Shared scope | Common report scope filters | Apply filters | Rebuilds report URLs with current scope | filter query params | Scoped report links | all links must preserve the same filter context | filter parsing only | `FilterBar`, `getCoreAppData()` | Consistent report scope | |
| Report Catalogue | Report text search | Search visible catalogue rows | Enter text and submit | Updates `reportSearch` and filters row list | `reportSearch` | Reduced or restored list | search affects only catalogue visibility | empty search restores all rows | route query string | Faster report selection | no separate API call |
| Report Catalogue | Report launcher table | Report list and launch actions | Click `Load Report` | Opens the report endpoint in a new tab | current filters, report type | PDF or generated response from endpoint | `posture-summary` always includes `format=pdf` | row link existence only | report APIs | Launch selected report | page does not inspect report response |
| Report Catalogue | Clear search | Remove text-search term while keeping report scope | Click `Clear` | Rebuilds URL without `reportSearch` | current filter query params | Reset catalogue list | report scope must remain intact | none | route query string | Restored full catalogue | |

## 5. Database Mapping
The page itself has a light data footprint. It reads the active snapshot date and filter options, but does not directly query report content tables. The actual report data is loaded by the downstream report endpoints.

Primary data dependencies for the page itself:

- `tsaat.dataset_snapshot`
- reference and scope tables used to populate filter options, including `tsaat.managed_network` and `tsaat.ict_system`

Downstream report endpoints depend on broader operational tables, but those are outside the page's direct implementation.

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Report Catalogue | Snapshot label | `tsaat` | `dataset_snapshot` | `snapshot_date` | date | displays active snapshot date in page header | Read | latest snapshot unless `dataDate` supplied | direct display | none | |
| Report Catalogue | Filter options | `tsaat` | `managed_network`, `ict_system`, related scope tables | IDs and names used in filter options | mixed | shared filter controls | Read | standard filter option relationships | same as shared filter bar | direct display | no report content loaded here |
| Report Catalogue | Report output | multiple | downstream report endpoints | endpoint-specific | mixed | generated report content | Read via API | depends on selected report type | outside this page's direct scope | assembled by report endpoint | document separately if report internals are required |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Filter query assembly | keep report scope consistent | convert non-empty filter fields into query entries | route filters | Runtime | backend | omitted filters are not added to links |
| Report launcher URL | open the correct report for current scope | append query entries to base API path; for posture summary also append `format=pdf` | filter query entries | Runtime | backend | if no filters are selected, link is base endpoint |
| Catalogue text search | reduce visible report rows | include row when report name, description, or audience contains normalized search text | hard-coded report catalogue rows | Runtime | backend | zero results show a no-match row |

## 8. Non-Database Calculations
- Report rows are a hard-coded catalogue in the page implementation.
- Search matching is runtime string matching over report metadata, not database-backed search.
- Launch links open in a new tab and the page does not validate the returned document content.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped through shared navigation state and snapshot selection.
- The page itself is not a report generator; it is a scoped launcher.
- The visible report catalogue is fixed in code.
- Report content completeness and performance depend on each downstream API, not on this page.

## 10. Open Questions / Gaps
- **Open question:** should the report catalogue remain hard-coded, or should available reports be driven from configurable metadata?
- **Open question:** should the page indicate expected file type or generation time for each report endpoint?
- **Open question:** if report endpoint behaviour changes, should this page perform any preflight validation before opening the link?
