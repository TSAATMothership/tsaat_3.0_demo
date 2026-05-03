# Findings and Evidence

**Page Path:** `/findings`

## 1. Page Overview
- **Page name:** Findings and Evidence
- **Purpose:** provide the findings history view, compliance-detail style register, export surface, and evidence drillthroughs for linked assets.
- **User outcome:** the user can review open or closed findings as of a selected date, analyse the trend over time, and export or inspect evidence at finding, CI, and CVE level.
- **Primary user roles:** cyber analysts, remediation coordinators, governance teams, auditors, reporting users.

## 2. Page Summary
This page provides `overview` and `register` views, combined with `open` and `closed` status tabs.

Major dependencies:

- `getCoreAppData()`
- `FindingsViewTabs`
- `FindingsStatusTabs`
- `FindingsTimelineFilter`
- `FindingsHistoryDrillthrough`
- `FindingsTable`
- `/api/findings/export`
- `/api/findings/asset-details`
- `workflowStatusAtAsOf()`

Important hidden behaviour:

- the page clamps the selected `asOf` date to the last two years and no later than the snapshot date.
- workflow status is reconstructed at runtime from open and close timestamps rather than taken directly from the stored status field.
- the history drillthrough is a non-route overlay triggered by `historyDrillthrough=1`.
- if persisted findings are unavailable, the underlying analytics layer may generate synthetic findings from non-compliant or unknown evaluations.

## 3. Feature Breakdown
### Feature: Shared Findings Filter Scope
- **What it does:** filters the page by the shared scope plus findings-specific SPI, priority, severity, search, status, view, page, and as-of date parameters.
- **User perspective:** the user can narrow the findings set to the relevant scope and time slice.
- **System behaviour:** the page loads the shared filtered analytics, reconstructs open or closed status at `asOf`, and then applies findings-specific filters; the Overview view hides and ignores the system criticality filter.
- **Outcome:** the findings set reflects both structural scope and time-based workflow reconstruction.

### Feature: Overview View
- **What it does:** shows findings history, summary cards, asset-type summaries, and SPI summaries.
- **User perspective:** the user gets a trend-focused understanding of findings pressure before looking at individual rows.
- **System behaviour:** the page builds a two-year daily history series, an SPI-specific history series, and card counts from the currently filtered findings set; asset-type summaries use the shared canonical asset taxonomy.
- **Outcome:** the page acts as the analytical overview for open or closed findings.

### Feature: Findings History Drillthrough
- **What it does:** opens a full-screen drillthrough with per-SPI trend lines.
- **User perspective:** the user can inspect how findings accumulated or closed by SPI over the last two years.
- **System behaviour:** the drillthrough preserves current filters and status tabs, and uses `historyDrillthrough=1` to toggle the overlay state.
- **Outcome:** users can inspect trend detail without leaving `/findings`.

### Feature: Register View
- **What it does:** shows a scrollable compliance-detail style findings worklist with evidence, exports, and selected-row CI/CVE drillthrough.
- **User perspective:** the user can review all finding rows in the current filter scope, open affected CI details from a finding title, inspect CVEs for that CI, and export the filtered register.
- **System behaviour:** the page renders the filtered result set directly, builds URL-aligned export links for CSV or JSON, and builds the affected-CI drillthrough from the selected finding row plus the snapshot CVE index. `/api/findings/asset-details` remains as a retained compatibility endpoint for older drillthrough paths.
- **Outcome:** the register is the operational findings worklist and evidence source without separate pagination.

## 4. Feature Detail Table
| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Findings and Evidence | View routing | Switches between overview and register | Click view tab | Updates `findingsViewTab` query parameter; opening overview clears `criticality` and `spi` query state | `findingsViewTab` | Different layout | overview is default; overview ignores system criticality | unsupported values fall back to overview | `FindingsViewTabs` | Bookmarkable view state | |
| Findings and Evidence | Status routing | Switches between open and closed findings | Click status tab | Dismisses any open register affected-CI/CVE overlays, then updates `findingsTab` query parameter | `findingsTab` | Open or closed scope | open is default | unsupported values fall back to open | `FindingsStatusTabs` | Bookmarkable workflow state | |
| Findings and Evidence | As-of timeline filter | Changes date used to reconstruct workflow state | Pick date | Clamps date and recomputes timeline status for each finding | `asOf` | Rebuilt findings set and charts | max date is current snapshot date; min date is two years earlier | invalid or out-of-range dates are corrected | `workflowStatusAtAsOf()` | Stable as-of reporting | hidden clamping rule |
| Findings and Evidence | Overview analytics | Two-year trend and summary cards | Open overview | Builds daily history points and summary cards | findings, reconstructed statuses | Trend chart, cards, summaries | overview can include SPI filter not shown on register | zero-safe counts | chart components | Analytical overview | |
| Findings and Evidence | History drillthrough | Full-screen SPI trend analysis | Click drillthrough action | Toggles `historyDrillthrough=1` and renders overlay | current filter state plus history series | Overlay charts | overlay preserves current findings scope | none beyond preserved query params | `FindingsHistoryDrillthrough` | Deep trend analysis | non-route overlay |
| Findings and Evidence | Register table | Compliance-detail style register with evidence | Open register, filter, export, open affected CIs and CVEs | Renders all filtered rows in a scrollable table, exposes priority in the tab filter bar, builds export URLs, and derives selected-row CI/CVE details client-side | filtered findings, CVE index, `asOf`, search params | Table, export files, affected-CIs slideout, CVE modal | register-specific filters are URL-aligned; no register pagination | unsupported filters are ignored by existing parsing | `FindingsTable`, export API, retained asset-details API | Operational findings list | selected-row drillthrough is client-side |

