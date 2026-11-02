import type { Dataset } from "@/lib/types";

/** Deterministic enhancements of synthetic seed data only; never reads a live database. */
export function enrichSampleData(dataset: Dataset, snapshotId: number): Dataset {
  dataset.snapshotId = snapshotId;
  dataset.managedNetworks.forEach((network, index) => {
    network.description ||= "Sample managed network supporting operational services and linked ICT systems.";
    network.owner ||= "Network Operations " + (index + 1);
    network.supportEmail ||= "network-" + (index + 1) + "@example.invalid";
    network.diisId ||= "DIIS-NET-" + String(index + 1).padStart(3, "0");
    network.atoNumber ||= "ATO-NET-" + String(index + 1).padStart(3, "0");
  });
  dataset.ictSystems.forEach((system, index) => {
    system.description ||= "Sample ICT system for exploring service dependencies, compliance and remediation.";
    system.owner ||= "Application Operations " + (index + 1);
    system.supportEmail ||= "system-" + (index + 1) + "@example.invalid";
    system.apmNumber ||= "APP-" + String(index + 1).padStart(4, "0");
    // Include visible yes/no KPI cases in every snapshot; ATO presence is the sole KPI-1 test.
    system.atoNumber ||= "ATO-SYS-" + String(index + 1).padStart(3, "0");
    if (index % 4 === 0) system.atoNumber = "";
    if (system.diisDefined) system.diisId ||= "DIIS-SYS-" + String(index + 1).padStart(3, "0");
    if (index % 7 === 0) { system.diisDefined = false; system.diisId = ""; }
  });
  dataset.managedNetworks.filter(n => n.id !== "net-unassigned").forEach((network, index) => {
    const owner = dataset.assets.find(a => a.networkId === network.id && a.systemContext);
    for (const approach of ["IP Scan", "ARP Table"] as const) {
      const id = "demo-ip-" + index + "-" + (approach === "IP Scan" ? "scan" : "arp");
      if (dataset.assets.some(a => a.id === id)) continue;
      dataset.assets.push({ id, name: "Unidentified IP " + index + " " + approach, hostname: "", type: "ip-node",
        ipAddress: "10.254." + index + "." + (approach === "IP Scan" ? 200 : 201), networkId: network.id,
        securityDomain: owner?.securityDomain ?? "Unclassified", lifecycle: { eolStatus: "Unknown", warrantyStatus: "Unknown" },
        vulnerabilities: [], systemContext: owner?.systemContext, discoveryApproach: approach,
        arpOwnerAssetId: approach === "ARP Table" ? owner?.id ?? null : null, discoveredBy: approach });
      network.assetIds.push(id);
    }
  });
  dataset.assets.forEach((asset, index) => {
    asset.ipAddress ||= "10." + (1 + Math.floor(index / 65025)) + "." + Math.floor(index / 255) % 255 + "." + (index % 254 + 1);
    asset.macAddress ||= "02:00:" + index.toString(16).padStart(8, "0").match(/../g)!.join(":");
    asset.deviceModel ||= ({ server: "PowerEdge R750", workstation: "Latitude 7440", "network-device": "Catalyst 9300", "storage-device": "PowerStore 1200T", "printer-device": "LaserJet Enterprise", other: "Managed appliance", "ip-node": "Unknown" })[asset.type];
    asset.lastDiscoveredDate ||= dataset.snapshotDate + "T06:00:00Z";
    asset.discoveredBy ||= asset.type === "server" || asset.type === "workstation" ? "Tanium" : "UCMDB";
    if ("installedSoftware" in asset) asset.installedSoftware.forEach(software => {
      software.lastDiscoveredDate ||= asset.lastDiscoveredDate;
      software.discoveredBy ||= asset.discoveredBy;
      software.filePath ||= "C:/Program Files/" + software.name;
    });
  });
  return dataset;
}
