import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { enrichDemoDataset, summarizeDemoDataset } from "../scripts/enrich-demo-dataset.mjs";
import { populateJsonStore } from "../scripts/populate-json-store.mjs";
import { initializeJsonStore } from "../scripts/setup-json-store.mjs";
import type { Dataset } from "@/lib/types";

const original: Dataset = JSON.parse(await fs.readFile("data/current.json","utf8"));
// Exercise a genuinely incomplete source, independently of the complete bundled fixture.
delete original.assets[0].ipAddress;
const temporary: string[] = [];
async function directory() { const value=await fs.mkdtemp(path.join(os.tmpdir(),"tsaat-population-test-"));temporary.push(value);return value; }
afterEach(async()=>{for(const target of temporary.splice(0)){if(path.dirname(target)!==os.tmpdir()||!path.basename(target).startsWith("tsaat-population-test-"))throw new Error("Unsafe test cleanup.");await fs.rm(target,{recursive:true,force:true});}});
function smallDataset(): Dataset {
  const asset=structuredClone(original.assets[0]);
  const system=structuredClone(original.ictSystems.find(s=>s.id===asset.systemContext!.systemId)!);
  const network=structuredClone(original.managedNetworks.find(n=>n.id===asset.networkId)!);
  network.assetIds=[asset.id];network.ictSystemIds=[system.id];
  system.environments=system.environments.map(e=>({...e,assetIds:e.assetIds.filter(id=>id===asset.id)}));
  return {generatedAt:original.generatedAt,snapshotDate:original.snapshotDate,assets:[asset],managedNetworks:[network],ictSystems:[system],findings:[],ciDependencies:[],spiEvaluations:[]};
}
async function legacyStore() {
  const root=await directory(), target=path.join(root,"store");
  await fs.mkdir(path.join(target,"snapshots"),{recursive:true});
  await fs.mkdir(path.join(target,"settings"));await fs.mkdir(path.join(target,"references"));
  const manifest={format:"tsaat-json-store",schemaVersion:1,snapshots:[{id:8,date:original.snapshotDate,file:"snapshots/original.json"}]};
  await fs.writeFile(path.join(target,"store.json"),JSON.stringify(manifest));
  await fs.writeFile(path.join(target,"snapshots/original.json"),JSON.stringify(smallDataset()));
  await fs.writeFile(path.join(target,"settings/custom.json"),'{"preserve":true}');
  await fs.writeFile(path.join(target,"references/cmdb-attributes.json"),'{"customMapping":true}');
  return {root,target,manifest};
}

