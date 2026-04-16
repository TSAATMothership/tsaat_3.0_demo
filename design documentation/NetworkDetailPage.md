# NetworkDetailPage

## Page Overview
- **Page Name**: NetworkDetailPage
- **Purpose**: Detailed view of a specific managed network.
- **User Outcome**: Users drill down into network specifics.
- **Primary User Roles**: Network managers.

## Page Summary
The NetworkDetailPage shows tabs for overview, risk, systems, etc. It displays network metrics and details. Major features include charts and tables. Expected outcomes: Network details. Dependencies: Network data.

## Feature Breakdown
1. **Tab Navigation**: Switches details. System behaviour: Updates. Outcome: View.
2. **Network Overview**: Key metrics. System behaviour: Displays. Outcome: Summary.
3. **Risk Analysis**: Findings charts. System behaviour: Plots. Outcome: Risks.
4. **System List**: Network systems. System behaviour: Lists. Outcome: Inventory.
5. **Compliance Details**: Scores. System behaviour: Calculates. Outcome: Posture.

## Feature Detail Table

| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
|-----------|--------------|---------------------|-------------|------------------|--------|---------|----------------|-------------|-------------|---------|-------|
| NetworkDetailPage | Tab Navigation | Detail switch | Click | Update | Tab | UI | Valid | Exists | None | Change | Dynamic |
| NetworkDetailPage | Network Overview | Metrics | View | Show | Data | Cards | Network rules | Data | None | Summary | Key stats |
| NetworkDetailPage | Risk Analysis | Charts | View | Plot | Findings | Visuals | Severity | Valid | Data | Risks | Interactive |
| NetworkDetailPage | System List | Table | View | Display | Systems | Rows | Filtered | Data | None | Inventory | Searchable |
| NetworkDetailPage | Compliance Details | Scores | View | Calc | Evaluations | % | Compliance | Numbers | None | Posture | Drill-down |

## Database Mapping
1. **Network Data**: `managed_network` table.
2. **Systems**: `ict_system` linked.
3. **Findings**: `finding` scoped.

## Database Mapping Table

| Page Name | Feature Name | Schema | Table | Column | Data Type | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
|-----------|--------------|--------|-------|--------|-----------|-----------------|------------|---------------------------|-----------------------|-----------------------------|-------|
| NetworkDetailPage | Network Data | tsaat | managed_network | id | NVARCHAR(255) | Network ID | Read | Primary | Not null | Display | Route param |
| NetworkDetailPage | Systems | tsaat | ict_system | network_id | NVARCHAR(255) | Systems | Read | FK | Not null | List | Filtered |
| NetworkDetailPage | Findings | tsaat | finding | network_id | NVARCHAR(255) | Risks | Read | FK | Not null | Aggregate | Charts |

## Calculations and Derived Logic
1. **Metrics**: Counts and %. Performed: Runtime.
2. **Charts**: Data series. Performed: Runtime.

## Non-Database Calculations
1. **UI Layout**: Responsive. Performed: Frontend.
2. **Search**: Client-side. Performed: Frontend.

## Rules, Assumptions, and Constraints
- **Business Rules**: Network scope.
- **Technical Assumptions**: Route valid.
- **Data Assumptions**: Network exists.
- **Constraints**: Tab structure.
- **Known Limitations**: No edit.
- **Performance Considerations**: System count.

## Open Questions / Gaps
- Specific tabs require analysis.