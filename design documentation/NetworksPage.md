# NetworksPage

## Page Overview
- **Page Name**: NetworksPage
- **Purpose**: Network-focused dashboard for compliance and risk analysis.
- **User Outcome**: Users assess network posture and trends.
- **Primary User Roles**: Network administrators.

## Page Summary
The NetworksPage provides tabs for overview, action, and posture. It displays network metrics, trends, and details. Major features include charts, tables, and filters. Expected outcomes: Network insights. Dependencies: Network data.

## Feature Breakdown
1. **Tab Navigation**: Switches views. System behaviour: Updates. Outcome: View change.
2. **Compliance Charts**: Network scores. System behaviour: Calculates. Outcome: Overview.
3. **Risk Trends**: Time series. System behaviour: Aggregates. Outcome: Trends.
4. **Action Metrics**: Remediation counts. System behaviour: Counts. Outcome: Priorities.
5. **Networks Table**: Detailed list. System behaviour: Displays. Outcome: Details.

## Feature Detail Table

| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
|-----------|--------------|---------------------|-------------|------------------|--------|---------|----------------|-------------|-------------|---------|-------|
| NetworksPage | Tab Navigation | View switch | Click | Update | Tab | UI | Valid | Exists | None | Change | Progress |
| NetworksPage | Compliance Charts | Score visuals | View | Plot | Data | Charts | % calc | Numbers | Evaluations | Overview | Radar |
| NetworksPage | Risk Trends | Trend lines | View | Series | Findings | Lines | Time | Dates | Historical | Trends | Weekly |
| NetworksPage | Action Metrics | Count tiles | View | Count | Assets | Numbers | Criteria | Filtered | Data | Priorities | Tiles |
| NetworksPage | Networks Table | List | View | Display | Networks | Rows | Sorted | Data | None | Details | Paginated |

## Database Mapping
1. **Networks Data**: `managed_network` table.
2. **Assets**: `asset` linked.
3. **Findings**: `finding` for metrics.

## Database Mapping Table

| Page Name | Feature Name | Schema | Table | Column | Data Type | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
|-----------|--------------|--------|-------|--------|-----------|-----------------|------------|---------------------------|-----------------------|-----------------------------|-------|
| NetworksPage | Networks Data | tsaat | managed_network | id | NVARCHAR(255) | Network ID | Read | Primary | Not null | Display | Hierarchy |
| NetworksPage | Assets | tsaat | asset | network_id | NVARCHAR(255) | Link | Read | FK | Not null | Count | Filtered |
| NetworksPage | Findings | tsaat | finding | network_id | NVARCHAR(255) | Scope | Read | FK | Not null | Aggregate | Metrics |

## Calculations and Derived Logic
1. **Compliance %**: (compliant / total) * 100. Performed: Runtime.
2. **Trend Series**: Cumulative counts. Performed: Runtime.
3. **Action Counts**: Filtered sums. Performed: Runtime.

## Non-Database Calculations
1. **UI Charts**: Data points. Performed: Frontend.
2. **Table Sorting**: Client-side. Performed: Frontend.

## Rules, Assumptions, and Constraints
- **Business Rules**: Network scope.
- **Technical Assumptions**: Data linked.
- **Data Assumptions**: Networks defined.
- **Constraints**: Tab limits.
- **Known Limitations**: Snapshot.
- **Performance Considerations**: Large networks.

## Open Questions / Gaps
- Detailed features require analysis.