import { describe, expect, it } from "vitest";
import { ENDPOINT_COLUMNS, type EndpointRecord } from "@/lib/endpoint-explorer";
import { buildEndpointWorkbook } from "@/lib/endpoint-explorer-workbook";
import { readXlsxEntries } from "@/lib/network-target-state-template-workbook";

const endpoint: EndpointRecord = { assetId: "a1", name: "=1+1 <gateway> & partner", ciType: "Server", ipAddress: "010.001.001.002",
  macAddress: "00:AA:BB:CC:DD:EE", deviceModel: null, lastDiscoveredDate: "2026-10-28T13:42:00Z", discoveredBy: "Scanner", managedNetwork: "West" };
const exportedAt = new Date("2026-10-31T06:07:08Z");

describe("endpoint Excel export", () => {
  it("exports all rows beyond the UI page with nine columns and one UTC timestamp per row", () => {
    const rows = Array.from({ length: 76 }, (_, index) => ({ ...endpoint, assetId: `a${index}` }));
    const zip = readXlsxEntries(buildEndpointWorkbook(rows, exportedAt));
    expect([...zip.keys()]).toEqual(expect.arrayContaining(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]));
    const sheet = zip.get("xl/worksheets/sheet1.xml")!.toString("utf8");
    expect(sheet.match(/<row /g)).toHaveLength(77);
    for (const { label } of ENDPOINT_COLUMNS) expect(sheet).toContain(`>${label}</t>`);
    expect(sheet).toContain("Export Timestamp (UTC)");
    const times = [...sheet.matchAll(/<c r="I\d+" s="2"><v>([^<]+)<\/v><\/c>/g)].map((match) => Number(match[1]));
    expect(times).toHaveLength(76);
    expect(new Set(times).size).toBe(1);
    expect(times[0]).toBeCloseTo(exportedAt.getTime() / 86400000 + 25569, 8);
    expect(sheet).toContain('autoFilter ref="A1:I77"');
    expect(sheet).toContain('state="frozen"');
  });

  it("preserves addresses and formula-looking names as text, escapes XML and writes dates as dates", () => {
    const zip = readXlsxEntries(buildEndpointWorkbook([endpoint], exportedAt));
    const sheet = zip.get("xl/worksheets/sheet1.xml")!.toString("utf8");
    expect(sheet).toContain('t="inlineStr"><is><t xml:space="preserve">=1+1 &lt;gateway&gt; &amp; partner</t>');
    expect(sheet).toContain('>010.001.001.002</t>');
    expect(sheet).toContain('>00:AA:BB:CC:DD:EE</t>');
    expect(sheet).not.toContain("<f>");
    expect(sheet).toContain('<c r="F2" s="2"><v>');
    expect(sheet).toContain('<c r="E2" s="0" t="inlineStr"><is><t xml:space="preserve"></t>');
    expect(zip.get("xl/styles.xml")!.toString("utf8")).toContain('formatCode="yyyy-mm-dd hh:mm:ss &quot;UTC&quot;"');
  });

  it("supports empty results and rejects an invalid export timestamp", () => {
    const sheet = readXlsxEntries(buildEndpointWorkbook([], exportedAt)).get("xl/worksheets/sheet1.xml")!.toString("utf8");
    expect(sheet).toContain('dimension ref="A1:I1"');
    expect(() => buildEndpointWorkbook([], new Date(NaN))).toThrow("Invalid export timestamp");
  });
});
