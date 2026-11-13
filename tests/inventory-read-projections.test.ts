import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { topologyReadAssets } from "@/lib/inventory-read-projections";
import { buildTopologyExplorer } from "@/lib/topology-explorer";
import type { Dataset } from "@/lib/types";

it("preserves multi-system environment evidence and an ARP owner outside the selected domain", () => {
  const dataset: Dataset = JSON.parse(readFileSync("data/current.json", "utf8"));
  const owner = dataset.assets.find(asset => asset.type === "server")!;
  const ip = dataset.assets.find(asset => asset.type === "ip-node")!;
  if (ip.type !== "ip-node") throw new Error("Fixture requires an IP node");
  owner.securityDomain = "SECRET"; ip.securityDomain = "PROTECTED";
  ip.networkId = owner.networkId; ip.arpOwnerAssetId = owner.id; ip.discoveryApproach = "ARP Table";
  delete ip.systemContext;
  const otherSystem = dataset.ictSystems.find(system => system.id !== owner.systemContext?.systemId && system.environments.length)!;
  otherSystem.environments[0].assetIds.push(owner.id);
  for (const scope of [
    { system: otherSystem.id, securityDomain: "PROTECTED" },
    { network: owner.networkId, system: otherSystem.id, securityDomain: "SECRET,PROTECTED" },
    { network: owner.networkId, securityDomain: "NONE" },
    { system: "missing", securityDomain: "UNKNOWN" },
    {}
  ]) {
    const assets = topologyReadAssets(dataset, scope);
    expect(buildTopologyExplorer({ ...dataset, assets }, scope)).toEqual(buildTopologyExplorer(dataset, scope));
  }
  const selected = topologyReadAssets(dataset, { system: otherSystem.id, securityDomain: "PROTECTED" });
  expect(selected.some(asset => asset.id === owner.id)).toBe(true);
  expect(selected.some(asset => asset.id === ip.id)).toBe(true);
});
