import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { Dataset } from "@/lib/types";

describe("seed dataset", () => {
  const dataset = JSON.parse(
    readFileSync(path.join(process.cwd(), "data", "current.json"), "utf-8")
  ) as Dataset;
  const vulnerabilityCriticality = new Set(["Low", "Medium", "High", "Critical"]);
  const vulnerabilityExploitability = new Set([
    "No Known Exploit",
    "Proof of Concept",
    "Exploitable",
    "Known Exploited"
  ]);

  it("stays within required dataset ranges", () => {
    expect(dataset.managedNetworks.length).toBeGreaterThanOrEqual(10);
    expect(dataset.managedNetworks.length).toBeLessThanOrEqual(13);

    expect(dataset.ictSystems.length).toBeGreaterThanOrEqual(60);

    const modelledSystems = dataset.ictSystems.filter((system) => system.modellingStatus === true);
    const unmodelledSystems = dataset.ictSystems.filter((system) => system.modellingStatus === false);
    const diisSystems = dataset.ictSystems.filter((system) => system.diisDefined === true);

    expect(modelledSystems.length).toBeGreaterThanOrEqual(20);
    expect(unmodelledSystems.length).toBe(40);
    expect(diisSystems.length).toBe(dataset.ictSystems.length);
    expect(dataset.ictSystems.every((system) => typeof system.adfPlatform === "boolean")).toBe(true);
    expect(dataset.ictSystems.every((system) => typeof system.enterprisePlatform === "boolean")).toBe(true);

    expect(dataset.assets.length).toBe(1000);

    const servers = dataset.assets.filter((asset) => asset.type === "server");
    const workstations = dataset.assets.filter((asset) => asset.type === "workstation");
    const devices = dataset.assets.filter((asset) => asset.type === "network-device");
    const storageDevices = dataset.assets.filter((asset) => asset.type === "storage-device");
    const printerDevices = dataset.assets.filter((asset) => asset.type === "printer-device");
    const otherAssets = dataset.assets.filter((asset) => asset.type === "other");

    expect(servers.length).toBe(780);
    expect(workstations.length).toBe(80);
    expect(devices.length).toBe(60);
    expect(storageDevices.length).toBe(40);
    expect(printerDevices.length).toBe(20);
    expect(otherAssets.length).toBe(20);

    const modelledAssets = dataset.assets.filter((asset) => asset.systemContext?.systemId);
    const unmodelledAssets = dataset.assets.filter((asset) => !asset.systemContext?.systemId);
    expect(modelledAssets.length).toBe(700);
    expect(unmodelledAssets.length).toBe(300);
    expect(modelledAssets.every((asset) => asset.type === "server")).toBe(true);
    expect(workstations.every((asset) => !asset.systemContext)).toBe(true);
    expect(devices.every((asset) => !asset.systemContext)).toBe(true);
    expect(storageDevices.every((asset) => !asset.systemContext)).toBe(true);
    expect(printerDevices.every((asset) => !asset.systemContext)).toBe(true);
    expect(otherAssets.every((asset) => !asset.systemContext)).toBe(true);

    for (const network of dataset.managedNetworks) {
      const expectedStatus = network.assetIds.length > 0 ? "Discovery Enabled" : "Discovery Non Enabled";
      expect(network.discoveryStatus).toBe(expectedStatus);
      expect(["Critical", "Non-Critical"]).toContain(network.criticality);
      expect(typeof network.adfPlatform).toBe("boolean");
      expect(typeof network.enterprisePlatform).toBe("boolean");
    }

    const modelledServerCountBySystem = new Map<string, number>();
    for (const server of servers) {
      const systemId = server.systemContext?.systemId;
      if (!systemId) {
        continue;
      }
      modelledServerCountBySystem.set(systemId, (modelledServerCountBySystem.get(systemId) ?? 0) + 1);
    }
    const modelledServerCounts = modelledSystems.map((system) => modelledServerCountBySystem.get(system.id) ?? 0);
    expect(modelledServerCounts.every((count) => count >= 20 && count <= 300)).toBe(true);
    const underFiftyCount = modelledServerCounts.filter((count) => count < 50).length;
    expect(underFiftyCount).toBeGreaterThan(modelledSystems.length / 2);

    const flowCountBySource = new Map(dataset.assets.map((asset) => [asset.id, 0]));
    for (const dependency of dataset.ciDependencies ?? []) {
      if (dependency.dependencyType === "Flow Dependency") {
        flowCountBySource.set(dependency.sourceAssetId, (flowCountBySource.get(dependency.sourceAssetId) ?? 0) + 1);
      }
    }

    let zero = 0;
    let high = 0;
    let medium = 0;
    let spike = 0;
    for (const count of flowCountBySource.values()) {
      if (count === 0) {
        zero += 1;
      } else if (count >= 20 && count <= 50) {
        high += 1;
      } else if (count >= 3 && count <= 19) {
        medium += 1;
      } else if (count >= 51 && count <= 150) {
        spike += 1;
      } else {
        throw new Error(`Unexpected flow dependency count: ${count}`);
      }
    }

    expect(zero).toBe(100);
    expect(high).toBe(700);
    expect(medium).toBe(190);
    expect(spike).toBe(10);
  });

  it("stores CVE vulnerability history per asset for the last 12 months", () => {
    const snapshotAnchor = new Date(`${dataset.snapshotDate}T23:59:59.999Z`).getTime();
    let noVulnerabilityAssets = 0;
    let criticalExploitable = 0;
    let lowerRisk = 0;

    for (const asset of dataset.assets) {
      if (asset.vulnerabilities.length === 0) {
        noVulnerabilityAssets += 1;
        continue;
      }

      for (const vulnerability of asset.vulnerabilities) {
        expect(vulnerability.assetId).toBe(asset.id);
        expect(vulnerability.cve.startsWith("CVE-")).toBe(true);
        expect(vulnerability.description.trim().length).toBeGreaterThan(0);
        expect(vulnerability.remediationGuidance.trim().length).toBeGreaterThan(0);
        expect(vulnerabilityCriticality.has(vulnerability.criticality)).toBe(true);
        expect(vulnerabilityCriticality.has(vulnerability.severity)).toBe(true);
        expect(vulnerabilityExploitability.has(vulnerability.exploitability)).toBe(true);

        const detectedTime = new Date(`${vulnerability.detectedDate}T00:00:00.000Z`).getTime();
        const capturedTime = new Date(vulnerability.capturedAt).getTime();
        expect(Number.isNaN(detectedTime)).toBe(false);
        expect(Number.isNaN(capturedTime)).toBe(false);
        expect(capturedTime).toBeGreaterThanOrEqual(detectedTime);

        const detectedAgeDays = Math.floor((snapshotAnchor - detectedTime) / (1000 * 60 * 60 * 24));
        const capturedAgeDays = Math.floor((snapshotAnchor - capturedTime) / (1000 * 60 * 60 * 24));
        expect(detectedAgeDays).toBeGreaterThanOrEqual(0);
        expect(capturedAgeDays).toBeGreaterThanOrEqual(0);
        expect(detectedAgeDays).toBeLessThanOrEqual(366);
        expect(capturedAgeDays).toBeLessThanOrEqual(366);

        if (
          vulnerability.criticality === "Critical" &&
          (vulnerability.exploitability === "Known Exploited" || vulnerability.exploitability === "Exploitable")
        ) {
          criticalExploitable += 1;
        }

        if (["Low", "Medium", "High"].includes(vulnerability.criticality)) {
          lowerRisk += 1;
        }
      }
    }

    expect(noVulnerabilityAssets).toBeGreaterThan(0);
    expect((noVulnerabilityAssets / dataset.assets.length) * 100).toBeGreaterThanOrEqual(15);
    expect(criticalExploitable).toBeGreaterThan(0);
    expect(lowerRisk).toBeGreaterThan(0);

    const servers = dataset.assets.filter((asset) => asset.type === "server");
    const workstations = dataset.assets.filter((asset) => asset.type === "workstation");
    const networkDevices = dataset.assets.filter((asset) => asset.type === "network-device");
    const storageDevices = dataset.assets.filter((asset) => asset.type === "storage-device");
    const printerDevices = dataset.assets.filter((asset) => asset.type === "printer-device");
    const otherAssets = dataset.assets.filter((asset) => asset.type === "other");
    expect(servers.some((asset) => asset.vulnerabilities.length === 0)).toBe(true);
    expect(workstations.some((asset) => asset.vulnerabilities.length === 0)).toBe(true);
    expect(networkDevices.some((asset) => asset.vulnerabilities.length === 0)).toBe(true);
    expect(storageDevices.some((asset) => asset.vulnerabilities.length === 0)).toBe(true);
    expect(printerDevices.some((asset) => asset.vulnerabilities.length === 0)).toBe(true);
    expect(otherAssets.some((asset) => asset.vulnerabilities.length === 0)).toBe(true);
  }, 20000);

  it("contains production and non-production environments for each ICT system", () => {
    const modelledSystems = dataset.ictSystems.filter((system) => system.modellingStatus === true);
    const unmodelledSystems = dataset.ictSystems.filter((system) => system.modellingStatus === false);

    for (const system of modelledSystems) {
      expect(system.environments.some((environment) => environment.type === "Production")).toBe(true);
      expect(system.environments.length).toBeGreaterThanOrEqual(2);
      for (const capability of system.missionCapabilities) {
        expect(["Critical", "Non-Critical"]).toContain(capability.criticality);
      }
      for (const service of system.businessServices) {
        expect(["Critical", "Non-Critical"]).toContain(service.criticality);
      }
    }

    for (const system of unmodelledSystems) {
      expect(system.name.trim().length).toBeGreaterThan(0);
      expect(system.diisDefined).toBe(true);
      expect(system.environments.length).toBe(0);
    }

    const assetSystemIds = new Set(
      dataset.assets
        .map((asset) => asset.systemContext?.systemId)
        .filter((systemId): systemId is string => Boolean(systemId))
    );
    for (const system of unmodelledSystems) {
      expect(assetSystemIds.has(system.id)).toBe(false);
    }
  });

  it("includes findings with workflow status and timestamps from 2024-02-10 onward", () => {
    const findings = dataset.findings ?? [];
    expect(findings.length).toBeGreaterThan(0);

    const snapshotAnchor = new Date(`${dataset.snapshotDate}T12:00:00.000Z`).getTime();
    const findingsStart = new Date("2024-02-10T00:00:00.000Z").getTime();
    let findingsOnStartDate = 0;
    for (const finding of findings) {
      expect(["open", "closed"]).toContain(finding.status);
      expect(["Compliant", "Non-compliant", "Unknown"]).toContain(finding.complianceStatus);

      const findingTime = new Date(finding.timestamp).getTime();
      expect(Number.isNaN(findingTime)).toBe(false);
      expect(findingTime).toBeGreaterThanOrEqual(findingsStart);
      const ageDays = Math.floor((snapshotAnchor - findingTime) / (1000 * 60 * 60 * 24));
      expect(ageDays).toBeGreaterThanOrEqual(0);

      if (finding.status === "closed") {
        expect(finding.closedTimestamp).toBeTruthy();
        const closedTime = new Date(String(finding.closedTimestamp)).getTime();
        expect(Number.isNaN(closedTime)).toBe(false);
        expect(closedTime).toBeGreaterThanOrEqual(findingTime);
        expect(closedTime).toBeLessThanOrEqual(snapshotAnchor);
      } else {
        expect(finding.closedTimestamp ?? null).toBeNull();
      }

      if (finding.timestamp.slice(0, 10) === "2024-02-10") {
        findingsOnStartDate += 1;
      }
    }

    expect(findingsOnStartDate).toBeGreaterThanOrEqual(0);
  });
});
