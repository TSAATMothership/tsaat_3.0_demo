import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const systemPanelsSource = readFileSync(path.join(process.cwd(), "components", "systems-cop-panels.tsx"), "utf8");
const systemsPageSource = readFileSync(path.join(process.cwd(), "app", "systems", "page.tsx"), "utf8");

describe("ICT systems KPI statistics", () => {
  it("uses critical plus high risk findings instead of P1-P2 high risk findings", () => {
    expect(systemPanelsSource).toContain("Total Critical & High risk Findings");
    expect(systemPanelsSource).toContain("Critical & High Risk");
    expect(systemPanelsSource).toContain("criticalHighRiskFindingsCount");
    expect(systemPanelsSource).toContain('dataKey="criticalHighRiskFindingsCount"');
    expect(systemPanelsSource).toContain("Critical & High Risk Findings");
    expect(systemPanelsSource).toContain("Critical & High Risk ICT Systems");
    expect(systemPanelsSource).not.toContain("Total high risk findings (P1-P2)");
    expect(systemPanelsSource).not.toContain("High Risk (P1-P2)");

    expect(systemsPageSource).toContain("let criticalHighRiskFindingsCount = 0;");
    expect(systemsPageSource).toContain('finding.severity === "Critical Exposure"');
    expect(systemsPageSource).toContain('finding.severity === "High Risk"');
    expect(systemsPageSource).toContain("criticalHighRiskFindingsCount += 1;");
    expect(systemsPageSource).toContain("criticalHighRiskFindingsCount={criticalHighRiskFindingsCount}");
    expect(systemsPageSource).toContain("criticalHighRiskFindingsCount:");
    expect(systemsPageSource).not.toContain("highRiskP12FindingsCount");
    expect(systemsPageSource).not.toContain("highRiskP12FindingsBySystem");
  });

  it("pads the critical and high risk scatter chart so edge bubbles are not clipped", () => {
    expect(systemPanelsSource).toContain("function buildPaddedScatterDomain");
    expect(systemPanelsSource).toContain("const endpointAxisDomain = buildPaddedScatterDomain");
    expect(systemPanelsSource).toContain("const criticalHighRiskAxisDomain = buildPaddedScatterDomain");
    expect(systemPanelsSource).toContain("domain={endpointAxisDomain}");
    expect(systemPanelsSource).toContain("domain={criticalHighRiskAxisDomain}");
    expect(systemPanelsSource).toContain("tickFormatter={formatNonNegativeAxisTick}");
    expect(systemPanelsSource).toContain("margin={{ top: 24, right: 28, bottom: 20, left: 16 }}");
  });
});
