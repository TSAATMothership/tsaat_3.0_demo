# SystemDetailPage

## Page Overview
- **Page Name**: SystemDetailPage
- **Purpose**: Detailed view of a specific ICT system.
- **User Outcome**: Users drill down into system specifics.
- **Primary User Roles**: System owners.

## Page Summary
The SystemDetailPage shows tabs for overview, risk, assets, etc. It displays system metrics and details. Major features include charts and tables. Expected outcomes: System details. Dependencies: System data.

## Feature Breakdown
1. **Tab Navigation**: Switches details. System behaviour: Updates. Outcome: View.
2. **System Overview**: Key metrics. System behaviour: Displays. Outcome: Summary.
3. **Risk Analysis**: Findings charts. System behaviour: Plots. Outcome: Risks.
4. **Asset List**: System assets. System behaviour: Lists. Outcome: Inventory.
5. **Compliance Details**: Scores. System behaviour: Calculates. Outcome: Posture.

## Feature Detail Table

| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
|-----------|--------------|---------------------|-------------|------------------|--------|---------|----------------|-------------|-------------|---------|-------|
| SystemDetailPage | Tab Navigation | Detail switch | Click | Update | Tab | UI | Valid | Exists | None | Change | Dynamic |
| SystemDetailPage | System Overview | Metrics | View | Show | Data | Cards | System rules | Data | None | Summary | Key stats |
| SystemDetailPage | Risk Analysis | Charts | View | Plot | Findings | Visuals | Severity | Valid | Data | Risks | Interactive |
| SystemDetailPage | Asset List | Table | View | Display | Assets | Rows | Filtered | Data | None | Inventory | Searchable |
| SystemDetailPage | Compliance Details | Scores | View | Calc | Evaluations | % | Compliance | Numbers | None | Posture | Drill-down |

## Database Mapping
1. **System Data**: `ict_system` table.
2. **Assets**: `asset` linked.
3. **Findings**: `finding` scoped.

## Database Mapping Table

| Page Name | Feature Name | Schema | Table | Column | Data Type | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
|-----------|--------------|--------|-------|--------|-----------|-----------------|------------|---------------------------|-----------------------|-----------------------------|-------|
| SystemDetailPage | System Data | tsaat | ict_system | id | NVARCHAR(255) | System ID | Read | Primary | Not null | Display | Route param |
| SystemDetailPage | Assets | tsaat | asset | systemContext.systemId | NVARCHAR(255) | Assets | Read | FK | Not null | List | Filtered |
| SystemDetailPage | Findings | tsaat | finding | scope.systemId | NVARCHAR(255) | Risks | Read | FK | Not null | Aggregate | Charts |

## Calculations and Derived Logic
1. **Metrics**: Counts and %. Performed: Runtime.
2. **Charts**: Data series. Performed: Runtime.

## Non-Database Calculations
1. **UI Layout**: Responsive. Performed: Frontend.
2. **Search**: Client-side. Performed: Frontend.

## Rules, Assumptions, and Constraints
- **Business Rules**: System scope.
- **Technical Assumptions**: Route valid.
- **Data Assumptions**: System exists.
- **Constraints**: Tab structure.
- **Known Limitations**: No edit.
- **Performance Considerations**: Asset count.

## Open Questions / Gaps
- Specific tabs require analysis.