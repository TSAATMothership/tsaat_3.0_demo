# SystemsPage

## Page Overview
- **Page Name**: SystemsPage
- **Purpose**: ICT System-scoped operational dashboard for cyber security posture visibility.
- **User Outcome**: Users can assess system compliance, risk trends, and remediation planning.
- **Primary User Roles**: System owners, cyber analysts.

## Page Summary
The SystemsPage has three tabs: Overview (compliance and trends), Action (remediation metrics), Posture (KPIs and table). It loads trend data, applies filters, and performs aggregations. Major features include compliance tiles, risk charts, action metrics, and system table. Expected outcomes: System-level insights, action prioritization. Dependencies: Trend app data, filters.

## Feature Breakdown
1. **Tab Navigation**: Switches tabs. System behaviour: Updates URL. Outcome: View change.
2. **Compliance Tiles**: Shows scores. System behaviour: Calculates percentages. Outcome: Posture overview.
3. **Risk Trend Charts**: Weekly trends. System behaviour: Aggregates daily series. Outcome: Trend view.
4. **Action Metrics**: Tiles for actions. System behaviour: Counts assets/findings. Outcome: Workload summary.
5. **Throughput Chart**: Weekly bars. System behaviour: Calculates net change. Outcome: Velocity.
6. **Age Buckets**: Age distribution. System behaviour: Buckets by days. Outcome: Aging analysis.
7. **Blast Radius**: Scatter chart. System behaviour: Plots systems. Outcome: Risk visualization.
8. **Systems Table**: Detailed roll-up. System behaviour: Displays data. Outcome: System details.
9. **Remediation Report**: Generates report. System behaviour: Links to API. Outcome: Export.

## Feature Detail Table

| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
|-----------|--------------|---------------------|-------------|------------------|--------|---------|----------------|-------------|-------------|---------|-------|
| SystemsPage | Tab Navigation | Tab switching | Click tab | URL update | Tab | View | Valid tabs | Exists | Router | View change | Progress bar |
| SystemsPage | Compliance Tiles | Score displays | View | Calculate % | Statuses | Scores | Compliant count | >0 total | Evaluations | Posture | Rounded |
| SystemsPage | Risk Trend Charts | Weekly lines | View | Aggregate daily | Series | Weekly points | 13 weeks | Valid dates | Daily data | Trend | High/Critical |
| SystemsPage | Action Metrics | Tile counts | View | Count items | Assets/findings | Numbers | Criteria matches | Filtered | Data | Summary | Modelling gaps |
| SystemsPage | Throughput Chart | Weekly bars | View | Net change | Findings | Metrics | Opened-closed | Timestamps | Dates | Velocity | 13 weeks |
| SystemsPage | Age Buckets | Stacked bars | View | Bucket ages | Findings | Counts | 5 ranges | Days calc | Snapshot | Aging | By severity |
| SystemsPage | Blast Radius | Scatter plot | Click points | Plot metrics | Systems | Points | Assets vs findings | Valid types | Assets | Risk | Selection event |
| SystemsPage | Systems Table | Roll-up table | View | Display | Systems | Rows | Filtered | Data | None | Details | Scrollable |
| SystemsPage | Remediation Report | Export link | Click | API call | Params | Report | Filtered | Valid | API | Export | Query params |

## Database Mapping
1. **Systems Data**: `ict_system` for systems; `finding` for aggregations.
2. **Assets**: `asset` for counts and evaluations.
3. **Trends**: `finding` timestamps for series.
4. **Compliance**: Evaluation statuses from rollups.
5. **Action**: Counts from `asset` and `finding`.
6. **Table**: `ict_system` columns.

## Database Mapping Table

| Page Name | Feature Name | Schema | Table | Column | Data Type | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
|-----------|--------------|--------|-------|--------|-----------|-----------------|------------|---------------------------|-----------------------|-----------------------------|-------|
| SystemsPage | Systems Data | tsaat | ict_system | id | NVARCHAR(255) | System ID | Read | Primary | Not null | Display | Hierarchy |
| SystemsPage | Assets | tsaat | asset | systemContext.systemId | NVARCHAR(255) | Asset link | Read | ict_system.id | Not null | Count | Type filter |
| SystemsPage | Trends | tsaat | finding | timestamp | DATETIMEOFFSET(7) | Event dates | Read | System scope | Not null | Series | Closed date |
| SystemsPage | Compliance | tsaat | finding | compliance_status | NVARCHAR(20) | Status | Read | Evaluations | Compliant etc. | % calc | Rollups |
| SystemsPage | Action | tsaat | asset | type | NVARCHAR(20) | OS filter | Read | Evaluations | server etc. | Count | Non-compliant |
| SystemsPage | Table | tsaat | ict_system | name | NVARCHAR(255) | Display | Read | Direct | Not null | Text | Criticality |

## Calculations and Derived Logic
1. **Compliance Score**: (compliant / total) * 100. Performed: Runtime. Location: Frontend.
2. **Daily Series**: Cumulative from events. Performed: Runtime. Location: Frontend.
3. **Weekly Trend**: Sum per week. Performed: Runtime. Location: Frontend.
4. **Throughput**: Opened - closed per week. Performed: Runtime. Location: Frontend.
5. **Age Buckets**: Days buckets. Performed: Runtime. Location: Frontend.

## Non-Database Calculations
1. **UI Totals**: Sum displays. Performed: Frontend.
2. **Filter Counts**: Item counts. Performed: Frontend.

## Rules, Assumptions, and Constraints
- **Business Rules**: Compliance from evaluations; severity definitions.
- **Technical Assumptions**: Data integrity.
- **Data Assumptions**: Links valid.
- **Constraints**: 13 weeks; filtered scope.
- **Known Limitations**: Snapshot-based.
- **Performance Considerations**: Large systems slow.

## Open Questions / Gaps
- Modelling status logic requires confirmation.