import { promises as fs } from "fs";
import path from "path";
import { ASSET_TYPES } from "../lib/asset-taxonomy";
import {
  DISABLED_REFERENCE_NETWORK_DESCRIPTION,
  DISABLED_REFERENCE_NETWORK_ID,
  DISABLED_REFERENCE_NETWORK_NAME
} from "../lib/disabled-network-fixture";
import {
  Asset,
  AssetType,
  BusinessService,
  CiDependency,
  Criticality,
  Dataset,
  EnvironmentType,
  ICTSystem,
  InstalledSoftware,
  Lifecycle,
  ManagedNetwork,
  MissionCapability,
  NetworkDeviceAsset,
  OperatingSystem,
  ReferenceVersions,
  SecurityDomain,
  ServerAsset,
  StorageDeviceAsset,
  SystemCriticality,
  SupportStatus,
  SystemEnvironment,
  PrinterDeviceAsset,
  OtherAsset,
  VulnerabilityExploitability,
  VulnerabilitySeverity,
  Vulnerability,
  WorkstationAsset
} from "../lib/types";

type Random = () => number;

const CAPABILITIES = [
  "Joint Fires Coordination",
  "Maritime Domain Awareness",
  "Air Tasking Management",
  "Secure Coalition Messaging",
  "Battlefield Telemetry Fusion",
  "ISR Data Exploitation",
  "Logistics Sustainment",
  "Strategic Comms Resilience"
];

const SERVICES = [
  "Identity and Access Service",
  "Mission Planning Platform",
  "Secure Email Gateway",
  "Data Lake Service",
  "Operational Ticketing",
  "Command Portal",
  "Geo Intelligence Service",
  "Endpoint Protection Console",
  "Vulnerability Management Service"
];

const NETWORK_NAMES = [
  "Aegis Mesh North",
  "Sentinel Core East",
  "Rampart Domain South",
  "Vanguard Grid West",
  "Citadel Fusion Central"
];

const NEW_DEFENCE_NETWORK_NAMES = [
  "Defence Joint Sensor Backbone",
  "Defence Expeditionary Access Fabric",
  "Defence Maritime Command Mesh",
  "Defence Air Operations Transit Grid",
  "Defence Secure Logistics Exchange",
  "Defence ISR Correlation Bus",
  "Defence Coalition Gateway Ring"
];

const SYSTEM_NAMES = [
  "Falcon Ops Hub",
  "Trident Link",
  "Cerberus Control",
  "Iron Lens",
  "Vector Guard",
  "Hydra Exchange",
  "Atlas Dispatch",
  "Nexus Shield",
  "Pioneer Relay",
  "Argus Matrix",
  "Echo Bastion",
  "Tempest Planner",
  "Harbor Net",
  "Saber Chain",
  "Comet Watch"
];

const UNMODELLED_SYSTEM_COUNT = 40;

const SERVER_SOFTWARE = [
  "Apache HTTP Server",
  "NGINX",
  "PostgreSQL",
  "Microsoft SQL Server",
  "OpenJDK Runtime",
  "Tomcat",
  "Docker Engine",
  "Elasticsearch",
  "GitLab Runner",
  "Node.js Runtime"
];

const WORKSTATION_SOFTWARE = [
  "Microsoft Office",
  "Google Chrome",
  "Mozilla Firefox",
  "Adobe Reader",
  "Java Runtime",
  "Python",
  "7-Zip",
  "Microsoft Teams",
  "Visual Studio Code",
  "Secure VPN Client"
];

const DEVICE_NAMES = ["Edge", "Switch", "Gateway", "Firewall", "Router", "Core"];
const STORAGE_DEVICE_NAMES = ["NAS", "SAN", "Backup", "Archive", "Storage Array"];
const PRINTER_DEVICE_NAMES = ["Laser", "Inkjet", "MFP", "Label", "Thermal"];
const OTHER_DEVICE_NAMES = ["IoT", "Controller", "Sensor", "Console", "Appliance"];

const ENV_TYPES: EnvironmentType[] = ["Development", "UAT", "Test"];
const SECURITY_DOMAINS: SecurityDomain[] = ["Secret", "Protected", "Unclassified"];

const TOTAL_ASSET_COUNT = 1000;
const MODELLED_ASSET_RATIO = 0.7;
const SERVER_COUNT = 780;
const WORKSTATION_COUNT = 80;
const NETWORK_DEVICE_COUNT = 60;
const STORAGE_DEVICE_COUNT = 40;
const PRINTER_DEVICE_COUNT = 20;
const OTHER_ASSET_COUNT = 20;
const MODELLED_SYSTEM_COUNT = 20;
const MODELLED_SYSTEM_MIN_SERVERS = 20;
const MODELLED_SYSTEM_MAX_SERVERS = 300;
const TARGET_STATE_BUCKET_HIGH_RATIO = 0.1;

type AssetProfile =
  | "server"
  | "workstation"
  | "network-device"
  | "storage-device"
  | "printer-device"
  | "other";

type TargetStateBucket = "high" | "mid" | "low";

interface NetworkAssetTypeCombo {
  networkId: string;
  assetType: AssetType;
}

interface CveTemplate {
  cve: string;
  criticality: VulnerabilitySeverity;
  exploitability: VulnerabilityExploitability;
  description: string;
  remediationGuidance: string;
}

interface VulnerabilityGenerationProfile {
  noVulnerabilityChance: number;
  minCount: number;
  maxCount: number;
  severityWeights: VulnerabilitySeverity[];
  sources: string[];
}

const VULNERABILITY_GENERATION_PROFILES: Record<AssetProfile, VulnerabilityGenerationProfile> = {
  server: {
    noVulnerabilityChance: 0.2,
    minCount: 1,
    maxCount: 4,
    severityWeights: ["Critical", "High", "High", "Medium", "Medium", "Low"],
    sources: ["Qualys", "Nessus", "OpenVAS", "Defender"]
  },
  workstation: {
    noVulnerabilityChance: 0.42,
    minCount: 1,
    maxCount: 3,
    severityWeights: ["Critical", "High", "Medium", "Medium", "Low", "Low", "Low"],
    sources: ["Defender", "Qualys", "Nessus", "OpenVAS"]
  },
  "network-device": {
    noVulnerabilityChance: 0.3,
    minCount: 1,
    maxCount: 4,
    severityWeights: ["Critical", "High", "High", "Medium", "Low"],
    sources: ["Qualys", "Nessus", "OpenVAS"]
  },
  "storage-device": {
    noVulnerabilityChance: 0.35,
    minCount: 1,
    maxCount: 3,
    severityWeights: ["Critical", "High", "Medium", "Medium", "Low"],
    sources: ["Qualys", "Nessus", "OpenVAS"]
  },
  "printer-device": {
    noVulnerabilityChance: 0.45,
    minCount: 1,
    maxCount: 2,
    severityWeights: ["High", "Medium", "Medium", "Low", "Low"],
    sources: ["Qualys", "Nessus", "OpenVAS"]
  },
  other: {
    noVulnerabilityChance: 0.5,
    minCount: 1,
    maxCount: 2,
    severityWeights: ["High", "Medium", "Medium", "Low", "Low", "Low"],
    sources: ["Qualys", "Nessus", "OpenVAS"]
  }
};

