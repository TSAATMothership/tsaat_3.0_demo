import { expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { migrateSecurityDomains } from "../scripts/migrate-security-domains.mjs";
import { normalizeDatasetSecurityDomains } from "@/lib/security-domain.mjs";
it("previews and atomically migrates legacy JSON with backups, provenance and settings intact", async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),"tsaat-domain-test-"));
  try {
    const target=path.join(root,"store"), original=JSON.parse(await fs.readFile("data/current.json","utf8"));
    for(const n of original.managedNetworks) delete n.securityDomain;
    for(const a of [...original.assets,...original.ictSystems]) a.securityDomain=a.securityDomain==="UNKNOWN"?"Unclassified":a.securityDomain.toLowerCase();
    const manifest={format:"tsaat-json-store",schemaVersion:2,sampleDataProfile:"retained-profile",snapshots:[{id:8,date:original.snapshotDate,file:"snapshots/original.json"}]};
    await fs.mkdir(path.join(target,"snapshots"),{recursive:true}); await fs.mkdir(path.join(target,"settings"));
    await fs.writeFile(path.join(target,"snapshots/original.json"),JSON.stringify(original));
    await fs.writeFile(path.join(target,"store.json"),JSON.stringify(manifest));
    await fs.writeFile(path.join(target,"settings/keep.json"),'{"keep":true}');
    expect((await migrateSecurityDomains({target})).changedSnapshots).toBe(1);
    expect(JSON.parse(await fs.readFile(path.join(target,"store.json"),"utf8"))).toEqual(manifest);
    const report=await migrateSecurityDomains({target,apply:true,backupDirectory:path.join(root,"backup")});
    expect(report.applied).toBe(true);
    expect(JSON.parse(await fs.readFile(path.join(report.backupDirectory!,"store.json"),"utf8"))).toEqual(manifest);
    const after=JSON.parse(await fs.readFile(path.join(target,"store.json"),"utf8"));
    expect(after.sampleDataProfile).toBe(manifest.sampleDataProfile);
    expect(JSON.parse(await fs.readFile(path.join(target,after.snapshots[0].file),"utf8"))).toEqual(normalizeDatasetSecurityDomains(original));
    expect(await fs.readFile(path.join(target,"settings/keep.json"),"utf8")).toBe('{"keep":true}');
    expect(JSON.parse(await fs.readFile(path.join(target,"snapshots/original.json"),"utf8"))).toEqual(original);
    expect((await migrateSecurityDomains({target,apply:true})).changedSnapshots).toBe(0);
  } finally {
    if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith("tsaat-domain-test-")) throw Error("Unsafe cleanup");
    await fs.rm(root,{recursive:true,force:true});
  }
});
