import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const tableClientSource = readFileSync(
  path.join(process.cwd(), "components", "networks-table-client.tsx"),
  "utf8"
);
const tableSource = readFileSync(path.join(process.cwd(), "components", "networks-table.tsx"), "utf8");
const networksPageSource = readFileSync(path.join(process.cwd(), "app", "networks", "page.tsx"), "utf8");

describe("networks roll-up posture summary table", () => {
  it("replaces posture and P1-P2 columns with severity grouped findings columns", () => {
    expect(tableClientSource).not.toContain("PostureBadge");
    expect(tableClientSource).not.toContain("<th className=\"px-2.5 py-1.5\">Posture</th>");
    expect(tableClientSource).not.toContain("P1-P2 Findings");
    expect(tableClientSource).not.toContain("p12Findings");
    expect(tableClientSource).not.toContain("p12HighRiskFindings");
    expect(tableClientSource).not.toContain("p12CriticalExposureFindings");

    expect(tableClientSource).toContain("Findings (Critical)");
    expect(tableClientSource).toContain("Findings (High)");
    expect(tableClientSource).toContain("Findings (Other)");
    expect(tableClientSource).toContain("criticalFindings");
    expect(tableClientSource).toContain("highFindings");
    expect(tableClientSource).toContain("otherFindings");
  });

  it("uses green score bars with red remainder gaps for both score columns", () => {
    expect(tableClientSource).toContain("bg-emerald-400/90");
    expect(tableClientSource).toContain("bg-rose-500/85");
    expect(tableClientSource).not.toContain('tone="discovery"');
    expect(tableClientSource).not.toContain("bg-cyan-300/90");
    expect(tableClientSource).not.toContain("bg-slate-700/75");
  });

  it("keeps score column headings on one line", () => {
    expect(tableClientSource).toContain('<th className="whitespace-nowrap px-2.5 py-1.5">Compliance Score</th>');
    expect(tableClientSource).toContain('<th className="whitespace-nowrap px-2.5 py-1.5">Discovery Compliance Score</th>');
  });

  it("places the new findings columns immediately after assets", () => {
    const assetsIndex = tableClientSource.indexOf("<th className=\"px-2.5 py-1.5\">Assets</th>");
    const criticalIndex = tableClientSource.indexOf("Findings (Critical)", assetsIndex);
    const highIndex = tableClientSource.indexOf("Findings (High)", criticalIndex);
    const otherIndex = tableClientSource.indexOf("Findings (Other)", highIndex);
    const complianceIndex = tableClientSource.indexOf("Compliance Score", otherIndex);

    expect(assetsIndex).toBeGreaterThan(-1);
    expect(criticalIndex).toBeGreaterThan(assetsIndex);
    expect(highIndex).toBeGreaterThan(criticalIndex);
    expect(otherIndex).toBeGreaterThan(highIndex);
    expect(complianceIndex).toBeGreaterThan(otherIndex);
  });

  it("passes severity grouped findings from the networks page into the table", () => {
    expect(tableSource).not.toContain("deriveOverallStatus");
    expect(tableSource).toContain("criticalFindingsByNetwork");
    expect(tableSource).toContain("highFindingsByNetwork");
    expect(tableSource).toContain("otherFindingsByNetwork");
    expect(tableSource).toContain("riskFindings: NetworkDetailRiskFindingRow[]");
    expect(tableSource).toContain("assetHighRiskCvesByAssetId?: Record<string, HighRiskCveDetail[]>");

    expect(networksPageSource).toContain('const openFindings = networkScopedFindings.filter((finding) => finding.status === "open");');
    expect(networksPageSource).toContain("for (const finding of openFindings)");
    expect(networksPageSource).toContain("const criticalFindingsByNetwork = new Map<string, number>();");
    expect(networksPageSource).toContain("const highFindingsByNetwork = new Map<string, number>();");
    expect(networksPageSource).toContain("const otherFindingsByNetwork = new Map<string, number>();");
    expect(networksPageSource).toContain('finding.severity === "Critical Exposure"');
    expect(networksPageSource).toContain('finding.severity === "High Risk"');
    expect(networksPageSource).toContain("criticalFindingsByNetwork={criticalFindingsByNetwork}");
    expect(networksPageSource).toContain("highFindingsByNetwork={highFindingsByNetwork}");
    expect(networksPageSource).toContain("otherFindingsByNetwork={otherFindingsByNetwork}");
    expect(networksPageSource).toContain("networkId,");
    expect(networksPageSource).toContain("systemId,");
    expect(networksPageSource).toContain("environmentType,");
    expect(networksPageSource).toContain("riskFindings={riskProfileFindings}");
    expect(networksPageSource).toContain("assetHighRiskCvesByAssetId={highRiskCvesByAssetId}");
    expect(networksPageSource).toContain("asOfDate={chartAnchorDateKey}");
    expect(networksPageSource).not.toContain("p12FindingsByNetwork={");
    expect(networksPageSource).not.toContain("p12CriticalExposureFindingsByNetwork={");
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
    expect(tableClientSource).toContain('if (count <= 0)');
    expect(tableClientSource).toContain("setRiskDrillThrough");
    expect(tableClientSource).toContain('finding.workflowStatus !== "open"');
    expect(tableClientSource).toContain("finding.networkId");
    expect(tableClientSource).toContain("selectedFindings.length");
    expect(tableClientSource).toContain("allFindings={riskDrillThrough.allFindings}");
    expect(tableClientSource).toContain("assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}");
  });
});
