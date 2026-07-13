import {
  buildNetworkTargetStateTemplateHref,
  networkTargetStateTemplateContentDisposition,
  networkTargetStateTemplateFilename
} from "@/lib/network-target-state-template-links";
import {
  buildNetworkTargetStateTemplateWorkbook,
  networkTargetStateTemplateAssetRows,
  networkDetailsTemplateValues,
  readXlsxEntries
} from "@/lib/network-target-state-template-workbook";
import type { ManagedNetwork } from "@/lib/types";
import { describe, expect, it } from "vitest";

function createNetwork(overrides: Partial<ManagedNetwork> = {}): ManagedNetwork {
  return {
    id: "net-alpha",
    name: "Alpha Network",
    criticality: "Critical",
    adfPlatform: true,
    enterprisePlatform: true,
    modellingStatus: true,
    discoveryStatus: "Discovery Enabled",
    ictSystemIds: [],
    assetIds: [],
    description: "Alpha & protected <network>",
    atoNumber: "ATO-NET-001",
    diisId: "DIIS-NET-001",
    owner: "Alpha Operations",
    supportEmail: "alpha.support@example.test",
    ...overrides
  };
}

describe("network target-state template links", () => {
  it("builds a data-date aware download URL and safe workbook filename", () => {
    expect(buildNetworkTargetStateTemplateHref({ networkId: "net-alpha", dataDate: "2026-04-30" })).toBe(
      "/api/discovery-coverage/target-state-template?network=net-alpha&dataDate=2026-04-30"
    );
    expect(networkTargetStateTemplateFilename('Alpha/Network:"One"')).toBe(
      "Alpha Network One target state template.xlsx"
    );
    expect(networkTargetStateTemplateContentDisposition("Alpha Network")).toContain(
      'filename="Alpha Network target state template.xlsx"'
    );
  });
});

describe("network target-state template workbook", () => {
  it("fills the Network Details sheet from resolved network detail fields", async () => {
    const workbook = await buildNetworkTargetStateTemplateWorkbook(
      createNetwork({
        targetStateAssets: {
          server: ["srv-alpha-01", " srv-alpha-02 "],
          "storage-device": ["nas-alpha-&-01"],
          workstation: [""]
        }
      })
    );
    const entries = readXlsxEntries(workbook);
    const networkDetailsSheet = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8") ?? "";
    const assetsSheet = entries.get("xl/worksheets/sheet2.xml")?.toString("utf8") ?? "";

    expect(networkDetailsSheet).toContain('dimension ref="A1:B6"');
    expect(networkDetailsSheet).toContain('<c r="B1" t="inlineStr"><is><t>Alpha Network</t></is></c>');
    expect(networkDetailsSheet).toContain("Alpha &amp; protected &lt;network&gt;");
    expect(networkDetailsSheet).toContain('<c r="B3" t="inlineStr"><is><t>ATO-NET-001</t></is></c>');
    expect(networkDetailsSheet).toContain('<c r="B4" t="inlineStr"><is><t>DIIS-NET-001</t></is></c>');
    expect(networkDetailsSheet).toContain('<c r="B5" t="inlineStr"><is><t>Alpha Operations</t></is></c>');
    expect(networkDetailsSheet).toContain('<c r="B6" t="inlineStr"><is><t>alpha.support@example.test</t></is></c>');
    expect(entries.has("xl/worksheets/sheet2.xml")).toBe(true);
    expect(entries.has("xl/worksheets/sheet3.xml")).toBe(true);
    expect(assetsSheet).toContain('dimension ref="A1:B4"');
    expect(assetsSheet).toContain('<c r="A2" t="inlineStr"><is><t>srv-alpha-01</t></is></c>');
    expect(assetsSheet).toContain('<c r="B2" t="inlineStr"><is><t>Server</t></is></c>');
    expect(assetsSheet).toContain('<c r="A3" t="inlineStr"><is><t>srv-alpha-02</t></is></c>');
    expect(assetsSheet).toContain('<c r="A4" t="inlineStr"><is><t>nas-alpha-&amp;-01</t></is></c>');
    expect(assetsSheet).toContain('<c r="B4" t="inlineStr"><is><t>Storage Device</t></is></c>');
    expect(assetsSheet).toContain("<xm:sqref>B2:B39</xm:sqref>");
  });

  it("uses network detail fallbacks when source detail fields are blank", () => {
    const values = networkDetailsTemplateValues(
      createNetwork({
        description: undefined,
        atoNumber: undefined,
        diisId: undefined,
        owner: undefined,
        supportEmail: undefined
      })
    );

    expect(values).toEqual([
      "Alpha Network",
      "Alpha Network is a multi-domain managed network segment in current TSAAT scope.",
      "ATO-NET-ALPHA",
      "",
      "Alpha Network Operations Team",
      "network-support+net-alpha@tsaat.local"
    ]);
  });

  it("builds asset sheet rows from target-state assets in canonical asset-type order", () => {
    expect(
      networkTargetStateTemplateAssetRows(
        createNetwork({
          targetStateAssets: {
            other: ["other-01"],
            server: ["server-01"],
            workstation: ["  workstation-01  "],
            "network-device": ["network-01"],
            "storage-device": [],
            "printer-device": ["printer-01"]
          }
        })
      )
    ).toEqual([
      { assetName: "server-01", assetTypeLabel: "Server" },
      { assetName: "workstation-01", assetTypeLabel: "Workstation" },
      { assetName: "network-01", assetTypeLabel: "Network Device" },
      { assetName: "printer-01", assetTypeLabel: "Printer Device" },
      { assetName: "other-01", assetTypeLabel: "Other" }
    ]);
  });
});
