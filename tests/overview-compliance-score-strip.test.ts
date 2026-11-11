import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const stripSource = readFileSync(
  path.join(process.cwd(), "components", "overview-compliance-score-strip.tsx"),
  "utf8"
);
const networksPageSource = readFileSync(path.join(process.cwd(), "app", "networks", "page.tsx"), "utf8");
const systemsPageSource = readFileSync(path.join(process.cwd(), "app", "systems", "page.tsx"), "utf8");
const cyberCopDashboardSource = readFileSync(path.join(process.cwd(), "components", "cyber-cop-dashboard.tsx"), "utf8");
const cyberCopPageSource = readFileSync(path.join(process.cwd(), "app", "cyber-cop", "page.tsx"), "utf8");

describe("overview compliance score strip", () => {
  it("uses drill-through-style score cards for overview score sections", () => {
    expect(stripSource).toContain("OverviewComplianceScoreStrip");
    expect(stripSource).toContain("p-2.5");
    expect(stripSource).toContain("export interface OverviewScoreCard");
    expect(stripSource).toContain("function ScoreCard");
    expect(stripSource).toContain("text-3xl font-semibold leading-none text-emerald-100");
    expect(stripSource).toContain('{card.total} checks');
    expect(stripSource).toContain("mt-3 flex h-2.5 overflow-hidden rounded-full");
    expect(stripSource).toContain("card.segments.map");
    expect(stripSource).toContain("mt-2 grid grid-cols-3 gap-1.5");
    expect(stripSource).toContain("Current modelling scope");
    expect(stripSource).toContain("text-3xl font-semibold leading-none text-amber-100");
    expect(stripSource).toContain("mt-2 grid grid-cols-2 gap-1.5");
    expect(stripSource).toContain("segmentWidth(coverage.modelledCount, coverage.totalCount)");
    expect(stripSource).toContain("segmentWidth(coverage.notModelledCount, coverage.totalCount)");
    expect(stripSource).not.toContain('<ComplianceScoreTile title="Overall Compliance"');
    expect(stripSource).not.toContain('<ComplianceScoreTile title="DSE Compliance"');
    expect(stripSource).not.toContain('<ComplianceScoreTile title="DPE Compliance"');
  });

  it("redirects retired posture pages to the current scoped risk profiles", () => {
    for (const pageSource of [networksPageSource, systemsPageSource]) {
      expect(pageSource).toContain("postureReplacementHref");
      expect(pageSource).toContain("redirect(");
    }
  });

  it("reuses the network overview score-card styling in Cyber COP overview tiles", () => {
    expect(stripSource).toContain("export function ScoreCard");
    expect(cyberCopDashboardSource).toContain("ScoreCard as OverviewScoreCardTile");
    expect(cyberCopDashboardSource).toContain("complianceScoreCards: OverviewScoreCard[]");
    expect(cyberCopDashboardSource).toContain("<OverviewScoreCardTile key={card.title} card={card} />");
    expect(cyberCopDashboardSource).not.toContain("function ComplianceTile");
    expect(cyberCopDashboardSource).not.toContain("Senior Cyber Operations Briefing");

    expect(cyberCopPageSource).toContain("function complianceScoreCard");
    expect(cyberCopPageSource).toContain("rollupComplianceCounts(scopedNetworkRollups)");
    expect(cyberCopPageSource).toContain("complianceScoreCards={complianceScoreCards}");
  });
});
