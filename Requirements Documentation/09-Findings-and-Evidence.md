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
- `loadSnapshotEffectiveFindings()`
- `tsaat.usp_get_effective_findings_snapshot`
- `tsaat.usp_get_finding_history_snapshot`
- `tsaat.usp_get_finding_spi_history_snapshot`

Important hidden behaviour:

- the page clamps the selected `asOf` date to the last two years and no later than the snapshot date.
- workflow status for as-of effective rows is reconstructed by SQL Server from open and close timestamps rather than taken directly from the stored status field.
- the history drillthrough is a non-route overlay triggered by `historyDrillthrough=1`.
- if persisted findings are unavailable, SQL Server generates deterministic SPI findings through the database-backed findings fallback procedure.
- severity/priority/status buckets, evidence display mappings, and register/export display definitions are loaded from database finding metadata tables.

## 3. Feature Breakdown
### Feature: Shared Findings Filter Scope
- **What it does:** filters the page by the shared scope plus findings-specific SPI, priority, severity, search, status, view, page, and as-of date parameters.
- **User perspective:** the user can narrow the findings set to the relevant scope and time slice.
- **System behaviour:** the page loads shared filtered analytics, loads SQL-produced effective finding rows for the selected `asOf`, and then applies findings-specific filters; the Overview view hides and ignores the system criticality filter.
- **Outcome:** the findings set reflects both structural scope and time-based workflow reconstruction.

### Feature: Overview View
- **What it does:** shows findings history, summary cards, asset-type summaries, and SPI summaries.
- **User perspective:** the user gets a trend-focused understanding of findings pressure before looking at individual rows.
- **System behaviour:** the page builds a two-year daily history series, an SPI-specific history series, and card counts from SQL-produced effective findings plus database-backed bucket definitions; asset-type summaries use the shared canonical asset taxonomy and database-backed evidence mappings.
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
| Findings and Evidence | As-of timeline filter | Changes date used to reconstruct workflow state | Pick date | Clamps date and reloads SQL effective findings for the selected date | `asOf` | Rebuilt findings set and charts | max date is current snapshot date; min date is two years earlier | invalid or out-of-range dates are corrected | `loadSnapshotEffectiveFindings()`, `usp_get_effective_findings_snapshot` | Stable as-of reporting | hidden clamping rule |
| Findings and Evidence | Overview analytics | Two-year trend and summary cards | Open overview | Builds daily history points and summary cards from DB-produced findings and DB-backed bucket semantics | findings, reconstructed statuses, finding buckets | Trend chart, cards, summaries | overview can include SPI filter not shown on register | zero-safe counts | chart components, finding metadata tables | Analytical overview | |
| Findings and Evidence | History drillthrough | Full-screen SPI trend analysis | Click drillthrough action | Toggles `historyDrillthrough=1` and renders overlay | current filter state plus history series | Overlay charts | overlay preserves current findings scope | none beyond preserved query params | `FindingsHistoryDrillthrough` | Deep trend analysis | non-route overlay |
| Findings and Evidence | Register table | Compliance-detail style register with evidence | Open register, filter, export, open affected CIs and CVEs | Renders all filtered rows in a scrollable table, exposes priority in the tab filter bar, builds export URLs, and derives selected-row CI/CVE details client-side | filtered findings, CVE index, `asOf`, search params | Table, export files, affected-CIs slideout, CVE modal | register-specific filters are URL-aligned; no register pagination | unsupported filters are ignored by existing parsing | `FindingsTable`, export API, retained asset-details API | Operational findings list | selected-row drillthrough is client-side |

## 5. Database Mapping
The page reads SQL-produced effective finding rows. Persisted `tsaat.finding` rows remain authoritative when present; when a snapshot has no persisted findings, SQL Server generates deterministic SPI findings from SQL SPI evaluations and database-backed classification rules.

Primary data dependencies:

- `tsaat.finding`
- `tsaat.finding_source_policy`
- `tsaat.finding_generation_policy`
- `tsaat.finding_workflow_status_definition`
- `tsaat.finding_bucket_definition`
- `tsaat.finding_evidence_field_definition`
- `tsaat.finding_register_column_definition`
- `tsaat.vw_persisted_finding_normalized`
- `tsaat.usp_generate_spi_findings_snapshot`
- `tsaat.usp_get_effective_findings_snapshot`
- `tsaat.usp_get_finding_history_snapshot`
- `tsaat.usp_get_finding_spi_history_snapshot`
- `tsaat.asset`
- `tsaat.asset_vulnerability`
- `tsaat.ict_system`
- `tsaat.managed_network`
- measures settings tables used by SQL effective findings for visible severity and non-compliant priority remap

