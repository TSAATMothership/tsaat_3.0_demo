# DiscoveryCoveragePage

## Page Overview
- **Page Name**: DiscoveryCoveragePage
- **Purpose**: Discovery tools monitoring and management interface to track coverage of seven critical discovery tools across assets.
- **User Outcome**: Identifies and remediates discovery coverage gaps, configures tool requirements.
- **Primary User Roles**: Discovery administrators, network managers.

## Page Summary
The DiscoveryCoveragePage has three tabs: Summary (gap analysis), Tool Settings (configuration), Target State (network planning). It evaluates asset coverage by tools, displays statistics, and generates reports. Major features include tool tables, radar charts, gap tables, and settings panels. Expected outcomes: Coverage visibility, gap remediation. Dependencies: Dataset, discovery tools settings.

## Feature Breakdown
1. **Summary Tab**: Coverage overview with statistics and gaps. System behaviour: Displays metrics. Outcome: Gap identification.
2. **Tool Settings Tab**: Configuration of tool definitions. System behaviour: Allows editing. Outcome: Customization.
3. **Target State Tab**: Network discovery targets. System behaviour: Shows planning. Outcome: Future goals.
4. **Tool Statistics Table**: Coverage per tool. System behaviour: Aggregates data. Outcome: Tool status.
5. **Coverage Radar Chart**: Visual coverage. System behaviour: Plots percentages. Outcome: Overview.
6. **Coverage Gaps Table**: Non-compliant assets. System behaviour: Lists gaps. Outcome: Remediation list.
7. **Remediation Report**: PDF generation. System behaviour: API call. Outcome: Export.
8. **Network Summary Table**: Network metrics. System behaviour: Displays data. Outcome: Network view.
9. **Target vs Actual Charts**: Bar charts. System behaviour: Compares counts. Outcome: Planning.
10. **Filter Bar**: Filtering. System behaviour: Applies scope. Outcome: Narrowed view.

## Feature Detail Table

| Page Name | Feature Name | Feature Description | User Action | System Behaviour | Inputs | Outputs | Business Rules | Validations | Dependencies | Outcome | Notes |
|-----------|--------------|---------------------|-------------|------------------|--------|---------|----------------|-------------|-------------|---------|-------|
| DiscoveryCoveragePage | Summary Tab | Gap analysis | View | Shows stats | Data | UI | Coverage rules | Valid data | Dataset | Overview | Default |
| DiscoveryCoveragePage | Tool Settings Tab | Configuration | Edit | Saves settings | Inputs | Updated | Tool definitions | Valid | Persistence | Customization | Admin |
| DiscoveryCoveragePage | Target State Tab | Planning | View | Displays targets | Networks | Charts | Deterministic % | Valid | None | Goals | Future |
| DiscoveryCoveragePage | Tool Statistics Table | Per-tool metrics | Click row | Opens panel | Tool | Details | Aggregation | Counts | Assets | Status | Interactive |
| DiscoveryCoveragePage | Coverage Radar Chart | Visual coverage | View | Plots data | Scores | Chart | Tool list | Percentages | Recharts | Insight | Responsive |
| DiscoveryCoveragePage | Coverage Gaps Table | Gap list | Search/page | Displays | Assets | Table | Missing tools | Filtered | None | List | Paginated |
| DiscoveryCoveragePage | Remediation Report | PDF export | Click | Generates | Filters | PDF | Scope | Valid | API | Report | Markdown |
| DiscoveryCoveragePage | Network Summary Table | Network data | Click row | Opens panel | Networks | Rows | Discovery status | Valid | None | Details | Links |
| DiscoveryCoveragePage | Target vs Actual Charts | Comparison | View | Plots bars | Counts | Chart | Target calc | Numbers | None | Planning | Deterministic |
| DiscoveryCoveragePage | Filter Bar | Filtering | Select | Applies | Options | Filtered | Multi-field | Valid | Filter options | Scope | URL sync |

## Database Mapping
1. **Asset Coverage**: `asset` for evaluation.
2. **Tool Detection**: Various columns for tool checks.
3. **Settings**: `discovery_tools_settings` for config.
4. **Networks**: `managed_network` for targets.
5. **Filters**: Applied to assets.

## Database Mapping Table

| Page Name | Feature Name | Schema | Table | Column | Data Type | Purpose on Page | CRUD Usage | Join / Relationship Logic | Default Value / Rule | Calculation / Transformation | Notes |
|-----------|--------------|--------|-------|--------|-----------|-----------------|------------|---------------------------|-----------------------|-----------------------------|-------|
| DiscoveryCoveragePage | Asset Coverage | tsaat | asset | id | NVARCHAR(255) | Evaluation | Read | Primary | Not null | Coverage calc | Per tool |
| DiscoveryCoveragePage | Tool Detection | tsaat | asset | systemContext.systemId | NVARCHAR(255) | UCMDB check | Read | Exists | Null | 1/0/null | Tool-specific |
| DiscoveryCoveragePage | Settings | tsaat | discovery_tools_settings | tool_id | NVARCHAR(50) | Config | Read/Update | Key | Defaults | Applied | JSON |
| DiscoveryCoveragePage | Networks | tsaat | managed_network | id | NVARCHAR(255) | Targets | Read | Primary | Not null | % calc | Deterministic |
| DiscoveryCoveragePage | Filters | tsaat | asset | network_id | NVARCHAR(255) | Scope | Read | Filter | All | Applied | Multi |

## Calculations and Derived Logic
1. **Coverage Evaluation**: Per tool checks. Performed: Runtime. Location: Frontend.
2. **Compliant Count**: Count coverageCompliance = true. Performed: Runtime. Location: Frontend.
3. **Gap Count**: Total - compliant. Performed: Runtime. Location: Frontend.
4. **Overall Coverage**: (covered slots / total slots) * 100. Performed: Runtime. Location: Frontend.
5. **Target Count**: Deterministic hash-based. Performed: Runtime. Location: Frontend.

## Non-Database Calculations
1. **UI Percentages**: Formatting. Performed: Frontend.
2. **Chart Data**: Transformation. Performed: Frontend.
3. **Search Filtering**: Client-side. Performed: Frontend.

## Rules, Assumptions, and Constraints
- **Business Rules**: Tool applicability by asset type; coverage compliance = all required tools.
- **Technical Assumptions**: Data loaded; settings valid.
- **Data Assumptions**: Assets linked; tool data present.
- **Constraints**: 7 tools; asset types limited.
- **Known Limitations**: No real-time; depends on data.
- **Performance Considerations**: Large assets slow; pagination used.

## Open Questions / Gaps
- Tool detection logic accuracy requires confirmation.