const CVE_TEMPLATES: CveTemplate[] = [
  {
    cve: "CVE-2024-39877",
    criticality: "Critical",
    exploitability: "Known Exploited",
    description: "Unauthenticated remote code execution vulnerability in a perimeter service component.",
    remediationGuidance:
      "Patch to latest vendor release immediately, restrict edge exposure, and monitor for post-exploitation indicators."
  },
  {
    cve: "CVE-2025-41012",
    criticality: "Critical",
    exploitability: "Exploitable",
    description: "Privilege escalation flaw in endpoint agent update handler allows SYSTEM-level execution.",
    remediationGuidance:
      "Deploy hotfix package, rotate privileged credentials used by agents, and validate update channel integrity."
  },
  {
    cve: "CVE-2026-11209",
    criticality: "Critical",
    exploitability: "Known Exploited",
    description: "Authentication bypass in web administration endpoint can expose device control functions.",
    remediationGuidance:
      "Disable external administration interfaces, enforce MFA on management plane, and apply firmware update."
  },
  {
    cve: "CVE-2024-45031",
    criticality: "Critical",
    exploitability: "Exploitable",
    description: "Memory corruption in network stack permits code execution through crafted inbound traffic.",
    remediationGuidance:
      "Upgrade to fixed network OS build, apply temporary ACL mitigations, and prioritize vulnerable segments."
  },
  {
    cve: "CVE-2025-20716",
    criticality: "High",
    exploitability: "Proof of Concept",
    description: "Directory traversal permits unauthorized read access to application configuration data.",
    remediationGuidance:
      "Patch the application service, harden file permissions, and block traversal patterns at reverse proxy."
  },
  {
    cve: "CVE-2026-11844",
    criticality: "High",
    exploitability: "Exploitable",
    description: "Improper input sanitization permits command injection in automation endpoint.",
    remediationGuidance:
      "Apply security update, disable exposed automation endpoint until patched, and rotate integration secrets."
  },
  {
    cve: "CVE-2024-33215",
    criticality: "High",
    exploitability: "Proof of Concept",
    description: "Session token leakage vulnerability in API gateway can enable account takeover.",
    remediationGuidance:
      "Patch gateway component, invalidate active sessions, and enforce shorter token lifetimes."
  },
  {
    cve: "CVE-2025-28911",
    criticality: "High",
    exploitability: "No Known Exploit",
    description: "TLS certificate validation weakness allows machine-in-the-middle interception.",
    remediationGuidance:
      "Update trust chain validation library, enforce certificate pinning where supported, and rotate certificates."
  },
  {
    cve: "CVE-2026-13007",
    criticality: "High",
    exploitability: "Exploitable",
    description: "Local privilege escalation in kernel driver reachable from authenticated user context.",
    remediationGuidance:
      "Apply vendor kernel update and restrict local administrative access pending patch rollout."
  },
  {
    cve: "CVE-2025-16221",
    criticality: "Medium",
    exploitability: "Proof of Concept",
    description: "Cross-site scripting in administrative dashboard may expose operator session data.",
    remediationGuidance:
      "Patch dashboard version, enable strict content security policy, and sanitize user-provided fields."
  },
  {
    cve: "CVE-2024-27116",
    criticality: "Medium",
    exploitability: "No Known Exploit",
    description: "Information disclosure in verbose error logging reveals internal service topology.",
    remediationGuidance:
      "Disable debug logging in production and deploy secure logging profile."
  },
  {
    cve: "CVE-2026-14932",
    criticality: "Medium",
    exploitability: "Proof of Concept",
    description: "Weak default permissions on diagnostic files allow unauthorized data access.",
    remediationGuidance:
      "Apply permission hardening baseline and redeploy endpoint policy to affected assets."
  },
  {
    cve: "CVE-2025-30045",
    criticality: "Medium",
    exploitability: "No Known Exploit",
    description: "Denial-of-service condition through malformed protocol requests in network daemon.",
    remediationGuidance:
      "Upgrade daemon version and apply rate-limiting controls on exposed listeners."
  },
  {
    cve: "CVE-2025-09014",
    criticality: "Low",
    exploitability: "No Known Exploit",
    description: "Minor information exposure via predictable temporary file naming.",
    remediationGuidance:
      "Adopt secure temporary file APIs and remove stale temporary artifacts."
  },
  {
    cve: "CVE-2024-18055",
    criticality: "Low",
    exploitability: "No Known Exploit",
    description: "UI-level validation bypass can produce incorrect audit metadata values.",
    remediationGuidance:
      "Apply user interface update and enforce validation at server-side boundary."
  },
  {
    cve: "CVE-2026-15501",
    criticality: "Low",
    exploitability: "Proof of Concept",
    description: "Low-impact configuration disclosure in status endpoint.",
    remediationGuidance:
      "Restrict status endpoint visibility and remove sensitive attributes from responses."
  }
];

