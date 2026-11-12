import { describe, expect, it } from "vitest";
import { buildCmdbModelCiDetails } from "@/lib/cmdb-model-ci";
import { buildCmdbModelCiView, CMDB_MODEL_ATTRIBUTE_KEYS, type CmdbAttributeDefinition } from "@/lib/cmdb-attributes";
import { isCmdbCiType, MODEL_CI_TYPES } from "@/lib/cmdb-ci-types";
import { isAssetType } from "@/lib/asset-taxonomy";
import { cmdbTopologyHref } from "@/lib/cmdb-topology-navigation";
import type { Dataset, ICTSystem, ManagedNetwork } from "@/lib/types";
const network = (id: string, securityDomain: ManagedNetwork["securityDomain"]): ManagedNetwork => ({ id, name: id, securityDomain,
    criticality: "Critical", adfPlatform: false, enterprisePlatform: false, modellingStatus: true, discoveryStatus: "Discovery Enabled", ictSystemIds: [], assetIds: [] });
const system = (id: string, networkId: string, securityDomain: ICTSystem["securityDomain"], criticality: ICTSystem["criticality"]): ICTSystem => ({
    id, name: id, networkId, securityDomain, criticality, adfPlatform: false, enterprisePlatform: false, modellingStatus: true, diisDefined: true,
    businessServices: [{ id: "shared", name: "Business CI", criticality }], missionCapabilities: [{ id: "shared", name: "Mission CI", criticality }], environments: []
});
export const modelCiFixture: Dataset = { snapshotDate: "2026-10-31", generatedAt: "2026-10-31T00:00:00Z", assets: [],
    managedNetworks: [network("n1", "PROTECTED"), network("n2", "SECRET")],
    ictSystems: [system("s1", "n1", "PROTECTED", "Critical"), system("s2", "n2", "SECRET", "Non-Critical")] };
const definitions: CmdbAttributeDefinition[] = CMDB_MODEL_ATTRIBUTE_KEYS.map((key, index) => ({ key, label: key, displayOrder: index * 10 }));
describe("Recorded model CIs in CMDB", () => {
    it.each(MODEL_CI_TYPES)("recognises %s independently of endpoint inventory and ID collisions", type => {
        expect(isCmdbCiType(type)).toBe(true);
        expect(isAssetType(type)).toBe(false);
        const details = buildCmdbModelCiDetails(modelCiFixture, type, "shared", {})!;
        expect(details.ciName).toBe(type === "business-service" ? "Business CI" : "Mission CI");
        expect(details.systemIds).toEqual(["s1", "s2"]);
        expect(details.criticality).toContain("varies by related system");
        expect(details.relatedSystems).toContain("s1 (s1) — Critical");
        expect(details.relatedSystems).toContain("s2 (s2) — Non-Critical");
        const view = buildCmdbModelCiView(details, definitions);
        expect(view.attributes.map(row => row.key)).toEqual([...CMDB_MODEL_ATTRIBUTE_KEYS]);
        expect(view.attributes.find(row => row.key === "ciType")?.value).toBe(type === "business-service" ? "Business Service" : "Mission Service");
        expect(view.networkId).toBe(""); // A logical CI is not assigned a fabricated single network/domain/IP.
        expect(view.attributes.some(row => /^(assetIpAddress|securityDomain|operatingSystemSummary)$/.test(row.key))).toBe(false);
        expect(buildCmdbModelCiView(details, []).attributes).toEqual([]);
        expect(() => buildCmdbModelCiView(details, [{ key: "assetIpAddress", label: "IP", displayOrder: 1 }])).toThrow();
    });
    it("restricts associations by network, system and domain independently", () => {
        const details = buildCmdbModelCiDetails(modelCiFixture, "business-service", "shared", { network: "n1", securityDomain: "PROTECTED" })!;
        expect(details.systemIds).toEqual(["s1"]);
        expect(details.relatedNetworks).toBe("n1 (n1)");
        expect(details.criticality).toBe("Critical");
        expect(buildCmdbModelCiDetails(modelCiFixture, "business-service", "shared", { system: "s1", securityDomain: "SECRET" })).toBeNull();
        expect(buildCmdbModelCiDetails(modelCiFixture, "business-service", "shared", { securityDomain: "NONE" })).toBeNull();
        expect(buildCmdbModelCiDetails(modelCiFixture, "business-service", "missing", {})).toBeNull();
        const restrictedNetwork = { ...modelCiFixture, managedNetworks: [network("n1", "SECRET")] };
        expect(buildCmdbModelCiDetails(restrictedNetwork, "business-service", "shared", { system: "s1", securityDomain: "PROTECTED" })?.relatedNetworks).toBe("");
    });
    it("uses the selected snapshot and retains exact scoped model identity when exploring topology", () => {
        const details = buildCmdbModelCiDetails(modelCiFixture, "mission-capability", "shared", { system: "s1" })!;
        const view = buildCmdbModelCiView(details, definitions);
        const href = new URL(cmdbTopologyHref(view, "discoveryView=topology&topologyMode=dependencies&system=s1&securityDomain=PROTECTED&dataDate=2026-11-07"), "http://localhost");
        expect(Object.fromEntries(href.searchParams)).toEqual({ discoveryView: "topology", topologyCi: "mission:shared", dataDate: "2026-10-31", topologyMode: "dependencies", system: "s1", securityDomain: "PROTECTED" });
        expect(new URL(cmdbTopologyHref(view, ""), "http://localhost").searchParams.get("system")).toBe("s1");
        const external = new URL(cmdbTopologyHref(view, "network=n2&securityDomain=PROTECTED", undefined, "s1"), "http://localhost");
        expect(external.searchParams.get("system")).toBe("s1");
        expect(external.searchParams.has("network")).toBe(false);
    });
});
