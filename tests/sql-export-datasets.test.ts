import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { populateJsonStore } from "../scripts/populate-json-store.mjs";
import { datasetsFromSqlExport } from "../scripts/sql-export-datasets.mjs";

function exportFixture() {
  return { databaseName:"TSAAT_Test",exportedAtUtc:"2026-11-02T00:00:00",tables:{
    dataset_snapshot:[{snapshot_id:8,snapshot_date:"2026-04-23",generated_at:"2026-04-23T12:00:00+10:00"}],
    managed_network:[{snapshot_id:8,network_id:"net-1",name:"Original network",criticality:"Critical",adf_platform:false,enterprise_platform:true,modelling_status:true,classification:"Protected",description:"Original profile",owner:"Original owner",support_email:"owner@example.test",service_catalogue_url:"https://catalogue.example.test/net-1",discovery_status:"Discovery Enabled"}],
    managed_network_hierarchy:[],network_declared_system:[{snapshot_id:8,network_id:"net-1",system_id:"sys-1"}],network_declared_asset:[{snapshot_id:8,network_id:"net-1",asset_id:"server-1"}],network_target_state_asset:[{snapshot_id:8,network_id:"net-1",asset_type:"server",asset_name:"Original server"}],
    ict_system:[{snapshot_id:8,system_id:"sys-1",network_id:"net-1",name:"Original system",criticality:"Critical",security_domain:"Protected",adf_platform:false,enterprise_platform:true,modelling_status:true,diis_defined:false,ato_number:null,apm_number:"APM-1"}],
    ict_system_hierarchy:[],system_mission_capability:[{snapshot_id:8,system_id:"sys-1",mission_capability_id:"cap-1",name:"Original mission",criticality:"Critical"}],system_business_service:[{snapshot_id:8,system_id:"sys-1",business_service_id:"service-1",name:"Original service",criticality:"Non-Critical"}],
    system_environment:[{snapshot_id:8,system_id:"sys-1",environment_id:"env-1",name:"Production",environment_type:"Production"}],system_environment_asset:[{snapshot_id:8,system_id:"sys-1",environment_id:"env-1",asset_id:"server-1"}],
    asset:[{snapshot_id:8,asset_id:"server-1",name:"Original server",hostname:"original.example.test",asset_type:"server",ip_address:"192.0.2.1",mac_address:"02:00:00:00:00:01",device_model:"Original model",last_discovered_date:"2026-04-21T12:00:00",discovered_by:"Original agent",cmdb_record_url:"https://cmdb.example.test/original",network_id:"net-1",security_domain:"Protected",system_id:"sys-1",environment_type:"Production",lifecycle_eol_status:"EOL",lifecycle_warranty_status:"Unknown"}],
    asset_operating_system:[{snapshot_id:8,asset_id:"server-1",family:"Original OS",vendor:"Vendor",version:"3",patch_level:"Original patch",major_version:3,support_status:"OutOfSupport",current_supported_major:5,n_minus:2}],asset_network_os:[],asset_patch_state:[],
    asset_installed_software:[{snapshot_id:8,asset_id:"server-1",software_ordinal:2,name:"Second software",version:"2",support_status:"Unknown",file_path:"/opt/second",last_discovered_date:"2026-04-20T12:00:00",discovered_by:"Original scanner"},{snapshot_id:8,asset_id:"server-1",software_ordinal:1,name:"First software",version:"1",support_status:"Supported",file_path:"/opt/first",last_discovered_date:"2026-04-20T12:00:00",discovered_by:"Original scanner"}],
    asset_vulnerability:[{snapshot_id:8,asset_id:"server-1",vulnerability_id:"v1",cve:"CVE-2026-0001",description:"Original CVE evidence",remediation_guidance:"Original remediation",criticality:"Critical",severity:"Critical",exploitability:"Known Exploited",source:"Source scanner",detected_date:"2026-03-01",captured_at:"2026-03-01T10:00:00+10:00"}],
    ci_dependency:[{snapshot_id:8,dependency_id:"dep-1",source_asset_id:"server-1",target_asset_id:"server-1",dependency_type:"Flow Dependency",flow_protocol:"TCP",source_port:44000,target_port:443,observation_method:"Source flow",observed_at:"2026-04-20T12:00:00"}],
    finding:[{snapshot_id:8,finding_id:"finding-1",spi_id:1,priority_rank:2,severity:"Major",compliance_status:"Non-compliant",network_id:"net-1",system_id:"sys-1",environment_type:"Production",asset_id:"server-1",title:"Original finding",evidence:'{"source":"original","count":2}',recommended_action:"Original action",workflow_status:"closed",observed_at:"2026-03-01T10:00:00+10:00",closed_at:"2026-04-01T10:00:00+10:00"}]
  }};
}