describe("No-SQL population",()=>{
  it("fills all endpoint, software and entity profile fields and retains real source history",()=>{
    const dataset=enrichDemoDataset(original), summary=summarizeDemoDataset(dataset);
    expect(summary).toMatchObject({knownEndpoints:1000,shadowNodes:240,assets:1240,systems:60,networks:14,installations:4277,findings:original.findings!.length,dependencies:27441});
    for(const missing of [summary.missingEndpointFields,summary.missingSoftwareFields,summary.missingNetworkFields,summary.missingSystemFields]) expect(Object.values(missing).every(n=>n===0)).toBe(true);
    expect(dataset.findings).toEqual(original.findings);
    expect(dataset.ciDependencies).toEqual(original.ciDependencies);
    expect(dataset.snapshotDate).toBe(original.snapshotDate);
    for(const asset of original.assets){
      const actual=dataset.assets.find(a=>a.id===asset.id)!;
      expect(actual.vulnerabilities).toEqual(asset.vulnerabilities);
      expect(actual.lifecycle).toEqual(asset.lifecycle);
      expect(actual.systemContext).toEqual(asset.systemContext);
      if("operatingSystem" in asset && asset.operatingSystem) expect(actual).toMatchObject({operatingSystem:asset.operatingSystem});
      if("operatingSystem" in asset && !asset.operatingSystem && "operatingSystem" in actual) expect(actual.operatingSystem).toMatchObject({supportStatus:"Unknown",majorVersion:null,nMinus:null});
    }
    const unmodelled=dataset.ictSystems.filter(s=>!s.modellingStatus);
    expect(unmodelled).toHaveLength(40);
    expect(unmodelled.every(s=>s.networkId === 'net-unassigned'&&s.environments.length===0)).toBe(true);
    const nodes=dataset.assets.filter(a=>a.type==="ip-node");
    expect(nodes.filter(a=>a.discoveryApproach==="IP Scan")).toHaveLength(144);
    expect(nodes.filter(a=>a.discoveryApproach==="ARP Table")).toHaveLength(96);
    expect(nodes.every(a=>!a.macAddress&&!a.deviceModel&&!("operatingSystem" in a)&&!("installedSoftware" in a))).toBe(true);
    expect(enrichDemoDataset(dataset)).toEqual(dataset);
    expect(original.assets[0].ipAddress).toBeUndefined();
  });
  it("keeps identities stable and discovery dates historical across all eight snapshots",async()=>{
    const ids=new Map<string,string>();
    for(const name of (await fs.readdir("data/snapshots")).filter(n=>n.endsWith(".json")).sort()){
      const dataset=enrichDemoDataset(JSON.parse(await fs.readFile(path.join("data/snapshots",name),"utf8")));
      expect(dataset.assets).toHaveLength(1240);
      for(const asset of dataset.assets){
        if(ids.has(asset.id))expect(asset.ipAddress).toBe(ids.get(asset.id));else ids.set(asset.id,asset.ipAddress!);
        expect(Date.parse(asset.lastDiscoveredDate!)).toBeLessThanOrEqual(Date.parse(dataset.snapshotDate+"T23:59:59.999Z"));
      }
    }
  });
  it("preserves populated values and rejects broken relationships before publication",()=>{
    const input=smallDataset();input.assets[0].ipAddress="192.0.2.55";input.managedNetworks[0].owner="Existing owner";
    const populated=enrichDemoDataset(input);
    expect(populated.assets[0].ipAddress).toBe("192.0.2.55");expect(populated.managedNetworks[0].owner).toBe("Existing owner");
    input.assets[0].networkId="missing-network";
    expect(()=>enrichDemoDataset(input)).toThrow("Invalid asset scope");
  });
  it("previews without writes, backs up the whole store, publishes atomically and is idempotent",async()=>{
    const {root,target,manifest}=await legacyStore();
    const before=await fs.readFile(path.join(target,"store.json"),"utf8");
    const source=await fs.readFile(path.join(target,"snapshots/original.json"),"utf8");
    expect((await populateJsonStore({target})).applied).toBe(false);
    expect(await fs.readFile(path.join(target,"store.json"),"utf8")).toBe(before);
    expect(await fs.readdir(path.join(target,"snapshots"))).toEqual(["original.json"]);
    const report=await populateJsonStore({target,apply:true,demo:true,backupDirectory:path.join(root,"backup")});
    expect(report.applied).toBe(true);expect(report.changedSnapshots).toBe(1);
    expect(await fs.readFile(path.join(report.backupDirectory!,"store.json"),"utf8")).toBe(before);
    expect(await fs.readFile(path.join(report.backupDirectory!,"snapshots/original.json"),"utf8")).toBe(source);
    expect(await fs.readFile(path.join(target,"snapshots/original.json"),"utf8")).toBe(source);
    for(const file of ["settings/custom.json","references/cmdb-attributes.json"]) expect(await fs.readFile(path.join(target,file),"utf8")).toBe(await fs.readFile(path.join(report.backupDirectory!,file),"utf8"));
    const published=JSON.parse(await fs.readFile(path.join(target,"store.json"),"utf8"));
    expect(published.snapshots[0]).toMatchObject({id:manifest.snapshots[0].id,date:manifest.snapshots[0].date});
    expect(published.snapshots[0].file).not.toBe(manifest.snapshots[0].file);
    const again=await populateJsonStore({target,apply:true,demo:true,backupDirectory:path.join(root,"backup")});
    expect(again.applied).toBe(false);expect(again.changedSnapshots).toBe(0);
    expect((await initializeJsonStore({target})).created).toBe(false);
    expect(await fs.readFile(path.join(target,"settings/custom.json"),"utf8")).toBe('{"preserve":true}');
  });
  it("requires explicit demonstration mode and refuses busy stores and escaping paths",async()=>{
    const {root,target,manifest}=await legacyStore();
    await expect(populateJsonStore({target,apply:true})).rejects.toThrow("--apply --demo");
    await fs.writeFile(path.join(target,".write-lock"),"another writer");
    await expect(populateJsonStore({target,apply:true,demo:true})).rejects.toThrow("busy");
    expect(await fs.readFile(path.join(target,".write-lock"),"utf8")).toBe("another writer");
    await fs.rm(path.join(target,".write-lock"));
    manifest.snapshots[0].file="../outside.json";
    await fs.writeFile(path.join(target,"store.json"),JSON.stringify(manifest));
    await expect(populateJsonStore({target,apply:true,demo:true,backupDirectory:path.join(root,"backup")})).rejects.toThrow("escapes");
    await expect(fs.stat(path.join(target,".write-lock"))).rejects.toMatchObject({code:"ENOENT"});
    expect(await fs.readdir(path.join(target,"snapshots"))).toEqual(["original.json"]);
  });
  it("initializes fresh stores with complete samples and keeps existing stores intact",async()=>{
    const target=await directory();await initializeJsonStore({target});
    const manifest=JSON.parse(await fs.readFile(path.join(target,"store.json"),"utf8"));
    expect(manifest.sampleDataProfile).toBe("tsaat-aligned-evidence-v1");
    const latest=JSON.parse(await fs.readFile(path.join(target,manifest.snapshots.at(-1).file),"utf8"));
    expect(summarizeDemoDataset(latest).missingEndpointFields.deviceModel).toBe(0);
    expect(latest.assets).toHaveLength(1240);
  });
});
