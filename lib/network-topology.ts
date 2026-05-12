import { ASSET_TYPES, createAssetTypeRecord } from "@/lib/asset-taxonomy";
import { Asset, AssetType, AnalyticsResult, CiDependencyType, ComplianceStatus, Dataset, EnvironmentType, ICTSystem } from "@/lib/types";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";
import { filterRealNetworks, isRealNetworkId } from "@/lib/network-scope";

export type TopologyEntityType = "network" | "mission-capability" | "service" | "ict-system";

export interface TopologyComplianceSummary {
  score: number;
  compliant: number;
  nonCompliant: number;
  other: number;
}

export interface TopologyNode {
  id: string;
  entityId: string;
  entityType: TopologyEntityType;
  name: string;
  cyberCompliance: TopologyComplianceSummary;
  discoveryCompliance: TopologyComplianceSummary;
  details: TopologyNodeDetails;
}

export interface TopologyEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface CmdbAssetNode {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  networkId: string;
  environmentType: EnvironmentType | null;
  type: Asset["type"];
  cyberCompliance: TopologyComplianceSummary;
  discoveryCompliance: TopologyComplianceSummary;
}

export interface CmdbSystemTopology {
  systemId: string;
  systemName: string;
  assetsByType: Record<AssetType, CmdbAssetNode[]>;
  networkDevices: CmdbAssetNode[];
  workstations: CmdbAssetNode[];
  servers: CmdbAssetNode[];
  storageDevices: CmdbAssetNode[];
  printerDevices: CmdbAssetNode[];
  otherAssets: CmdbAssetNode[];
}

export interface TopologyCiNode {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  type: Asset["type"];
  networkId: string;
  environmentType: EnvironmentType | null;
  systemId: string | null;
  systemName: string | null;
  systemModelled: boolean;
}

export interface TopologyCiDependency {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  dependencyType: CiDependencyType;
}

export interface NetworkTopologyData {
  networkId: string;
  networkName: string;
  rootScope: {
    type: "network" | "ict-system";
    id: string;
    name: string;
  };
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  cmdbTopologies: CmdbSystemTopology[];
  ciNodes: TopologyCiNode[];
  ciDependencies: TopologyCiDependency[];
  modelAssetIds: string[];
  preferredCoreNodeId?: string;
}

export interface TopologyNodeDetails {
  description: string;
  classification?: string;
  discoveryStatus?: string;
  criticality?: string;
  securityDomain?: string;
  owner?: string;
  supportEmail?: string;
  serviceCatalogueUrl?: string;
  atoNumber?: string;
  diisId?: string;
  diisUrl?: string;
  grcUrl?: string;
  apmNumber?: string;
  apmUrl?: string;
  missionCapabilities?: string[];
  businessServices?: string[];
  dependentSystems?: string[];
  connectedServices?: string[];
  connectedMissionCapabilities?: string[];
}

export interface BuildNetworkTopologyOptions {
  mode?: "dependency" | "full";
}

interface HierarchyMaps {
  parentsById: Map<string, Set<string>>;
  childrenById: Map<string, Set<string>>;
}

const NETWORK_PARENT_KEYS = ["parentNetworkId", "parentId", "networkParentId", "parentNetwork", "parent"];
const NETWORK_CHILD_KEYS = ["childNetworkIds", "childIds", "networkChildIds", "children", "childNetworks"];
const SYSTEM_PARENT_KEYS = ["parentSystemId", "parentId", "ictSystemParentId", "parentIctSystemId", "parent"];
const SYSTEM_CHILD_KEYS = ["childSystemIds", "childIds", "ictSystemChildIds", "children", "childIctSystems"];

function complianceScore(statuses: ComplianceStatus[]): number {
  if (!statuses.length) {
    return 0;
  }
  const compliant = statuses.filter((status) => status === "Compliant").length;
  return Number(((compliant / statuses.length) * 100).toFixed(1));
}

function summarizeCyberCompliance(statuses: ComplianceStatus[]): TopologyComplianceSummary {
  if (!statuses.length) {
    return {
      score: 0,
      compliant: 0,
      nonCompliant: 0,
      other: 1
    };
  }
  const compliant = statuses.filter((status) => status === "Compliant").length;
  const nonCompliant = statuses.filter((status) => status === "Non-compliant").length;
  const other = statuses.length - compliant - nonCompliant;
  return {
    score: complianceScore(statuses),
    compliant,
    nonCompliant,
    other
  };
}

function summarizeDiscoveryCompliance(values: boolean[]): TopologyComplianceSummary {
  if (!values.length) {
    return {
      score: 0,
      compliant: 0,
      nonCompliant: 0,
      other: 1
    };
  }
  const compliant = values.filter(Boolean).length;
  const nonCompliant = values.length - compliant;
  return {
    score: Number(((compliant / values.length) * 100).toFixed(1)),
    compliant,
    nonCompliant,
    other: 0
  };
}

function resolveAssetIpAddress(asset: Asset): string {
  const candidate = asset as Asset & {
    ipAddress?: string | null;
    ip?: string | null;
    ipv4?: string | null;
    ipv4Address?: string | null;
    primaryIp?: string | null;
  };
  const value =
    candidate.ipAddress ?? candidate.ip ?? candidate.ipv4 ?? candidate.ipv4Address ?? candidate.primaryIp ?? null;
  if (!value || !String(value).trim()) {
    return "N/A";
  }
  return String(value).trim();
}

function collectSystemIdsByMission(systems: ICTSystem[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const system of systems) {
    for (const mission of system.missionCapabilities) {
      const current = map.get(mission.id) ?? new Set<string>();
      current.add(system.id);
      map.set(mission.id, current);
    }
  }
  return map;
}

function collectSystemIdsByService(systems: ICTSystem[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const system of systems) {
    for (const service of system.businessServices) {
      const current = map.get(service.id) ?? new Set<string>();
      current.add(system.id);
      map.set(service.id, current);
    }
  }
  return map;
}

function fallbackSystemDescription(system: ICTSystem): string {
  if (system.description?.trim()) {
    return system.description.trim();
  }
  const missionSummary =
    system.missionCapabilities.map((capability) => capability.name).join(", ") || "assigned mission capabilities";
  const serviceSummary =
    system.businessServices.map((service) => service.name).join(", ") || "assigned business services";
  return `${system.name} is a ${system.criticality.toLowerCase()} ICT system in the ${system.securityDomain} domain supporting ${missionSummary} and ${serviceSummary}.`;
}

