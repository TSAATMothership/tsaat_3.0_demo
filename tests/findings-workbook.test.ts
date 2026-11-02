import { describe, expect, it } from "vitest";
import { buildFindingsWorkbook } from "@/lib/findings-workbook";
import { buildAssetDetailsRow } from "@/lib/findings-assets";
import { readXlsxEntries } from "@/lib/network-target-state-template-workbook";
import { assetDetails, configuration, exportContext, finding } from "./fixtures/findings-export";

const exportedAt = new Date("2026-11-01T06:07:08Z");
const workbook = (rows = [finding()]) => readXlsxEntries(buildFindingsWorkbook(rows, exportContext.asOf, assetDetails, configuration, exportedAt));
const xml = (zip: Map<string, Buffer>, sheet: number) => zip.get(`xl/worksheets/sheet${sheet}.xml`)!.toString("utf8");

describe("findings workbook", () => {
  it("exports every finding and unique affected CI to separate linked sheets", () => {
    const zip = workbook(Array.from({ length: 76 }, (_, index) => finding(`finding-${index}`, index < 75 ? "0001" : "missing-ci")));
    expect(zip.get("xl/workbook.xml")!.toString()).toContain('name="Findings" sheetId="1" r:id="rId1"');
    expect(zip.get("xl/workbook.xml")!.toString()).toContain('name="Affected CIs" sheetId="2" r:id="rId2"');
    expect(zip.get("xl/_rels/workbook.xml.rels")!.toString()).toContain('Target="worksheets/sheet2.xml"');
    expect(zip.get("[Content_Types].xml")!.toString()).toContain('PartName="/xl/worksheets/sheet2.xml"');
    const findings = xml(zip, 1), cis = xml(zip, 2);
    expect(findings.match(/<row /g)).toHaveLength(77);
    expect(cis.match(/<row /g)).toHaveLength(3);
    expect(findings).toContain('autoFilter ref="A1:P77"');
    expect(cis).toContain('autoFilter ref="A1:H3"');
    for (const sheet of [findings, cis]) {
      expect(sheet).toContain('state="frozen"');
      expect(sheet).toContain('>CI ID</t>');
      expect(sheet).toContain('>0001</t>');
      expect(sheet).toContain('>missing-ci</t>');
      expect(sheet).toContain('>Export Timestamp (UTC)</t>');
      expect(sheet).not.toContain('>unrelated</t>');
    }
  });
  it("matches the drill-through columns and canonical values, preserving dates and text safely", () => {
    const cis = xml(workbook(), 2);
    for (const label of ["Device Name", "Device IP", "Device Model", "Last Discovered Date", "Discovered By", "Asset Type"]) {
      expect(cis).toContain(`>${label}</t>`);
    }
    expect(buildAssetDetailsRow(finding(), assetDetails, configuration)).toMatchObject({ deviceName: "=1+1 <gateway> & partner", assetType: "Network Device" });
    for (const value of ["=1+1 &lt;gateway&gt; &amp; partner", "010.001.001.002", "Edge Model 100", "01-11-2026", "Discovery Scanner", "Network Device"]) {
      expect(cis).toContain(`>${value}</t>`);
    }
    expect(cis).not.toContain("Evidence fallback");
    expect(cis).not.toContain("<f>");
  });
  it("uses the same evidence fallback and missing-value labels as the drill-through", () => {
    const cis = xml(workbook([finding("missing", "missing-ci")]), 2);
    expect(buildAssetDetailsRow(finding("missing", "missing-ci"), assetDetails, configuration)).toMatchObject({
      deviceName: "Evidence fallback", deviceIp: "192.0.2.9", assetType: "Storage Device", deviceModel: "Not recorded", lastDiscoveredDate: "Not recorded", discoveredBy: "Not recorded"
    });
    for (const value of ["Evidence fallback", "192.0.2.9", "Storage Device", "Not recorded"]) expect(cis).toContain(`>${value}</t>`);
  });
  it("preserves finding details and uses numeric open duration at the selected date, leaving closed duration blank", () => {
    const findings = xml(workbook([finding(), finding("closed", "0001", "closed")]), 1);
    expect(findings).toContain('<c r="H2"><v>29</v></c>');
    expect(findings).toContain('<c r="H3" s="0" t="inlineStr"><is><t xml:space="preserve"></t>');
    expect(findings).toContain('<c r="B2"><v>1</v></c>');
    for (const value of ["net-1", "sys-1", "Production", "Upgrade required", "Upgrade the device"]) expect(findings).toContain(`>${value}</t>`);
    expect(findings).toContain('&quot;asset_name&quot;:&quot;Evidence fallback&quot;');
    expect(findings).toContain('<c r="G2" s="2"><v>');
  });
});
