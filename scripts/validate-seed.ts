import { promises as fs } from "fs";
import path from "path";
import { Asset, Dataset } from "../lib/types";

const SECURITY_DOMAINS = new Set(["Secret", "Protected", "Unclassified"]);
const SYSTEM_CRITICALITY = new Set(["Critical", "Non-Critical"]);
const ENTITY_CRITICALITY = new Set(["Critical", "Non-Critical"]);
const VULNERABILITY_CRITICALITY = new Set(["Low", "Medium", "High", "Critical"]);
const VULNERABILITY_EXPLOITABILITY = new Set([
  "No Known Exploit",
  "Proof of Concept",
  "Exploitable",
  "Known Exploited"
]);
const CI_DEPENDENCY_TYPES = new Set(["Logical Dependency", "Flow Dependency"]);

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf-8")) as T;
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasCritical(asset: Asset): boolean {
  return asset.vulnerabilities.some((vulnerability) => vulnerability.severity === "Critical");
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

async function main() {
  const current = await readJson<Dataset>(path.join(process.cwd(), "data", "current.json"));
  const snapshotsDir = path.join(process.cwd(), "data", "snapshots");
  const snapshotFiles = (await fs.readdir(snapshotsDir)).filter((file) => file.endsWith(".json"));

  assert(current.managedNetworks.length >= 11 && current.managedNetworks.length <= 13, "Managed networks must be 11-13.");
  assert(current.ictSystems.length >= 50 && current.ictSystems.length <= 55, "ICT systems must be 50-55.");
  assert(current.assets.length === 22000, "Assets must equal 22000.");
  assert(snapshotFiles.length === 8, "Must include 8 snapshots.");
  assert(Array.isArray(current.ciDependencies ?? []), "ciDependencies must be an array when present.");
  const snapshotAnchor = new Date(`${current.snapshotDate}T23:59:59.999Z`);

  for (const network of current.managedNetworks) {
    const expectedStatus = network.assetIds.length > 0 ? "Discovery Enabled" : "Discovery Non Enabled";
    assert(
      network.discoveryStatus === expectedStatus,
      `Network ${network.id} discovery status must be ${expectedStatus}.`
    );
    assert(ENTITY_CRITICALITY.has(network.criticality), `Network ${network.id} must have valid criticality.`);
  }

  const modelledSystems = current.ictSystems.filter((system) => system.modellingStatus === true);
  const unmodelledSystems = current.ictSystems.filter((system) => system.modellingStatus === false);
  const diisSystems = current.ictSystems.filter((system) => system.diisDefined === true);

  assert(modelledSystems.length >= 10 && modelledSystems.length <= 15, "Modelled ICT systems must be 10-15.");
  assert(unmodelledSystems.length === 40, "Unmodelled ICT systems must equal 40.");
  assert(diisSystems.length === current.ictSystems.length, "All ICT systems must be represented in DIIS.");

  const serverAssets = current.assets.filter((asset) => asset.type === "server");
  const workstationAssets = current.assets.filter((asset) => asset.type === "workstation");
  const networkAssets = current.assets.filter((asset) => asset.type === "network-device");
  const desktopAssets = workstationAssets.filter((asset) => asset.id.startsWith("dsk-"));
  const namedWorkstations = workstationAssets.filter((asset) => asset.id.startsWith("wks-"));

  assert(serverAssets.length === 2000, "Servers must equal 2000.");
  assert(namedWorkstations.length === 2000, "Workstations must equal 2000.");
  assert(desktopAssets.length === 10000, "Desktops must equal 10000.");
  assert(networkAssets.length === 8000, "Network devices must equal 8000.");

  let noVulnerabilityAssets = 0;
  let criticalExploitableCount = 0;
  let lowerRiskCount = 0;
  for (const asset of current.assets) {
    if (asset.vulnerabilities.length === 0) {
      noVulnerabilityAssets += 1;
      continue;
    }

    for (const vulnerability of asset.vulnerabilities) {
      assert(vulnerability.assetId === asset.id, `Vulnerability ${vulnerability.id} must reference its parent asset.`);
      assert(vulnerability.cve.startsWith("CVE-"), `Vulnerability ${vulnerability.id} must use CVE format.`);
      assert(vulnerability.description.trim().length > 0, `Vulnerability ${vulnerability.id} must include description.`);
      assert(
        vulnerability.remediationGuidance.trim().length > 0,
        `Vulnerability ${vulnerability.id} must include remediation guidance.`
      );
      assert(
        VULNERABILITY_CRITICALITY.has(vulnerability.criticality),
        `Vulnerability ${vulnerability.id} has invalid criticality.`
      );
      assert(
        VULNERABILITY_CRITICALITY.has(vulnerability.severity),
        `Vulnerability ${vulnerability.id} has invalid severity.`
      );
      assert(
        VULNERABILITY_EXPLOITABILITY.has(vulnerability.exploitability),
        `Vulnerability ${vulnerability.id} has invalid exploitability.`
      );

      const detectedDate = new Date(`${vulnerability.detectedDate}T00:00:00.000Z`);
      const capturedAt = new Date(vulnerability.capturedAt);
      assert(!Number.isNaN(detectedDate.getTime()), `Vulnerability ${vulnerability.id} has invalid detectedDate.`);
      assert(!Number.isNaN(capturedAt.getTime()), `Vulnerability ${vulnerability.id} has invalid capturedAt timestamp.`);

      const detectedAgeDays = daysBetween(snapshotAnchor, detectedDate);
      const capturedAgeDays = daysBetween(snapshotAnchor, capturedAt);
      assert(detectedAgeDays >= 0, `Vulnerability ${vulnerability.id} detectedDate cannot be after snapshot.`);
      assert(capturedAgeDays >= 0, `Vulnerability ${vulnerability.id} capturedAt cannot be after snapshot.`);
      assert(detectedAgeDays <= 366, `Vulnerability ${vulnerability.id} must be within the last 12 months.`);
      assert(capturedAgeDays <= 366, `Vulnerability ${vulnerability.id} capture timestamp must be within the last 12 months.`);
      assert(capturedAt.getTime() >= detectedDate.getTime(), `Vulnerability ${vulnerability.id} capturedAt cannot precede detectedDate.`);

      if (
        vulnerability.criticality === "Critical" &&
        (vulnerability.exploitability === "Known Exploited" || vulnerability.exploitability === "Exploitable")
      ) {
        criticalExploitableCount += 1;
      }

      if (vulnerability.criticality === "Low" || vulnerability.criticality === "Medium" || vulnerability.criticality === "High") {
        lowerRiskCount += 1;
      }
    }
  }

  const noVulnerabilityPercentage = (noVulnerabilityAssets / current.assets.length) * 100;
  assert(noVulnerabilityPercentage >= 15, "At least 15% of assets must have no vulnerabilities.");
  assert(noVulnerabilityPercentage <= 70, "No-vulnerability assets percentage should remain realistic.");
  assert(criticalExploitableCount > 0, "Dataset must include critical exploitable vulnerabilities.");
  assert(lowerRiskCount > 0, "Dataset must include lower-risk vulnerabilities.");
  assert(serverAssets.some((asset) => asset.vulnerabilities.length === 0), "Servers must include some assets with no vulnerabilities.");
  assert(workstationAssets.some((asset) => asset.vulnerabilities.length === 0), "Workstations must include some assets with no vulnerabilities.");
  assert(networkAssets.some((asset) => asset.vulnerabilities.length === 0), "Network devices must include some assets with no vulnerabilities.");

  const productionServers = serverAssets.filter((asset) => asset.systemContext?.environmentType === "Production");
  const productionWorkstations = workstationAssets.filter(
    (asset) => asset.systemContext?.environmentType === "Production"
  );

  const highRisk4 = productionServers.some(
    (asset) => hasCritical(asset) && asset.operatingSystem?.supportStatus === "OutOfSupport"
  );
  const highRisk5 = productionServers.some(
    (asset) =>
      hasCritical(asset) && asset.installedSoftware.some((software) => software.supportStatus === "OutOfSupport")
  );
  const highRisk6 = productionWorkstations.some(
    (asset) =>
      hasCritical(asset) && asset.installedSoftware.some((software) => software.supportStatus === "OutOfSupport")
  );

  assert(highRisk4, "Missing SPI 4 trigger data.");
  assert(highRisk5, "Missing SPI 5 trigger data.");
  assert(highRisk6, "Missing SPI 6 trigger data.");

  assert(networkAssets.some((asset) => hasCritical(asset)), "Missing critical network vulnerability data.");
  assert(
    networkAssets.some((asset) => asset.networkOs?.supportStatus === "OutOfSupport"),
    "Missing unsupported network OS data."
  );
  assert(networkAssets.some((asset) => asset.patchState?.isLatest === false), "Missing patch-lagged network device data.");

  assert(
    current.assets.some((asset) => asset.lifecycle.eolStatus === "EOL" || asset.lifecycle.warrantyStatus === "OutOfWarranty"),
    "Missing lifecycle exception data."
  );

  assert(current.assets.some((asset) => asset.lifecycle.eolStatus === "Unknown"), "Missing unknown data quality cases.");
  assert(
    modelledSystems.every((system) => SYSTEM_CRITICALITY.has(system.criticality)),
    "Every modelled ICT system must include valid criticality."
  );
  assert(
    modelledSystems.every((system) =>
      system.missionCapabilities.every((capability) => ENTITY_CRITICALITY.has(capability.criticality))
    ),
    "Every mission capability must include valid criticality."
  );
  assert(
    modelledSystems.every((system) =>
      system.businessServices.every((service) => ENTITY_CRITICALITY.has(service.criticality))
    ),
    "Every business service must include valid criticality."
  );
  assert(
    modelledSystems.every((system) => SECURITY_DOMAINS.has(system.securityDomain)),
    "Every modelled ICT system must include a valid security domain."
  );
  assert(current.assets.every((asset) => SECURITY_DOMAINS.has(asset.securityDomain)), "Every asset must include a valid security domain.");
  assert(Array.isArray(current.findings) && current.findings.length > 0, "Current dataset must include findings.");

  const findingsStart = new Date("2024-02-10T00:00:00.000Z");
  let findingsOnStartDate = 0;
  for (const finding of current.findings ?? []) {
    assert(finding.status === "open" || finding.status === "closed", `Finding ${finding.id} must have open/closed workflow status.`);
    assert(
      finding.complianceStatus === "Compliant" ||
        finding.complianceStatus === "Non-compliant" ||
        finding.complianceStatus === "Unknown",
      `Finding ${finding.id} has invalid compliance status.`
    );

    const timestamp = new Date(finding.timestamp);
    assert(!Number.isNaN(timestamp.getTime()), `Finding ${finding.id} has invalid timestamp.`);
    const ageDays = daysBetween(snapshotAnchor, timestamp);
    assert(timestamp.getTime() >= findingsStart.getTime(), `Finding ${finding.id} timestamp must be on/after 2024-02-10.`);
    assert(ageDays >= 0, `Finding ${finding.id} timestamp cannot be after snapshot date.`);

    if (finding.status === "closed") {
      assert(!!finding.closedTimestamp, `Closed finding ${finding.id} must include closedTimestamp.`);
      const closedTime = new Date(String(finding.closedTimestamp));
      assert(!Number.isNaN(closedTime.getTime()), `Finding ${finding.id} has invalid closedTimestamp.`);
      assert(closedTime.getTime() >= timestamp.getTime(), `Finding ${finding.id} closedTimestamp cannot be before timestamp.`);
      assert(closedTime.getTime() <= snapshotAnchor.getTime(), `Finding ${finding.id} closedTimestamp cannot be after snapshot date.`);
    } else {
      assert(!finding.closedTimestamp, `Open finding ${finding.id} must not have closedTimestamp.`);
    }

    if (finding.timestamp.slice(0, 10) === "2024-02-10") {
      findingsOnStartDate += 1;
    }
  }
  assert(findingsOnStartDate >= 90, "Findings on 2024-02-10 must be at least 90.");

  for (const system of modelledSystems) {
    assert(
      system.environments.some((environment) => environment.type === "Production"),
      `System ${system.id} missing Production environment.`
    );
    assert(system.environments.length >= 2, `System ${system.id} must have at least 1 non-production environment.`);
  }

  for (const system of unmodelledSystems) {
    assert(system.name.trim().length > 0, `Unmodelled system ${system.id} must have a name.`);
    assert(system.diisDefined === true, `Unmodelled system ${system.id} must be DIIS-defined.`);
    assert(system.environments.length === 0, `Unmodelled system ${system.id} must have no environments.`);
  }

  const assetSystemIds = new Set(
    current.assets
      .map((asset) => asset.systemContext?.systemId)
      .filter((systemId): systemId is string => Boolean(systemId))
  );
  for (const system of unmodelledSystems) {
    assert(!assetSystemIds.has(system.id), `Unmodelled system ${system.id} must have no linked assets.`);
  }

  const assetIds = new Set(current.assets.map((asset) => asset.id));
  for (const dependency of current.ciDependencies ?? []) {
    assert(assetIds.has(dependency.sourceAssetId), `Dependency ${dependency.id} has unknown source asset.`);
    assert(assetIds.has(dependency.targetAssetId), `Dependency ${dependency.id} has unknown target asset.`);
    assert(
      CI_DEPENDENCY_TYPES.has(dependency.dependencyType),
      `Dependency ${dependency.id} has unsupported dependency type.`
    );
    assert(
      dependency.sourceAssetId !== dependency.targetAssetId,
      `Dependency ${dependency.id} cannot self-reference the same asset.`
    );
  }

  console.log("Seed validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