function fallbackSystemOwner(system: ICTSystem): string {
  if (system.owner?.trim()) {
    return system.owner.trim();
  }
  return `${system.name} Operations Team`;
}

function fallbackSystemSupportEmail(system: ICTSystem): string {
  if (system.supportEmail?.trim()) {
    return system.supportEmail.trim();
  }
  const normalizedId = system.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `ict-support+${normalizedId}@tsaat.local`;
}

function fallbackSystemServiceCatalogueUrl(system: ICTSystem): string {
  if (system.serviceCatalogueUrl?.trim()) {
    return system.serviceCatalogueUrl.trim();
  }
  return `/systems/${system.id}`;
}

function fallbackSystemAtoNumber(system: ICTSystem): string {
  if (system.atoNumber?.trim()) {
    return system.atoNumber.trim();
  }
  const normalizedId = system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase();
  return `ATO-${normalizedId}`;
}

function fallbackSystemDiisId(system: ICTSystem): string {
  if (system.diisId?.trim()) {
    return system.diisId.trim();
  }
  const normalizedId = system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase();
  return `DIIS-${normalizedId}`;
}

function fallbackSystemDiisUrl(system: ICTSystem): string {
  if (system.diisUrl?.trim()) {
    return system.diisUrl.trim();
  }
  return `https://diis.defence.gov.au/systems/${encodeURIComponent(system.id)}`;
}

function fallbackSystemGrcUrl(system: ICTSystem, atoNumber: string): string {
  if (system.grcUrl?.trim()) {
    return system.grcUrl.trim();
  }
  return `https://grc.defence.gov.au/ato/${encodeURIComponent(atoNumber)}`;
}

function fallbackSystemApmNumber(system: ICTSystem): string {
  if (system.apmNumber?.trim()) {
    return system.apmNumber.trim();
  }

  const normalizedId = system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase();
  return `APM-${normalizedId}`;
}

function fallbackSystemApmUrl(apmNumber: string): string {
  return `https://apm.defence.gov.au/applications/${encodeURIComponent(apmNumber)}`;
}

function createEdgeAccumulator() {
  const edgeSet = new Set<string>();
  const edges: TopologyEdge[] = [];
  const addEdge = (fromNodeId: string | undefined, toNodeId: string | undefined) => {
    if (!fromNodeId || !toNodeId || fromNodeId === toNodeId) {
      return;
    }
    const key = `${fromNodeId}->${toNodeId}`;
    if (edgeSet.has(key)) {
      return;
    }
    edgeSet.add(key);
    edges.push({
      id: key,
      fromNodeId,
      toNodeId
    });
  };
  return { edges, addEdge };
}

function mapEvaluationsBySystemId(
  analytics: AnalyticsResult,
  includedSystemIds: Set<string>
): Map<
  string,
  Array<{
    statuses: ComplianceStatus[];
    discoveryCoverageCompliant: boolean;
  }>
> {
  const evaluationsBySystemId = new Map<
    string,
    Array<{
      statuses: ComplianceStatus[];
      discoveryCoverageCompliant: boolean;
    }>
  >();

  for (const evaluation of analytics.evaluations) {
    if (!evaluation.systemId || !includedSystemIds.has(evaluation.systemId)) {
      continue;
    }
    const current = evaluationsBySystemId.get(evaluation.systemId) ?? [];
    current.push({
      statuses: evaluation.evaluations.map((item) => item.status),
      discoveryCoverageCompliant: evaluation.discoveryCoverageCompliant
    });
    evaluationsBySystemId.set(evaluation.systemId, current);
  }
  return evaluationsBySystemId;
}

type AssetEvaluationSummary = {
  statuses: ComplianceStatus[];
  discoveryCoverageCompliant: boolean;
};

function mapEvaluationsByAssetId(
  analytics: AnalyticsResult
): Map<string, AssetEvaluationSummary> {
  const evaluationsByAssetId = new Map<string, AssetEvaluationSummary>();

  for (const evaluation of analytics.evaluations) {
    evaluationsByAssetId.set(evaluation.assetId, {
      statuses: evaluation.evaluations.map((item) => item.status),
      discoveryCoverageCompliant: evaluation.discoveryCoverageCompliant
    });
  }

  return evaluationsByAssetId;
}

function summarizeSystems(
  systemIds: Iterable<string>,
  evaluationsBySystemId: Map<
    string,
    Array<{
      statuses: ComplianceStatus[];
      discoveryCoverageCompliant: boolean;
    }>
  >
) {
  const cyberStatuses: ComplianceStatus[] = [];
  const discoveryFlags: boolean[] = [];
  for (const systemId of systemIds) {
    const evaluations = evaluationsBySystemId.get(systemId) ?? [];
    for (const evaluation of evaluations) {
      cyberStatuses.push(...evaluation.statuses);
      discoveryFlags.push(evaluation.discoveryCoverageCompliant);
    }
  }
  return {
    cyber: summarizeCyberCompliance(cyberStatuses),
    discovery: summarizeDiscoveryCompliance(discoveryFlags)
  };
}

function summarizeAssets(
  assetIds: Iterable<string>,
  evaluationsByAssetId: Map<string, AssetEvaluationSummary>
) {
  const cyberStatuses: ComplianceStatus[] = [];
  const discoveryFlags: boolean[] = [];
  for (const assetId of assetIds) {
    const evaluation = evaluationsByAssetId.get(assetId);
    if (!evaluation) {
      continue;
    }
    cyberStatuses.push(...evaluation.statuses);
    discoveryFlags.push(evaluation.discoveryCoverageCompliant);
  }
  return {
    cyber: summarizeCyberCompliance(cyberStatuses),
    discovery: summarizeDiscoveryCompliance(discoveryFlags)
  };
}

function summarizeAsset(assetId: string, evaluationsByAssetId: Map<string, AssetEvaluationSummary>) {
  const evaluation = evaluationsByAssetId.get(assetId);
  if (!evaluation) {
    return {
      cyber: summarizeCyberCompliance([]),
      discovery: summarizeDiscoveryCompliance([])
    };
  }
  return {
    cyber: summarizeCyberCompliance(evaluation.statuses),
    discovery: summarizeDiscoveryCompliance([evaluation.discoveryCoverageCompliant])
  };
}