function createRandom(seed: number): Random {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function randomInt(random: Random, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function chance(random: Random, probability: number): boolean {
  return random() < probability;
}

function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function pickMany<T>(random: Random, items: T[], count: number): T[] {
  const copy = [...items];
  const selected: T[] = [];
  for (let index = 0; index < count && copy.length; index += 1) {
    const itemIndex = randomInt(random, 0, copy.length - 1);
    selected.push(copy[itemIndex]);
    copy.splice(itemIndex, 1);
  }
  return selected;
}

function shuffledIndices(random: Random, count: number): number[] {
  const values = Array.from({ length: count }, (_, index) => index);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(random, 0, index);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function buildChunkAllocation(
  random: Random,
  total: number,
  bucketCount: number,
  minChunkSize: number,
  maxChunkSize: number
): number[] {
  if (bucketCount <= 0) {
    return [];
  }

  const allocations = Array.from({ length: bucketCount }, () => 0);
  let remaining = total;
  const randomizedBuckets = shuffledIndices(random, bucketCount);

  for (let index = 0; index < randomizedBuckets.length; index += 1) {
    const bucketId = randomizedBuckets[index];
    const bucketsLeft = randomizedBuckets.length - index;
    const minReservedForOthers = bucketsLeft - 1;
    const maxAllowed = Math.max(1, Math.min(maxChunkSize, remaining - minReservedForOthers));
    const minAllowed = Math.min(maxAllowed, Math.max(1, minChunkSize));
    const chunkSize = randomInt(random, minAllowed, maxAllowed);
    allocations[bucketId] += chunkSize;
    remaining -= chunkSize;
  }

  while (remaining > 0) {
    const bucketId = randomInt(random, 0, bucketCount - 1);
    const chunkSize = randomInt(random, 1, Math.min(maxChunkSize, remaining));
    allocations[bucketId] += chunkSize;
    remaining -= chunkSize;
  }

  return allocations;
}

function createAssetTypeRecord<T>(factory: (assetType: AssetType) => T): Record<AssetType, T> {
  return Object.fromEntries(ASSET_TYPES.map((assetType) => [assetType, factory(assetType)] as const)) as Record<
    AssetType,
    T
  >;
}

function comboKey(networkId: string, assetType: AssetType): string {
  return `${networkId}::${assetType}`;
}

function sortCombos(combos: NetworkAssetTypeCombo[]): NetworkAssetTypeCombo[] {
  return [...combos].sort((left, right) => {
    const networkCmp = left.networkId.localeCompare(right.networkId);
    if (networkCmp !== 0) {
      return networkCmp;
    }
    return left.assetType.localeCompare(right.assetType);
  });
}

function hasValidMidCoverageTarget(discoveredCount: number): boolean {
  if (discoveredCount <= 0) {
    return false;
  }
  for (let targetTotal = discoveredCount; targetTotal <= discoveredCount * 5; targetTotal += 1) {
    const ratio = discoveredCount / targetTotal;
    if (ratio > 0.9 && ratio <= 0.95) {
      return true;
    }
  }
  return false;
}

function pickComboKeySet(random: Random, combos: NetworkAssetTypeCombo[], count: number): Set<string> {
  if (!combos.length || count <= 0) {
    return new Set<string>();
  }
  const order = shuffledIndices(random, combos.length);
  const selected = new Set<string>();
  for (const index of order) {
    selected.add(comboKey(combos[index].networkId, combos[index].assetType));
    if (selected.size >= count) {
      break;
    }
  }
  return selected;
}

function pickTargetTotalsForMappedBuckets(
  random: Random,
  discoveredCount: number,
  bucket: TargetStateBucket
): number {
  if (discoveredCount <= 0) {
    return 0;
  }

  if (bucket === "high") {
    const extra = discoveredCount >= 25 ? randomInt(random, 0, 1) : 0;
    return discoveredCount + extra;
  }

  if (bucket === "mid") {
    if (discoveredCount < 4) {
      return discoveredCount;
    }

    const validMidTargets: number[] = [];
    for (let targetTotal = discoveredCount; targetTotal <= discoveredCount * 5; targetTotal += 1) {
      const ratio = discoveredCount / targetTotal;
      if (ratio > 0.9 && ratio <= 0.95) {
        validMidTargets.push(targetTotal);
      }
    }
    if (!validMidTargets.length) {
      return discoveredCount;
    }
    return pick(random, validMidTargets);
  }

  const desiredCoverage = 0.2 + random() * 0.65;
  let targetTotal = Math.max(discoveredCount + 1, Math.round(discoveredCount / desiredCoverage));
  while (discoveredCount / targetTotal > 0.85) {
    targetTotal += 1;
  }
  while (discoveredCount / targetTotal < 0.2 && targetTotal > discoveredCount + 1) {
    targetTotal -= 1;
  }
  return targetTotal;
}

function buildUnmatchedTargetNames(
  networkId: string,
  assetType: AssetType,
  existingNames: Set<string>,
  needed: number
): string[] {
  const targetNames: string[] = [];
  let counter = 1;
  while (targetNames.length < needed) {
    const candidate = `Target ${networkId.toUpperCase()} ${assetType.toUpperCase()} ${String(counter).padStart(4, "0")}`;
    if (!existingNames.has(candidate.toLowerCase())) {
      targetNames.push(candidate);
      existingNames.add(candidate.toLowerCase());
    }
    counter += 1;
  }
  return targetNames;
}

function assignNetworkTargetStateAssets(random: Random, networks: ManagedNetwork[], assets: Asset[]) {
  const discoveredByCombo = new Map<string, string[]>();
  for (const asset of assets) {
    const key = comboKey(asset.networkId, asset.type);
    const existing = discoveredByCombo.get(key);
    if (existing) {
      existing.push(asset.name);
    } else {
      discoveredByCombo.set(key, [asset.name]);
    }
  }

  const allCombos = sortCombos(
    networks.flatMap((network) => ASSET_TYPES.map((assetType) => ({ networkId: network.id, assetType })))
  );
  const combosWithDiscoveredAssets = allCombos.filter((combo) => (discoveredByCombo.get(comboKey(combo.networkId, combo.assetType)) ?? []).length > 0);
  const mappedCandidateCombos = combosWithDiscoveredAssets.filter((combo) => {
    const discoveredCount = (discoveredByCombo.get(comboKey(combo.networkId, combo.assetType)) ?? []).length;
    return hasValidMidCoverageTarget(discoveredCount);
  });
  const nonMappedCombos = combosWithDiscoveredAssets.filter((combo) => {
    const discoveredCount = (discoveredByCombo.get(comboKey(combo.networkId, combo.assetType)) ?? []).length;
    return !hasValidMidCoverageTarget(discoveredCount);
  });

  const targetMissingKeys = new Set<string>();
  const nonMappedOrder = shuffledIndices(random, nonMappedCombos.length);
  const minimumMappedCount = 10;
  const supplementalMappedCount = Math.max(0, Math.min(nonMappedCombos.length, minimumMappedCount - mappedCandidateCombos.length));
  const supplementalMappedCombos = nonMappedOrder.slice(0, supplementalMappedCount).map((index) => nonMappedCombos[index]);
  const supplementalMappedKeys = new Set(
    supplementalMappedCombos.map((combo) => comboKey(combo.networkId, combo.assetType))
  );

  const missingPoolCombos = nonMappedOrder
    .slice(supplementalMappedCount)
    .map((index) => nonMappedCombos[index]);
  for (let orderIndex = 0; orderIndex < missingPoolCombos.length; orderIndex += 1) {
    const combo = missingPoolCombos[orderIndex];
    const key = comboKey(combo.networkId, combo.assetType);
    targetMissingKeys.add(key);
  }

  if (!targetMissingKeys.size && mappedCandidateCombos.length > 0) {
    targetMissingKeys.add(comboKey(mappedCandidateCombos[0].networkId, mappedCandidateCombos[0].assetType));
  }
  const mappedCombos = [...mappedCandidateCombos.filter((combo) => {
    const key = comboKey(combo.networkId, combo.assetType);
    return !targetMissingKeys.has(key);
  }), ...supplementalMappedCombos.filter((combo) => {
    const key = comboKey(combo.networkId, combo.assetType);
    return !targetMissingKeys.has(key) && supplementalMappedKeys.has(key);
  })];
  const mappedCount = mappedCombos.length;
  const mappedDistributionCombos = mappedCombos.filter((combo) => {
    const discoveredCount = (discoveredByCombo.get(comboKey(combo.networkId, combo.assetType)) ?? []).length;
    return hasValidMidCoverageTarget(discoveredCount);
  });

  const highCount = Math.min(
    mappedDistributionCombos.length,
    Math.max(1, Math.floor(mappedCount * TARGET_STATE_BUCKET_HIGH_RATIO))
  );
  const targetOverNinetyCount = Math.min(mappedCount, Math.max(1, Math.round(mappedCount * 0.6)));
  const midCount = Math.min(
    Math.max(0, mappedDistributionCombos.length - highCount),
    Math.max(1, targetOverNinetyCount - highCount)
  );

  const highKeys = pickComboKeySet(random, mappedDistributionCombos, highCount);
  const midCandidates = mappedDistributionCombos.filter((combo) => !highKeys.has(comboKey(combo.networkId, combo.assetType)));
  const midKeys = pickComboKeySet(random, midCandidates, midCount);

  const mappedBucketByKey = new Map<string, TargetStateBucket>();
  for (const combo of mappedCombos) {
    const key = comboKey(combo.networkId, combo.assetType);
    mappedBucketByKey.set(key, highKeys.has(key) ? "high" : midKeys.has(key) ? "mid" : "low");
  }

  const targetStateByNetwork = new Map<string, Record<AssetType, string[]>>();
  for (const network of networks) {
    targetStateByNetwork.set(network.id, createAssetTypeRecord(() => []));
  }

  for (const combo of allCombos) {
    const key = comboKey(combo.networkId, combo.assetType);
    const targetStateAssets = targetStateByNetwork.get(combo.networkId)!;
    const discoveredNames = discoveredByCombo.get(key) ?? [];

    if (targetMissingKeys.has(key)) {
      targetStateAssets[combo.assetType] = [];
      continue;
    }

    if (discoveredNames.length <= 0) {
      targetStateAssets[combo.assetType] = [];
      continue;
    }

    const bucket = mappedBucketByKey.get(key) ?? "low";
    const targetTotal = pickTargetTotalsForMappedBuckets(random, discoveredNames.length, bucket);
    const normalizedNameSet = new Set(discoveredNames.map((name) => name.trim().toLowerCase()));
    const extraCount = Math.max(0, targetTotal - discoveredNames.length);
    const extras = buildUnmatchedTargetNames(combo.networkId, combo.assetType, normalizedNameSet, extraCount);
    targetStateAssets[combo.assetType] = [...discoveredNames, ...extras];
  }

  for (const network of networks) {
    network.targetStateAssets = targetStateByNetwork.get(network.id)!;
  }
}

function generateVersions(): ReferenceVersions {
  return {
    osCurrentMajor: {
      windowsServer: 2022,
      windowsClient: 11,
      ubuntu: 24,
      rhel: 9,
      ciscoIos: 17,
      junos: 22,
      fortios: 7
    },
    softwareSupportMatrix: {
      "Apache HTTP Server": ["2.4.58", "2.4.57", "2.2.0"],
      NGINX: ["1.25.4", "1.24.0", "1.16.1"],
      PostgreSQL: ["16.2", "15.6", "11.0"],
      "Microsoft SQL Server": ["2022", "2019", "2012"],
      "OpenJDK Runtime": ["21", "17", "8"],
      Tomcat: ["10.1.19", "9.0.87", "7.0.0"],
      "Docker Engine": ["26.0", "25.0", "20.10"],
      Elasticsearch: ["8.13", "7.17", "6.8"],
      "GitLab Runner": ["17.0", "16.5", "14.0"],
      "Node.js Runtime": ["22", "20", "14"],
      "Microsoft Office": ["365", "2021", "2013"],
      "Google Chrome": ["131", "126", "102"],
      "Mozilla Firefox": ["133", "128", "97"],
      "Adobe Reader": ["2024", "2021", "2017"],
      "Java Runtime": ["21", "17", "8"],
      Python: ["3.12", "3.11", "3.7"],
      "7-Zip": ["24.0", "23.1", "16.0"],
      "Microsoft Teams": ["2410", "2405", "2201"],
      "Visual Studio Code": ["1.96", "1.90", "1.70"],
      "Secure VPN Client": ["10.2", "9.8", "8.0"]
    }
  };
}

function supportFromGap(gap: number): SupportStatus {
  if (gap > 2) {
    return "OutOfSupport";
  }
  return "Supported";
}

function buildOperatingSystem(
  random: Random,
  profile: "server" | "workstation" | "network-device",
  versions: ReferenceVersions
): OperatingSystem | null {
  if (chance(random, 0.03)) {
    return null;
  }

  if (profile === "server") {
    const pool = [
      { family: "Windows Server", vendor: "Microsoft", key: "windowsServer" },
      { family: "Ubuntu Server", vendor: "Canonical", key: "ubuntu" },
      { family: "RHEL", vendor: "Red Hat", key: "rhel" }
    ] as const;

    const selected = pick(random, pool);
    const current = versions.osCurrentMajor[selected.key];
    const gap = pick(random, [0, 0, 1, 1, 2, 3, 4]);
    const majorVersion = current - gap;
    return {
      family: selected.family,
      vendor: selected.vendor,
      majorVersion,
      version: `${majorVersion}.${randomInt(random, 0, 9)}`,
      supportStatus: supportFromGap(gap),
      currentSupportedMajor: current,
      nMinus: gap
    };
  }

  if (profile === "workstation") {
    const pool = [
      { family: "Windows", vendor: "Microsoft", key: "windowsClient" },
      { family: "Ubuntu Desktop", vendor: "Canonical", key: "ubuntu" }
    ] as const;

    const selected = pick(random, pool);
    const current = versions.osCurrentMajor[selected.key];
    const gap = pick(random, [0, 1, 1, 2, 2, 3, 4]);
    const majorVersion = current - gap;
    return {
      family: selected.family,
      vendor: selected.vendor,
      majorVersion,
      version: `${majorVersion}.${randomInt(random, 0, 3)}`,
      supportStatus: supportFromGap(gap),
      currentSupportedMajor: current,
      nMinus: gap
    };
  }

  const pool = [
    { family: "Cisco IOS XE", vendor: "Cisco", key: "ciscoIos" },
    { family: "JunOS", vendor: "Juniper", key: "junos" },
    { family: "FortiOS", vendor: "Fortinet", key: "fortios" }
  ] as const;
  const selected = pick(random, pool);
  const current = versions.osCurrentMajor[selected.key];
  const gap = pick(random, [0, 1, 1, 2, 2, 3, 4]);
  const majorVersion = current - gap;

  return {
    family: selected.family,
    vendor: selected.vendor,
    majorVersion,
    version: `${majorVersion}.${randomInt(random, 0, 8)}`,
    supportStatus: supportFromGap(gap),
    currentSupportedMajor: current,
    nMinus: gap
  };
}

function buildSoftware(random: Random, type: "server" | "workstation", versions: ReferenceVersions): InstalledSoftware[] {
  const source = type === "server" ? SERVER_SOFTWARE : WORKSTATION_SOFTWARE;
  const selected = pickMany(random, source, randomInt(random, 3, 7));

  return selected.map((name) => {
    const versionOptions = versions.softwareSupportMatrix[name] ?? ["1.0", "0.9", "0.5"];
    const stale = chance(random, 0.18);
    const unknown = chance(random, 0.04);

    const supportStatus: SupportStatus = unknown
      ? "Unknown"
      : stale
        ? "OutOfSupport"
        : "Supported";

    const version = stale
      ? versionOptions[versionOptions.length - 1]
      : pick(random, versionOptions.slice(0, 2));

    return {
      name,
      version,
      supportStatus
    };
  });
}

function randomDateWithinDays(random: Random, maxDaysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - randomInt(random, 0, maxDaysAgo));
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function randomTimestampForDate(random: Random, dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCHours(randomInt(random, 0, 23), randomInt(random, 0, 59), randomInt(random, 0, 59), 0);
  return date.toISOString();
}

function templatesByCriticality(criticality: VulnerabilitySeverity): CveTemplate[] {
  return CVE_TEMPLATES.filter((template) => template.criticality === criticality);
}

function buildVulnerabilityRecord(
  random: Random,
  assetId: string,
  profile: AssetProfile,
  severityOverride?: VulnerabilitySeverity,
  sourceOverride?: string,
  maxDaysAgo = 365
): Vulnerability {
  const generationProfile = VULNERABILITY_GENERATION_PROFILES[profile];
  const criticality = severityOverride ?? pick(random, generationProfile.severityWeights);
  const severityTemplates = templatesByCriticality(criticality);
  const selectedTemplate = pick(random, severityTemplates.length ? severityTemplates : CVE_TEMPLATES);
  const detectedDate = randomDateWithinDays(random, maxDaysAgo);
  const capturedAt = randomTimestampForDate(random, detectedDate);
  const source = sourceOverride ?? pick(random, generationProfile.sources);

  return {
    id: `VULN-${randomInt(random, 100000, 999999)}`,
    assetId,
    cve: selectedTemplate.cve,
    description: selectedTemplate.description,
    remediationGuidance: selectedTemplate.remediationGuidance,
    criticality,
    severity: criticality,
    exploitability:
      criticality === "Critical"
        ? pick(random, ["Known Exploited", "Exploitable"] as const)
        : selectedTemplate.exploitability,
    detectedDate,
    capturedAt,
    source
  };
}

function buildVulnerabilities(random: Random, profile: AssetProfile, assetId: string): Vulnerability[] {
  const generationProfile = VULNERABILITY_GENERATION_PROFILES[profile];
  if (chance(random, generationProfile.noVulnerabilityChance)) {
    return [];
  }

  const count = randomInt(random, generationProfile.minCount, generationProfile.maxCount);
  const vulnerabilities: Vulnerability[] = [];
  const selectedCves = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    let candidate = buildVulnerabilityRecord(random, assetId, profile);
    let attempts = 0;
    while (selectedCves.has(candidate.cve) && attempts < 4) {
      candidate = buildVulnerabilityRecord(random, assetId, profile);
      attempts += 1;
    }

    selectedCves.add(candidate.cve);
    vulnerabilities.push(candidate);
  }

  return vulnerabilities;
}

function randomCriticality(random: Random): "Critical" | "Non-Critical" {
  return chance(random, 0.4) ? "Critical" : "Non-Critical";
}

function buildLifecycle(random: Random): Lifecycle {
  const eolStatus = chance(random, 0.03)
    ? "Unknown"
    : chance(random, 0.1)
      ? "EOL"
      : "Supported";
  const warrantyStatus = chance(random, 0.04)
    ? "Unknown"
    : chance(random, 0.18)
      ? "OutOfWarranty"
      : "InWarranty";

  return { eolStatus, warrantyStatus };
}

function networkCriticalityForClassification(
  classification: "Official" | "Protected" | "Restricted"
): Criticality {
  return classification === "Official" ? "Non-Critical" : "Critical";
}

function formatNetworkReferenceOrdinal(ordinal: number): string {
  return String(ordinal).padStart(3, "0");
}

function formatSystemReferenceOrdinal(ordinal: number): string {
  return String(ordinal).padStart(3, "0");
}

function buildNetworks(random: Random): ManagedNetwork[] {
  const count = randomInt(random, 5, 6);
  const baselineNetworks = NETWORK_NAMES.slice(0, count).map((name, index) => {
    const classification = pick(random, ["Official", "Protected", "Restricted"] as const);
    const referenceOrdinal = formatNetworkReferenceOrdinal(index + 1);
    return {
      id: `net-${index + 1}`,
      name,
      criticality: networkCriticalityForClassification(classification),
      adfPlatform: chance(random, 0.4),
      enterprisePlatform: chance(random, 0.35),
      modellingStatus: false,
      classification,
      diisId: `DIIS-NET-${referenceOrdinal}`,
      atoNumber: `ATO-NET-${referenceOrdinal}`,
      apmNumber: `APM-NET-${referenceOrdinal}`,
      discoveryStatus: "Discovery Non Enabled" as const,
      ictSystemIds: [],
      assetIds: []
    };
  });
  const referenceBase = baselineNetworks.length;
  const newNetworks = NEW_DEFENCE_NETWORK_NAMES.map((name, index) => {
    const classification = pick(random, ["Official", "Protected", "Restricted"] as const);
    const referenceOrdinal = formatNetworkReferenceOrdinal(referenceBase + index + 1);
    return {
      id: `net-new-${index + 1}`,
      name,
      criticality: networkCriticalityForClassification(classification),
      adfPlatform: chance(random, 0.4),
      enterprisePlatform: chance(random, 0.35),
      modellingStatus: false,
      classification,
      diisId: `DIIS-NET-${referenceOrdinal}`,
      atoNumber: `ATO-NET-${referenceOrdinal}`,
      apmNumber: `APM-NET-${referenceOrdinal}`,
      discoveryStatus: "Discovery Non Enabled" as const,
      ictSystemIds: [],
      assetIds: []
    };
  });
  const disabledReferenceOrdinal = formatNetworkReferenceOrdinal(referenceBase + newNetworks.length + 1);
  const disabledReferenceNetwork: ManagedNetwork = {
    id: DISABLED_REFERENCE_NETWORK_ID,
    name: DISABLED_REFERENCE_NETWORK_NAME,
    description: DISABLED_REFERENCE_NETWORK_DESCRIPTION,
    criticality: "Non-Critical",
    adfPlatform: false,
    enterprisePlatform: false,
    modellingStatus: false,
    diisId: `DIIS-NET-${disabledReferenceOrdinal}`,
    atoNumber: `ATO-NET-${disabledReferenceOrdinal}`,
    apmNumber: `APM-NET-${disabledReferenceOrdinal}`,
    discoveryStatus: "Discovery Non Enabled",
    ictSystemIds: [],
    assetIds: []
  };

  return [...baselineNetworks, ...newNetworks, disabledReferenceNetwork];
}

function securityDomainForNetwork(network: ManagedNetwork): SecurityDomain {
  if (network.classification === "Protected") {
    return "Protected";
  }
  if (network.classification === "Restricted") {
    return "Secret";
  }
  return "Unclassified";
}

function buildSystems(random: Random, networks: ManagedNetwork[]): ICTSystem[] {
  const count = Math.max(MODELLED_SYSTEM_COUNT, 1);
  const systems: ICTSystem[] = [];

  for (let index = 0; index < count; index += 1) {
    const systemReferenceOrdinal = formatSystemReferenceOrdinal(index + 1);
    const network = networks[index % networks.length];
    const envTypes = pickMany(random, ENV_TYPES, randomInt(random, 1, 3));
    const environments: SystemEnvironment[] = [
      {
        id: `sys-${index + 1}-prod`,
        name: "Production",
        type: "Production",
        assetIds: []
      },
      ...envTypes.map((type) => ({
        id: `sys-${index + 1}-${type.toLowerCase()}`,
        name: type,
        type,
        assetIds: []
      }))
    ];

    const missionCapabilities: MissionCapability[] = pickMany(random, CAPABILITIES, randomInt(random, 1, 3)).map(
      (name) => ({
        id: `cap-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name,
        criticality: randomCriticality(random)
      })
    );

    const businessServices: BusinessService[] = pickMany(random, SERVICES, randomInt(random, 1, 3)).map((name) => ({
      id: `svc-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      criticality: randomCriticality(random)
    }));

    const hasHighDependency =
      missionCapabilities.some((capability) => capability.criticality === "Critical") ||
      businessServices.some((service) => service.criticality === "Critical");
    const criticality: SystemCriticality =
      hasHighDependency ? (chance(random, 0.8) ? "Critical" : "Non-Critical") : chance(random, 0.2) ? "Critical" : "Non-Critical";

    systems.push({
      id: `sys-${index + 1}`,
      name: SYSTEM_NAMES[index] ?? `Mission System ${index + 1}`,
      adfPlatform: chance(random, 0.35),
      enterprisePlatform: chance(random, 0.35),
      modellingStatus: true,
      diisDefined: true,
      diisId: `DIIS-SYS-${systemReferenceOrdinal}`,
      atoNumber: `ATO-SYS-${systemReferenceOrdinal}`,
      apmNumber: `APM-SYS-${systemReferenceOrdinal}`,
      networkId: network.id,
      criticality,
      securityDomain: pick(random, SECURITY_DOMAINS),
      missionCapabilities,
      businessServices,
      environments
    });

    network.ictSystemIds.push(`sys-${index + 1}`);
  }

  return systems;
}

function buildUnmodelledSystems(random: Random, startIndex: number, count: number): ICTSystem[] {
  return Array.from({ length: count }, (_, index) => {
    const systemNumber = startIndex + index + 1;
    const systemReferenceOrdinal = formatSystemReferenceOrdinal(systemNumber);
    return {
      id: `sys-${systemNumber}`,
      name: `Unmodelled ICT System ${String(index + 1).padStart(2, "0")}`,
      adfPlatform: chance(random, 0.2),
      enterprisePlatform: chance(random, 0.2),
      modellingStatus: false,
      diisDefined: true,
      diisId: `DIIS-SYS-${systemReferenceOrdinal}`,
      atoNumber: `ATO-SYS-${systemReferenceOrdinal}`,
      apmNumber: `APM-SYS-${systemReferenceOrdinal}`,
      networkId: "",
      criticality: "Non-Critical",
      securityDomain: "Unclassified",
      missionCapabilities: [],
      businessServices: [],
      environments: []
    };
  });
}

function assignSystemContext(
  random: Random,
  networkId: string,
  systems: ICTSystem[]
): { systemId: string; environmentType: EnvironmentType } | undefined {
  const matching = systems.filter((system) => system.networkId === networkId);
  if (!matching.length || !chance(random, 0.72)) {
    return undefined;
  }

  const system = pick(random, matching);
  const environments = system.environments;
  const production = environments.find((environment) => environment.type === "Production");
  const nonProd = environments.filter((environment) => environment.type !== "Production");

  if (production && chance(random, 0.55)) {
    return { systemId: system.id, environmentType: "Production" };
  }

  if (nonProd.length) {
    return { systemId: system.id, environmentType: pick(random, nonProd).type };
  }

  return production ? { systemId: system.id, environmentType: "Production" } : undefined;
}

function pickEnvironmentTypeForSystem(random: Random, system: ICTSystem): EnvironmentType {
  const production = system.environments.find((environment) => environment.type === "Production");
  const nonProduction = system.environments.filter((environment) => environment.type !== "Production");

  if (production && chance(random, 0.55)) {
    return "Production";
  }
  if (nonProduction.length) {
    return pick(random, nonProduction).type;
  }
  return "Production";
}

function buildServer(random: Random, index: number, networkId: string, versions: ReferenceVersions): ServerAsset {
  const id = `srv-${String(index + 1).padStart(4, "0")}`;
  return {
    id,
    name: `Server ${index + 1}`,
    hostname: `${id}.dct.local`,
    type: "server",
    networkId,
    securityDomain: "Unclassified",
    lifecycle: buildLifecycle(random),
    vulnerabilities: buildVulnerabilities(random, "server", id),
    operatingSystem: buildOperatingSystem(random, "server", versions),
    installedSoftware: buildSoftware(random, "server", versions)
  };
}

function buildWorkstation(
  random: Random,
  index: number,
  networkId: string,
  versions: ReferenceVersions
): WorkstationAsset {
  const id = `wks-${String(index + 1).padStart(4, "0")}`;
  return {
    id,
    name: `Workstation ${index + 1}`,
    hostname: `${id}.dct.local`,
    type: "workstation",
    networkId,
    securityDomain: "Unclassified",
    lifecycle: buildLifecycle(random),
    vulnerabilities: buildVulnerabilities(random, "workstation", id),
    operatingSystem: buildOperatingSystem(random, "workstation", versions),
    installedSoftware: buildSoftware(random, "workstation", versions)
  };
}

function buildDesktop(
  random: Random,
  index: number,
  networkId: string,
  versions: ReferenceVersions
): WorkstationAsset {
  const id = `dsk-${String(index + 1).padStart(5, "0")}`;
  return {
    id,
    name: `Desktop ${index + 1}`,
    hostname: `${id}.dct.local`,
    type: "workstation",
    networkId,
    securityDomain: "Unclassified",
    lifecycle: buildLifecycle(random),
    vulnerabilities: buildVulnerabilities(random, "workstation", id),
    operatingSystem: buildOperatingSystem(random, "workstation", versions),
    installedSoftware: buildSoftware(random, "workstation", versions)
  };
}

function buildDevice(
  random: Random,
  index: number,
  networkId: string,
  versions: ReferenceVersions
): NetworkDeviceAsset {
  const id = `netd-${String(index + 1).padStart(4, "0")}`;
  return {
    id,
    name: `${pick(random, DEVICE_NAMES)} Device ${index + 1}`,
    hostname: `${id}.dct.local`,
    type: "network-device",
    networkId,
    securityDomain: "Unclassified",
    lifecycle: buildLifecycle(random),
    vulnerabilities: buildVulnerabilities(random, "network-device", id),
    networkOs: buildOperatingSystem(random, "network-device", versions),
    patchState: chance(random, 0.04)
      ? null
      : {
          isLatest: chance(random, 0.05) ? null : chance(random, 0.74),
          lastPatchedDate: randomDateWithinDays(random, 240)
      }
  };
}

function buildStorageDevice(random: Random, index: number, networkId: string): StorageDeviceAsset {
  const id = `std-${String(index + 1).padStart(4, "0")}`;
  return {
    id,
    name: `${pick(random, STORAGE_DEVICE_NAMES)} Device ${index + 1}`,
    hostname: `${id}.dct.local`,
    type: "storage-device",
    networkId,
    securityDomain: "Unclassified",
    lifecycle: buildLifecycle(random),
    vulnerabilities: buildVulnerabilities(random, "storage-device", id)
  };
}

function buildPrinterDevice(random: Random, index: number, networkId: string): PrinterDeviceAsset {
  const id = `prd-${String(index + 1).padStart(4, "0")}`;
  return {
    id,
    name: `${pick(random, PRINTER_DEVICE_NAMES)} Printer ${index + 1}`,
    hostname: `${id}.dct.local`,
    type: "printer-device",
    networkId,
    securityDomain: "Unclassified",
    lifecycle: buildLifecycle(random),
    vulnerabilities: buildVulnerabilities(random, "printer-device", id)
  };
}

function buildOtherAsset(random: Random, index: number, networkId: string): OtherAsset {
  const id = `oth-${String(index + 1).padStart(4, "0")}`;
  return {
    id,
    name: `${pick(random, OTHER_DEVICE_NAMES)} Device ${index + 1}`,
    hostname: `${id}.dct.local`,
    type: "other",
    networkId,
    securityDomain: "Unclassified",
    lifecycle: buildLifecycle(random),
    vulnerabilities: buildVulnerabilities(random, "other", id)
  };
}

function ensureEnvironmentAssignments(random: Random, systems: ICTSystem[], assets: Asset[]) {
  const unassigned = assets.filter((asset) => asset.systemContext === undefined);

  for (const system of systems) {
    for (const environment of system.environments) {
      if (environment.assetIds.length >= 4) {
        continue;
      }

      const candidates = unassigned.filter((asset) => asset.networkId === system.networkId);
      const needed = 4 - environment.assetIds.length;
      const selected = pickMany(random, candidates, needed);
      for (const asset of selected) {
        asset.systemContext = {
          systemId: system.id,
          environmentType: environment.type
        };
      }
    }
  }
}

function syncRelationshipIndexes(networks: ManagedNetwork[], systems: ICTSystem[], assets: Asset[]) {
  for (const network of networks) {
    network.assetIds = [];
  }

  for (const system of systems) {
    for (const environment of system.environments) {
      environment.assetIds = [];
    }
  }

  const networkById = new Map(networks.map((network) => [network.id, network]));
  const systemById = new Map(systems.map((system) => [system.id, system]));

  for (const asset of assets) {
    networkById.get(asset.networkId)?.assetIds.push(asset.id);

    const systemId = asset.systemContext?.systemId;
    const envType = asset.systemContext?.environmentType;

    if (systemId && envType) {
      const system = systemById.get(systemId);
      const environment = system?.environments.find((item) => item.type === envType);
      environment?.assetIds.push(asset.id);
    }
  }

  for (const network of networks) {
    network.discoveryStatus = network.assetIds.length > 0 ? "Discovery Enabled" : "Discovery Non Enabled";
    network.modellingStatus = network.discoveryStatus !== "Discovery Non Enabled";
  }
}

function syncSecurityDomains(networks: ManagedNetwork[], systems: ICTSystem[], assets: Asset[]) {
  const networkById = new Map(networks.map((network) => [network.id, network]));
  const systemById = new Map(systems.map((system) => [system.id, system]));

  for (const asset of assets) {
    const systemId = asset.systemContext?.systemId;
    if (systemId) {
      const system = systemById.get(systemId);
      if (system) {
        asset.securityDomain = system.securityDomain;
        continue;
      }
    }

    const network = networkById.get(asset.networkId);
    if (network) {
      asset.securityDomain = securityDomainForNetwork(network);
    }
  }
}

function normalizeDerived(asset: Asset, versions: ReferenceVersions) {
  if (asset.type === "server" || asset.type === "workstation") {
    const operatingSystem = asset.operatingSystem;
    if (operatingSystem && operatingSystem.majorVersion !== null && operatingSystem.currentSupportedMajor !== null) {
      const gap = (operatingSystem.currentSupportedMajor ?? 0) - (operatingSystem.majorVersion ?? 0);
      operatingSystem.nMinus = gap;
      operatingSystem.supportStatus = supportFromGap(gap);
    }
  }

  if (asset.type === "network-device" && asset.networkOs && asset.networkOs.majorVersion !== null) {
    const networkOs = asset.networkOs;
    const key =
      networkOs.family.includes("Cisco")
        ? "ciscoIos"
        : networkOs.family.includes("Jun")
          ? "junos"
          : "fortios";
    const current = versions.osCurrentMajor[key];
    networkOs.currentSupportedMajor = current;
    const gap = current - (networkOs.majorVersion ?? current);
    networkOs.nMinus = gap;
    networkOs.supportStatus = supportFromGap(gap);
  }
}

function addCriticalVulnerability(asset: Asset, random: Random) {
  const vulnerability = buildVulnerabilityRecord(random, asset.id, asset.type, "Critical", "Qualys", 120);
  vulnerability.exploitability = pick(random, ["Known Exploited", "Exploitable"] as const);
  asset.vulnerabilities.push(vulnerability);
}

function forceOutOfSupportSoftware(asset: ServerAsset | WorkstationAsset) {
  if (!asset.installedSoftware.length) {
    asset.installedSoftware.push({
      name: "Legacy Middleware",
      version: "1.0",
      supportStatus: "OutOfSupport"
    });
    return;
  }

  asset.installedSoftware[0].supportStatus = "OutOfSupport";
}

function injectIssues(random: Random, assets: Asset[], versions: ReferenceVersions) {
  const servers = assets.filter((asset): asset is ServerAsset => asset.type === "server");
  const workstations = assets.filter((asset): asset is WorkstationAsset => asset.type === "workstation");
  const devices = assets.filter((asset): asset is NetworkDeviceAsset => asset.type === "network-device");

  const productionServers = servers.filter((asset) => asset.systemContext?.environmentType === "Production");
  const productionWorkstations = workstations.filter(
    (asset) => asset.systemContext?.environmentType === "Production"
  );
  const workstationIssueTargets = productionWorkstations.length ? productionWorkstations : workstations;

  pickMany(random, [...servers, ...workstations], 30).forEach((asset) => {
    if (asset.operatingSystem) {
      asset.operatingSystem.majorVersion = (asset.operatingSystem.currentSupportedMajor ?? 10) - randomInt(random, 3, 5);
      normalizeDerived(asset, versions);
    }
  });

  pickMany(random, servers, 24).forEach((server) => addCriticalVulnerability(server, random));
  pickMany(random, devices, 14).forEach((device) => addCriticalVulnerability(device, random));

  pickMany(random, productionServers, 12).forEach((server) => {
    addCriticalVulnerability(server, random);
    if (server.operatingSystem) {
      server.operatingSystem.majorVersion = (server.operatingSystem.currentSupportedMajor ?? 10) - randomInt(random, 3, 5);
      normalizeDerived(server, versions);
    }
  });

  pickMany(random, productionServers, 12).forEach((server) => {
    addCriticalVulnerability(server, random);
    forceOutOfSupportSoftware(server);
  });

  pickMany(random, workstationIssueTargets, 12).forEach((workstation) => {
    addCriticalVulnerability(workstation, random);
    forceOutOfSupportSoftware(workstation);
  });

  pickMany(random, devices, 20).forEach((device) => {
    if (!device.patchState) {
      device.patchState = {
        isLatest: false,
        lastPatchedDate: randomDateWithinDays(random, 300)
      };
    } else {
      device.patchState.isLatest = false;
      device.patchState.lastPatchedDate = randomDateWithinDays(random, 300);
    }
  });

  pickMany(random, assets, 34).forEach((asset) => {
    asset.lifecycle.eolStatus = chance(random, 0.55) ? "EOL" : asset.lifecycle.eolStatus;
    asset.lifecycle.warrantyStatus = "OutOfWarranty";
  });

  pickMany(random, assets, 20).forEach((asset) => {
    if (asset.type === "network-device") {
      if (chance(random, 0.5)) {
        asset.networkOs = null;
      } else if (asset.patchState) {
        asset.patchState.isLatest = null;
      } else {
        asset.patchState = null;
      }
      return;
    }

    if (asset.type === "server" || asset.type === "workstation") {
      if (chance(random, 0.6)) {
        asset.operatingSystem = null;
      } else {
        asset.lifecycle.eolStatus = "Unknown";
        asset.lifecycle.warrantyStatus = "Unknown";
      }
      return;
    }

    asset.lifecycle.eolStatus = "Unknown";
    asset.lifecycle.warrantyStatus = "Unknown";
  });
}

function randomObservedAt(random: Random, maxDaysAgo: number): string {
  const observedDate = randomDateWithinDays(random, maxDaysAgo);
  return randomTimestampForDate(random, observedDate);
}

function buildModelledServerAllocation(random: Random, systemCount: number, targetServerCount: number): number[] {
  if (systemCount <= 0) {
    throw new Error("Modelled server allocation requires at least one ICT system.");
  }
  if (targetServerCount < systemCount * MODELLED_SYSTEM_MIN_SERVERS) {
    throw new Error(
      `Insufficient modelled servers (${targetServerCount}) for ${systemCount} systems with minimum ${MODELLED_SYSTEM_MIN_SERVERS}.`
    );
  }

  const allocation = Array.from({ length: systemCount }, () => MODELLED_SYSTEM_MIN_SERVERS);
  let remaining = targetServerCount - systemCount * MODELLED_SYSTEM_MIN_SERVERS;

  const preferredCap = 49;
  while (remaining > 0) {
    const candidates = allocation
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value < preferredCap);
    if (!candidates.length) {
      break;
    }

    const selected = pick(random, candidates);
    allocation[selected.index] += 1;
    remaining -= 1;
  }

  while (remaining > 0) {
    const candidates = allocation
      .map((value, index) => ({ value, index }))
      .filter((entry) => entry.value < MODELLED_SYSTEM_MAX_SERVERS);
    if (!candidates.length) {
      throw new Error("Unable to distribute servers within ICT system max constraint.");
    }

    const selected = pick(random, candidates);
    allocation[selected.index] += 1;
    remaining -= 1;
  }

  return allocation;
}

function buildFlowDependencyTargets(random: Random, assetCount: number): number[] {
  if (assetCount <= 1) {
    return Array.from({ length: assetCount }, () => 0);
  }

  const result = Array.from({ length: assetCount }, () => 0);
  const shuffled = shuffledIndices(random, assetCount);
  const zeroCount = Math.floor(assetCount * 0.1);
  const highCount = Math.floor(assetCount * 0.7);
  const mediumCount = Math.floor(assetCount * 0.19);
  const burstCount = assetCount - zeroCount - highCount - mediumCount;

  let cursor = 0;
  for (let index = 0; index < zeroCount; index += 1) {
    result[shuffled[cursor]] = 0;
    cursor += 1;
  }

  for (let index = 0; index < highCount; index += 1) {
    result[shuffled[cursor]] = randomInt(random, 20, Math.min(50, assetCount - 1));
    cursor += 1;
  }

  for (let index = 0; index < mediumCount; index += 1) {
    result[shuffled[cursor]] = randomInt(random, 3, Math.min(19, assetCount - 1));
    cursor += 1;
  }

  for (let index = 0; index < burstCount; index += 1) {
    const lowerBound = Math.min(51, assetCount - 1);
    const upperBound = Math.min(150, assetCount - 1);
    result[shuffled[cursor]] = lowerBound > upperBound ? upperBound : randomInt(random, lowerBound, upperBound);
    cursor += 1;
  }

  return result;
}

function buildCiDependencies(random: Random, systems: ICTSystem[], assets: Asset[]): CiDependency[] {
  void systems;

  const dependencies: CiDependency[] = [];
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const allAssetIds = assets.map((asset) => asset.id);
  const flowTargetsBySource = buildFlowDependencyTargets(random, allAssetIds.length);
  let counter = 1;

  for (let sourceIndex = 0; sourceIndex < allAssetIds.length; sourceIndex += 1) {
    const sourceAssetId = allAssetIds[sourceIndex];
    const sourceAsset = assetById.get(sourceAssetId);
    if (!sourceAsset) {
      continue;
    }

    const desiredCount = Math.min(flowTargetsBySource[sourceIndex] ?? 0, Math.max(0, allAssetIds.length - 1));
    if (desiredCount <= 0) {
      continue;
    }

    const sameNetworkTargets = shuffledIndices(random, allAssetIds.length)
      .map((targetIndex) => allAssetIds[targetIndex])
      .filter((targetId) => {
        if (targetId === sourceAssetId) {
          return false;
        }
        const targetAsset = assetById.get(targetId);
        return targetAsset?.networkId === sourceAsset.networkId;
      });
    const crossNetworkTargets = shuffledIndices(random, allAssetIds.length)
      .map((targetIndex) => allAssetIds[targetIndex])
      .filter((targetId) => {
        if (targetId === sourceAssetId) {
          return false;
        }
        const targetAsset = assetById.get(targetId);
        return targetAsset?.networkId !== sourceAsset.networkId;
      });

    const orderedTargets = [...sameNetworkTargets, ...crossNetworkTargets];
    const seenTargets = new Set<string>();

    for (const targetAssetId of orderedTargets) {
      if (seenTargets.has(targetAssetId)) {
        continue;
      }

      seenTargets.add(targetAssetId);
      dependencies.push({
        id: `dep-${String(counter).padStart(6, "0")}`,
        sourceAssetId,
        targetAssetId,
        dependencyType: "Flow Dependency",
        protocol: pick(random, ["TCP", "UDP"] as const),
        sourcePort: randomInt(random, 49152, 65535),
        targetPort: pick(random, [22, 53, 80, 443, 1433, 1521, 3389, 5432, 8443]),
        observationMethod: "Synthetic network telemetry",
        observedAt: randomObservedAt(random, 90)
      });
      counter += 1;

      if (seenTargets.size >= desiredCount) {
        break;
      }
    }
  }

  return dependencies;
}

function cloneDataset(dataset: Dataset): Dataset {
  return JSON.parse(JSON.stringify(dataset)) as Dataset;
}

function perturbSnapshot(dataset: Dataset, weeksAgo: number, random: Random, versions: ReferenceVersions) {
  const factor = weeksAgo / 7;

  for (const asset of dataset.assets) {
    if (chance(random, 0.08 + factor * 0.08)) {
      addCriticalVulnerability(asset, random);
    }

    if ((asset.type === "server" || asset.type === "workstation") && asset.operatingSystem) {
      if (chance(random, 0.05 + factor * 0.08)) {
        asset.operatingSystem.majorVersion = (asset.operatingSystem.majorVersion ?? 1) - 1;
        normalizeDerived(asset, versions);
      }

      if (chance(random, 0.05 + factor * 0.04) && asset.installedSoftware.length) {
        const target = pick(random, asset.installedSoftware);
        target.supportStatus = "OutOfSupport";
      }
    }

    if (asset.type === "network-device") {
      if (!asset.patchState && chance(random, 0.35)) {
        asset.patchState = {
          isLatest: false,
          lastPatchedDate: randomDateWithinDays(random, 300)
        };
      }

      if (asset.patchState && chance(random, 0.16 + factor * 0.1)) {
        asset.patchState.isLatest = false;
      }
    }

    if (chance(random, 0.03)) {
      asset.vulnerabilities = asset.vulnerabilities.filter((vulnerability) => vulnerability.severity !== "Critical");
    }

    if (asset.type === "network-device" && asset.patchState && chance(random, 0.04)) {
      asset.patchState.isLatest = true;
    }
  }
}

function offsetWeeks(weeksAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - weeksAgo * 7);
  return date.toISOString().slice(0, 10);
}