## 5. Database Mapping
The page reads the filtered findings set from runtime analytics. That set may come from persisted `tsaat.finding` rows or, when absent, from synthetic findings generated from evaluation outcomes.

Primary data dependencies:

- `tsaat.finding`
- `tsaat.asset`
- `tsaat.asset_vulnerability`
- `tsaat.ict_system`
- `tsaat.managed_network`
- measures settings tables used for severity and non-compliant priority remap

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Findings and Evidence | Findings register | `tsaat` | `finding` | `finding_id`, `spi_id`, `priority_rank`, `severity`, `compliance_status`, scope columns, `title`, `evidence`, `recommended_action`, `workflow_status`, `observed_at`, `closed_at` | mixed | main finding rows, trend input, exports | Read | findings join back to asset, system, and network by scope fields | severity and non-compliant priority may be remapped at runtime | as-of status reconstructed from timestamps | synthetic fallback may replace missing persisted rows |
| Findings and Evidence | Asset evidence drillthrough | `tsaat` | `asset`, `asset_vulnerability` | asset identity, type, IP, vulnerability fields | mixed | affected CI and CVE details for a selected finding | Read | register uses the selected finding row; compatibility API can narrow rows by current findings context | scoped to active finding filters and as-of date | CVE details use the snapshot vulnerability index and criticality filter | |
| Findings and Evidence | Scope context | `tsaat` | `ict_system`, `managed_network` | IDs and names | mixed | scope filtering, search text, export context | Read | findings link through scope columns | none | direct display outside the register table | |
| Findings and Evidence | Measures remap context | `tsaat` | `measures_settings_version`, `measures_severity_matrix`, `measures_priority_matrix` | SPI severity and priority mappings | mixed | determines visible severity and non-compliant priority on page and exports | Read | latest settings version applied | defaults if settings are absent | runtime rewrite before display | Unknown/Data Gap remains P90 |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Workflow status at as-of date | decide whether a finding is open or closed on a selected date | if opened after `asOf`, exclude; if closed on or before `asOf`, status is closed; otherwise open | finding timestamps | Runtime | backend and shared utility | derived from timestamps, not stored workflow field |
| Findings history series | trend chart on overview | start from opening balance at history start date, then add opened findings and subtract closed findings per day | finding timestamps over two years | Runtime | backend | open and closed modes use different accumulation logic |
| SPI history series | drillthrough line chart | build a separate running count per SPI across each day in the history window | finding timestamps, SPI ID | Runtime | backend | one line per SPI present in catalogue |
| Summary cards | top-level status counts | count filtered findings by severity and priority classes | filtered findings | Runtime | backend | zero-safe |
| Asset-type summary | compare findings by asset type | group findings by `evidence.assetType` and count total, High Risk, Critical Exposure, and P1/P2 | findings evidence | Runtime | backend | dynamic grouping supports `server`, `workstation`, `network-device`, `storage-device`, `printer-device`, and `other` |
| Register worklist rendering | operational table display | render all filtered rows inside the scrollable register panel | filtered findings, query params | Runtime | backend/client | no register pagination |
| Findings export | filtered register output | re-run active filters and emit CSV or JSON rows, including as-of status | findings plus query params | Runtime | API layer | export uses same as-of reconstruction as page |
| CVE drillthrough filter | selected-CI vulnerability review | filter selected asset CVEs by text and `CVE Criticality` | asset vulnerabilities | Runtime | client | CSV export uses the filtered CVE rows |
| Synthetic findings fallback | keep findings surfaces populated | create deterministic findings from non-compliant or unknown evaluations, assigning severity, priority, and timestamps | runtime evaluations and vulnerabilities | Runtime | backend | only used when no persisted findings exist |

## 8. Non-Database Calculations
- Overview cards, SPI summaries, and chart labels are runtime-only display aggregations.
- The history drillthrough open and close states are client-side overlay state controlled by a query parameter.
- Affected-CI and CVE CSV generation is performed in the browser from the selected finding row and snapshot vulnerability index.
- Open/Closed Findings tab changes dispatch a client-side dismissal event so register overlays close before the new view loads.
- Search matching is application logic over concatenated finding text and evidence content.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped through the underlying snapshot date and explicit `asOf` control.
- `asOf` is limited to the two-year history window ending at the active snapshot date.
- The register table is scrollable and does not paginate rows.
- Visible severity may differ from persisted `finding.severity` due to measures severity remap; non-compliant priority may differ from persisted `finding.priority_rank` due to measures priority remap.
- Asset-type summaries use the shared six-type taxonomy and do not assume a fixed 3-column model.
- Affected-CI drillthrough is scoped to the selected register row; `/api/findings/asset-details` remains available for compatibility with older asset-details paths.

## 10. Open Questions / Gaps
- **Open question:** should the page clearly indicate when the findings set is synthetic because `tsaat.finding` had no rows for the selected snapshot?
- **Open question:** should the stored `workflow_status` field continue to be ignored in favour of reconstructed as-of logic, or should discrepancies be surfaced?
- **Open question:** is the two-year history window a fixed business rule, or should it be configurable?
