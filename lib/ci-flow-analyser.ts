import type { TopologyCiDependency, TopologyCiNode } from "@/lib/network-topology";
import type { AssetType, EnvironmentType, SecurityDomain } from "@/lib/types";

export type CiFlowRelationshipType = "Flow Dependency" | "Logical Dependency";

export interface CiFlowRelationship {
  id: string;
  sourceAssetId: string;
  targetAssetId: string;
  dependencyType: CiFlowRelationshipType;
}

export interface CiFlowAssetScope {
  visibleAssetIds: string[];
  visibleDependencies: CiFlowRelationship[];
  depthByAssetId: Map<string, number>;
}

export interface CiAnalyserRow {
  findingId: null;
  systemId: string | null;
  systemName: string;
  environmentType: EnvironmentType | null;
  assetId: string;
  assetName: string;
  assetHostname: string;
  assetType: AssetType;
  assetIpAddress: string;
  networkId: string;
  networkName: string;
  hasIctSystem: boolean;
  serverId: string;
  serverName: string;
  serverHostname: string;
  securityDomain: SecurityDomain;
  severity: null;
  spiId: null;
  spiLabel: string;
  hasOpenFinding: false;
  relatedAssetId: string;
  relatedAssetName: string;
  relatedAssetHostname: string;
  relatedAssetType: AssetType;
  relatedAssetIpAddress: string;
  relatedSystemId: string | null;
  relatedSystemName: string;
}

export const NON_MODELLED_RELATED_SYSTEM_LABEL = "Non Modelled";

function isSupportedRelationshipType(value: string): value is CiFlowRelationshipType {
  return value === "Flow Dependency" || value === "Logical Dependency";
}

function ciDisplayName(node: TopologyCiNode): string {
  return node.name || node.hostname || node.id;
}

export function buildCiFlowAssetScope({
  rootAssetId,
  ciNodes,
  ciDependencies,
  includedAssetTypes,
  includedDependencyTypes,
  maxRelatedNodes
}: {
  rootAssetId: string;
  ciNodes: TopologyCiNode[];
  ciDependencies: TopologyCiDependency[];
  includedAssetTypes: Iterable<AssetType>;
  includedDependencyTypes: Iterable<CiFlowRelationshipType>;
  maxRelatedNodes: number;
}): CiFlowAssetScope {
  const ciNodeByAssetId = new Map(ciNodes.map((node) => [node.id, node]));
  const includedAssetTypeSet = new Set(includedAssetTypes);
  const includedDependencyTypeSet = new Set(includedDependencyTypes);
  const relationships: CiFlowRelationship[] = [];
  const undirectedAdjacency = new Map<string, Set<string>>();

  for (const dependency of ciDependencies) {
    if (!isSupportedRelationshipType(dependency.dependencyType)) {
      continue;
    }
    if (!includedDependencyTypeSet.has(dependency.dependencyType)) {
      continue;
    }
    if (!ciNodeByAssetId.has(dependency.sourceAssetId) || !ciNodeByAssetId.has(dependency.targetAssetId)) {
      continue;
    }
    if (dependency.sourceAssetId === dependency.targetAssetId) {
      continue;
    }
    relationships.push({
      id: dependency.id,
      sourceAssetId: dependency.sourceAssetId,
      targetAssetId: dependency.targetAssetId,
      dependencyType: dependency.dependencyType
    });
    const sourceAdjacency = undirectedAdjacency.get(dependency.sourceAssetId) ?? new Set<string>();
    sourceAdjacency.add(dependency.targetAssetId);
    undirectedAdjacency.set(dependency.sourceAssetId, sourceAdjacency);
    const targetAdjacency = undirectedAdjacency.get(dependency.targetAssetId) ?? new Set<string>();
    targetAdjacency.add(dependency.sourceAssetId);
    undirectedAdjacency.set(dependency.targetAssetId, targetAdjacency);
  }

  const includedAssetIds = new Set<string>([rootAssetId]);
  const traversalQueue = [rootAssetId];
  while (traversalQueue.length && includedAssetIds.size < maxRelatedNodes) {
    const currentAssetId = traversalQueue.shift();
    if (!currentAssetId) {
      continue;
    }
    for (const relatedAssetId of undirectedAdjacency.get(currentAssetId) ?? []) {
      if (includedAssetIds.has(relatedAssetId)) {
        continue;
      }
      includedAssetIds.add(relatedAssetId);
      traversalQueue.push(relatedAssetId);
      if (includedAssetIds.size >= maxRelatedNodes) {
        break;
      }
    }
  }

  const visibleAssetIds = new Set<string>();
  for (const assetId of includedAssetIds) {
    if (assetId === rootAssetId) {
      visibleAssetIds.add(assetId);
      continue;
    }
    const node = ciNodeByAssetId.get(assetId);
    if (node && includedAssetTypeSet.has(node.type)) {
      visibleAssetIds.add(assetId);
    }
  }

  const depthByAssetId = new Map<string, number>([[rootAssetId, 0]]);
  const depthQueue = [rootAssetId];
  while (depthQueue.length) {
    const currentAssetId = depthQueue.shift();
    if (!currentAssetId) {
      continue;
    }
    const currentDepth = depthByAssetId.get(currentAssetId) ?? 0;
    for (const relatedAssetId of undirectedAdjacency.get(currentAssetId) ?? []) {
      if (!visibleAssetIds.has(relatedAssetId) || depthByAssetId.has(relatedAssetId)) {
        continue;
      }
      depthByAssetId.set(relatedAssetId, currentDepth + 1);
      depthQueue.push(relatedAssetId);
    }
  }
  for (const assetId of visibleAssetIds) {
    if (!depthByAssetId.has(assetId)) {
      depthByAssetId.set(assetId, 1);
    }
  }

  const visibleDependencies = relationships.filter(
    (dependency) => visibleAssetIds.has(dependency.sourceAssetId) && visibleAssetIds.has(dependency.targetAssetId)
  );

  return {
    visibleAssetIds: Array.from(visibleAssetIds),
    visibleDependencies,
    depthByAssetId
  };
}

