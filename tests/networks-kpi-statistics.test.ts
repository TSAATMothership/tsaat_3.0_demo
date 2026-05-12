import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const networkPanelsSource = readFileSync(path.join(process.cwd(), "components", "networks-cop-panels.tsx"), "utf8");
const networksPageSource = readFileSync(path.join(process.cwd(), "app", "networks", "page.tsx"), "utf8");

describe("networks KPI statistics", () => {
  it("uses critical plus high risk findings instead of P1-P2 high risk findings", () => {
    expect(networkPanelsSource).toContain("Total Critical & High risk Findings");
    expect(networkPanelsSource).toContain("Critical & High Risk");
    expect(networkPanelsSource).toContain("criticalHighRiskFindingsCount");
    expect(networkPanelsSource).toContain('dataKey="criticalHighRiskFindingsCount"');
    expect(networkPanelsSource).toContain("Critical & High Risk Findings");
    expect(networkPanelsSource).not.toContain("Total high risk findings (P1-P2)");
    expect(networkPanelsSource).not.toContain("High Risk (P1-P2)");

    expect(networksPageSource).toContain("let criticalHighRiskFindingsCount = 0;");
    expect(networksPageSource).toContain('finding.severity === "Critical Exposure"');
    expect(networksPageSource).toContain('finding.severity === "High Risk"');
    expect(networksPageSource).toContain("criticalHighRiskFindingsCount += 1;");
    expect(networksPageSource).toContain("criticalHighRiskFindingsCount={criticalHighRiskFindingsCount}");
    expect(networksPageSource).toContain("criticalHighRiskFindingsCount:");
    expect(networksPageSource).not.toContain("highRiskP12FindingsCount");
    expect(networksPageSource).not.toContain("highRiskP12FindingsByNetwork");
  });

  it("pads the high risk networks scatter chart so edge bubbles are not clipped", () => {
    expect(networkPanelsSource).toContain("function buildPaddedScatterDomain");
    expect(networkPanelsSource).toContain("const endpointAxisDomain = buildPaddedScatterDomain");
    expect(networkPanelsSource).toContain("const criticalHighRiskAxisDomain = buildPaddedScatterDomain");
    expect(networkPanelsSource).toContain("domain={endpointAxisDomain}");
    expect(networkPanelsSource).toContain("domain={criticalHighRiskAxisDomain}");
    expect(networkPanelsSource).toContain("tickFormatter={formatNonNegativeAxisTick}");
    expect(networkPanelsSource).toContain("margin={{ top: 24, right: 28, bottom: 20, left: 16 }}");
  });
});
