import { promises as fs } from "fs";
import path from "path";
import {
  Asset,
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
  SystemCriticality,
  SupportStatus,
  SystemEnvironment,
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

const ENV_TYPES: EnvironmentType[] = ["Development", "UAT", "Test"];
const SECURITY_DOMAINS: SecurityDomain[] = ["Secret", "Protected", "Unclassified"];

const SERVER_COUNT = 2000;
const WORKSTATION_COUNT = 2000;
const DESKTOP_COUNT = 10000;
const NETWORK_DEVICE_COUNT = 8000;

type AssetProfile = "server" | "workstation" | "network-device";

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

function buildNetworks(random: Random): ManagedNetwork[] {
  const count = randomInt(random, 4, 6);
  const baselineNetworks = NETWORK_NAMES.slice(0, count).map((name, index) => {
    const classification = pick(random, ["Official", "Protected", "Restricted"] as const);
    return {
      id: `net-${index + 1}`,
      name,
      criticality: networkCriticalityForClassification(classification),
      classification,
      discoveryStatus: "Discovery Non Enabled" as const,
      ictSystemIds: [],
      assetIds: []
    };
  });
  const newNetworks = NEW_DEFENCE_NETWORK_NAMES.map((name, index) => {
    const classification = pick(random, ["Official", "Protected", "Restricted"] as const);
    return {
      id: `net-new-${index + 1}`,
      name,
      criticality: networkCriticalityForClassification(classification),
      classification,
      discoveryStatus: "Discovery Non Enabled" as const,
      ictSystemIds: [],
      assetIds: []
    };
  });

  return [...baselineNetworks, ...newNetworks];
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
  const count = randomInt(random, 10, 15);
  const systems: ICTSystem[] = [];

  for (let index = 0; index < count; index += 1) {
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
      name: SYSTEM_NAMES[index],
      modellingStatus: true,
      diisDefined: true,
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

function buildUnmodelledSystems(startIndex: number, count: number): ICTSystem[] {
  return Array.from({ length: count }, (_, index) => {
    const systemNumber = startIndex + index + 1;
    return {
      id: `sys-${systemNumber}`,
      name: `Unmodelled ICT System ${String(index + 1).padStart(2, "0")}`,
      modellingStatus: false,
      diisDefined: true,
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

function buildServer(random: Random, index: number, networkId: string, systems: ICTSystem[], versions: ReferenceVersions): ServerAsset {
  const id = `srv-${String(index + 1).padStart(4, "0")}`;
  return {
    id,
    name: `Server ${index + 1}`,
    hostname: `${id}.dct.local`,
    type: "server",
    networkId,
    securityDomain: "Unclassified",
    systemContext: assignSystemContext(random, networkId, systems),
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
  systems: ICTSystem[],
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
    systemContext: assignSystemContext(random, networkId, systems),
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
  systems: ICTSystem[],
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
    systemContext: assignSystemContext(random, networkId, systems),
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
  systems: ICTSystem[],
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
    systemContext: chance(random, 0.35) ? assignSystemContext(random, networkId, systems) : undefined,
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

  pickMany(random, productionWorkstations, 12).forEach((workstation) => {
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
    } else if (chance(random, 0.6)) {
      asset.operatingSystem = null;
    } else {
      asset.lifecycle.eolStatus = "Unknown";
      asset.lifecycle.warrantyStatus = "Unknown";
    }
  });
}

function randomObservedAt(random: Random, maxDaysAgo: number): string {
  const observedDate = randomDateWithinDays(random, maxDaysAgo);
  return randomTimestampForDate(random, observedDate);
}

function buildCiDependencies(random: Random, systems: ICTSystem[], assets: Asset[]): CiDependency[] {
  const dependencies: CiDependency[] = [];
  const seen = new Set<string>();
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const systemById = new Map(systems.map((system) => [system.id, system]));
  let counter = 1;

  const addDependency = (
    sourceAssetId: string | undefined,
    targetAssetId: string | undefined,
    dependencyType: CiDependency["dependencyType"]
  ) => {
    if (!sourceAssetId || !targetAssetId || sourceAssetId === targetAssetId) {
      return;
    }
    if (!assetById.has(sourceAssetId) || !assetById.has(targetAssetId)) {
      return;
    }
    const dedupeKey = `${sourceAssetId}->${targetAssetId}:${dependencyType}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    const base: CiDependency = {
      id: `dep-${String(counter).padStart(6, "0")}`,
      sourceAssetId,
      targetAssetId,
      dependencyType
    };
    counter += 1;

    if (dependencyType === "Flow Dependency") {
      dependencies.push({
        ...base,
        protocol: "TCP",
        sourcePort: randomInt(random, 49152, 65535),
        targetPort: pick(random, [22, 443, 8443, 1433, 1521, 5432]),
        observationMethod: "Synthetic network telemetry",
        observedAt: randomObservedAt(random, 60)
      });
      return;
    }

    dependencies.push({
      ...base,
      observationMethod: "Model relationship mapping",
      observedAt: randomObservedAt(random, 120)
    });
  };

  const modelledSystems = systems.filter((system) => system.modellingStatus);
  const modelledAssetIds = assets
    .filter((asset) => {
      const ownerSystemId = asset.systemContext?.systemId;
      if (!ownerSystemId) {
        return false;
      }
      const ownerSystem = systemById.get(ownerSystemId);
      return ownerSystem?.modellingStatus === true;
    })
    .map((asset) => asset.id);

  const unmodelledAssetIds = assets
    .filter((asset) => {
      const ownerSystemId = asset.systemContext?.systemId;
      if (!ownerSystemId) {
        return true;
      }
      const ownerSystem = systemById.get(ownerSystemId);
      return ownerSystem?.modellingStatus !== true;
    })
    .map((asset) => asset.id);

  for (const system of modelledSystems) {
    for (const environment of system.environments) {
      const envAssets = environment.assetIds.filter((assetId) => assetById.has(assetId));
      const envSlice = envAssets.slice(0, 10);

      for (let index = 0; index < envSlice.length - 1 && index < 5; index += 1) {
        addDependency(envSlice[index], envSlice[index + 1], "Logical Dependency");
      }

      const flowSource = envSlice.find((assetId) => {
        const asset = assetById.get(assetId);
        return asset?.type === "server" || asset?.type === "workstation";
      });
      const flowTarget = envSlice.find((assetId) => {
        const asset = assetById.get(assetId);
        return asset?.type === "network-device";
      });
      addDependency(flowSource, flowTarget, "Flow Dependency");
    }
  }

  const modelledSystemsByNetwork = new Map<string, ICTSystem[]>();
  for (const system of modelledSystems) {
    const current = modelledSystemsByNetwork.get(system.networkId) ?? [];
    current.push(system);
    modelledSystemsByNetwork.set(system.networkId, current);
  }

  for (const systemsInNetwork of modelledSystemsByNetwork.values()) {
    const ordered = [...systemsInNetwork].sort((left, right) => left.id.localeCompare(right.id));
    const representativeAssetIds = ordered
      .map((system) =>
        assets
          .filter((asset) => asset.systemContext?.systemId === system.id)
          .sort((left, right) => left.id.localeCompare(right.id))[0]?.id
      )
      .filter((assetId): assetId is string => Boolean(assetId));

    for (let index = 0; index < representativeAssetIds.length - 1; index += 1) {
      addDependency(representativeAssetIds[index], representativeAssetIds[index + 1], "Flow Dependency");
    }
  }

  const pairCount = Math.min(180, modelledAssetIds.length, unmodelledAssetIds.length);
  const modelledSelection = pickMany(random, modelledAssetIds, pairCount);
  const unmodelledSelection = pickMany(random, unmodelledAssetIds, pairCount);
  for (let index = 0; index < pairCount; index += 1) {
    addDependency(modelledSelection[index], unmodelledSelection[index], "Logical Dependency");
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
  const provisionedNetworks = networks.filter((network) => !network.id.startsWith("net-new-"));
  const modelledSystems = buildSystems(random, provisionedNetworks);

  const assets: Asset[] = [];
  const serverChunksBySystem = buildChunkAllocation(random, SERVER_COUNT, modelledSystems.length, 50, 250);
  const workstationChunksBySystem = buildChunkAllocation(random, WORKSTATION_COUNT, modelledSystems.length, 20, 140);
  const desktopChunksBySystem = buildChunkAllocation(random, DESKTOP_COUNT, modelledSystems.length, 80, 900);
  const deviceChunksByNetwork = buildChunkAllocation(random, NETWORK_DEVICE_COUNT, provisionedNetworks.length, 500, 3000);

  let serverIndex = 0;
  for (let systemIndex = 0; systemIndex < modelledSystems.length; systemIndex += 1) {
    const system = modelledSystems[systemIndex];
    const chunkSize = serverChunksBySystem[systemIndex] ?? 0;
    for (let chunkIndex = 0; chunkIndex < chunkSize; chunkIndex += 1) {
      const server = buildServer(random, serverIndex, system.networkId, modelledSystems, versions);
      server.systemContext = {
        systemId: system.id,
        environmentType: pickEnvironmentTypeForSystem(random, system)
      };
      assets.push(server);
      serverIndex += 1;
    }
  }

  let workstationIndex = 0;
  for (let systemIndex = 0; systemIndex < modelledSystems.length; systemIndex += 1) {
    const system = modelledSystems[systemIndex];
    const chunkSize = workstationChunksBySystem[systemIndex] ?? 0;
    for (let chunkIndex = 0; chunkIndex < chunkSize; chunkIndex += 1) {
      const workstation = buildWorkstation(random, workstationIndex, system.networkId, modelledSystems, versions);
      workstation.systemContext = {
        systemId: system.id,
        environmentType: pickEnvironmentTypeForSystem(random, system)
      };
      assets.push(workstation);
      workstationIndex += 1;
    }
  }

  let desktopIndex = 0;
  for (let systemIndex = 0; systemIndex < modelledSystems.length; systemIndex += 1) {
    const system = modelledSystems[systemIndex];
    const chunkSize = desktopChunksBySystem[systemIndex] ?? 0;
    for (let chunkIndex = 0; chunkIndex < chunkSize; chunkIndex += 1) {
      const desktop = buildDesktop(random, desktopIndex, system.networkId, modelledSystems, versions);
      desktop.systemContext = {
        systemId: system.id,
        environmentType: pickEnvironmentTypeForSystem(random, system)
      };
      assets.push(desktop);
      desktopIndex += 1;
    }
  }

  let deviceIndex = 0;
  for (let networkIndex = 0; networkIndex < provisionedNetworks.length; networkIndex += 1) {
    const network = provisionedNetworks[networkIndex];
    const chunkSize = deviceChunksByNetwork[networkIndex] ?? 0;
    for (let chunkIndex = 0; chunkIndex < chunkSize; chunkIndex += 1) {
      assets.push(buildDevice(random, deviceIndex, network.id, modelledSystems, versions));
      deviceIndex += 1;
    }
  }

  ensureEnvironmentAssignments(random, modelledSystems, assets);
  syncRelationshipIndexes(networks, modelledSystems, assets);
  syncSecurityDomains(networks, modelledSystems, assets);
  injectIssues(random, assets, versions);

  const systems = [...modelledSystems, ...buildUnmodelledSystems(modelledSystems.length, UNMODELLED_SYSTEM_COUNT)];
  const ciDependencies = buildCiDependencies(random, systems, assets);

  const currentDataset: Dataset = {
    generatedAt: new Date().toISOString(),
    snapshotDate: offsetWeeks(0),
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
