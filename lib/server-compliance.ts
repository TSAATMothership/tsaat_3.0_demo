import { assetTypeLabel } from "@/lib/asset-taxonomy";
import type { DiscoveryToolsSettings } from "@/lib/discovery-tools-settings";
import type { SpiDefinition } from "@/lib/spi-definitions";
import type {
  Asset,
  ComplianceStatus,
  Dataset,
  DiscoveryCoverageValue,
  Finding,
  FindingWorkflowStatus,
  SpiEvaluation
} from "@/lib/types";

export interface AssetComplianceAssetSummary {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  assetType: Asset["type"];
  assetTypeLabel: string;
  environmentType: string;
  systemName: string;
  networkName: string;
  securityDomain: string;
}

export interface AssetComplianceEvidenceItem {
  key: string;
  value: string;
}

export interface AssetComplianceOpenFinding {
  id: string;
  title: string;
  severity: string;
  status: FindingWorkflowStatus;
  recommendedAction: string;
}

export interface AssetComplianceFinding extends AssetComplianceOpenFinding {
  assetId: string;
  assetName: string;
  assetType: string;
  assetIpAddress: string;
  assetChangeAssignmentGroup: string;
  assetIncidentAssignmentGroup: string;
  owner: string;
  spiId: number;
  priorityRank: number;
  timestamp: string;
  timestampLabel: string;
  closedTimestamp: string | null;
  closedTimestampLabel: string | null;
  measureLabel: string;
  complianceStatus: ComplianceStatus;
  evaluationStatus: ComplianceStatus;
  scope: Finding["scope"];
  scopeLabel: string;
  evidencePreview: string;
  evidence: AssetComplianceEvidenceItem[];
}

export interface AssetComplianceMeasure {
  spiId: number;
  label: string;
  status: ComplianceStatus;
  total: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  score: number;
  impactedAssets: number;
  topReasons: string[];
  reasons: string[];
  evidence: AssetComplianceEvidenceItem[];
  findings: AssetComplianceFinding[];
  openFindings: AssetComplianceFinding[];
}

export interface AssetComplianceOverview {
  score: number;
  total: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  openFindingCount: number;
  measures: AssetComplianceMeasure[];
  findings: AssetComplianceFinding[];
}

export type AssetDiscoveryComplianceToolStatus = "Covered" | "Missing" | "Not available";

export interface AssetDiscoveryComplianceTool {
  id: string;
  name: string;
  description: string;
  el2Owner: string;
  el2OperationsManager: string;
  value: DiscoveryCoverageValue;
  status: AssetDiscoveryComplianceToolStatus;
}

export interface AssetDiscoveryCompliance {
  score: number;
  coverageCompliance: boolean;
  covered: number;
  missing: number;
  notAvailable: number;
  total: number;
  tools: AssetDiscoveryComplianceTool[];
}

export interface AssetComplianceModel {
  snapshotDate: string;
  asset: AssetComplianceAssetSummary;
  complianceOverview: AssetComplianceOverview;
  discoveryCompliance: AssetDiscoveryCompliance;
}

export interface BuildAssetComplianceModelOptions {
  dataset: Dataset;
  assetId: string;
  spiDefinitions: SpiDefinition[];
  discoveryToolsSettings: DiscoveryToolsSettings;
  preferredSystemId?: string | null;
}

export type ServerComplianceAssetSummary = AssetComplianceAssetSummary;
export type ServerComplianceEvidenceItem = AssetComplianceEvidenceItem;
export type ServerComplianceOpenFinding = AssetComplianceOpenFinding;
export type ServerComplianceFinding = AssetComplianceFinding;
export type ServerComplianceMeasure = AssetComplianceMeasure;
export type ServerComplianceOverview = AssetComplianceOverview;
export type ServerDiscoveryComplianceToolStatus = AssetDiscoveryComplianceToolStatus;
export type ServerDiscoveryComplianceTool = AssetDiscoveryComplianceTool;
export type ServerDiscoveryCompliance = AssetDiscoveryCompliance;
export type ServerComplianceModel = AssetComplianceModel;
export type BuildServerComplianceModelOptions = BuildAssetComplianceModelOptions;