describe("SQL export conversion",()=>{
  it("imports nullable server patch observations without changing inventory or legacy exports", () => {
    const source = exportFixture();
    Object.assign(source.tables, { server_patch_observation: [{ snapshot_id: 8, asset_id: "server-1", assessment_date: "2026-04-23T00:00:00",
      last_restarted_date: "2026-04-22T01:00:00", missing_updates: 0, missing_critical_updates: 0, restart_required: false,
      deployment_status: "Succeeded", source: "Recorded scanner", exception_reason: null }] });
    const [dataset] = datasetsFromSqlExport(source);
    expect(dataset.assets[0]).toMatchObject({ patchManagement: { assessmentDate: "2026-04-23T00:00:00.000Z", lastRestartedDate: "2026-04-22T01:00:00.000Z", missingUpdates: 0, restartRequired: false, source: "Recorded scanner" }, operatingSystem: { patchLevel: "Original patch" } });
    expect(datasetsFromSqlExport(exportFixture())[0].assets[0]).not.toHaveProperty("patchManagement");
  });
  it("retains optional CVE metadata without conflating creation and detection dates", () => {
    const source = exportFixture();
    Object.assign(source.tables.asset_vulnerability[0], { cve_name: "Recorded CVE name", cve_created_date: "2024-05-08", software_name: "Tomcat", software_version: "10.1.19", reference_url: "https://www.cve.org/CVERecord?id=CVE-2024-34750" });
    const [dataset] = datasetsFromSqlExport(source);
    expect(dataset.assets[0].vulnerabilities[0]).toMatchObject({ cveName: "Recorded CVE name", cveCreatedDate: "2024-05-08", softwareName: "Tomcat", softwareVersion: "10.1.19", detectedDate: "2026-03-01", referenceUrl: "https://www.cve.org/CVERecord?id=CVE-2024-34750" });
  });
  it("preserves database identity, inventory details, relationships and finding history",()=>{
    const source=exportFixture(), before=JSON.stringify(source), [dataset]=datasetsFromSqlExport(source);
    expect(dataset.snapshotId).toBe(8);expect(dataset.snapshotDate).toBe("2026-04-23");expect(dataset.generatedAt).toBe("2026-04-23T02:00:00.000Z");
    expect(dataset.managedNetworks[0]).toMatchObject({id:"net-1",description:"Original profile",owner:"Original owner",assetIds:["server-1"],ictSystemIds:["sys-1"],targetStateAssets:{server:["Original server"]}});
    expect(dataset.ictSystems[0]).toMatchObject({id:"sys-1",diisDefined:false,apmNumber:"APM-1",missionCapabilities:[{id:"cap-1"}],businessServices:[{id:"service-1"}],environments:[{assetIds:["server-1"]}]});
    expect(dataset.ictSystems[0].atoNumber).toBeUndefined();
    expect(dataset.assets[0]).toMatchObject({id:"server-1",ipAddress:"192.0.2.1",macAddress:"02:00:00:00:00:01",deviceModel:"Original model",discoveredBy:"Original agent",operatingSystem:{patchLevel:"Original patch",supportStatus:"OutOfSupport"},installedSoftware:[{name:"First software",filePath:"/opt/first",discoveredBy:"Original scanner"},{name:"Second software",supportStatus:"Unknown"}],vulnerabilities:[{id:"v1",description:"Original CVE evidence",capturedAt:"2026-03-01T00:00:00.000Z"}]});
    expect(dataset.findings).toEqual([{id:"finding-1",spiId:1,priorityRank:2,severity:"Major",complianceStatus:"Non-compliant",title:"Original finding",recommendedAction:"Original action",status:"closed",scope:{networkId:"net-1",systemId:"sys-1",environmentType:"Production",assetId:"server-1"},evidence:{source:"original",count:2},timestamp:"2026-03-01T00:00:00.000Z",closedTimestamp:"2026-04-01T00:00:00.000Z",sourceKind:"persisted"}]);
    expect(dataset.ciDependencies?.[0]).toMatchObject({id:"dep-1",protocol:"TCP",targetPort:443,observationMethod:"Source flow"});
    expect(JSON.stringify(source)).toBe(before);
  });
  it("imports source records through a backed-up manifest while preserving local settings",async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),"tsaat-sql-import-test-"));
    try {
      const target=path.join(root,"store"),sourceFile=path.join(root,"source.json"),source=exportFixture();
      await fs.mkdir(path.join(target,"snapshots"),{recursive:true});await fs.mkdir(path.join(target,"settings"));
      const [old]=datasetsFromSqlExport(source);old.assets[0].name="Old local sample";
      await fs.writeFile(path.join(target,"snapshots/original.json"),JSON.stringify(old));
      const manifest={format:"tsaat-json-store",schemaVersion:1,snapshots:[{id:8,date:old.snapshotDate,file:"snapshots/original.json"}]};
      await fs.writeFile(path.join(target,"store.json"),JSON.stringify(manifest));
      await fs.writeFile(path.join(target,"settings/preserve.json"),'{"priority":7}');
      await fs.writeFile(sourceFile,JSON.stringify(source));
      const report=await populateJsonStore({target,sourceExport:sourceFile,apply:true,demo:true,backupDirectory:path.join(root,"backups")});
      expect(report.applied).toBe(true);
      const published=JSON.parse(await fs.readFile(path.join(target,"store.json"),"utf8"));
      expect(published.dataProvenance).toMatchObject({kind:"sql-export",database:"TSAAT_Test"});
      expect(published.dataProvenance.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(published.snapshots[0]).toMatchObject({id:8,date:old.snapshotDate});
      const imported=JSON.parse(await fs.readFile(path.join(target,published.snapshots[0].file),"utf8"));
      expect(imported.assets[0].name).toBe("Original server");
      expect(imported.findings).toEqual(datasetsFromSqlExport(source)[0].findings);
      expect(await fs.readFile(path.join(target,"settings/preserve.json"),"utf8")).toBe('{"priority":7}');
      expect(await fs.readFile(path.join(report.backupDirectory!,"snapshots/original.json"),"utf8")).toContain("Old local sample");
    } finally {
      if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith("tsaat-sql-import-test-"))throw new Error("Unsafe test directory.");
      await fs.rm(root,{recursive:true,force:true});
    }
  });
  it("refuses incomplete exports, duplicate dates and unsupported inventory instead of silently losing rows",()=>{
    expect(()=>datasetsFromSqlExport({databaseName:"TSAAT",tables:{}})).toThrow("missing table");
    const duplicate=exportFixture();duplicate.tables.dataset_snapshot.push({...duplicate.tables.dataset_snapshot[0],snapshot_id:9});
    expect(()=>datasetsFromSqlExport(duplicate)).toThrow("Invalid SQL snapshot catalogue");
    const unsupported=exportFixture();unsupported.tables.asset[0].asset_type="other";
    expect(()=>datasetsFromSqlExport(unsupported)).toThrow("unsupported typed inventory");
    const broken=exportFixture();broken.tables.finding[0].asset_id="missing";
    expect(()=>datasetsFromSqlExport(broken)).toThrow("Invalid finding asset reference");
  });
});
