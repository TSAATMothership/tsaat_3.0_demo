import { assertRetainedDataset } from "../lib/inventory-schema.mjs";
import { createHash } from "node:crypto";

export const DEMO_DATA_PROFILE = "tsaat-complete-demo-v1";
const MODELS = {
  server: ["PowerEdge R750", "ProLiant DL380 Gen10", "ThinkSystem SR650"],
  workstation: ["Latitude 7440", "EliteBook 840 G10", "ThinkPad T14 Gen4"],
  "network-device": ["Catalyst 9300", "Aruba CX 6300", "Juniper EX4400"],
  "storage-device": ["PowerStore 500T", "NetApp AFF A250", "MSA 2060"],
  "printer-device": ["LaserJet Enterprise M507", "Lexmark MS823", "Brother HL-L6400DW"],
  other: ["Sample Console Appliance", "Sample Monitoring Appliance", "Sample Management Gateway"]
};
const ENDPOINT_FIELDS = ["name", "hostname", "ipAddress", "macAddress", "deviceModel", "lastDiscoveredDate", "discoveredBy", "cmdbRecordUrl"];
const ENTITY_FIELDS = ["description", "owner", "supportEmail", "serviceCatalogueUrl"];
const SOFTWARE_FIELDS = ["name", "version", "filePath", "lastDiscoveredDate", "discoveredBy"];
const present = value => value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "");
const seedFor = id => createHash("sha256").update(id).digest().readUInt32BE(0);
const referenceKey = id => /^[A-Za-z0-9-]{1,50}$/.test(id) ? id.toLowerCase() : createHash("sha256").update(id).digest("hex").slice(0,40);
function fill(record, key, value) { if (!present(record[key])) record[key] = value; }
function identifiers(rows, label) {
  if (!Array.isArray(rows)) throw new Error("Missing " + label + " array.");
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || !row.id.trim() || ids.has(row.id)) throw new Error("Invalid or duplicate " + label + " ID.");
    ids.add(row.id);
  }
  return ids;
}
export function validateDemoDataset(dataset) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataset.snapshotDate) || !Number.isFinite(Date.parse(dataset.snapshotDate + "T00:00:00Z")) ||
      new Date(dataset.snapshotDate + "T00:00:00Z").toISOString().slice(0,10) !== dataset.snapshotDate) throw new Error("Invalid snapshot date.");
  const networks = identifiers(dataset.managedNetworks, "network"), systems = identifiers(dataset.ictSystems, "system"), assets = identifiers(dataset.assets, "asset");
  assertRetainedDataset(dataset);
  identifiers(dataset.ciDependencies ?? [], "dependency");
  for (const network of dataset.managedNetworks) {
    if (!Array.isArray(network.assetIds) || !Array.isArray(network.ictSystemIds) || network.assetIds.some(id => !assets.has(id)) || network.ictSystemIds.some(id => !systems.has(id))) throw new Error("Invalid network membership: " + network.id);
  }
  for (const system of dataset.ictSystems) {
    if (system.networkId && system.networkId !== "net-unassigned" && !networks.has(system.networkId)) throw new Error("Invalid system network: " + system.id);
    if (!Array.isArray(system.environments) || system.environments.some(env => !Array.isArray(env.assetIds) || env.assetIds.some(id => !assets.has(id)))) throw new Error("Invalid system environment: " + system.id);
  }
  const byAsset = new Map(dataset.assets.map(asset => [asset.id, asset]));
  for (const asset of dataset.assets) {
    if (!MODELS[asset.type] && asset.type !== "ip-node") throw new Error("Unsupported asset type: " + asset.type);
    if (!networks.has(asset.networkId) || (asset.systemContext && !systems.has(asset.systemContext.systemId))) throw new Error("Invalid asset scope: " + asset.id);
    if (!Array.isArray(asset.vulnerabilities) || asset.vulnerabilities.some(v => v.assetId !== asset.id)) throw new Error("Invalid vulnerability reference: " + asset.id);
    if (asset.type === "ip-node") {
      const owner = byAsset.get(asset.arpOwnerAssetId);
      if (!["IP Scan", "ARP Table"].includes(asset.discoveryApproach) || (asset.discoveryApproach === "IP Scan" ? asset.arpOwnerAssetId != null : !owner || owner.type === "ip-node" || owner.networkId !== asset.networkId)) throw new Error("Invalid Shadow IT owner: " + asset.id);
    }
  }
  if ((dataset.ciDependencies ?? []).some(d => !assets.has(d.sourceAssetId) || !assets.has(d.targetAssetId))) throw new Error("Invalid dependency asset reference.");
}
function discoveryDate(snapshotDate, seed) {
  const band = seed % 10;
  const age = band < 6 ? seed % 7 : band < 8 ? 8 + seed % 23 : band === 8 ? 31 + seed % 60 : 91 + seed % 60;
  return new Date(Date.parse(snapshotDate + "T00:00:00Z") - age * 86400000 + (480 + seed % 600) * 60000).toISOString();
}
function sampleOs(asset, seed) {
  const options = asset.type === "workstation" ? [["Windows", "Microsoft", "11.0"], ["Ubuntu Desktop", "Canonical", "22.04"]] :
    [["Windows Server", "Microsoft", "2022"], ["Ubuntu Server", "Canonical", "22.04"], ["RHEL", "Red Hat", "9.3"]];
  const [family, vendor, version] = options[seed % options.length];
  return { family, vendor, version, supportStatus: "Unknown" };
}
function claimIp(prefix, ordinal, used, id) {
  for (let cursor = ordinal; cursor <= 65024; cursor++) {
    const address = prefix + "." + Math.floor((cursor - 1) / 254) + "." + ((cursor - 1) % 254 + 1);
    if (!used.has(address) || used.get(address) === id) { used.set(address, id); return address; }
  }
  throw new Error("Sample IP address pool exhausted.");
}
/** Explicit sample enrichment, never an operational SQL export or a runtime fallback. */
export function enrichDemoDataset(input) {
  validateDemoDataset(input);
  const dataset = structuredClone(input);
  const known = dataset.assets.filter(a => a.type !== "ip-node").sort((a,b) => a.id.localeCompare(b.id, "en"));
  if (known.length > 65024) throw new Error("Sample endpoint address pool exhausted.");
  const usedIps = new Map(dataset.assets.filter(a => present(a.ipAddress)).map(a => [a.ipAddress, a.id]));
  const usedMacs = new Set(known.filter(a => present(a.macAddress)).map(a => a.macAddress.toUpperCase()));
  for (const [index, asset] of known.entries()) {
    const seed = seedFor(asset.id), key = referenceKey(asset.id);
    fill(asset, "name", "Sample Endpoint " + (index + 1));
    fill(asset, "hostname", key + ".example.test");
    if (!present(asset.ipAddress)) asset.ipAddress = claimIp("10.77", index + 1, usedIps, asset.id);
    if (!present(asset.macAddress)) {
      let ordinal = index + 1, mac;
      do { mac = "02:77:" + (ordinal++).toString(16).padStart(8,"0").match(/../g).join(":").toUpperCase(); } while (usedMacs.has(mac));
      asset.macAddress = mac; usedMacs.add(mac);
    }
    fill(asset, "deviceModel", MODELS[asset.type][seed % 3]);
    fill(asset, "lastDiscoveredDate", discoveryDate(dataset.snapshotDate, seed));
    fill(asset, "discoveredBy", ["Demo: Endpoint Agent", "Demo: Network Scan", "Demo: Configuration Manager", "Demo: CMDB Import"][seed % 4]);
    fill(asset, "cmdbRecordUrl", "https://cmdb.example.test/assets/" + key);
    if ((asset.type === "server" || asset.type === "workstation") && asset.installedSoftware?.length && !asset.operatingSystem) asset.operatingSystem = sampleOs(asset, seed);
    const os = asset.operatingSystem ?? asset.networkOs;
    if (os) fill(os, "patchLevel", "DEMO-" + (asset.networkOs ? "FW" : os.family.includes("Windows") ? "WIN" : "LINUX") + "-" + dataset.snapshotDate.slice(0,7) + "-R" + (seed % 5 + 1));
    for (const [ordinal, software] of (asset.installedSoftware ?? []).entries()) {
      fill(software, "name", "Sample Application " + (ordinal + 1));
      fill(software, "version", "1." + (ordinal + 1) + ".0-demo");
      const folder = software.name.replace(/[\\/:*?"<>|]/g,"_"), version = software.version.replace(/[\\/:*?"<>|]/g,"_");
      const executable = folder.toLowerCase().replaceAll(" ","-");
      fill(software, "filePath", os?.family.includes("Windows") ? "C:\\Program Files\\" + folder + "\\" + version + "\\" + executable + ".exe" : "/opt/" + executable + "/" + version + "/bin/" + executable);
      const lastObserved = Math.min(Date.parse(asset.lastDiscoveredDate), Date.parse(dataset.snapshotDate + "T23:59:59.999Z"));
      fill(software, "lastDiscoveredDate", new Date(lastObserved - (30 + ordinal % 90) * 60000).toISOString());
      fill(software, "discoveredBy", ["Demo: Software Scanner", "Demo: Configuration Manager", "Demo: Endpoint Agent", "Demo: Package Inventory"][(seed + ordinal) % 4]);
    }
  }
  for (const network of dataset.managedNetworks) {
    const key = referenceKey(network.id);
    fill(network, "description", "Sample network profile for " + network.name + ". Recorded criticality: " + network.criticality + (network.classification ? ". Classification: " + network.classification : "") + ".");
    fill(network, "owner", network.name + " Network Operations (Sample)");
    fill(network, "supportEmail", "demo-" + key + "@support.example.test");
    fill(network, "serviceCatalogueUrl", "https://service-catalogue.example.test/networks/" + key);
    if (network.diisId) fill(network, "diisUrl", "https://diis.example.test/networks/" + key);
    if (network.atoNumber) fill(network, "grcUrl", "https://grc.example.test/networks/" + key);
  }
  for (const system of dataset.ictSystems) {
    const key = referenceKey(system.id), network = dataset.managedNetworks.find(n => n.id === system.networkId);
    fill(system, "description", "Sample ICT system profile for " + system.name + ". Recorded criticality: " + system.criticality + ". Security domain: " + system.securityDomain + ". " + (network ? "Assigned network: " + network.name + "." : "No managed network is assigned; modelling is incomplete."));
    fill(system, "owner", system.name + " Service Operations (Sample)");
    fill(system, "supportEmail", "demo-" + key + "@support.example.test");
    fill(system, "serviceCatalogueUrl", "https://service-catalogue.example.test/ict-systems/" + key);
    if (system.diisId) fill(system, "diisUrl", "https://diis.example.test/ict-systems/" + key);
    if (system.atoNumber) fill(system, "grcUrl", "https://grc.example.test/ict-systems/" + key);
  }
  const owners = new Map(), networks = new Map(), candidates = [];
  for (const asset of known) {
    if (asset.networkId === "net-unassigned") continue;
    if (!networks.has(asset.networkId)) networks.set(asset.networkId, []);
    networks.get(asset.networkId).push(asset);
    if (asset.systemContext && !owners.has(asset.systemContext.systemId)) owners.set(asset.systemContext.systemId, asset);
  }
  const arpOwners = new Map([...owners.values()].map(a => [a.id,a]));
  for (const [networkId, assets] of networks) {
    const owner = assets.find(a => a.type === "network-device") ?? assets[0];
    arpOwners.set(owner.id, owner);
    for (let n=1;n<=12;n++) candidates.push({ id: "ip-node-demo-scan-" + networkId + "-" + n, networkId, securityDomain: assets.map(a=>a.securityDomain).sort()[0], discoveryApproach: "IP Scan", arpOwnerAssetId: null, discoveredBy: n%2 ? "Demo: Scheduled IP Scan" : "Demo: Active IP Scan" });
  }
  for (const owner of arpOwners.values()) for (let n=1;n<=3;n++) candidates.push({ id: "ip-node-demo-arp-" + owner.id + "-" + n, networkId: owner.networkId, securityDomain: owner.securityDomain, discoveryApproach: "ARP Table", arpOwnerAssetId: owner.id, discoveredBy: owner.type === "network-device" ? "Demo: Switch ARP Poll" : "Demo: Endpoint ARP Collection" });
  const existing = new Map(dataset.assets.map(a=>[a.id,a]));
  candidates.sort((a,b)=>a.id.localeCompare(b.id,"en"));
  for (const [index, candidate] of candidates.entries()) {
    const previous = existing.get(candidate.id);
    if (previous) {
      if (previous.type !== "ip-node" || previous.networkId !== candidate.networkId || previous.discoveryApproach !== candidate.discoveryApproach || previous.arpOwnerAssetId !== candidate.arpOwnerAssetId) throw new Error("Sample Shadow IT ID conflict: " + candidate.id);
      continue;
    }
    const ipAddress = claimIp("10.88", index + 1, usedIps, candidate.id);
    dataset.assets.push({ ...candidate, type: "ip-node", name: "IP Node " + ipAddress, hostname: "", ipAddress, lastDiscoveredDate: discoveryDate(dataset.snapshotDate, seedFor(candidate.id)), lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" }, vulnerabilities: [] });
    // Declared membership remains the original CMDB source, as in SQL.
  }
  validateDemoDataset(dataset);
  return dataset;
}
export function summarizeDemoDataset(dataset) {
  const known = dataset.assets.filter(a=>a.type!=="ip-node"), software = known.flatMap(a=>a.installedSoftware ?? []);
  const missing = (rows, fields) => Object.fromEntries(fields.map(key=>[key,rows.filter(row=>!present(row[key])).length]));
  return { date: dataset.snapshotDate, networks: dataset.managedNetworks.length, systems: dataset.ictSystems.length, assets: dataset.assets.length,
    knownEndpoints: known.length, shadowNodes: dataset.assets.length-known.length, installations: software.length,
    dependencies: dataset.ciDependencies?.length ?? 0, vulnerabilities: known.reduce((n,a)=>n+a.vulnerabilities.length,0),
    missingEndpointFields: missing(known,ENDPOINT_FIELDS), missingSoftwareFields: missing(software,SOFTWARE_FIELDS),
    missingNetworkFields: missing(dataset.managedNetworks,ENTITY_FIELDS), missingSystemFields: missing(dataset.ictSystems,ENTITY_FIELDS) };
}