interface AssetSystemMembership {
  systemId: string;
  systemName: string;
  environmentType: string;
}

function displayText(value: string | null | undefined, fallback = "N/A"): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

function resolveAssetIpAddress(asset: Asset): string {
  const candidate = asset as Asset & {
    ipAddress?: string | null;
    ip?: string | null;
    ipv4?: string | null;
    ipv4Address?: string | null;
    primaryIp?: string | null;
  };
  return displayText(
    candidate.ipAddress ?? candidate.ip ?? candidate.ipv4 ?? candidate.ipv4Address ?? candidate.primaryIp
  );
}

function resolveAssetSystemMembership(
  dataset: Dataset,
  asset: Asset,
  preferredSystemId?: string | null
): AssetSystemMembership | null {
  const memberships: AssetSystemMembership[] = [];
  for (const system of dataset.ictSystems) {
    for (const environment of system.environments) {
      if (!environment.assetIds.includes(asset.id)) {
        continue;
      }
      memberships.push({
        systemId: system.id,
        systemName: system.name,
        environmentType: environment.type
      });
    }
  }

  const preferredMembership = preferredSystemId
    ? memberships.find((membership) => membership.systemId === preferredSystemId)
    : null;
  if (preferredMembership) {
    return preferredMembership;
  }

  if (asset.systemContext) {
    const contextMembership = memberships.find(
      (membership) =>
        membership.systemId === asset.systemContext?.systemId &&
        membership.environmentType === asset.systemContext.environmentType
    );
    if (contextMembership) {
      return contextMembership;
    }
    const contextSystem = dataset.ictSystems.find((system) => system.id === asset.systemContext?.systemId);
    if (contextSystem) {
      return {
        systemId: contextSystem.id,
        systemName: contextSystem.name,
        environmentType: asset.systemContext.environmentType
      };
    }
  }

  return (
    memberships.sort(
      (left, right) =>
        left.systemName.localeCompare(right.systemName) ||
        left.environmentType.localeCompare(right.environmentType) ||
        left.systemId.localeCompare(right.systemId)
    )[0] ?? null
  );
}

function evidenceValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "N/A";
  }
  if (typeof value === "string") {
    return value.trim() || "N/A";
  }
  return String(value);
}

function evidenceItems(evidence: Record<string, string | number | boolean | null>): AssetComplianceEvidenceItem[] {
  return Object.entries(evidence)
    .map(([key, value]) => ({ key, value: evidenceValue(value) }))
    .sort((left, right) => left.key.localeCompare(right.key) || left.value.localeCompare(right.value));
}

function sortedFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((left, right) => {
    if (left.priorityRank !== right.priorityRank) {
      return left.priorityRank - right.priorityRank;
    }
    const timestampDelta = new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
    return timestampDelta || left.id.localeCompare(right.id);
  });
}

