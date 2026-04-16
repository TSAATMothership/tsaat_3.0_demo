# CyberCopPage

## Page Overview
- **Page Name**: CyberCopPage
- **Purpose**: Provides a senior cyber operations briefing dashboard for real-time situational awareness and operational intelligence across the Defence Cyber Terrain.
- **User Outcome**: Executives and cyber operations leaders can monitor compliance, risk exposure, organizational impact, and remediation progress to make informed decisions on cyber defence priorities.
- **Primary User Roles**: Senior cyber operations personnel, executives, cyber defence analysts.

## Page Summary
The CyberCopPage displays a three-tabbed interface (Overview, Impact, Action) showing compliance scores, risk trends, organizational impact analysis, and action planning metrics. It uses data from the current dataset snapshot with trend analysis over the past 12 months. Major features include compliance tiles, risk trend charts, impact leaderboards, SPI driver analysis, blast radius visualizations, and action plan summaries. Expected outcomes include identification of immediate action items, understanding of organizational risk exposure, and prioritization of remediation efforts. Dependencies include core app data loading, measures settings, and filter application.

## Feature Breakdown
1. **Compliance Score Tiles**: Displays five real-time compliance metrics (Overall, DSE, DPE, Critical ICT Systems, Networks) as percentage cards. System behaviour calculates compliance from evaluation statuses. Outcome: Provides current posture overview. Validations: Ensures denominator > 0 to avoid division by zero.
2. **Risk Trend Charts**: Shows daily trends for open High Risk and Critical Exposure findings over 12 months. System behaviour builds time series from finding open/close events. Outcome: Visualizes risk trajectory. Dependencies: Snapshot date for data cutoff.
3. **Impact Leaderboards**: Displays top impacted business services, mission capabilities, and ICT systems by finding concentration. System behaviour aggregates findings by scope and severity. Outcome: Identifies high-risk areas. User action: Search and select items to filter downstream views.
4. **SPI Driver Chart**: Horizontal bar chart showing top 10 SPIs driving severe findings. System behaviour counts findings by SPI and severity. Outcome: Highlights control areas needing attention.
5. **Blast Radius Scatter Charts**: Plots systems by asset count vs. critical exposure findings. System behaviour determines primary asset type and aggregates metrics. Outcome: Visualizes system risk concentration.
6. **Action Plan Summary**: Shows 7 tile metrics for immediate/planned actions, non-compliant OS, out-of-warranty assets, etc. System behaviour counts filtered assets/findings meeting criteria. Outcome: Quantifies remediation workload.
7. **Remediation Throughput Chart**: 13-week bar chart of opened/closed findings. System behaviour calculates net change per week. Outcome: Tracks remediation velocity.
8. **Finding Age Buckets**: Stacked chart of open findings by age ranges. System behaviour categorizes by days open. Outcome: Identifies aging issues.
9. **Oldest Open Findings Table**: Top 12 longest-running findings. System behaviour sorts by age descending. Outcome: Prioritizes oldest issues.
10. **Quick Wins Table**: Findings grouped by recommended action. System behaviour clusters by action and counts impact. Outcome: Suggests high-impact remediations.

## Feature Detail Table

| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
|-----------|--------------|---------------------|-------------|------------------|--------|---------|----------------|-------------|-------------|---------|-------|
| CyberCopPage | Compliance Score Tiles | Displays percentage compliance metrics | View tiles | Calculates compliant/total ratios | Evaluation statuses | Percentage scores | Compliant = "Compliant" status | Denominator > 0 | Measures settings | Current posture overview | Rounded to 1 decimal |
| CyberCopPage | Risk Trend Charts | Shows daily open finding trends | View chart | Builds time series from finding events | Findings, severity, dates | Daily counts | Events tracked by open/close dates | Date ranges valid | Snapshot date | Risk trajectory visualization | Nulls for future dates |
| CyberCopPage | Impact Leaderboards | Lists top impacted entities | Search/select items | Aggregates findings by scope | Findings, systems/capabilities | Sorted lists with counts | Criticality merging for capabilities | Valid system references | System relationships | High-risk area identification | Filterable/searchable |
| CyberCopPage | SPI Driver Chart | Shows SPIs driving severe findings | View chart | Counts by SPI and severity | Findings, SPI IDs | Top 10 SPIs | Severe = Critical Exposure + High Risk | SPI definitions exist | SPI reference data | Control area prioritization | Segmented by severity |
| CyberCopPage | Blast Radius Scatter Charts | Plots systems by assets vs. critical findings | View chart | Aggregates system metrics | Systems, findings, assets | Scatter points | Primary asset type by frequency | Valid asset types | Asset data | Risk concentration visualization | Bubble size = finding volume |
| CyberCopPage | Action Plan Summary | Shows remediation metrics tiles | View tiles | Counts meeting criteria | Assets, findings, systems | Metric counts | Immediate = Critical + High Risk | Filtered scope | Discovery/network data | Workload quantification | Includes modelling gaps |
| CyberCopPage | Remediation Throughput Chart | Weekly opened/closed bars | View chart | Calculates weekly net change | Findings, dates | Weekly metrics | 13-week window | Valid timestamps | Historical data | Velocity tracking | Includes net change |
| CyberCopPage | Finding Age Buckets | Age distribution by severity | View chart | Buckets by days open | Findings, timestamps | Age counts | 5 ranges: 0-30d etc. | Current date reference | Snapshot date | Aging issue identification | Stacked by severity |
| CyberCopPage | Oldest Open Findings Table | Top 12 oldest findings | View table | Sorts by age descending | Findings | Sorted list with details | Age = days since opened | Valid timestamps | Asset/system data | Oldest issue prioritization | Includes evidence |
| CyberCopPage | Quick Wins Table | Actions grouped by recommendation | View table | Clusters by action | Findings | Grouped counts | Sort by severe count | Valid actions | Recommended action data | High-impact suggestion | Top 10 groups |

## Database Mapping
1. **Compliance Scores**: Uses `finding` table for status counts; `asset` for evaluation scope; `ict_system` for system compliance.
2. **Risk Trends**: Reads `finding.timestamp` and `finding.closedTimestamp` for event dates; filters by `finding.severity`.
3. **Impact Leaderboards**: Joins `finding` with `ict_system`, `system_mission_capability`, `system_business_service` via `finding.scope.systemId`.
4. **SPI Driver**: Accesses `finding.spiId` and `finding.severity`; references `spi_definition` for descriptions.
5. **Blast Radius**: Aggregates `asset` counts per `ict_system`; counts `finding` where `finding.scope.systemId` matches.
6. **Action Plan**: Counts `asset` where SPI 1/2 non-compliant; `finding` for open counts; `managed_network` for discovery status.
7. **Throughput**: Tracks `finding.timestamp` and `finding.closedTimestamp` per week.
8. **Age Buckets**: Calculates age from `finding.timestamp` to snapshot date.
9. **Oldest Findings**: Sorts `finding` by `finding.timestamp` ascending.
10. **Quick Wins**: Groups `finding` by `finding.recommendedAction`.

## Database Mapping Table