function normalizeHierarchyId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

function extractHierarchyIds(value: unknown): string[] {
  if (typeof value === "string") {
    const single = normalizeHierarchyId(value);
    return single ? [single] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const normalized = normalizeHierarchyId(item);
      if (normalized) {
        ids.push(normalized);
      }
      continue;
    }
    if (!item || typeof item !== "object") {
      continue;
    }
    const objectId = normalizeHierarchyId((item as { id?: unknown }).id);
    if (objectId) {
      ids.push(objectId);
    }
  }
  return ids;
}

function readHierarchyIds(entity: Record<string, unknown>, candidateKeys: string[]): string[] {
  const ids = new Set<string>();
  for (const key of candidateKeys) {
    for (const id of extractHierarchyIds(entity[key])) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

function buildHierarchyMaps<T extends { id: string }>(
  entities: T[],
  parentKeys: string[],
  childKeys: string[]
): HierarchyMaps {
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  const parentsById = new Map<string, Set<string>>(entities.map((entity) => [entity.id, new Set<string>()]));
  const childrenById = new Map<string, Set<string>>(entities.map((entity) => [entity.id, new Set<string>()]));

  const addHierarchyEdge = (parentId: string, childId: string) => {
    if (parentId === childId || !entityById.has(parentId) || !entityById.has(childId)) {
      return;
    }
    parentsById.get(childId)?.add(parentId);
    childrenById.get(parentId)?.add(childId);
  };

  for (const entity of entities) {
    const asRecord = entity as unknown as Record<string, unknown>;
    for (const parentId of readHierarchyIds(asRecord, parentKeys)) {
      addHierarchyEdge(parentId, entity.id);
    }
    for (const childId of readHierarchyIds(asRecord, childKeys)) {
      addHierarchyEdge(entity.id, childId);
    }
  }

  return {
    parentsById,
    childrenById
  };
}

function collectAncestors(nodeId: string, hierarchy: HierarchyMaps): Set<string> {
  const visited = new Set<string>();
  const queue = [...(hierarchy.parentsById.get(nodeId) ?? [])];
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const parentId of hierarchy.parentsById.get(current) ?? []) {
      if (!visited.has(parentId)) {
        queue.push(parentId);
      }
    }
  }
  return visited;
}

function collectDescendants(nodeId: string, hierarchy: HierarchyMaps): Set<string> {
  const visited = new Set<string>();
  const queue = [...(hierarchy.childrenById.get(nodeId) ?? [])];
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);
    for (const childId of hierarchy.childrenById.get(current) ?? []) {
      if (!visited.has(childId)) {
        queue.push(childId);
      }
    }
  }
  return visited;
}

function filterReachableFromRoot(nodes: TopologyNode[], edges: TopologyEdge[], rootNodeId: string) {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const current = adjacency.get(edge.fromNodeId) ?? [];
    current.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, current);
  }

  const reachableNodeIds = new Set<string>([rootNodeId]);
  const queue: string[] = [rootNodeId];
  while (queue.length) {
    const currentNodeId = queue.shift();
    if (!currentNodeId) {
      continue;
    }
    for (const childNodeId of adjacency.get(currentNodeId) ?? []) {
      if (reachableNodeIds.has(childNodeId)) {
        continue;
      }
      reachableNodeIds.add(childNodeId);
      queue.push(childNodeId);
    }
  }

  const filteredNodes = nodes.filter((node) => reachableNodeIds.has(node.id));
  const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));
  const filteredEdges = edges.filter(
    (edge) => filteredNodeIds.has(edge.fromNodeId) && filteredNodeIds.has(edge.toNodeId)
  );

  return {
    filteredNodes,
    filteredEdges
  };
}

function buildCmdbTopologies(
  dataset: Dataset,
  scopedSystems: ICTSystem[],
  includedSystemIds: Set<string>,
  eligibleNetworkIds: Set<string>,
  evaluationsByAssetId: Map<string, AssetEvaluationSummary>,
  includedAssetIds?: Set<string>
): CmdbSystemTopology[] {
  const assetsBySystemId = new Map<string, Asset[]>();
  for (const asset of dataset.assets) {
    if (includedAssetIds && !includedAssetIds.has(asset.id)) {
      continue;
    }
    if (!eligibleNetworkIds.has(asset.networkId)) {
      continue;
    }
    const systemId = asset.systemContext?.systemId;
    if (!systemId || !includedSystemIds.has(systemId)) {
      continue;
    }
    const current = assetsBySystemId.get(systemId) ?? [];
    current.push(asset);
    assetsBySystemId.set(systemId, current);
  }

  return scopedSystems
    .filter((system) => includedSystemIds.has(system.id))
    .map((system) => {
      const assets = assetsBySystemId.get(system.id) ?? [];
      const mappedAssets = assets
        .map((asset) => {
          const summary = summarizeAsset(asset.id, evaluationsByAssetId);
          return {
            id: asset.id,
            name: asset.name,
            hostname: asset.hostname,
            ipAddress: resolveAssetIpAddress(asset),
            networkId: asset.networkId,
            environmentType: asset.systemContext?.environmentType ?? null,
            type: asset.type,
            cyberCompliance: summary.cyber,
            discoveryCompliance: summary.discovery
          };
        })
        .sort((a, b) => a.hostname.localeCompare(b.hostname));
      const assetsByType = createAssetTypeRecord((assetType) =>
        mappedAssets.filter((asset) => asset.type === assetType)
      );
      return {
        systemId: system.id,
        systemName: system.name,
        assetsByType,
        networkDevices: assetsByType["network-device"],
        workstations: assetsByType.workstation,
        servers: assetsByType.server,
        storageDevices: assetsByType["storage-device"],
        printerDevices: assetsByType["printer-device"],
        otherAssets: assetsByType.other
      };
    })
    .sort((a, b) => a.systemName.localeCompare(b.systemName));
}

