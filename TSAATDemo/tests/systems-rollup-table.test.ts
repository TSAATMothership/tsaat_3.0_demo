import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const tableClientSource = readFileSync(
  path.join(process.cwd(), "components", "systems-table-client.tsx"),
  "utf8"
);
const tableSource = readFileSync(path.join(process.cwd(), "components", "systems-table.tsx"), "utf8");
const systemsPageSource = readFileSync(path.join(process.cwd(), "app", "systems", "page.tsx"), "utf8");
const mainTableHeaderStart = tableClientSource.indexOf('<table className="min-w-full text-sm">');
const mainTableHeaderEnd = tableClientSource.indexOf("</thead>", mainTableHeaderStart);
const mainTableHeader = tableClientSource.slice(mainTableHeaderStart, mainTableHeaderEnd);

describe("ICT systems roll-up posture summary table", () => {
  it("removes dependency and posture columns from the main roll-up table", () => {
    expect(mainTableHeader).not.toContain("Dependent mission capabilites");
    expect(mainTableHeader).not.toContain("Dependent mission capabilities");
    expect(mainTableHeader).not.toContain("Dependent business services");
    expect(mainTableHeader).not.toContain("Overall Posture");
    expect(mainTableHeader).not.toContain("Production Posture");
    expect(tableClientSource).not.toContain("PostureBadge");
    expect(tableClientSource).not.toContain("overallPosture");
    expect(tableClientSource).not.toContain("productionPosture");
  });

  it("keeps mission and business metadata in the ICT system detail slide-out", () => {
    expect(tableClientSource).toContain("selectedRow.missionCapabilities");
    expect(tableClientSource).toContain("selectedRow.businessServices");
    expect(tableClientSource).toContain("Dependent mission capabilites");
    expect(tableClientSource).toContain("Dependent business services");
  });

  it("renders assets and severity grouped findings before score columns", () => {
    const systemIndex = mainTableHeader.indexOf("ICT System");
    const assetsIndex = mainTableHeader.indexOf("Assets", systemIndex);
    const criticalIndex = mainTableHeader.indexOf("Findings (Critical)", assetsIndex);
    const highIndex = mainTableHeader.indexOf("Findings (High)", criticalIndex);
    const otherIndex = mainTableHeader.indexOf("Findings (Other)", highIndex);
    const complianceIndex = mainTableHeader.indexOf("Compliance Score", otherIndex);
    const discoveryIndex = mainTableHeader.indexOf("Discovery Compliance Score", complianceIndex);

    expect(systemIndex).toBeGreaterThan(-1);
    expect(assetsIndex).toBeGreaterThan(systemIndex);
    expect(criticalIndex).toBeGreaterThan(assetsIndex);
    expect(highIndex).toBeGreaterThan(criticalIndex);
    expect(otherIndex).toBeGreaterThan(highIndex);
    expect(complianceIndex).toBeGreaterThan(otherIndex);
    expect(discoveryIndex).toBeGreaterThan(complianceIndex);
  });

  it("uses green score bars with red remainder gaps for both score columns", () => {
    expect(tableClientSource).toContain("bg-emerald-400/90");
    expect(tableClientSource).toContain("bg-rose-500/85");
    expect(tableClientSource).not.toContain('tone="discovery"');
    expect(tableClientSource).not.toContain("bg-cyan-300/90");
    expect(tableClientSource).not.toContain("bg-slate-700/75");
  });

  it("keeps score column headings on one line", () => {
    expect(tableClientSource).toContain(
      '<th className="min-w-[10rem] whitespace-nowrap px-2.5 py-1.5">Compliance Score</th>'
    );
    expect(tableClientSource).toContain(
      '<th className="min-w-[13rem] whitespace-nowrap px-2.5 py-1.5">Discovery Compliance Score</th>'
    );
  });

  it("passes open severity grouped findings and risk detail context into the table", () => {
    expect(tableSource).not.toContain("deriveOverallStatus");
    expect(tableSource).toContain("assetCountBySystem");
    expect(tableSource).toContain("criticalFindingsBySystem");
    expect(tableSource).toContain("highFindingsBySystem");
    expect(tableSource).toContain("otherFindingsBySystem");
    expect(tableSource).toContain("riskFindings: NetworkDetailRiskFindingRow[]");
    expect(tableSource).toContain("assetHighRiskCvesByAssetId?: Record<string, HighRiskCveDetail[]>");

    expect(systemsPageSource).toContain('const openFindings = systemScopedFindings.filter((finding) => finding.status === "open");');
    expect(systemsPageSource).toContain("for (const finding of openFindings)");
    expect(systemsPageSource).toContain("const criticalFindingsBySystem = new Map<string, number>();");
    expect(systemsPageSource).toContain("const highFindingsBySystem = new Map<string, number>();");
    expect(systemsPageSource).toContain("const otherFindingsBySystem = new Map<string, number>();");
    expect(systemsPageSource).toContain("assetCountBySystem={endpointCountBySystem}");
    expect(systemsPageSource).toContain("criticalFindingsBySystem={criticalFindingsBySystem}");
    expect(systemsPageSource).toContain("highFindingsBySystem={highFindingsBySystem}");
    expect(systemsPageSource).toContain("otherFindingsBySystem={otherFindingsBySystem}");
    expect(systemsPageSource).toContain("riskFindings={riskProfileFindings}");
    expect(systemsPageSource).toContain("assetHighRiskCvesByAssetId={highRiskCvesByAssetId}");
    expect(systemsPageSource).toContain("asOfDate={chartAnchorDateKey}");
    expect(systemsPageSource).toContain("networkId,");
    expect(systemsPageSource).toContain("systemId,");
    expect(systemsPageSource).toContain("environmentType,");
  });

  it("opens the shared Risk Detail panel from non-zero findings values", () => {
    expect(tableClientSource).toContain("RiskFindingsDrillThrough");
    expect(tableClientSource).toContain("RiskFindingsDrillThroughSelection");
    expect(tableClientSource).toContain("function FindingCountCell");
    expect(tableClientSource).toContain("function findingMatchesBucket");
    expect(tableClientSource).toContain('bucket === "critical"');
    expect(tableClientSource).toContain('finding.severity === "Critical Exposure"');
    expect(tableClientSource).toContain('bucket === "high"');
    expect(tableClientSource).toContain('finding.severity === "High Risk"');
    expect(tableClientSource).toContain('return finding.severity !== "Critical Exposure" && finding.severity !== "High Risk";');
    expect(tableClientSource).toContain("openRiskFindingsBySystemId");
    expect(tableClientSource).toContain('finding.workflowStatus !== "open"');
    expect(tableClientSource).toContain("finding.systemId");
    expect(tableClientSource).toContain("selectedFindings.length");
    expect(tableClientSource).toContain("allFindings={riskDrillThrough.allFindings}");
    expect(tableClientSource).toContain("assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}");
  });
});