| Page Name | Feature Name | Schema | Table | Column | Data Type | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
|-----------|--------------|--------|-------|--------|-----------|-----------------|------------|---------------------------|-----------------------|-----------------------------|-------|
| CyberCopPage | Compliance Scores | tsaat | finding | compliance_status | NVARCHAR(20) | Status for percentage calc | Read | Filtered by asset evaluations | Compliant/Non-compliant/Unknown | Count compliant / total * 100 | Rounded to 1 decimal |
| CyberCopPage | Risk Trends | tsaat | finding | timestamp | DATETIMEOFFSET(7) | Opening date for series | Read | By severity filter | Not null | Daily cumulative count | Closed date for close events |
| CyberCopPage | Impact Leaderboards | tsaat | ict_system | id | NVARCHAR(255) | System scope for aggregation | Read | finding.scope.systemId = ict_system.id | Not null | Findings count per system | Includes criticality |
| CyberCopPage | SPI Driver | tsaat | finding | spiId | SMALLINT | SPI grouping | Read | References spi_definition | 1-10 | Count by severity | Top 10 by total severe |
| CyberCopPage | Blast Radius | tsaat | asset | systemContext.systemId | NVARCHAR(255) | Asset count per system | Read | ict_system.id = asset.systemContext.systemId | Not null | Count assets + critical findings | Primary type by frequency |
| CyberCopPage | Action Plan | tsaat | asset | type | NVARCHAR(20) | OS asset filter | Read | SPI evaluations | server/workstation | Count non-compliant OS | SPI 1/2 evaluations |
| CyberCopPage | Throughput | tsaat | finding | timestamp | DATETIMEOFFSET(7) | Weekly opened count | Read | By date ranges | Not null | Opened - closed per week | 13-week window |
| CyberCopPage | Age Buckets | tsaat | finding | timestamp | DATETIMEOFFSET(7) | Age calculation | Read | To snapshot date | Not null | Days open buckets | 5 age ranges |
| CyberCopPage | Oldest Findings | tsaat | finding | timestamp | DATETIMEOFFSET(7) | Sort by oldest | Read | Ascending order | Not null | Top 12 by age | Includes closedTimestamp |
| CyberCopPage | Quick Wins | tsaat | finding | recommendedAction | NVARCHAR(MAX) | Grouping key | Read | Case-insensitive group | Not null | Count per action | Sort by impact |

## Calculations and Derived Logic
1. **Compliance Score**: Formula: (compliant_count / total_count) * 100, rounded to 1 decimal. Performed at runtime from evaluation statuses. Stored: No. Location: Frontend. Edge cases: 0 if no statuses.
2. **DPE Compliance**: Filters statuses where environmentType = "Production". Same formula. Performed: Runtime. Location: Frontend.
3. **DSE Compliance**: Filters non-Production environments. Same formula. Performed: Runtime. Location: Frontend.
4. **Daily Trend Series**: Builds cumulative open count from opening/closing events. Formula: running_total += opened - closed. Performed: Runtime. Location: Frontend. Null handling: Null for dates beyond snapshot.
5. **Weekly Risk Trend**: Aggregates daily series into 13 weeks. Formula: Sum per week. Performed: Runtime. Location: Frontend.
6. **System Impact Aggregation**: Counts findings, high priority (rank ≤2), severities per system. Formula: Sum per system. Performed: Runtime. Location: Frontend.
7. **SPI Driver Counts**: Counts critical/high/other per SPI. Formula: Group and count. Performed: Runtime. Location: Frontend.
8. **Blast Radius Points**: Assets count + critical exposure count per system. Formula: Count assets, count findings. Performed: Runtime. Location: Frontend.
9. **Action Throughput**: Opened/closed/net per week. Formula: Count events in week ranges. Performed: Runtime. Location: Frontend.
10. **Age Buckets**: Days = (snapshot_date - timestamp). Formula: Floor difference in days. Performed: Runtime. Location: Frontend.

## Non-Database Calculations
1. **UI Compliance Percentages**: Display formatting of scores. Performed: Frontend. Temporary state.
2. **Chart Data Transformations**: Converting counts to chart points. Performed: Frontend. Session-based.
3. **Filter Counts**: Number of filtered items. Performed: Frontend. Client-side validation.

## Rules, Assumptions, and Constraints
- **Business Rules**: Severe findings = Critical Exposure + High Risk; P1-P2 = priority ≤2; Production = DPE, others = DSE.
- **Technical Assumptions**: Snapshot data is current; filters applied consistently.
- **Data Assumptions**: Findings have valid timestamps; systems/assets linked properly.
- **Constraints**: 12-month trend window; 13-week throughput; top 10/12 limits.
- **Known Limitations**: No real-time updates; depends on snapshot frequency.
- **Performance Considerations**: Large datasets may slow rendering; client-side calculations.

## Open Questions / Gaps
- Exact formula for priority rank assignment requires confirmation from measures settings logic.
- Validation of SPI evaluation accuracy not detailed.