function buildCiDependencyTopologyData(
  dataset: Dataset,
  scopedAssetIds: Set<string>,
  modelAssetIds: Set<string>
): {
  ciNodes: TopologyCiNode[];
  ciDependencies: TopologyCiDependency[];
  modelAssetIds: string[];
} {
  const assetById = new Map(dataset.assets.map((asset) => [asset.id, asset]));
  const systemById = new Map(dataset.ictSystems.map((system) => [system.id, system]));
  const sourceDependencies = dataset.ciDependencies ?? [];
  const expandedAssetIds = new Set<string>(scopedAssetIds);
  const ciDependencyById = new Map<string, TopologyCiDependency>();

  // Expand two hops from in-scope CIs so focused CI flow can include related out-of-model neighbours.
  for (let depth = 0; depth < 2; depth += 1) {
    let addedDependency = false;
    for (const dependency of sourceDependencies) {
      const sourceAsset = assetById.get(dependency.sourceAssetId);
      const targetAsset = assetById.get(dependency.targetAssetId);
      if (!sourceAsset || !targetAsset || sourceAsset.id === targetAsset.id) {
        continue;
      }
      const touchesKnownScope =
        expandedAssetIds.has(sourceAsset.id) || expandedAssetIds.has(targetAsset.id);
      if (!touchesKnownScope) {
        continue;
      }
      const dependencyId =
        dependency.id?.trim() || `${sourceAsset.id}->${targetAsset.id}:${dependency.dependencyType}`;
      if (!ciDependencyById.has(dependencyId)) {
        ciDependencyById.set(dependencyId, {
          id: dependencyId,
          sourceAssetId: sourceAsset.id,
          targetAssetId: targetAsset.id,
          dependencyType: dependency.dependencyType
        });
        addedDependency = true;
      }
      expandedAssetIds.add(sourceAsset.id);
      expandedAssetIds.add(targetAsset.id);
    }
    if (!addedDependency) {
      break;
    }
  }

  const ciNodes = Array.from(expandedAssetIds)
    .map((assetId) => assetById.get(assetId))
    .filter((asset): asset is Asset => Boolean(asset))
    .map((asset) => {
      const ownerSystemId = asset.systemContext?.systemId ?? null;
      const ownerSystem = ownerSystemId ? systemById.get(ownerSystemId) : undefined;
      return {
        id: asset.id,
        name: asset.name,
        hostname: asset.hostname,
        ipAddress: resolveAssetIpAddress(asset),
        type: asset.type,
        networkId: asset.networkId,
        environmentType: asset.systemContext?.environmentType ?? null,
        systemId: ownerSystemId,
        systemName: ownerSystem?.name ?? null,
        systemModelled: ownerSystem?.modellingStatus ?? false
      };
    })
    .sort((left, right) => left.hostname.localeCompare(right.hostname));

  return {
    ciNodes,
    ciDependencies: Array.from(ciDependencyById.values()).sort((left, right) => left.id.localeCompare(right.id)),
    modelAssetIds: Array.from(modelAssetIds).sort((left, right) => left.localeCompare(right))
  };
}

function collectCmdbAssetIds(cmdbTopologies: CmdbSystemTopology[]): Set<string> {
  const assetIds = new Set<string>();
  for (const topology of cmdbTopologies) {
    for (const assetType of ASSET_TYPES) {
      for (const asset of topology.assetsByType[assetType]) {
        assetIds.add(asset.id);
      }
    }
  }
  return assetIds;
}

function buildSystemNode(
  system: ICTSystem,
  summaries: {
    cyber: TopologyComplianceSummary;
    discovery: TopologyComplianceSummary;
  },
  relatedSystemNames?: string[]
): TopologyNode {
  const atoNumber = fallbackSystemAtoNumber(system);
  const apmNumber = fallbackSystemApmNumber(system);

  return {
    id: `system:${system.id}`,
    entityId: system.id,
    entityType: "ict-system",
    name: system.name,
    cyberCompliance: summaries.cyber,
    discoveryCompliance: summaries.discovery,
    details: {
      description: fallbackSystemDescription(system),
      criticality: system.criticality,
      securityDomain: system.securityDomain,
      owner: fallbackSystemOwner(system),
      supportEmail: fallbackSystemSupportEmail(system),
      serviceCatalogueUrl: fallbackSystemServiceCatalogueUrl(system),
      atoNumber,
      diisId: fallbackSystemDiisId(system),
      diisUrl: fallbackSystemDiisUrl(system),
      grcUrl: fallbackSystemGrcUrl(system, atoNumber),
      apmNumber,
      apmUrl: fallbackSystemApmUrl(apmNumber),
      missionCapabilities: system.missionCapabilities.map((mission) => mission.name).sort((a, b) => a.localeCompare(b)),
      businessServices: system.businessServices.map((service) => service.name).sort((a, b) => a.localeCompare(b)),
      dependentSystems: relatedSystemNames
    }
  };
}

function buildNetworkNode(
  dataset: Dataset,
  networkId: string,
  networkName: string,
  summary: {
    cyber: TopologyComplianceSummary;
    discovery: TopologyComplianceSummary;
  },
  missionNames: string[],
  serviceNames: string[],
  dependentSystemNames: string[]
): TopologyNode {
  const network = dataset.managedNetworks.find((item) => item.id === networkId);
  const networkDetails = network
    ? resolveNetworkDetailFields(network)
    : {
        description: `${networkName} is a managed network segment in current TSAAT scope.`,
        owner: `${networkName} Operations Team`,
        supportEmail: `network-support+${networkId.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}@tsaat.local`,
        serviceCatalogueUrl: `/networks/${networkId}`,
        atoNumber: `ATO-${networkId.replace(/[^a-z0-9]+/gi, "-").toUpperCase()}`,
        diisUrl: `https://diis.defence.gov.au/networks/${encodeURIComponent(networkId)}`,
        grcUrl: `https://grc.defence.gov.au/ato/${encodeURIComponent(networkId)}`
      };

  return {
    id: `network:${networkId}`,
    entityId: networkId,
    entityType: "network",
    name: networkName,
    cyberCompliance: summary.cyber,
    discoveryCompliance: summary.discovery,
    details: {
      description: networkDetails.description,
      classification: network?.classification ?? "Unknown",
      discoveryStatus: network?.discoveryStatus ?? "Unknown",
      criticality: network?.criticality ?? "Unknown",
      owner: networkDetails.owner,
      supportEmail: networkDetails.supportEmail,
      serviceCatalogueUrl: networkDetails.serviceCatalogueUrl,
      atoNumber: networkDetails.atoNumber,
      ...(network?.diisId ? { diisId: network.diisId } : {}),
      diisUrl: networkDetails.diisUrl,
      grcUrl: networkDetails.grcUrl,
      missionCapabilities: missionNames,
      businessServices: serviceNames,
      dependentSystems: dependentSystemNames
    }
  };
}

