import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SECURITY_DOMAINS, normalizeDatasetSecurityDomains, securityDomainSelection, securityDomainFilter, parseSecurityDomainScope } from "@/lib/security-domain.mjs";
import { applyAssetFilters, filterNetworks, filterSystems, parseFilters } from "@/lib/selectors";
import { updateWorkspaceScope, workspaceHref, sameWorkspaceScope } from "@/lib/workspace-navigation";
import type { Dataset } from "@/lib/types";
const sample: Dataset = JSON.parse(readFileSync("data/current.json", "utf8"));
describe("global security domain scope", () => {
  it("defaults to all three, distinguishes none and accepts legacy bookmarks", () => {
    expect(securityDomainSelection(undefined)).toEqual(SECURITY_DOMAINS);
    expect(securityDomainFilter(["UNKNOWN", "SECRET", "PROTECTED"])).toBeUndefined();
    expect(securityDomainFilter([])).toBe("NONE");
    expect(securityDomainSelection("NONE")).toEqual([]);
    expect(parseFilters({securityDomain: ["Secret", "Unclassified"]}).securityDomain).toBe("SECRET,UNKNOWN");
    expect(parseSecurityDomainScope("SECRET,PROTECTED")).toBe("PROTECTED,SECRET");
    expect(() => parseSecurityDomainScope("SECRET; DROP TABLE tsaat.asset")).toThrow("Invalid security domain");
    expect(() => parseSecurityDomainScope(null)).toThrow();
  });
  it("preserves scope and date through navigation and clears stale detail state", () => {
    const current = new URLSearchParams("network=net-1&dataDate=2026-03-05&page=4&impactAssetId=a");
    const next = updateWorkspaceScope(current,"securityDomain",["SECRET"]);
    expect(next.get("network")).toBe("net-1");
    expect(next.get("dataDate")).toBe("2026-03-05");
    expect(next.has("page")).toBe(false); expect(next.has("impactAssetId")).toBe(false);
    expect(workspaceHref("/measures?measuresTab=measures-spi",next)).toContain("securityDomain=SECRET");
    expect(sameWorkspaceScope(current,next)).toBe(false);
    expect(sameWorkspaceScope(current,updateWorkspaceScope(next,"securityDomain",[...SECURITY_DOMAINS]))).toBe(true);
    expect(workspaceHref("/discovery-coverage",updateWorkspaceScope(next,"securityDomain",[]))).toContain("securityDomain=NONE");
  });
  it("partitions each entity by its own domain and retains existing all-domain results", () => {
    for(const [rows,filter] of [[sample.assets,(domain:string)=>applyAssetFilters(sample.assets,sample.ictSystems,{securityDomain:domain})],
      [sample.ictSystems,(domain:string)=>filterSystems(sample.ictSystems,{securityDomain:domain})],
      [sample.managedNetworks.filter(n=>n.id!=="net-unassigned"),(domain:string)=>filterNetworks(sample.managedNetworks,{securityDomain:domain})]] as const){
      expect(filter("NONE")).toEqual([]);
      const partitions: Array<{id:string}>=[];
      for(const domain of SECURITY_DOMAINS) partitions.push(...filter(domain));
      expect(partitions.map(row=>row.id).sort()).toEqual(rows.map(row=>row.id).sort());
    }
    const mixed=sample.assets.find(asset=>asset.securityDomain!==sample.managedNetworks.find(n=>n.id===asset.networkId)?.securityDomain)!;
    expect(applyAssetFilters(sample.assets,sample.ictSystems,{managedNetwork:mixed.networkId,securityDomain:mixed.securityDomain})).toContain(mixed);
  });
  it("normalizes legacy records without modifying observations or inventing parent inheritance", () => {
    const legacy={managedNetworks:[{id:"n",classification:"Restricted"},{id:"p",classification:"Protected"},{id:"o",classification:"Official"}],ictSystems:[{id:"s",securityDomain:"Unclassified"}],assets:[{id:"a",securityDomain:"Protected",vulnerabilities:[{id:"v"}]}]};
    const before=structuredClone(legacy),result=normalizeDatasetSecurityDomains(legacy);
    expect(legacy).toEqual(before);
    expect(result.managedNetworks.map(n=>n.securityDomain)).toEqual(["SECRET","PROTECTED","UNKNOWN"]);
    expect(result.ictSystems[0].securityDomain).toBe("UNKNOWN");
    expect(result.assets[0]).toEqual({...legacy.assets[0],securityDomain:"PROTECTED"});
    expect(normalizeDatasetSecurityDomains(result)).toEqual(result);
  });
});