## 6. Database Mapping Table
| Page Name | Feature Name | Schema | Table | Column | Data Type (if known) | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Findings and Evidence | Effective findings | `tsaat` | `usp_get_effective_findings_snapshot`, `vw_persisted_finding_normalized`, `finding` | finding identity, SPI, display/raw severity and priority, scope, evidence, workflow timestamps | mixed | main finding rows, trend input, exports | Read | persisted-first policy; generated fallback only when no persisted rows exist | latest measures settings applied in SQL | SQL reconstructs as-of status and emits display rows | persisted rows remain authoritative |
| Findings and Evidence | Finding metadata | `tsaat` | `finding_source_policy`, `finding_generation_policy`, `finding_workflow_status_definition`, `finding_bucket_definition`, `finding_evidence_field_definition`, `finding_register_column_definition` | policy, bucket, evidence, register labels and keys | mixed | source selection, generated fallback, grouping labels, evidence mapping, register/export semantics | Read | loaded as metadata through `lib/data-loader.ts` | seed preserves current labels and grouping | app renders using DB metadata | unsupported UI execution is not stored in DB |
| Findings and Evidence | Asset evidence drillthrough | `tsaat` | `asset`, `asset_vulnerability` | asset identity, type, IP, vulnerability fields | mixed | affected CI and CVE details for a selected finding | Read | register uses the selected finding row; compatibility API can narrow rows by current findings context | scoped to active finding filters and as-of date | CVE details use the snapshot vulnerability index and criticality filter | |
| Findings and Evidence | Scope context | `tsaat` | `ict_system`, `managed_network` | IDs and names | mixed | scope filtering, search text, export context | Read | findings link through scope columns | none | direct display outside the register table | |
| Findings and Evidence | Measures remap context | `tsaat` | `measures_settings_version`, `measures_severity_matrix`, `measures_priority_matrix` | SPI severity and priority mappings | mixed | determines visible severity and non-compliant priority on page and exports | Read | latest settings version applied | defaults if settings are absent | runtime rewrite before display | Unknown/Data Gap remains P90 |

## 7. Calculations and Derived Logic
| Calculation Name | Business Purpose | Formula / Logic | Source Fields / Tables | Stored or Runtime | Processing Layer | Edge Cases / Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Workflow status at as-of date | decide whether a finding is open or closed on a selected date | SQL excludes findings opened after `asOf`; SQL marks findings closed when closed on or before `asOf`, otherwise open | finding timestamps | Runtime SQL result | SQL Server | derived from timestamps, not stored workflow field |
| Findings history series | trend chart on overview | database procedure can aggregate opening balance plus opened/closed daily deltas over the configured window | finding timestamps and workflow status definitions | Runtime SQL result | SQL Server | open and closed modes use different accumulation logic |
| SPI history series | drillthrough line chart | database procedure can build a separate running count per SPI across each day in the history window | finding timestamps, SPI ID, SPI definitions | Runtime SQL result | SQL Server | one line per active SPI present in catalogue |
| Summary cards | top-level status counts | count filtered findings by database-backed severity/priority buckets | filtered findings, `finding_bucket_definition` | Runtime display over DB metadata | backend | zero-safe |
| Asset-type summary | compare findings by asset type | group findings by configured evidence field mapping and database-backed buckets | findings evidence, `finding_evidence_field_definition`, `finding_bucket_definition` | Runtime display over DB metadata | backend | dynamic grouping supports canonical asset taxonomy |
| Register worklist rendering | operational table display | render all filtered rows inside the scrollable register panel | filtered findings, query params | Runtime | backend/client | no register pagination |
| Findings export | filtered register output | re-run active filters against SQL effective findings and emit CSV or JSON rows | findings plus query params | Runtime over SQL result | API layer | export uses same SQL as-of reconstruction as page |
| CVE drillthrough filter | selected-CI vulnerability review | filter selected asset CVEs by text and `CVE Criticality` | asset vulnerabilities | Runtime | client | CSV export uses the filtered CVE rows |
| Generated findings fallback | keep findings surfaces populated | SQL creates deterministic findings from non-compliant or unknown SPI evaluations, assigning severity, priority, status, and timestamps from DB policy/config | SQL SPI evaluations, SPI classification rules, finding generation policy | Runtime SQL result | SQL Server | only used when no persisted findings exist |

## 8. Non-Database Calculations
- Overview cards, SPI summaries, and chart labels are runtime display aggregations over DB-produced effective findings and DB-backed bucket labels.
- The history drillthrough open and close states are client-side overlay state controlled by a query parameter.
- Affected-CI and CVE CSV generation is performed in the browser from the selected finding row and snapshot vulnerability index.
- Open/Closed Findings tab changes dispatch a client-side dismissal event so register overlays close before the new view loads.
- Search matching is application logic over concatenated DB-produced finding text and evidence content.

## 9. Rules, Assumptions, and Constraints
- The page is date-scoped through the underlying snapshot date and explicit `asOf` control.
- `asOf` is limited to the two-year history window ending at the active snapshot date.
- The register table is scrollable and does not paginate rows.
- Visible severity may differ from persisted `finding.severity` due to SQL-applied measures severity remap; non-compliant priority may differ from persisted `finding.priority_rank` due to SQL-applied measures priority remap.
- Asset-type summaries use the shared six-type taxonomy and do not assume a fixed 3-column model.
- Affected-CI drillthrough is scoped to the selected register row; `/api/findings/asset-details` remains available for compatibility with older asset-details paths.

## 10. Open Questions / Gaps
- **Open question:** should the page clearly indicate when the findings set is synthetic because `tsaat.finding` had no rows for the selected snapshot?
- **Open question:** should the page clearly label which rows came from persisted findings versus generated fallback rows?
- **Open question:** should DB-backed history procedures accept the full application filter model, or should filtered histories remain display-layer aggregations over SQL effective rows?
