import { describe, expect, it } from "vitest";
import { buildCmdbAssetView, CMDB_ATTRIBUTE_KEYS, type CmdbAttributeDefinition } from "@/lib/cmdb-attributes";
import type { CmdbAssetDetails } from "@/lib/cmdb-drill-through";
import { ASSET_TYPES } from "@/lib/asset-taxonomy";

const details: CmdbAssetDetails = {
  snapshotDate: "2026-10-30", assetId: "ci-1", assetName: "Server One", assetHostname: "server-1",
  assetType: "server", assetIpAddress: "192.0.2.1", networkId: "net-1", networkName: "Network One",
  hasIctSystem: true, systemId: "sys-1", systemName: "System One", environmentType: "Production",
  securityDomain: "PROTECTED", cmdbRecordUrl: "https://cmdb.example.test/ci-1",
  lifecycleEolStatus: "Supported", lifecycleWarrantyStatus: "Unknown", operatingSystemSummary: "Windows Server 2022 | Supported",
  networkOsSummary: null, patchStateSummary: null, installedSoftwareCount: 0, vulnerabilityCount: 2, criticalVulnerabilityCount: 1
};
const definitions: CmdbAttributeDefinition[] = CMDB_ATTRIBUTE_KEYS.map((key, index) => ({ key, label: key, displayOrder: index * 10 }));

describe("CMDB asset-type attributes", () => {
  it.each(ASSET_TYPES)("can render the complete existing field set for %s", assetType => {
    const view = buildCmdbAssetView({ ...details, assetType }, definitions);
    expect(view.attributes.map(row => row.key)).toEqual([...CMDB_ATTRIBUTE_KEYS]);
    expect(view.attributes.find(row => row.key === "installedSoftwareCount")?.value).toBe("0");
    expect(view.attributes.find(row => row.key === "networkOsSummary")?.value).toBe("Not supplied");
    expect(view.attributes.at(-1)).toMatchObject({ key: "cmdbRecordUrl", value: "Open CMDB record", href: details.cmdbRecordUrl });
  });
  it("uses only mapped fields, their SQL labels and their configured order", () => {
    const view = buildCmdbAssetView(details, [
      { key: "assetName", label: "Device", displayOrder: 20 },
      { key: "vulnerabilityCount", label: "Issues", displayOrder: 10 }
    ]);
    expect(view.attributes).toEqual([
      { key: "vulnerabilityCount", label: "Issues", value: "2" },
      { key: "assetName", label: "Device", value: "Server One" }
    ]);
    expect(view).not.toHaveProperty("cmdbRecordUrl");
    expect(view).not.toHaveProperty("operatingSystemSummary");
    expect(buildCmdbAssetView(details, []).attributes).toEqual([]);
  });
  it("retains unassigned values and type labels", () => {
    const view = buildCmdbAssetView({ ...details, assetType: "network-device", networkName: "", hasIctSystem: false, environmentType: null }, definitions);
    const values = Object.fromEntries(view.attributes.map(row => [row.key, row.value]));
    expect(values).toMatchObject({ assetType: "Network Device", networkName: "net-1", systemName: "Not linked to ICT system", environmentType: "Unassigned" });
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "invalid", null])("does not render unsafe or missing URLs: %s", cmdbRecordUrl => {
    expect(buildCmdbAssetView({ ...details, cmdbRecordUrl }, definitions).attributes.at(-1))
      .toEqual({ key: "cmdbRecordUrl", label: "cmdbRecordUrl", value: "Not supplied" });
  });
  it("rejects unsupported keys, duplicate keys and malformed metadata", () => {
    for (const invalid of [
      [{ ...definitions[0], key: "__proto__" }], [definitions[0], definitions[0]],
      [{ ...definitions[0], label: " " }], [{ ...definitions[0], displayOrder: -1 }]
    ]) expect(() => buildCmdbAssetView(details, invalid as CmdbAttributeDefinition[])).toThrow("Invalid CMDB attribute configuration");
  });
});
