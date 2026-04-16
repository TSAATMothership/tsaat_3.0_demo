# MeasuresPage

## Page Overview
- **Page Name**: MeasuresPage
- **Purpose**: Comprehensive performance and compliance dashboard presenting Key Performance Indicators (KPIs) and Security Performance Indicators (SPIs) for organizational security compliance metrics.
- **User Outcome**: Stakeholders gain data-driven visibility into critical security gaps, enabling executive-level decision-making and remediation prioritization.
- **Primary User Roles**: Executives, compliance officers, security analysts.

## Page Summary
The MeasuresPage displays 9 KPIs and 10 SPIs with compliance metrics, enabling drill-down to tasking reports. It loads core app data, applies filters, and computes scores. Major features include radar charts, detailed matrix, settings configuration, and PDF exports. Expected outcomes: Compliance visibility, remediation planning. Dependencies: Dataset, measures settings, discovery tools settings.

## Feature Breakdown
1. **Summary Tab**: Radar charts for KPI and SPI compliance. System behaviour: Visualizes scores. Outcome: Executive overview.
2. **Measures Tab**: Detailed matrix with metrics and tasking links. System behaviour: Displays full data. Outcome: Detailed analysis.
3. **Settings Tab**: SPI severity matrix configuration. System behaviour: Allows editing. Outcome: Customizable mappings.
4. **KPI Compliance Chart**: Radar visualization of KPIs. System behaviour: Plots percentages. Outcome: Visual compliance.
5. **SPI Compliance Chart**: Radar for SPIs. System behaviour: Plots scores. Outcome: Control visibility.
6. **KPI/SPI Matrix**: Tabular display. System behaviour: Shows counts and links. Outcome: Drill-down access.
7. **Tasking Reports**: PDF generation. System behaviour: Links to API. Outcome: Remediation docs.
8. **Filter Bar**: Multi-field filtering. System behaviour: Applies scope. Outcome: Narrowed view.
9. **Settings Matrix**: Editable severity mappings. System behaviour: Saves changes. Outcome: Policy configuration.
10. **Progress Indicators**: Loading feedback. System behaviour: Shows progress. Outcome: User feedback.

## Feature Detail Table

| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
|-----------|--------------|---------------------|-------------|------------------|--------|---------|----------------|-------------|-------------|---------|-------|
| MeasuresPage | Summary Tab | Radar charts overview | View | Displays charts | Scores | Visuals | KPI/SPI definitions | Valid data | Charts library | Executive summary | Responsive |
| MeasuresPage | Measures Tab | Detailed matrix | View | Shows table | Metrics | Rows | Drill-through | Filtered | API | Analysis | Paginated |
| MeasuresPage | Settings Tab | Configuration panel | Edit/save | Updates matrix | Selections | Saved settings | Severity options | Valid mappings | Persistence | Customization | Admin access |
| MeasuresPage | KPI Compliance Chart | KPI radar | View | Plots data | KPI scores | Chart | 9 KPIs | Percentages | Recharts | Compliance view | Color-coded |
| MeasuresPage | SPI Compliance Chart | SPI radar | View | Plots data | SPI scores | Chart | 10 SPIs | Scores | Recharts | Control view | Segmented |
| MeasuresPage | KPI/SPI Matrix | Tabular display | View/click | Displays data | Counts | Table | Links enabled | Data present | None | Detailed metrics | Exportable |
| MeasuresPage | Tasking Reports | PDF links | Click | API call | Filters | PDF | Filtered scope | Valid params | API | Reports | Disabled for some |
| MeasuresPage | Filter Bar | Filtering | Select | Applies | Options | Filtered data | Multi-select | Valid choices | Filter options | Scoped view | URL sync |
| MeasuresPage | Settings Matrix | Editable grid | Edit | Tracks changes | Inputs | Draft | Severity rules | Valid entries | Defaults | Configuration | Dirty state |
| MeasuresPage | Progress Indicators | Loading feedback | View | Shows progress | State | UI | Smooth animation | Time-based | None | User experience | 0-100% |

## Database Mapping
1. **KPIs**: Computed from evaluations and findings.
2. **SPIs**: Based on asset evaluations.
3. **Settings**: `measures_severity_matrix` for mappings.
4. **Filters**: Applied to assets and findings.
5. **Reports**: Uses filtered data.

## Database Mapping Table

| Page Name | Feature Name | Schema | Table | Column | Data Type | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
|-----------|--------------|--------|-------|--------|-----------|-----------------|------------|---------------------------|-----------------------|-----------------------------|-------|
| MeasuresPage | KPIs | tsaat | finding | compliance_status | NVARCHAR(20) | Status counts | Read | Evaluations | Compliant etc. | % calc | Aggregated |
| MeasuresPage | SPIs | tsaat | asset | type | NVARCHAR(20) | Evaluation scope | Read | SPI rules | server etc. | Score calc | Per asset |
| MeasuresPage | Settings | tsaat | measures_severity_matrix | severity | NVARCHAR(30) | Mapping | Read/Update | SPI/asset type | Defaults | Applied | Configurable |
| MeasuresPage | Filters | tsaat | asset | network_id | NVARCHAR(255) | Scope | Read | Filter condition | All | Applied | Multi-field |
| MeasuresPage | Reports | tsaat | finding | scope | NVARCHAR(MAX) | Context | Read | Filtered | None | PDF content | Exported |

## Calculations and Derived Logic
1. **KPI Scores**: (compliant / total) * 100. Performed: Runtime. Location: Frontend.
2. **SPI Scores**: Compliant count / total. Performed: Runtime. Location: Frontend.
3. **Compliance %**: Rounded to 1 decimal. Performed: Runtime. Location: Frontend.
4. **High Priority**: Count priorityRank ≤2. Performed: Runtime. Location: Frontend.
5. **Radar Data**: Transforms scores to points. Performed: Runtime. Location: Frontend.

## Non-Database Calculations
1. **UI Formatting**: Percentage display. Performed: Frontend.
2. **Chart Points**: Data transformation. Performed: Frontend.
3. **Validation**: Client-side checks. Performed: Frontend.

## Rules, Assumptions, and Constraints
- **Business Rules**: KPI targets ≥95%; SPI severity mappings; tasking restrictions.
- **Technical Assumptions**: Data integrity; settings persistence.
- **Data Assumptions**: Evaluations complete; links valid.
- **Constraints**: 9 KPIs, 10 SPIs; severity options limited.
- **Known Limitations**: No real-time; snapshot-based.
- **Performance Considerations**: Large matrices slow; caching used.

## Open Questions / Gaps
- Exact KPI formulas require confirmation.