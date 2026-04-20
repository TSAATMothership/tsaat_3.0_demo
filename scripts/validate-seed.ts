import { promises as fs } from "fs";
import path from "path";
import { ASSET_TYPES } from "../lib/asset-taxonomy";
import { buildNetworkTargetStateSummary } from "../lib/network-target-state";
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
const EXPECTED_ASSET_COUNT = 1000;
const EXPECTED_MODELLED_RATIO = 0.7;
const EXPECTED_UNMODELLED_RATIO = 0.3;
const FLOW_ZERO_RATIO = 0.1;
const FLOW_HIGH_RATIO = 0.7;
const FLOW_MEDIUM_RATIO = 0.19;
const FLOW_SPIKE_RATIO = 0.01;
const TARGET_HIGH_MIN_RATIO = 0.08;
const TARGET_HIGH_MAX_RATIO = 0.14;
const TARGET_OVER90_MIN_RATIO = 0.56;
const TARGET_OVER90_MAX_RATIO = 0.64;

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

  assert(current.managedNetworks.length >= 10, "Managed networks must include at least 10 entries.");
  assert(current.ictSystems.length >= 60, "ICT systems must include modelled and unmodelled entries.");
  assert(current.assets.length === EXPECTED_ASSET_COUNT, `Assets must equal ${EXPECTED_ASSET_COUNT}.`);
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
    assert(typeof network.adfPlatform === "boolean", `Network ${network.id} must include adfPlatform as boolean.`);
    assert(
      typeof network.enterprisePlatform === "boolean",
      `Network ${network.id} must include enterprisePlatform as boolean.`
    );
    assert(
      !!network.targetStateAssets && typeof network.targetStateAssets === "object",
      `Network ${network.id} must include targetStateAssets.`
    );
    for (const assetType of ASSET_TYPES) {
      assert(
        Array.isArray(network.targetStateAssets?.[assetType]),
        `Network ${network.id} targetStateAssets.${assetType} must be an array.`
      );
    }
  }

  const targetStateSummary = buildNetworkTargetStateSummary(
    current.managedNetworks,
    current.assets.map((asset) => ({
      networkId: asset.networkId,
      assetType: asset.type,
      name: asset.name
    }))
  );

  let mappedResults = 0;
  let highCoverageResults = 0;
  let overNinetyResults = 0;
  let betweenTwentyAndEightyFiveResults = 0;
  let targetMissingResults = 0;
  let discoveryMissingResults = 0;

  for (const network of current.managedNetworks) {
    const summary = targetStateSummary.get(network.id);
    assert(!!summary, `Missing target-state summary for network ${network.id}.`);

    for (const assetType of ASSET_TYPES) {
      const cell = summary!.byAssetType[assetType];
      if (cell.state === "target-missing") {
        targetMissingResults += 1;
        continue;
      }
      if (cell.state === "discovery-missing") {
        discoveryMissingResults += 1;
        continue;
      }

      mappedResults += 1;
      if (cell.coveragePercent > 95) {
        highCoverageResults += 1;
      }
      if (cell.coveragePercent > 90) {
        overNinetyResults += 1;
      }
      if (cell.coveragePercent >= 20 && cell.coveragePercent <= 85) {
        betweenTwentyAndEightyFiveResults += 1;
      }
    }
  }

  assert(targetMissingResults > 0, "Dataset must include target-state-missing examples.");
  assert(discoveryMissingResults > 0, "Dataset must include discovery-missing examples.");
  assert(mappedResults > 0, "Dataset must include mapped target-state results.");
  assert(
    overNinetyResults + betweenTwentyAndEightyFiveResults === mappedResults,
    "Mapped target-state coverage results must be either >90% or between 20% and 85%."
  );

  const highRatio = highCoverageResults / mappedResults;
  const overNinetyRatio = overNinetyResults / mappedResults;
  assert(
    highRatio >= TARGET_HIGH_MIN_RATIO && highRatio <= TARGET_HIGH_MAX_RATIO,
    `Mapped target-state results above 95% must be between ${(TARGET_HIGH_MIN_RATIO * 100).toFixed(0)}% and ${(TARGET_HIGH_MAX_RATIO * 100).toFixed(0)}%.`
  );
  assert(
    overNinetyRatio >= TARGET_OVER90_MIN_RATIO && overNinetyRatio <= TARGET_OVER90_MAX_RATIO,
    `Mapped target-state results above 90% must be between ${(TARGET_OVER90_MIN_RATIO * 100).toFixed(0)}% and ${(TARGET_OVER90_MAX_RATIO * 100).toFixed(0)}%.`
  );

  const modelledSystems = current.ictSystems.filter((system) => system.modellingStatus === true);
  const unmodelledSystems = current.ictSystems.filter((system) => system.modellingStatus === false);
  const diisSystems = current.ictSystems.filter((system) => system.diisDefined === true);

  assert(modelledSystems.length >= 20, "Modelled ICT systems must be at least 20.");
  assert(unmodelledSystems.length === 40, "Unmodelled ICT systems must equal 40.");
  assert(diisSystems.length === current.ictSystems.length, "All ICT systems must be represented in DIIS.");
  assert(
    current.ictSystems.every((system) => typeof system.adfPlatform === "boolean"),
    "All ICT systems must include adfPlatform as boolean."
  );
  assert(
    current.ictSystems.every((system) => typeof system.enterprisePlatform === "boolean"),
    "All ICT systems must include enterprisePlatform as boolean."
  );

  const serverAssets = current.assets.filter((asset) => asset.type === "server");
  const workstationAssets = current.assets.filter((asset) => asset.type === "workstation");
  const networkAssets = current.assets.filter((asset) => asset.type === "network-device");
  const storageAssets = current.assets.filter((asset) => asset.type === "storage-device");
  const printerAssets = current.assets.filter((asset) => asset.type === "printer-device");
  const otherAssets = current.assets.filter((asset) => asset.type === "other");
  assert(serverAssets.length === 780, "Servers must equal 780.");
  assert(workstationAssets.length === 80, "Workstations must equal 80.");
  assert(networkAssets.length === 60, "Network devices must equal 60.");
  assert(storageAssets.length === 40, "Storage devices must equal 40.");
  assert(printerAssets.length === 20, "Printer devices must equal 20.");
  assert(otherAssets.length === 20, "Other assets must equal 20.");

  const modelledAssets = current.assets.filter((asset) => asset.systemContext?.systemId);
  const unmodelledAssets = current.assets.filter((asset) => !asset.systemContext?.systemId);
  assert(
    modelledAssets.length === Math.round(current.assets.length * EXPECTED_MODELLED_RATIO),
    "Modelled CI allocation must equal 70%."
  );
  assert(
    unmodelledAssets.length === Math.round(current.assets.length * EXPECTED_UNMODELLED_RATIO),
    "Unmodelled CI allocation must equal 30%."
  );
  assert(
    modelledAssets.every((asset) => asset.type === "server"),
    "ICT system modelled assets must only include servers."
  );
  assert(
    workstationAssets.every((asset) => !asset.systemContext),
    "Workstations must not be assigned to ICT system environments."
  );
  assert(
    networkAssets.every((asset) => !asset.systemContext),
    "Network devices must not be assigned to ICT system environments."
  );
  assert(
    storageAssets.every((asset) => !asset.systemContext),
    "Storage devices must not be assigned to ICT system environments."
  );
  assert(
    printerAssets.every((asset) => !asset.systemContext),
    "Printer devices must not be assigned to ICT system environments."
  );
  assert(
    otherAssets.every((asset) => !asset.systemContext),
    "Other assets must not be assigned to ICT system environments."
  );

  const serverCountBySystem = new Map<string, number>();
  for (const asset of serverAssets) {
    const systemId = asset.systemContext?.systemId;
    if (!systemId) {
      continue;
    }
    serverCountBySystem.set(systemId, (serverCountBySystem.get(systemId) ?? 0) + 1);
  }

  const modelledSystemServerCounts = modelledSystems.map((system) => serverCountBySystem.get(system.id) ?? 0);
  assert(
    modelledSystemServerCounts.every((count) => count >= 20 && count <= 300),
    "Each modelled ICT system must have between 20 and 300 servers."
  );
  const systemsUnderFifty = modelledSystemServerCounts.filter((count) => count < 50).length;
  assert(
    systemsUnderFifty > modelledSystems.length / 2,
    "Most modelled ICT systems must have fewer than 50 servers."
  );

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
  assert(storageAssets.some((asset) => asset.vulnerabilities.length === 0), "Storage devices must include some assets with no vulnerabilities.");
  assert(printerAssets.some((asset) => asset.vulnerabilities.length === 0), "Printer devices must include some assets with no vulnerabilities.");
  assert(otherAssets.some((asset) => asset.vulnerabilities.length === 0), "Other assets must include some assets with no vulnerabilities.");

  const productionServers = serverAssets.filter((asset) => asset.systemContext?.environmentType === "Production");
  const productionWorkstations = workstationAssets.filter(
    (asset) => asset.systemContext?.environmentType === "Production"
  );
  const workstationRiskPopulation = productionWorkstations.length ? productionWorkstations : workstationAssets;

  const highRisk4 = productionServers.some(
    (asset) => hasCritical(asset) && asset.operatingSystem?.supportStatus === "OutOfSupport"
  );
  const highRisk5 = productionServers.some(
    (asset) =>
      hasCritical(asset) && asset.installedSoftware.some((software) => software.supportStatus === "OutOfSupport")
  );
  const highRisk6 = workstationRiskPopulation.some(
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

  const flowCountBySource = new Map<string, number>();
  for (const asset of current.assets) {
    flowCountBySource.set(asset.id, 0);
  }

  for (const dependency of current.ciDependencies ?? []) {
    if (dependency.dependencyType === "Flow Dependency") {
      flowCountBySource.set(dependency.sourceAssetId, (flowCountBySource.get(dependency.sourceAssetId) ?? 0) + 1);
    }
  }

  let zeroCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let spikeCount = 0;
  for (const flowCount of flowCountBySource.values()) {
    assert(flowCount >= 0, "Flow dependency count cannot be negative.");
    assert(flowCount <= 150, "Flow dependency count cannot exceed 150.");

    if (flowCount === 0) {
      zeroCount += 1;
      continue;
    }
    if (flowCount >= 20 && flowCount <= 50) {
      highCount += 1;
      continue;
    }
    if (flowCount >= 3 && flowCount <= 19) {
      mediumCount += 1;
      continue;
    }
    if (flowCount >= 51 && flowCount <= 150) {
      spikeCount += 1;
      continue;
    }
    throw new Error(`Unexpected flow dependency bucket value encountered: ${flowCount}`);
  }

  const totalSources = current.assets.length;
  const expectedZeroCount = Math.floor(totalSources * FLOW_ZERO_RATIO);
  const expectedHighCount = Math.floor(totalSources * FLOW_HIGH_RATIO);
  const expectedMediumCount = Math.floor(totalSources * FLOW_MEDIUM_RATIO);
  const expectedSpikeCount = totalSources - expectedZeroCount - expectedHighCount - expectedMediumCount;

  assert(zeroCount === expectedZeroCount, "Flow bucket 0% count does not match expected 10%.");
  assert(highCount === expectedHighCount, "Flow bucket 20-50 count does not match expected 70%.");
  assert(mediumCount === expectedMediumCount, "Flow bucket 3-19 count does not match expected 19%.");
  assert(spikeCount === expectedSpikeCount, "Flow bucket 51-150 count does not match expected 1%.");

  console.log("Seed validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
