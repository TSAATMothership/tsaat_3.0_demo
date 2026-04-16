# FindingsPage

## Page Overview
- **Page Name**: FindingsPage
- **Purpose**: Main findings management interface for displaying, filtering, and analyzing security findings.
- **User Outcome**: Users can view historical trends, filter findings by multiple criteria, and export data for remediation planning.
- **Primary User Roles**: Security analysts, compliance officers, remediation teams.

## Page Summary
The FindingsPage provides two views: Overview (trends and SPI analysis) and Findings Register (detailed table). It loads core app data, applies filters, and performs timeline calculations. Major features include KPI tiles, SPI summaries, trend charts, searchable table, and export functionality. Expected outcomes: Understanding finding trends, prioritizing remediation, and generating reports. Dependencies: Dataset, measures settings, filter options.

## Feature Breakdown
1. **Overview/Register Tabs**: Switches between summary and detailed views. System behaviour: Updates URL parameter. Outcome: View toggle.
2. **Status Tabs**: Filters open/closed findings. System behaviour: Applies workflow status filter. Outcome: Status-specific view.
3. **Timeline Filter**: Selects "as of" date for point-in-time analysis. System behaviour: Recalculates statuses. Outcome: Historical view.
4. **Filter Bar**: Multi-field filtering. System behaviour: Applies to dataset. Outcome: Narrowed results.
5. **KPI Tiles**: Shows total, critical, high risk, P1-P2 counts. System behaviour: Counts filtered findings. Outcome: Summary metrics.
6. **SPI Tiles**: Progress bars by SPI. System behaviour: Aggregates by SPI. Outcome: Control area status.
7. **Trend Charts**: Line charts of open/closed over time. System behaviour: Builds daily series. Outcome: Trend visualization.
8. **Findings Table**: Paginated, sortable table. System behaviour: Displays filtered results. Outcome: Detailed listing.
9. **Asset Details Panel**: Shows asset info on selection. System behaviour: Fetches via API. Outcome: Additional context.
10. **Export**: Downloads JSON/CSV. System behaviour: Generates file. Outcome: Data export.

## Feature Detail Table

| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
|-----------|--------------|---------------------|-------------|------------------|--------|---------|----------------|-------------|-------------|---------|-------|
| FindingsPage | Overview/Register Tabs | Toggles views | Click tab | Updates URL | Tab selection | View switch | Overview = summary, Register = table | Valid tab | None | View change | Loading indicator |
| FindingsPage | Status Tabs | Filters by status | Click tab | Applies filter | Status | Filtered findings | Open/closed based on dates | Valid status | Timeline date | Status view | Point-in-time |
| FindingsPage | Timeline Filter | Historical date selection | Select date | Recalculates | Date | Updated statuses | Within 2-year window | Date range | Snapshot data | Historical analysis | Clamped dates |
| FindingsPage | Filter Bar | Multi-criteria filtering | Select options | Applies filters | Filter values | Filtered data | Case-insensitive | Valid options | Filter options | Narrowed scope | URL params |
| FindingsPage | KPI Tiles | Summary counts | View tiles | Counts findings | Filtered findings | Numbers | Severity definitions | Non-negative | None | Metric overview | Real-time |
| FindingsPage | SPI Tiles | SPI breakdowns | View tiles | Aggregates by SPI | Findings | Progress bars | SPI 1-10 | Valid SPI | SPI definitions | Control status | Weighted by severity |
| FindingsPage | Trend Charts | Time series | View chart | Builds series | Findings, dates | Chart data | 2-year history | Valid timestamps | Historical snapshots | Trend insight | Daily cumulative |
| FindingsPage | Findings Table | Detailed listing | View/sort/page | Displays data | Filtered findings | Table rows | 10 per page | Valid data | Asset details API | Finding details | Searchable |
| FindingsPage | Asset Details Panel | Asset context | Click finding | API fetch | Finding ID | Asset info | Fallback keys | Valid ID | API endpoint | Context provision | Right panel |
| FindingsPage | Export | Data download | Click export | Generates file | Filtered findings | File | JSON/CSV formats | Non-empty | None | Data export | Query params |