export function buildCiAnalyserRowsFromScope({
  rootAssetId,
  ciNodes,
  scope,
  networkNameById
}: {
  rootAssetId: string;
  ciNodes: TopologyCiNode[];
  scope: Pick<CiFlowAssetScope, "visibleAssetIds" | "depthByAssetId">;
  networkNameById: Map<string, string>;
}): CiAnalyserRow[] {
  const ciNodeByAssetId = new Map(ciNodes.map((node) => [node.id, node]));
  const rootNode = ciNodeByAssetId.get(rootAssetId);
  if (!rootNode) {
    return [];
  }

  const rootSystemName = rootNode.systemId ? rootNode.systemName ?? rootNode.systemId : NON_MODELLED_RELATED_SYSTEM_LABEL;
  const rows = scope.visibleAssetIds
    .filter((assetId) => assetId !== rootAssetId)
    .map((assetId) => ciNodeByAssetId.get(assetId))
    .filter((node): node is TopologyCiNode => Boolean(node))
    .map((relatedNode): CiAnalyserRow => {
      const relatedSystemName = relatedNode.systemId
        ? relatedNode.systemName ?? relatedNode.systemId
        : NON_MODELLED_RELATED_SYSTEM_LABEL;
      return {
        findingId: null,
        systemId: rootNode.systemId,
        systemName: rootSystemName,
        environmentType: rootNode.environmentType,
        assetId: rootNode.id,
        assetName: ciDisplayName(rootNode),
        assetHostname: rootNode.hostname || rootNode.name || rootNode.id,
        assetType: rootNode.type,
        assetIpAddress: rootNode.ipAddress || "N/A",
        networkId: rootNode.networkId,
        networkName: networkNameById.get(rootNode.networkId) ?? rootNode.networkId,
        hasIctSystem: Boolean(rootNode.systemId),
        serverId: rootNode.id,
        serverName: ciDisplayName(rootNode),
        serverHostname: rootNode.hostname || rootNode.name || rootNode.id,
        securityDomain: "Unclassified",
        severity: null,
        spiId: null,
        spiLabel: "",
        hasOpenFinding: false,
        relatedAssetId: relatedNode.id,
        relatedAssetName: ciDisplayName(relatedNode),
        relatedAssetHostname: relatedNode.hostname || relatedNode.name || relatedNode.id,
        relatedAssetType: relatedNode.type,
        relatedAssetIpAddress: relatedNode.ipAddress || "N/A",
        relatedSystemId: relatedNode.systemId,
        relatedSystemName
      };
    });

  return rows.sort((left, right) => {
    const leftDepth = scope.depthByAssetId.get(left.relatedAssetId) ?? Number.MAX_SAFE_INTEGER;
    const rightDepth = scope.depthByAssetId.get(right.relatedAssetId) ?? Number.MAX_SAFE_INTEGER;
    if (leftDepth !== rightDepth) {
      return leftDepth - rightDepth;
    }
    const systemDelta = left.relatedSystemName.localeCompare(right.relatedSystemName);
    if (systemDelta !== 0) {
      return systemDelta;
    }
    return left.relatedAssetName.localeCompare(right.relatedAssetName);
  });
}
