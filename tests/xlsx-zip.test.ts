import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readXlsxEntries, readXlsxEntriesAsync, writeXlsxEntries } from "@/lib/xlsx-zip";
import { buildNetworkTargetStateTemplateWorkbook } from "@/lib/network-target-state-template-workbook";
import type { ManagedNetwork } from "@/lib/types";

const encode = (value: string) => new TextEncoder().encode(value);
const template = () => Uint8Array.from(readFileSync("data/templates/network-target-state-template.xlsx"));

describe("browser XLSX ZIP container", () => {
  it("round-trips Unicode names and arbitrary binary entries with browser byte APIs", async () => {
    const entries = new Map([["content/展示.xml", encode("<value>日本語 &amp; café</value>")], ["media/image.bin", new Uint8Array([0, 255, 17, 6])]]);
    const bytes = writeXlsxEntries(entries, new Date("2026-11-09T05:00:00Z"));
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(readXlsxEntries(bytes)).toEqual(entries);
    expect(await readXlsxEntriesAsync(bytes)).toEqual(entries);
  });

  it("rejects truncated and corrupted entries instead of emitting a partial workbook", () => {
    const bytes = writeXlsxEntries(new Map([["value.xml", encode("original")]]));
    expect(() => readXlsxEntries(bytes.slice(0, -8))).toThrow(/central directory/);
    bytes[30 + encode("value.xml").length] ^= 1;
    expect(() => readXlsxEntries(bytes)).toThrow(/integrity/);
    expect(() => writeXlsxEntries(new Map(), new Date(NaN))).toThrow(/timestamp/);
  });

  it("bundles the exact maintained template and preserves every untouched package part", async () => {
    const original = template();
    expect(Uint8Array.from(readFileSync("public/document-assets/network-target-state-template.xlsx"))).toEqual(original);
    const source = await readXlsxEntriesAsync(original);
    const network: ManagedNetwork = { id: "net-1", name: "Client template", securityDomain: "UNKNOWN", criticality: "Critical", adfPlatform: true,
      enterprisePlatform: true, modellingStatus: true, discoveryStatus: "Discovery Enabled", ictSystemIds: [], assetIds: [], targetStateAssets: { server: ["Server One"] } };
    const output = readXlsxEntries(await buildNetworkTargetStateTemplateWorkbook(network, original));
    expect([...output.keys()]).toEqual([...source.keys()]);
    for (const [name, bytes] of source) {
      if (name === "xl/worksheets/sheet1.xml" || name === "xl/worksheets/sheet2.xml") continue;
      expect(output.get(name), name).toEqual(bytes);
    }
    expect(new TextDecoder().decode(output.get("xl/worksheets/sheet2.xml"))).toContain("Server One");
  });
});