## Database Mapping
1. **Findings Data**: Primary `finding` table for all data; joins to `asset`, `ict_system`, `managed_network` via scope.
2. **Timeline**: Uses `finding.timestamp`, `finding.closedTimestamp` for status calculation.
3. **Filters**: Applies to `finding` columns like `spiId`, `severity`, `priorityRank`.
4. **KPI**: Counts from `finding` by `severity`, `priorityRank`.
5. **SPI Summary**: Groups `finding` by `spiId`.
6. **Trends**: Time series from `finding` timestamps.
7. **Table**: Displays `finding` columns with evidence.
8. **Asset Details**: Joins `finding.scope.assetId` to `asset` table.
9. **Export**: Serializes `finding` data.

## Database Mapping Table

| Page Name | Feature Name | Schema | Table | Column | Data Type | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
|-----------|--------------|--------|-------|--------|-----------|-----------------|------------|---------------------------|-----------------------|-----------------------------|-------|
| FindingsPage | Findings Data | tsaat | finding | finding_id | NVARCHAR(255) | Unique ID | Read | Primary key | Not null | Display as-is | Asset-spi format |
| FindingsPage | Timeline | tsaat | finding | timestamp | DATETIMEOFFSET(7) | Opening date | Read | For status calc | Not null | To UTC date key | Closed nullable |
| FindingsPage | Filters | tsaat | finding | spiId | SMALLINT | Filter criteria | Read | Filter condition | 1-10 | Equals match | Multiple filters |
| FindingsPage | KPI | tsaat | finding | severity | NVARCHAR(30) | Count grouping | Read | By severity | Critical Exposure etc. | Count per group | Priority rank for P1-P2 |
| FindingsPage | SPI Summary | tsaat | finding | spiId | SMALLINT | Grouping | Read | Group by | 1-10 | Count + severity | Progress bars |
| FindingsPage | Trends | tsaat | finding | timestamp | DATETIMEOFFSET(7) | Event dates | Read | Date ranges | Not null | Daily series | Opening/closing events |
| FindingsPage | Table | tsaat | finding | title | NVARCHAR(1000) | Display text | Read | Direct | Not null | Truncated if long | Evidence JSON |
| FindingsPage | Asset Details | tsaat | asset | id | NVARCHAR(255) | Asset info | Read | finding.scope.assetId = asset.id | Not null | Name, IP, etc. | API fetch |
| FindingsPage | Export | tsaat | finding | evidence | NVARCHAR(MAX) | Data export | Read | All columns | JSON | Serialize to file | JSON/CSV |

## Calculations and Derived Logic
1. **Workflow Status at As Of**: If opened ≤ asOf and (no closed or closed > asOf) then open. Performed: Runtime. Location: Frontend. Edge cases: Null timestamps invalid.
2. **Opening Balance**: Findings opened before start but relevant. Formula: Count where opened < start and (no closed or closed ≥ start). Performed: Runtime. Location: Frontend.
3. **Daily Cumulative**: Running total += opened - closed. Performed: Runtime. Location: Frontend.
4. **Search Match**: Case-insensitive substring match across fields. Performed: Runtime. Location: Frontend.
5. **KPI Counts**: Filter and count by criteria. Performed: Runtime. Location: Frontend.

## Non-Database Calculations
1. **UI Formatting**: Date formatting, truncation. Performed: Frontend.
2. **Pagination Counts**: Total pages from count. Performed: Frontend.
3. **Filter Validation**: Client-side checks. Performed: Frontend.

## Rules, Assumptions, and Constraints
- **Business Rules**: Severity based on SPI/compliance; priority from measures matrix; deduplication by key.
- **Technical Assumptions**: Data loaded correctly; timestamps valid.
- **Data Assumptions**: Findings non-compliant/unknown only; scope consistent.
- **Constraints**: 2-year history; 10 per page; JSON evidence.
- **Known Limitations**: No real-time; depends on snapshot.
- **Performance Considerations**: Large tables may slow; client search.

## Open Questions / Gaps
- Exact deduplication logic requires confirmation.