function uniqueTextValues(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function aggregateComplianceStatus(evaluations: SpiEvaluation[]): ComplianceStatus {
  if (evaluations.some((evaluation) => evaluation.status === "Non-compliant")) {
    return "Non-compliant";
  }
  if (evaluations.some((evaluation) => evaluation.status === "Unknown")) {
    return "Unknown";
  }
  return evaluations.length ? "Compliant" : "Unknown";
}

function aggregateEvidenceItems(
  evaluations: SpiEvaluation[],
  findings: Finding[]
): AssetComplianceEvidenceItem[] {
  const entries = evaluations.flatMap((evaluation) => evidenceItems(evaluation.evidence));
  if (entries.length) {
    const uniqueEntries = new Map(entries.map((entry) => [`${entry.key}\u0000${entry.value}`, entry]));
    return Array.from(uniqueEntries.values()).sort(
      (left, right) => left.key.localeCompare(right.key) || left.value.localeCompare(right.value)
    );
  }
  for (const finding of findings) {
    const findingEvidence = evidenceItems(finding.evidence);
    if (findingEvidence.length) {
      return findingEvidence;
    }
  }
  const reasons = uniqueTextValues(evaluations.flatMap((evaluation) => evaluation.reasons));
  if (reasons.length) {
    return reasons.map((reason, index) => ({
      key: index === 0 ? "reason" : `reason ${index + 1}`,
      value: reason
    }));
  }
  if (evaluations.length) {
    return [{ key: "evaluationStatus", value: aggregateComplianceStatus(evaluations) }];
  }
  return [];
}

function complianceScore(compliant: number, total: number): number {
  if (!total) {
    return 0;
  }
  return Number(((compliant / total) * 100).toFixed(1));
}

function discoveryToolStatus(value: DiscoveryCoverageValue): AssetDiscoveryComplianceToolStatus {
  if (value === 1) {
    return "Covered";
  }
  if (value === 0) {
    return "Missing";
  }
  return "Not available";
}

function spiMeasureLabel(definition: SpiDefinition | undefined, spiId: number): string {
  const description = definition?.description?.trim();
  const name = definition?.name?.trim();
  return `SPI ${spiId} - ${description || name || "Unmapped SPI"}`;
}

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return `${parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  })} UTC`;
}

function readEvidenceStringValue(
  evidence: Record<string, string | number | boolean | null>,
  candidateKeys: string[]
): string | null {
  const entries = Object.entries(evidence).map(([key, value]) => [key.toLowerCase(), value] as const);
  for (const candidateKey of candidateKeys) {
    const match = entries.find(([key]) => key === candidateKey.toLowerCase());
    if (!match || match[1] === null) {
      continue;
    }
    const value = String(match[1]).trim();
    if (value && value.toLowerCase() !== "null" && value.toLowerCase() !== "undefined") {
      return value;
    }
  }
  return null;
}

function findingEvidence(
  finding: Finding,
  evaluations: SpiEvaluation[]
): AssetComplianceEvidenceItem[] {
  const storedEvidence = evidenceItems(finding.evidence);
  if (storedEvidence.length) {
    return storedEvidence;
  }
  return aggregateEvidenceItems(evaluations, []);
}