function parseSeed(): number {
  const seedArg = process.argv.find((arg) => arg.startsWith("--seed="));
  if (!seedArg) {
    return 424242;
  }

  const parsed = Number(seedArg.replace("--seed=", ""));
  if (Number.isNaN(parsed)) {
    return 424242;
  }
  return parsed;
}

let buildAnalyticsFn:
  | ((dataset: Dataset, systems: ICTSystem[]) => { findings: NonNullable<Dataset["findings"]> })
  | undefined;

async function attachFindings(dataset: Dataset): Promise<Dataset> {
  if (!buildAnalyticsFn) {
    const imported = (await import("../lib/analytics")) as { default?: typeof import("../lib/analytics") } & typeof import("../lib/analytics");
    const analyticsModule = (imported.default ?? imported) as typeof import("../lib/analytics");
    buildAnalyticsFn = analyticsModule.buildAnalytics as NonNullable<typeof buildAnalyticsFn>;
  }

  const analytics = buildAnalyticsFn(dataset, dataset.ictSystems);
  return {
    ...dataset,
    findings: analytics.findings
  };
}

async function main() {
  const seed = parseSeed();
  const random = createRandom(seed);
  const versions = generateVersions();

  const networks = buildNetworks(random);
  const provisionedNetworks = networks.filter(
    (network) => !network.id.startsWith("net-new-") && network.id !== DISABLED_REFERENCE_NETWORK_ID
  );
  const assetAssignableNetworks = networks.filter((network) => network.id !== DISABLED_REFERENCE_NETWORK_ID);
  const modelledSystems = buildSystems(random, provisionedNetworks);

  if (
    SERVER_COUNT +
      WORKSTATION_COUNT +
      NETWORK_DEVICE_COUNT +
      STORAGE_DEVICE_COUNT +
      PRINTER_DEVICE_COUNT +
      OTHER_ASSET_COUNT !==
    TOTAL_ASSET_COUNT
  ) {
    throw new Error(
      `Asset count mismatch: expected ${TOTAL_ASSET_COUNT} but configured ${
        SERVER_COUNT +
        WORKSTATION_COUNT +
        NETWORK_DEVICE_COUNT +
        STORAGE_DEVICE_COUNT +
        PRINTER_DEVICE_COUNT +
        OTHER_ASSET_COUNT
      }.`
    );
  }

  const assets: Asset[] = [];

  for (let serverIndex = 0; serverIndex < SERVER_COUNT; serverIndex += 1) {
    const networkId = pick(random, assetAssignableNetworks).id;
    assets.push(buildServer(random, serverIndex, networkId, versions));
  }

  for (let workstationIndex = 0; workstationIndex < WORKSTATION_COUNT; workstationIndex += 1) {
    const networkId = pick(random, assetAssignableNetworks).id;
    assets.push(buildWorkstation(random, workstationIndex, networkId, versions));
  }

  for (let deviceIndex = 0; deviceIndex < NETWORK_DEVICE_COUNT; deviceIndex += 1) {
    const networkId = pick(random, assetAssignableNetworks).id;
    assets.push(buildDevice(random, deviceIndex, networkId, versions));
  }

  for (let storageIndex = 0; storageIndex < STORAGE_DEVICE_COUNT; storageIndex += 1) {
    const networkId = pick(random, assetAssignableNetworks).id;
    assets.push(buildStorageDevice(random, storageIndex, networkId));
  }

  for (let printerIndex = 0; printerIndex < PRINTER_DEVICE_COUNT; printerIndex += 1) {
    const networkId = pick(random, assetAssignableNetworks).id;
    assets.push(buildPrinterDevice(random, printerIndex, networkId));
  }

  for (let otherIndex = 0; otherIndex < OTHER_ASSET_COUNT; otherIndex += 1) {
    const networkId = pick(random, assetAssignableNetworks).id;
    assets.push(buildOtherAsset(random, otherIndex, networkId));
  }

  const targetModelledAssetCount = Math.round(TOTAL_ASSET_COUNT * MODELLED_ASSET_RATIO);
  const servers = assets.filter((asset): asset is ServerAsset => asset.type === "server");
  const targetModelledServerCount = Math.min(targetModelledAssetCount, servers.length);
  const modelledServerAllocation = buildModelledServerAllocation(
    random,
    modelledSystems.length,
    targetModelledServerCount
  );
  const selectedModelledServers = pickMany(random, servers, targetModelledServerCount);

  let allocationCursor = 0;
  for (let systemIndex = 0; systemIndex < modelledSystems.length; systemIndex += 1) {
    const system = modelledSystems[systemIndex];
    const serverCountForSystem = modelledServerAllocation[systemIndex] ?? 0;
    for (let assigned = 0; assigned < serverCountForSystem; assigned += 1) {
      const server = selectedModelledServers[allocationCursor];
      if (!server) {
        break;
      }
      server.networkId = system.networkId;
      server.systemContext = {
        systemId: system.id,
        environmentType: pickEnvironmentTypeForSystem(random, system)
      };
      allocationCursor += 1;
    }
  }

  const modelledServerIds = new Set(selectedModelledServers.map((server) => server.id));
  for (const server of servers) {
    if (!modelledServerIds.has(server.id)) {
      server.systemContext = undefined;
    }
  }

  syncRelationshipIndexes(networks, modelledSystems, assets);
  assignNetworkTargetStateAssets(random, networks, assets);
  syncSecurityDomains(networks, modelledSystems, assets);
  injectIssues(random, assets, versions);

  const systems = [...modelledSystems, ...buildUnmodelledSystems(random, modelledSystems.length, UNMODELLED_SYSTEM_COUNT)];
  const ciDependencies = buildCiDependencies(random, systems, assets);

  const currentDataset: Dataset = {
    generatedAt: new Date().toISOString(),
    snapshotDate: offsetWeeks(0),
    spiEvaluations: [],
    managedNetworks: networks,
    ictSystems: systems,
    assets,
    ciDependencies
  };

  const snapshots: Dataset[] = [];
  for (let week = 7; week >= 0; week -= 1) {
    const snapshotRandom = createRandom(seed + week * 1000 + 7);
    const snapshot = cloneDataset(currentDataset);
    snapshot.snapshotDate = offsetWeeks(week);
    if (week > 0) {
      perturbSnapshot(snapshot, week, snapshotRandom, versions);
    }
    snapshots.push(snapshot);
  }

  const currentDatasetWithFindings = await attachFindings(currentDataset);
  const snapshotsWithFindings = await Promise.all(snapshots.map((snapshot) => attachFindings(snapshot)));

  const dataDir = path.join(process.cwd(), "data");
  await fs.mkdir(path.join(dataDir, "snapshots"), { recursive: true });
  await fs.mkdir(path.join(dataDir, "reference"), { recursive: true });

  await fs.writeFile(path.join(dataDir, "current.json"), JSON.stringify(currentDatasetWithFindings, null, 2));
  await fs.writeFile(path.join(dataDir, "reference", "versions.json"), JSON.stringify(versions, null, 2));

  await Promise.all(
    snapshotsWithFindings.map((snapshot, index) =>
      fs.writeFile(
        path.join(dataDir, "snapshots", `week-${String(index + 1).padStart(2, "0")}.json`),
        JSON.stringify(snapshot, null, 2)
      )
    )
  );

  console.log(
    `Seed generated with ${networks.length} networks, ${systems.length} systems, ${assets.length} assets and ${snapshots.length} snapshots.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
