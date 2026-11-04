import { beforeEach, describe, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFPage, PDFRawStream } from "pdf-lib";
import { NextRequest } from "next/server";
import { createGovernanceInsightsPdf, insightsSnapshotTimestamp } from "@/lib/governance-insights-pdf";
import { buildDiscoveryOverview } from "@/lib/discovery-overview";
import { buildGovernanceInsights } from "@/lib/governance-insights";
import { buildScopedDiscoveryToolCoverage } from "@/lib/scoped-discovery-tool-coverage";
import { defaultDiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import { createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { loadGovernanceInsights, type GovernanceInsightsData } from "@/lib/governance-insights-data";
import type { ServiceImpactModel } from "@/lib/service-impact";
import { GET } from "@/app/api/governance/insights/report/route";

vi.mock("@/lib/governance-insights-data", () => ({ loadGovernanceInsights: vi.fn() }));
const date = "2026-04-23", snapshotTimestamp = "2026-04-23T10:08:50.675Z", generated = new Date("2026-11-04T11:12:13.000Z");
function fixture(): GovernanceInsightsData {
  const model = buildDiscoveryOverview({ snapshotDate: date, coverage: buildScopedDiscoveryToolCoverage([], defaultDiscoveryToolsSettings()), endpoints: [], software: [], vulnerabilities: [], patches: [], shadow: [] });
  const impact: ServiceImpactModel = { snapshotDate: date, systems: [], business: [], mission: [], assets: [], findings: [], unattributedFindings: 0, severities: [] };
  return { model, impact, insights: buildGovernanceInsights(model, impact), snapshotGeneratedAt: snapshotTimestamp,
    scope: { network: ["net-1"], system: [], securityDomain: "SECRET", dataDate: date },
    scopeLabels: { networks: ["Example Network (net-1)"], systems: [], domains: ["SECRET"] } };
}
async function readPdf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes), texts: string[] = [];
  for (const [, item] of doc.context.enumerateIndirectObjects()) if (item instanceof PDFRawStream) {
    let stream: Buffer; try { stream = inflateSync(item.contents); } catch { continue; }
    for (const match of stream.toString("latin1").matchAll(/<([0-9A-F]+)> Tj/g)) texts.push(Buffer.from(match[1], "hex").toString("latin1"));
  }
  return { doc, text: texts.join("\n") };
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(loadGovernanceInsights).mockResolvedValue(fixture()); });

describe("Insights infographic PDF", () => {
  it("includes all chapters, scoped context, distinct timestamps and explicit empty denominators", async () => {
    const { doc, text } = await readPdf(await createGovernanceInsightsPdf(fixture(), generated));
    expect(doc.getTitle()).toBe("Cyber Terrain Posture - Insights"); expect(doc.getCreationDate()).toEqual(generated);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(7);
    for (const label of ["Executive briefing", "You can only protect what you can see.", "Discovery tool coverage", "Separate the urgent from the underlying.", "Technical exposure has a service context.", "Completion needs evidence, not intention.", "Turn evidence into accountable action."])
      expect(text).toContain(label);
    expect(text).toContain("Example Network (net-1)"); expect(text).toContain("Security domains: SECRET");
    expect(text).toContain("Snapshot timestamp: 2026-04-23 10:08:50.675 UTC");
    expect(text).toContain("PDF generated: 2026-11-04 11:12:13.000 UTC");
    expect(text).toContain("N/A"); expect(text).toContain("No evidence is available");
    expect(text.match(/Snapshot timestamp:/g)?.length).toBe(doc.getPageCount() + 1);
    for (const page of doc.getPages()) expect(page.getSize()).toEqual({ width: 595.28, height: 841.89 });
  });
  it("uses source timestamps with an explicit timezone and never invents a midnight capture", () => {
    expect(insightsSnapshotTimestamp("2026-04-23T20:08:50.675+10:00")).toBe("2026-04-23 10:08:50.675 UTC");
    for (const value of [undefined, "", "bad", date, "2026-04-23T10:08:50"]) expect(insightsSnapshotTimestamp(value)).toBe("Not recorded");
  });
  it("flows large tool lists and long names without dropping text or drawing outside page bounds", async () => {
    const data = fixture(), source = structuredClone(data);
    data.scopeLabels.networks = ["Scoped network " + "long scope label ".repeat(80)];
    data.model.coverage.tools = Array.from({ length: 19 }, (_, index) => ({ id: `tool-${index}`, label: `Tool ${index} - ${"Long configured name ".repeat(index === 0 ? 180 : 4)}`,
      applicable: 10, covered: 7, missing: 3, applicableByCiType: createAssetTypeRecord(() => 10), coveragePercent: 70, chartBackground: "" }));
    const spy = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const { doc, text } = await readPdf(await createGovernanceInsightsPdf(data, generated));
      expect(doc.getPageCount()).toBeGreaterThan(7);
      for (let index = 0; index < 19; index++) expect(text).toContain(`Tool ${index} -`);
      for (const [label, options] of spy.mock.calls) {
        expect(options?.y, label).toBeGreaterThanOrEqual(20); expect(options?.y, label).toBeLessThanOrEqual(818);
        expect(options?.x, label).toBeGreaterThanOrEqual(35);
        expect((options?.x ?? 0) + (options?.font?.widthOfTextAtSize(label, options.size ?? 10) ?? 0), label).toBeLessThanOrEqual(560);
      }
      expect(data.model.patches).toEqual(source.model.patches);
    } finally { spy.mockRestore(); }
  });
  it("rejects invalid PDF generation time", async () => {
    await expect(createGovernanceInsightsPdf(fixture(), new Date("bad"))).rejects.toThrow("generation timestamp");
  });
});

describe("Insights PDF route", () => {
  it.each(["", "network=net-1&dataDate=bad", "network=net-1&dataDate=2026-02-30", "network=net-1&dataDate=2026-04-23&dataDate=2026-04-24", "system=sys-1&securityDomain=INVALID", "network=" + "x".repeat(256)])("rejects invalid scope/date: %s", async query => {
    expect((await GET(new NextRequest("http://localhost/api/governance/insights/report?" + query))).status).toBe(400);
    expect(loadGovernanceInsights).not.toHaveBeenCalled();
  });
  it("pins header filters only and returns the resolved snapshot filename without caching", async () => {
    const response = await GET(new NextRequest("http://localhost/api/governance/insights/report?system=sys-1&securityDomain=NONE&dataDate=2026-04-24&severity=Major&discoveryFilters=local"));
    expect(loadGovernanceInsights).toHaveBeenCalledExactlyOnceWith({ network: [], system: ["sys-1"], securityDomain: "NONE", dataDate: "2026-04-24" });
    expect(response.status).toBe(200); expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(`cyber-terrain-insights-${date}.pdf`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await readPdf(new Uint8Array(await response.arrayBuffer()))).text).toContain(snapshotTimestamp.replace("T", " ").replace("Z", " UTC"));
  });
  it("returns a retryable error without provider details", async () => {
    vi.mocked(loadGovernanceInsights).mockRejectedValueOnce(new Error("Private SQL credential details"));
    const response = await GET(new NextRequest("http://localhost/api/governance/insights/report?network=net-1"));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("Private");
  });
});