export function buildAssetComplianceModel({
  dataset,
  assetId,
  spiDefinitions,
  discoveryToolsSettings,
  preferredSystemId
}: BuildAssetComplianceModelOptions): AssetComplianceModel | null {
  const normalizedAssetId = assetId.trim();
  const asset = dataset.assets.find((candidate) => candidate.id === normalizedAssetId);
  if (!asset) {
    return null;
  }

  const definitionBySpiId = new Map(spiDefinitions.map((definition) => [definition.spiId, definition]));
  const selectedEvaluations = dataset.spiEvaluations.filter((evaluation) => evaluation.assetId === asset.id);
  const evaluationsBySpiId = new Map<number, SpiEvaluation[]>();
  for (const evaluation of selectedEvaluations) {
    const existing = evaluationsBySpiId.get(evaluation.spiId) ?? [];
    existing.push(evaluation);
    evaluationsBySpiId.set(evaluation.spiId, existing);
  }

  const membership = resolveAssetSystemMembership(dataset, asset, preferredSystemId);
  const network = dataset.managedNetworks.find((candidate) => candidate.id === asset.networkId);
  const defaultSystem = dataset.ictSystems.find((system) => system.id === membership?.systemId);
  const rawAssetFindings = sortedFindings(
    (dataset.findings ?? []).filter((finding) => finding.scope.assetId === asset.id)
  );
  const findingRows = rawAssetFindings.map<AssetComplianceFinding>((finding) => {
    const evaluations = evaluationsBySpiId.get(finding.spiId) ?? [];
    const evidence = findingEvidence(finding, evaluations);
    const scopedSystem =
      dataset.ictSystems.find((system) => system.id === finding.scope.systemId) ?? defaultSystem;
    const assetName =
      readEvidenceStringValue(finding.evidence, ["assetName", "asset_name"]) ??
      displayText(asset.name, asset.hostname || asset.id);
    const assetIpAddress =
      readEvidenceStringValue(finding.evidence, [
        "assetIpAddress",
        "assetIp",
        "ipAddress",
        "ip",
        "ipv4Address",
        "ipv4",
        "ip_address"
      ]) ?? resolveAssetIpAddress(asset);
    const closedTimestamp = finding.closedTimestamp ?? null;
    const measureLabel = spiMeasureLabel(definitionBySpiId.get(finding.spiId), finding.spiId);
    const scopedSystemId = finding.scope.systemId ?? membership?.systemId ?? null;
    const scopedEnvironmentType = finding.scope.environmentType ?? membership?.environmentType ?? null;
    return {
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      recommendedAction: finding.recommendedAction,
      assetId: asset.id,
      assetName,
      assetType: assetTypeLabel(asset.type),
      assetIpAddress,
      assetChangeAssignmentGroup:
        readEvidenceStringValue(finding.evidence, [
          "assetChangeAssignmentGroup",
          "changeAssignmentGroup",
          "changeGroup",
          "change_assignment_group"
        ]) ?? "Not assigned",
      assetIncidentAssignmentGroup:
        readEvidenceStringValue(finding.evidence, [
          "assetIncidentAssignmentGroup",
          "incidentAssignmentGroup",
          "incidentGroup",
          "incident_assignment_group"
        ]) ?? "Not assigned",
      owner:
        readEvidenceStringValue(finding.evidence, ["assetOwner", "owner", "serviceOwner"]) ??
        displayText(scopedSystem?.owner ?? network?.owner, "Not assigned"),
      spiId: finding.spiId,
      priorityRank: finding.priorityRank,
      timestamp: finding.timestamp,
      timestampLabel: formatTimestamp(finding.timestamp),
      closedTimestamp,
      closedTimestampLabel: closedTimestamp ? formatTimestamp(closedTimestamp) : null,
      measureLabel,
      complianceStatus: finding.complianceStatus,
      evaluationStatus: evaluations.length ? aggregateComplianceStatus(evaluations) : finding.complianceStatus,
      scope: { ...finding.scope },
      scopeLabel: [
        `Asset ${asset.id}`,
        scopedSystemId ? `System ${scopedSystemId}` : "System n/a",
        scopedEnvironmentType ? `Env ${scopedEnvironmentType}` : "Env n/a"
      ].join(" | "),
      evidencePreview:
        evidence
          .slice(0, 2)
          .map((item) => `${item.key}: ${item.value}`)
          .join(" | ") || "No evidence captured",
      evidence
    };
  });
  const findingsBySpiId = new Map<number, AssetComplianceFinding[]>();
  for (const finding of findingRows) {
    const existing = findingsBySpiId.get(finding.spiId) ?? [];
    existing.push(finding);
    findingsBySpiId.set(finding.spiId, existing);
  }

  const spiIds = Array.from(
    new Set([
      ...spiDefinitions.map((definition) => definition.spiId),
      ...selectedEvaluations.map((evaluation) => evaluation.spiId),
      ...rawAssetFindings.map((finding) => finding.spiId)
    ])
  ).sort((left, right) => {
    const leftDefinition = definitionBySpiId.get(left);
    const rightDefinition = definitionBySpiId.get(right);
    const leftOrder = Number.isFinite(leftDefinition?.displayOrder)
      ? (leftDefinition?.displayOrder as number)
      : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(rightDefinition?.displayOrder)
      ? (rightDefinition?.displayOrder as number)
      : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left - right;
  });

  const measures = spiIds.map<AssetComplianceMeasure>((spiId) => {
    const definition = definitionBySpiId.get(spiId);
    const evaluations = evaluationsBySpiId.get(spiId) ?? [];
    const findings = findingsBySpiId.get(spiId) ?? [];
    const compliant = evaluations.filter((evaluation) => evaluation.status === "Compliant").length;
    const nonCompliant = evaluations.filter((evaluation) => evaluation.status === "Non-compliant").length;
    const unknown = evaluations.filter((evaluation) => evaluation.status === "Unknown").length;
    const total = evaluations.length;
    const reasonCounts = new Map<string, number>();
    for (const evaluation of evaluations) {
      if (evaluation.status !== "Non-compliant") {
        continue;
      }
      for (const reason of evaluation.reasons) {
        const normalizedReason = reason.trim();
        if (normalizedReason) {
          reasonCounts.set(normalizedReason, (reasonCounts.get(normalizedReason) ?? 0) + 1);
        }
      }
    }
    const topReasons = Array.from(reasonCounts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 3)
      .map(([reason]) => reason);
    return {
      spiId,
      label: spiMeasureLabel(definition, spiId),
      status: aggregateComplianceStatus(evaluations),
      total,
      compliant,
      nonCompliant,
      unknown,
      score: complianceScore(compliant, total),
      impactedAssets: evaluations.some((evaluation) => evaluation.status !== "Compliant") ? 1 : 0,
      topReasons,
      reasons: uniqueTextValues(evaluations.flatMap((evaluation) => evaluation.reasons)),
      evidence: aggregateEvidenceItems(evaluations, rawAssetFindings.filter((finding) => finding.spiId === spiId)),
      findings,
      openFindings: findings.filter((finding) => finding.status === "open")
    };
  });
  const compliant = selectedEvaluations.filter((evaluation) => evaluation.status === "Compliant").length;
  const nonCompliant = selectedEvaluations.filter((evaluation) => evaluation.status === "Non-compliant").length;
  const unknown = selectedEvaluations.filter((evaluation) => evaluation.status === "Unknown").length;

  const coverageEvaluation = (dataset.discoveryCoverageEvaluations ?? []).find(
    (evaluation) => evaluation.assetId === asset.id
  );
  const tools = discoveryToolsSettings.tools
    .filter((tool) => tool.assetTypeScope[asset.type] !== "na")
    .map<AssetDiscoveryComplianceTool>((tool) => {
      const storedValue = coverageEvaluation?.toolValues[tool.id];
      const value: DiscoveryCoverageValue =
        storedValue === 1 || storedValue === 0 || storedValue === null ? storedValue : null;
      return {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        el2Owner: tool.el2Owner,
        el2OperationsManager: tool.el2OperationsManager,
        value,
        status: discoveryToolStatus(value)
      };
    });
  const covered = tools.filter((tool) => tool.status === "Covered").length;
  const missing = tools.filter((tool) => tool.status === "Missing").length;
  const notAvailable = tools.filter((tool) => tool.status === "Not available").length;
  return {
    snapshotDate: dataset.snapshotDate,
    asset: {
      id: asset.id,
      name: displayText(asset.name, asset.hostname || asset.id),
      hostname: displayText(asset.hostname, asset.name || asset.id),
      ipAddress: resolveAssetIpAddress(asset),
      assetType: asset.type,
      assetTypeLabel: assetTypeLabel(asset.type),
      environmentType: displayText(membership?.environmentType ?? asset.systemContext?.environmentType),
      systemName: displayText(membership?.systemName),
      networkName: displayText(network?.name, asset.networkId),
      securityDomain: displayText(asset.securityDomain)
    },
    complianceOverview: {
      score: complianceScore(compliant, selectedEvaluations.length),
      total: selectedEvaluations.length,
      compliant,
      nonCompliant,
      unknown,
      openFindingCount: findingRows.filter((finding) => finding.status === "open").length,
      measures,
      findings: findingRows
    },
    discoveryCompliance: {
      score: complianceScore(covered, covered + missing),
      coverageCompliance: coverageEvaluation?.coverageCompliance ?? false,
      covered,
      missing,
      notAvailable,
      total: tools.length,
      tools
    }
  };
}

export function buildServerComplianceModel(
  options: BuildServerComplianceModelOptions
): ServerComplianceModel | null {
  return buildAssetComplianceModel(options);
}