function buildDependencyNetworkTopologyData(
  dataset: Dataset,
  analytics: AnalyticsResult,
  networkId: string,
  networkName: string
): NetworkTopologyData {
  const networkNodeId = `network:${networkId}`;
  const systemsById = new Map(dataset.ictSystems.map((system) => [system.id, system]));

  const networkHierarchy = buildHierarchyMaps(filterRealNetworks(dataset.managedNetworks), NETWORK_PARENT_KEYS, NETWORK_CHILD_KEYS);
  const networkScopeIds = new Set<string>([networkId]);
  for (const ancestorId of collectAncestors(networkId, networkHierarchy)) {
    networkScopeIds.add(ancestorId);
  }
  for (const descendantId of collectDescendants(networkId, networkHierarchy)) {
    networkScopeIds.add(descendantId);
  }

  const directDependentSystemIds = new Set<string>();
  for (const asset of dataset.assets) {
    if (!networkScopeIds.has(asset.networkId)) {
      continue;
    }
    const systemId = asset.systemContext?.systemId;
    if (!systemId || !systemsById.has(systemId)) {
      continue;
    }
    directDependentSystemIds.add(systemId);
  }

  const systemHierarchy = buildHierarchyMaps(dataset.ictSystems, SYSTEM_PARENT_KEYS, SYSTEM_CHILD_KEYS);
  const dependentSystemIds = new Set<string>(directDependentSystemIds);
  for (const directSystemId of directDependentSystemIds) {
    for (const ancestorId of collectAncestors(directSystemId, systemHierarchy)) {
      dependentSystemIds.add(ancestorId);
    }
    for (const descendantId of collectDescendants(directSystemId, systemHierarchy)) {
      dependentSystemIds.add(descendantId);
    }
  }

  const scopedSystems = dataset.ictSystems
    .filter((system) => dependentSystemIds.has(system.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const scopedSystemIds = new Set(scopedSystems.map((system) => system.id));

  const evaluationsBySystemId = mapEvaluationsBySystemId(analytics, scopedSystemIds);
  const evaluationsByAssetId = mapEvaluationsByAssetId(analytics);
  const networkSummary = summarizeSystems(
    directDependentSystemIds.size ? directDependentSystemIds : scopedSystemIds,
    evaluationsBySystemId
  );

  const dependentSystemNames = scopedSystems.map((system) => system.name).sort((a, b) => a.localeCompare(b));
  const dependentMissionNames = Array.from(
    new Set(scopedSystems.flatMap((system) => system.missionCapabilities.map((mission) => mission.name)))
  ).sort((a, b) => a.localeCompare(b));
  const dependentServiceNames = Array.from(
    new Set(scopedSystems.flatMap((system) => system.businessServices.map((service) => service.name)))
  ).sort((a, b) => a.localeCompare(b));

  const nodes: TopologyNode[] = [
    buildNetworkNode(
      dataset,
      networkId,
      networkName,
      networkSummary,
      dependentMissionNames,
      dependentServiceNames,
      dependentSystemNames
    )
  ];
  const systemNodeIdBySystemId = new Map<string, string>();

  for (const system of scopedSystems) {
    const relatedSystemNames = Array.from(
      new Set([
        ...(systemHierarchy.parentsById.get(system.id) ?? []),
        ...(systemHierarchy.childrenById.get(system.id) ?? [])
      ])
    )
      .filter((relatedId) => scopedSystemIds.has(relatedId))
      .map((relatedId) => systemsById.get(relatedId)?.name ?? relatedId)
      .sort((a, b) => a.localeCompare(b));

    const summaries = summarizeSystems([system.id], evaluationsBySystemId);
    const node = buildSystemNode(system, summaries, relatedSystemNames.length ? relatedSystemNames : undefined);
    nodes.push(node);
    systemNodeIdBySystemId.set(system.id, node.id);
  }

  const { edges, addEdge } = createEdgeAccumulator();
  for (const system of scopedSystems) {
    addEdge(networkNodeId, systemNodeIdBySystemId.get(system.id));
  }

  for (const parentSystemId of Array.from(systemHierarchy.childrenById.keys()).sort((a, b) => a.localeCompare(b))) {
    if (!scopedSystemIds.has(parentSystemId)) {
      continue;
    }
    const childIds = Array.from(systemHierarchy.childrenById.get(parentSystemId) ?? []).sort((a, b) =>
      a.localeCompare(b)
    );
    for (const childSystemId of childIds) {
      if (!scopedSystemIds.has(childSystemId)) {
        continue;
      }
      addEdge(systemNodeIdBySystemId.get(parentSystemId), systemNodeIdBySystemId.get(childSystemId));
    }
  }

  const { filteredNodes, filteredEdges } = filterReachableFromRoot(nodes, edges, networkNodeId);
  const filteredSystemIds = new Set(
    filteredNodes.filter((node) => node.entityType === "ict-system").map((node) => node.entityId)
  );
  const cmdbTopologies = buildCmdbTopologies(
    dataset,
    scopedSystems,
    filteredSystemIds,
    networkScopeIds,
    evaluationsByAssetId
  );
  const cmdbAssetIds = collectCmdbAssetIds(cmdbTopologies);
  const ciDependencyData = buildCiDependencyTopologyData(dataset, cmdbAssetIds, cmdbAssetIds);

  return {
    networkId,
    networkName,
    rootScope: { type: "network", id: networkId, name: networkName },
    nodes: filteredNodes,
    edges: filteredEdges,
    cmdbTopologies,
    ciNodes: ciDependencyData.ciNodes,
    ciDependencies: ciDependencyData.ciDependencies,
    modelAssetIds: ciDependencyData.modelAssetIds,
    preferredCoreNodeId: networkNodeId
  };
}

function buildMissionServiceNetworkTopologyData(
  dataset: Dataset,
  analytics: AnalyticsResult,
  networkId: string,
  networkName: string
): NetworkTopologyData {
  const networkNodeId = `network:${networkId}`;
  const scopedSystems = dataset.ictSystems.filter((system) => system.networkId === networkId);
  const scopedSystemIds = new Set(scopedSystems.map((system) => system.id));
  const evaluationsBySystemId = mapEvaluationsBySystemId(analytics, scopedSystemIds);
  const evaluationsByAssetId = mapEvaluationsByAssetId(analytics);
  const missionSystemMap = collectSystemIdsByMission(scopedSystems);
  const serviceSystemMap = collectSystemIdsByService(scopedSystems);
  const nodes: TopologyNode[] = [];
  const missionNodeIdByMissionId = new Map<string, string>();
  const serviceNodeIdByServiceId = new Map<string, string>();
  const systemNodeIdBySystemId = new Map<string, string>();

  const networkSummary = summarizeSystems(scopedSystemIds, evaluationsBySystemId);
  const dependentMissionNames = Array.from(
    new Set(scopedSystems.flatMap((system) => system.missionCapabilities.map((mission) => mission.name)))
  ).sort((a, b) => a.localeCompare(b));
  const dependentServiceNames = Array.from(
    new Set(scopedSystems.flatMap((system) => system.businessServices.map((service) => service.name)))
  ).sort((a, b) => a.localeCompare(b));
  const dependentSystemNames = scopedSystems.map((system) => system.name).sort((a, b) => a.localeCompare(b));
  nodes.push(
    buildNetworkNode(
      dataset,
      networkId,
      networkName,
      networkSummary,
      dependentMissionNames,
      dependentServiceNames,
      dependentSystemNames
    )
  );

  const missionById = new Map<string, { id: string; name: string }>();
  for (const system of scopedSystems) {
    for (const mission of system.missionCapabilities) {
      if (!missionById.has(mission.id)) {
        missionById.set(mission.id, { id: mission.id, name: mission.name });
      }
    }
  }
  const serviceById = new Map<string, { id: string; name: string }>();
  for (const system of scopedSystems) {
    for (const service of system.businessServices) {
      if (!serviceById.has(service.id)) {
        serviceById.set(service.id, { id: service.id, name: service.name });
      }
    }
  }

  for (const mission of Array.from(missionById.values()).sort((a, b) => a.name.localeCompare(b.name))) {
    const systemIds = missionSystemMap.get(mission.id) ?? new Set<string>();
    const summaries = summarizeSystems(systemIds, evaluationsBySystemId);
    const nodeId = `mission:${mission.id}`;
    missionNodeIdByMissionId.set(mission.id, nodeId);
    nodes.push({
      id: nodeId,
      entityId: mission.id,
      entityType: "mission-capability",
      name: mission.name,
      cyberCompliance: summaries.cyber,
      discoveryCompliance: summaries.discovery,
      details: {
        description: `${mission.name} mission capability is supported by network-scoped services and ICT systems in this topology view.`,
        criticality:
          scopedSystems.find((system) => system.missionCapabilities.some((item) => item.id === mission.id))
            ?.missionCapabilities.find((item) => item.id === mission.id)?.criticality ?? "Unknown",
        connectedServices: Array.from(
          new Set(
            scopedSystems
              .filter((system) => system.missionCapabilities.some((item) => item.id === mission.id))
              .flatMap((system) => system.businessServices.map((service) => service.name))
          )
        ).sort((a, b) => a.localeCompare(b)),
        dependentSystems: Array.from(systemIds)
          .map((systemId) => scopedSystems.find((system) => system.id === systemId)?.name ?? systemId)
          .sort((a, b) => a.localeCompare(b))
      }
    });
  }

  for (const service of Array.from(serviceById.values()).sort((a, b) => a.name.localeCompare(b.name))) {
    const systemIds = serviceSystemMap.get(service.id) ?? new Set<string>();
    const summaries = summarizeSystems(systemIds, evaluationsBySystemId);
    const nodeId = `service:${service.id}`;
    serviceNodeIdByServiceId.set(service.id, nodeId);
    nodes.push({
      id: nodeId,
      entityId: service.id,
      entityType: "service",
      name: service.name,
      cyberCompliance: summaries.cyber,
      discoveryCompliance: summaries.discovery,
      details: {
        description: `${service.name} business service is delivered by downstream ICT systems within this managed network scope.`,
        criticality:
          scopedSystems.find((system) => system.businessServices.some((item) => item.id === service.id))
            ?.businessServices.find((item) => item.id === service.id)?.criticality ?? "Unknown",
        dependentSystems: Array.from(systemIds)
          .map((systemId) => scopedSystems.find((system) => system.id === systemId)?.name ?? systemId)
          .sort((a, b) => a.localeCompare(b)),
        connectedMissionCapabilities: Array.from(
          new Set(
            scopedSystems
              .filter((system) => system.businessServices.some((item) => item.id === service.id))
              .flatMap((system) => system.missionCapabilities.map((mission) => mission.name))
          )
        ).sort((a, b) => a.localeCompare(b)),
        connectedServices: Array.from(
          new Set(
            scopedSystems
              .filter((system) => system.businessServices.some((item) => item.id === service.id))
              .flatMap((system) => system.businessServices.map((item) => item.name))
          )
        )
          .filter((name) => name !== service.name)
          .sort((a, b) => a.localeCompare(b))
      }
    });
  }

  for (const system of [...scopedSystems].sort((a, b) => a.name.localeCompare(b.name))) {
    const summaries = summarizeSystems([system.id], evaluationsBySystemId);
    const node = buildSystemNode(system, summaries);
    nodes.push(node);
    systemNodeIdBySystemId.set(system.id, node.id);
  }

  const { edges, addEdge } = createEdgeAccumulator();
  for (const system of scopedSystems) {
    const systemNodeId = systemNodeIdBySystemId.get(system.id);
    for (const mission of system.missionCapabilities) {
      if (system.businessServices.length) {
        for (const service of system.businessServices) {
          addEdge(missionNodeIdByMissionId.get(mission.id), serviceNodeIdByServiceId.get(service.id));
        }
      } else {
        addEdge(missionNodeIdByMissionId.get(mission.id), systemNodeId);
      }
    }
    for (const service of system.businessServices) {
      addEdge(serviceNodeIdByServiceId.get(service.id), systemNodeId);
    }
  }

  // Rule 3: allow service -> service hierarchy (deterministic chain per mission scope).
  for (const mission of missionById.values()) {
    const serviceIds = Array.from(
      new Set(
        scopedSystems
          .filter((system) => system.missionCapabilities.some((item) => item.id === mission.id))
          .flatMap((system) => system.businessServices.map((service) => service.id))
      )
    ).sort((a, b) => {
      const left = serviceById.get(a)?.name ?? a;
      const right = serviceById.get(b)?.name ?? b;
      return left.localeCompare(right);
    });
    for (let index = 0; index < serviceIds.length - 1; index += 1) {
      addEdge(
        serviceNodeIdByServiceId.get(serviceIds[index]),
        serviceNodeIdByServiceId.get(serviceIds[index + 1])
      );
    }
  }

  // Rule 4: allow ICT System -> ICT System hierarchy (deterministic chain per service scope).
  for (const service of serviceById.values()) {
    const systemIds = Array.from(serviceSystemMap.get(service.id) ?? [])
      .map((systemId) => ({
        systemId,
        name: scopedSystems.find((item) => item.id === systemId)?.name ?? systemId
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => item.systemId);
    for (let index = 0; index < systemIds.length - 1; index += 1) {
      addEdge(systemNodeIdBySystemId.get(systemIds[index]), systemNodeIdBySystemId.get(systemIds[index + 1]));
    }
  }

  const inboundNodeIdsBeforeNetworkRoot = new Set(edges.map((edge) => edge.toNodeId));
  for (const missionNodeId of missionNodeIdByMissionId.values()) {
    addEdge(networkNodeId, missionNodeId);
  }
  for (const serviceNodeId of serviceNodeIdByServiceId.values()) {
    if (!inboundNodeIdsBeforeNetworkRoot.has(serviceNodeId)) {
      addEdge(networkNodeId, serviceNodeId);
    }
  }
  for (const systemNodeId of systemNodeIdBySystemId.values()) {
    if (!inboundNodeIdsBeforeNetworkRoot.has(systemNodeId)) {
      addEdge(networkNodeId, systemNodeId);
    }
  }

  const { filteredNodes, filteredEdges } = filterReachableFromRoot(nodes, edges, networkNodeId);
  const downstreamSystemIds = new Set(
    filteredNodes.filter((node) => node.entityType === "ict-system").map((node) => node.entityId)
  );
  const cmdbTopologies = buildCmdbTopologies(
    dataset,
    scopedSystems,
    downstreamSystemIds,
    new Set([networkId]),
    evaluationsByAssetId
  );
  const cmdbAssetIds = collectCmdbAssetIds(cmdbTopologies);
  const ciDependencyData = buildCiDependencyTopologyData(dataset, cmdbAssetIds, cmdbAssetIds);

  return {
    networkId,
    networkName,
    rootScope: { type: "network", id: networkId, name: networkName },
    nodes: filteredNodes,
    edges: filteredEdges,
    cmdbTopologies,
    ciNodes: ciDependencyData.ciNodes,
    ciDependencies: ciDependencyData.ciDependencies,
    modelAssetIds: ciDependencyData.modelAssetIds,
    preferredCoreNodeId: networkNodeId
  };
}

export function buildNetworkTopologyData(
  dataset: Dataset,
  analytics: AnalyticsResult,
  networkId: string,
  networkName: string,
  options: BuildNetworkTopologyOptions = {}
): NetworkTopologyData {
  if (options.mode === "full") {
    return buildMissionServiceNetworkTopologyData(dataset, analytics, networkId, networkName);
  }
  return buildDependencyNetworkTopologyData(dataset, analytics, networkId, networkName);
}

function buildDependencySystemTopologyData(
  dataset: Dataset,
  analytics: AnalyticsResult,
  systemId: string
): NetworkTopologyData {
  const system = dataset.ictSystems.find((item) => item.id === systemId);
  if (!system) {
    return {
      networkId: "unknown-network",
      networkName: "Unknown ICT System",
      rootScope: { type: "ict-system", id: systemId, name: "Unknown ICT System" },
      nodes: [],
      edges: [],
      cmdbTopologies: [],
      ciNodes: [],
      ciDependencies: [],
      modelAssetIds: []
    };
  }

  const systemNodeId = `system:${system.id}`;
  const systemsById = new Map(dataset.ictSystems.map((item) => [item.id, item]));
  const networkById = new Map(filterRealNetworks(dataset.managedNetworks).map((network) => [network.id, network]));
  const assetById = new Map(dataset.assets.map((asset) => [asset.id, asset]));
  const modelAssetIds = new Set<string>();
  for (const environment of system.environments) {
    for (const assetId of environment.assetIds) {
      if (assetById.has(assetId)) {
        modelAssetIds.add(assetId);
      }
    }
  }
  if (!modelAssetIds.size) {
    for (const asset of dataset.assets) {
      if (asset.systemContext?.systemId === system.id) {
        modelAssetIds.add(asset.id);
      }
    }
  }

  const modelAssets = Array.from(modelAssetIds)
    .map((assetId) => assetById.get(assetId))
    .filter((asset): asset is Asset => Boolean(asset));

  const modelAssetIdsBySystemId = new Map<string, Set<string>>();
  const modelAssetIdsByNetworkId = new Map<string, Set<string>>();
  const systemIdsByNetworkId = new Map<string, Set<string>>();
  for (const asset of modelAssets) {
    if (isRealNetworkId(asset.networkId) && networkById.has(asset.networkId)) {
      const assetsForNetwork = modelAssetIdsByNetworkId.get(asset.networkId) ?? new Set<string>();
      assetsForNetwork.add(asset.id);
      modelAssetIdsByNetworkId.set(asset.networkId, assetsForNetwork);
    }

    const ownerSystemId = asset.systemContext?.systemId;
    if (!ownerSystemId || !systemsById.has(ownerSystemId)) {
      continue;
    }
    const assetsForSystem = modelAssetIdsBySystemId.get(ownerSystemId) ?? new Set<string>();
    assetsForSystem.add(asset.id);
    modelAssetIdsBySystemId.set(ownerSystemId, assetsForSystem);

    if (isRealNetworkId(asset.networkId)) {
      const systemsForNetwork = systemIdsByNetworkId.get(asset.networkId) ?? new Set<string>();
      systemsForNetwork.add(ownerSystemId);
      systemIdsByNetworkId.set(asset.networkId, systemsForNetwork);
    }
  }

  const dependentSystemIds = Array.from(modelAssetIdsBySystemId.keys())
    .filter((item) => item !== system.id && systemsById.has(item))
    .sort((left, right) => {
      const leftName = systemsById.get(left)?.name ?? left;
      const rightName = systemsById.get(right)?.name ?? right;
      return leftName.localeCompare(rightName);
    });
  const dependentNetworkIds = Array.from(modelAssetIdsByNetworkId.keys())
    .filter((item) => item !== system.networkId && networkById.has(item))
    .sort((left, right) => {
      const leftName = networkById.get(left)?.name ?? left;
      const rightName = networkById.get(right)?.name ?? right;
      return leftName.localeCompare(rightName);
    });

  const scopedSystemIds = new Set<string>([system.id, ...dependentSystemIds]);
  const scopedSystems = dataset.ictSystems
    .filter((item) => scopedSystemIds.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const scopedNetworkIds = new Set<string>(dependentNetworkIds);
  const scopedNetworks = filterRealNetworks(dataset.managedNetworks)
    .filter((network) => scopedNetworkIds.has(network.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const evaluationsBySystemId = mapEvaluationsBySystemId(analytics, scopedSystemIds);
  const evaluationsByAssetId = mapEvaluationsByAssetId(analytics);
  const summarizeSystemFromModelScope = (targetSystemId: string) => {
    const assetIds = modelAssetIdsBySystemId.get(targetSystemId);
    if (assetIds?.size) {
      return summarizeAssets(assetIds, evaluationsByAssetId);
    }
    return summarizeSystems([targetSystemId], evaluationsBySystemId);
  };
  const coreRelatedSystemNames = dependentSystemIds
    .map((item) => systemsById.get(item)?.name ?? item)
    .sort((a, b) => a.localeCompare(b));
  const coreSystemSummary = summarizeSystemFromModelScope(system.id);
  const nodes: TopologyNode[] = [];
  const systemNodeIdBySystemId = new Map<string, string>();
  const coreNode = buildSystemNode(
    system,
    coreSystemSummary,
    coreRelatedSystemNames.length ? coreRelatedSystemNames : undefined
  );
  nodes.push(coreNode);
  systemNodeIdBySystemId.set(system.id, coreNode.id);
  for (const dependentSystemId of dependentSystemIds) {
    const dependentSystem = systemsById.get(dependentSystemId);
    if (!dependentSystem) {
      continue;
    }
    const dependentSummary = summarizeSystemFromModelScope(dependentSystem.id);
    const node = buildSystemNode(
      dependentSystem,
      dependentSummary,
      [system.name]
    );
    nodes.push(node);
    systemNodeIdBySystemId.set(dependentSystem.id, node.id);
  }

  const networkNodeIdByNetworkId = new Map<string, string>();
  for (const network of scopedNetworks) {
    const relatedSystems = (Array.from(systemIdsByNetworkId.get(network.id) ?? []) as string[])
      .map((item) => systemsById.get(item))
      .filter((item): item is ICTSystem => Boolean(item));
    const dependentMissionNames = Array.from(
      new Set(relatedSystems.flatMap((item) => item.missionCapabilities.map((mission) => mission.name)))
    ).sort((a, b) => a.localeCompare(b));
    const dependentServiceNames = Array.from(
      new Set(relatedSystems.flatMap((item) => item.businessServices.map((service) => service.name)))
    ).sort((a, b) => a.localeCompare(b));
    const dependentSystemNames = relatedSystems.map((item) => item.name).sort((a, b) => a.localeCompare(b));
    const summaries = summarizeAssets(modelAssetIdsByNetworkId.get(network.id) ?? [], evaluationsByAssetId);
    const node = buildNetworkNode(
      dataset,
      network.id,
      network.name,
      summaries,
      dependentMissionNames,
      dependentServiceNames,
      dependentSystemNames
    );
    nodes.push(node);
    networkNodeIdByNetworkId.set(network.id, node.id);
  }

  const { edges, addEdge } = createEdgeAccumulator();
  for (const dependentSystemId of dependentSystemIds) {
    addEdge(systemNodeId, systemNodeIdBySystemId.get(dependentSystemId));
  }

  for (const dependentNetworkId of dependentNetworkIds) {
    addEdge(systemNodeId, networkNodeIdByNetworkId.get(dependentNetworkId));
  }

  const { filteredNodes, filteredEdges } = filterReachableFromRoot(nodes, edges, systemNodeId);
  const filteredSystemIds = new Set(
    filteredNodes.filter((node) => node.entityType === "ict-system").map((node) => node.entityId)
  );
  const includedSystemIds = filteredSystemIds.size ? filteredSystemIds : scopedSystemIds;
  const cmdbNetworkScopeIds = new Set<string>();
  for (const asset of modelAssets) {
    if (isRealNetworkId(asset.networkId) && networkById.has(asset.networkId)) {
      cmdbNetworkScopeIds.add(asset.networkId);
    }
  }
  if (!cmdbNetworkScopeIds.size && isRealNetworkId(system.networkId) && networkById.has(system.networkId)) {
    cmdbNetworkScopeIds.add(system.networkId);
  }
  const cmdbScopedAssetIds = new Set<string>();
  for (const asset of modelAssets) {
    if (!isRealNetworkId(asset.networkId)) {
      continue;
    }
    const ownerSystemId = asset.systemContext?.systemId;
    if (!ownerSystemId || !includedSystemIds.has(ownerSystemId)) {
      continue;
    }
    cmdbScopedAssetIds.add(asset.id);
  }
  const cmdbTopologies = buildCmdbTopologies(
    dataset,
    scopedSystems,
    includedSystemIds,
    cmdbNetworkScopeIds,
    evaluationsByAssetId,
    cmdbScopedAssetIds
  );
  const ciDependencyData = buildCiDependencyTopologyData(dataset, cmdbScopedAssetIds, modelAssetIds);

  return {
    networkId: system.networkId,
    networkName: system.name,
    rootScope: { type: "ict-system", id: system.id, name: system.name },
    nodes: filteredNodes,
    edges: filteredEdges,
    cmdbTopologies,
    ciNodes: ciDependencyData.ciNodes,
    ciDependencies: ciDependencyData.ciDependencies,
    modelAssetIds: ciDependencyData.modelAssetIds,
    preferredCoreNodeId: systemNodeId
  };
}

export function buildSystemTopologyData(
  dataset: Dataset,
  analytics: AnalyticsResult,
  systemId: string
): NetworkTopologyData {
  return buildDependencySystemTopologyData(dataset, analytics, systemId);
}
