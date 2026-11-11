import { normalizeDatasetSecurityDomains } from "../lib/security-domain.mjs";
import { validateDemoDataset } from "./enrich-demo-dataset.mjs";

const requiredTables = ["dataset_snapshot", "managed_network", "managed_network_hierarchy", "network_declared_system", "network_declared_asset", "ict_system", "ict_system_hierarchy", "system_mission_capability", "system_business_service", "system_environment", "system_environment_asset", "asset", "asset_operating_system", "asset_network_os", "asset_patch_state", "asset_installed_software", "asset_vulnerability", "ci_dependency"];
function fields(row, mapping) {
  return Object.fromEntries(Object.entries(mapping).flatMap(([key,source])=>row[source]===null || row[source]===undefined ? [] : [[key,row[source]]]));
}
function timestamp(value) {
  if (value == null || value === "") return null;
  const text=String(value), withZone=/Z$|[+-]\d{2}:\d{2}$/.test(text)?text:text+"Z";
  const date=new Date(withZone);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid SQL timestamp.");
  return date.toISOString();
}
function osRecord(row) {
  if (!row) return null;
  return { family:row.family,vendor:row.vendor,version:row.version,patchLevel:row.patch_level ?? null,
    supportStatus:row.support_status };
}
/** Converts exported business tables only. SQL execution is deliberately outside the importer. */
export function datasetsFromSqlExport(source) {
  if (!source || typeof source.databaseName!=="string" || !source.tables) throw new Error("Invalid SQL export envelope.");
  for (const table of requiredTables) if (!Array.isArray(source.tables[table])) throw new Error("SQL export is missing table: " + table);
  const tables=source.tables;
  const snapshots=[...tables.dataset_snapshot].sort((a,b)=>String(a.snapshot_date).localeCompare(String(b.snapshot_date)));
  const ids=new Set(), dates=new Set();
  if (!snapshots.length) throw new Error("SQL export has no snapshots.");
  return snapshots.map(snapshot=>{
    const id=snapshot.snapshot_id, date=String(snapshot.snapshot_date).slice(0,10);
    if (!Number.isSafeInteger(id)||id<1||ids.has(id)||dates.has(date)) throw new Error("Invalid SQL snapshot catalogue.");
    ids.add(id);dates.add(date);
    const rows=name=>tables[name].filter(row=>row.snapshot_id===id);
    const scoped=Object.fromEntries(requiredTables.slice(1).map(name=>[name,rows(name)]));
    const byAsset=name=>new Map(scoped[name].map(row=>[row.asset_id,row]));
    const endpointOs=byAsset("asset_operating_system"),networkOs=byAsset("asset_network_os"),patches=byAsset("asset_patch_state");
    const software=new Map(),vulnerabilities=new Map();
    for(const row of scoped.asset_installed_software){if(!software.has(row.asset_id))software.set(row.asset_id,[]);software.get(row.asset_id).push(row);}
    for(const row of scoped.asset_vulnerability){if(!vulnerabilities.has(row.asset_id))vulnerabilities.set(row.asset_id,[]);vulnerabilities.get(row.asset_id).push(row);}
    const managedNetworks=scoped.managed_network.map(row=>{
      const networkId=row.network_id;
      const parent=scoped.managed_network_hierarchy.find(h=>h.child_network_id===networkId)?.parent_network_id;
      const children=scoped.managed_network_hierarchy.filter(h=>h.parent_network_id===networkId).map(h=>h.child_network_id);
      return {...fields(row,{id:"network_id",name:"name",criticality:"criticality",adfPlatform:"adf_platform",enterprisePlatform:"enterprise_platform",modellingStatus:"modelling_status",classification:"classification",securityDomain:"security_domain",description:"description",owner:"owner",supportEmail:"support_email",serviceCatalogueUrl:"service_catalogue_url",diisId:"diis_id",atoNumber:"ato_number",diisUrl:"diis_url",grcUrl:"grc_url",discoveryStatus:"discovery_status"}),
        ...(parent?{parentNetworkId:parent}:{}),...(children.length?{childNetworkIds:children}:{}),
        ictSystemIds:scoped.network_declared_system.filter(r=>r.network_id===networkId).map(r=>r.system_id),
        assetIds:scoped.network_declared_asset.filter(r=>r.network_id===networkId).map(r=>r.asset_id)};
    });
    const ictSystems=scoped.ict_system.map(row=>{
      const systemId=row.system_id;
      const parent=scoped.ict_system_hierarchy.find(h=>h.child_system_id===systemId)?.parent_system_id;
      const children=scoped.ict_system_hierarchy.filter(h=>h.parent_system_id===systemId).map(h=>h.child_system_id);
      return {...fields(row,{id:"system_id",name:"name",networkId:"network_id",criticality:"criticality",securityDomain:"security_domain",adfPlatform:"adf_platform",enterprisePlatform:"enterprise_platform",modellingStatus:"modelling_status",diisDefined:"diis_defined",description:"description",owner:"owner",supportEmail:"support_email",serviceCatalogueUrl:"service_catalogue_url",diisId:"diis_id",atoNumber:"ato_number",apmNumber:"apm_number",diisUrl:"diis_url",grcUrl:"grc_url"}),
        ...(parent?{parentSystemId:parent}:{}),...(children.length?{childSystemIds:children}:{}),
        missionCapabilities:scoped.system_mission_capability.filter(r=>r.system_id===systemId).map(r=>({id:r.mission_capability_id,name:r.name,criticality:r.criticality})),
        businessServices:scoped.system_business_service.filter(r=>r.system_id===systemId).map(r=>({id:r.business_service_id,name:r.name,criticality:r.criticality})),
        environments:scoped.system_environment.filter(r=>r.system_id===systemId).map(r=>({id:r.environment_id,name:r.name,type:r.environment_type,assetIds:scoped.system_environment_asset.filter(a=>a.system_id===systemId&&a.environment_id===r.environment_id).map(a=>a.asset_id)}))};
    });
    const assets=scoped.asset.map(row=>{
      const assetId=row.asset_id;
      const asset={...fields(row,{id:"asset_id",name:"name",hostname:"hostname",type:"asset_type",ipAddress:"ip_address",macAddress:"mac_address",deviceModel:"device_model",discoveredBy:"discovered_by",cmdbRecordUrl:"cmdb_record_url",networkId:"network_id",securityDomain:"security_domain"}),
        lastDiscoveredDate:timestamp(row.last_discovered_date),lifecycle:{eolStatus:row.lifecycle_eol_status,warrantyStatus:row.lifecycle_warranty_status},
        vulnerabilities:(vulnerabilities.get(assetId)??[]).map(v=>({...fields(v,{id:"vulnerability_id",assetId:"asset_id",cve:"cve",cveName:"cve_name",cveCreatedDate:"cve_created_date",softwareName:"software_name",softwareVersion:"software_version",referenceUrl:"reference_url",description:"description",remediationGuidance:"remediation_guidance",criticality:"criticality",severity:"severity",exploitability:"exploitability",source:"source"}),detectedDate:String(v.detected_date).slice(0,10),capturedAt:timestamp(v.captured_at)})),
        ...(row.system_id&&row.environment_type?{systemContext:{systemId:row.system_id,environmentType:row.environment_type}}:{})};
      if(row.asset_type==="server"||row.asset_type==="workstation"){
        asset.operatingSystem=osRecord(endpointOs.get(assetId));
        asset.installedSoftware=(software.get(assetId)??[]).sort((a,b)=>a.software_ordinal-b.software_ordinal).map(s=>({...fields(s,{name:"name",version:"version",supportStatus:"support_status",filePath:"file_path",discoveredBy:"discovered_by"}),lastDiscoveredDate:timestamp(s.last_discovered_date)}));
      } else if(row.asset_type==="network-device") {
        asset.networkOs=osRecord(networkOs.get(assetId));const patch=patches.get(assetId);
        asset.patchState=patch?{isLatest:patch.is_latest,lastPatchedDate:patch.last_patched_date?String(patch.last_patched_date).slice(0,10):null}:null;
      } else if(row.asset_type==="ip-node") {asset.discoveryApproach=row.discovery_approach;asset.arpOwnerAssetId=row.arp_owner_asset_id??null;}
      if ((software.get(assetId)?.length && !("installedSoftware" in asset)) || (endpointOs.has(assetId) && !("operatingSystem" in asset)) || (networkOs.has(assetId) && !("networkOs" in asset))) throw new Error("SQL data contains unsupported typed inventory for " + assetId + "; import refused rather than dropping it.");
      return asset;
    });
    const ciDependencies=scoped.ci_dependency.map(row=>({...fields(row,{id:"dependency_id",sourceAssetId:"source_asset_id",targetAssetId:"target_asset_id",dependencyType:"dependency_type",protocol:"flow_protocol",sourcePort:"source_port",targetPort:"target_port",observationMethod:"observation_method"}),...(row.observed_at?{observedAt:timestamp(row.observed_at)}:{})}));
    const dataset={snapshotId:id,snapshotDate:date,generatedAt:timestamp(snapshot.generated_at),managedNetworks,ictSystems,assets,ciDependencies};
    validateDemoDataset(dataset);
    return normalizeDatasetSecurityDomains(dataset);
  });
}
