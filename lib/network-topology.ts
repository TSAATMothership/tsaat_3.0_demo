import { Asset, AnalyticsResult, ComplianceStatus, Dataset, ICTSystem } from "@/lib/types";
import { resolveNetworkDetailFields } from "@/lib/network-detail-fields";

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
  type: Asset["type"];
}

export interface CmdbSystemTopology {
  systemId: string;
  systemName: string;
  networkDevices: CmdbAssetNode[];
  workstations: CmdbAssetNode[];
  servers: CmdbAssetNode[];
}

export interface NetworkTopologyData {
  networkId: string;
  networkName: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  cmdbTopologies: CmdbSystemTopology[];
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
  const normalizedId = system.id.replace(/[^a-z0-9]+/gi, "-").toUpperCase();
  return `APM-${normalizedId}`;
}

function fallbackSystemApmUrl(apmNumber: string): string {
  return `https://apm.defence.gov.au/applications/${encodeURIComponent(apmNumber)}`;
}

export function buildNetworkTopologyData(
  dataset: Dataset,
  analytics: AnalyticsResult,
  networkId: string,
  networkName: string
): NetworkTopologyData {
  const networkNodeId = `network:${networkId}`;
  const network = dataset.managedNetworks.find((item) => item.id === networkId);
  const scopedSystems = dataset.ictSystems.filter((system) => system.networkId === networkId);
  const scopedSystemIds = new Set(scopedSystems.map((system) => system.id));
  const evaluationsBySystemId = new Map<
    string,
    Array<{
      statuses: ComplianceStatus[];
      discoveryCoverageCompliant: boolean;
    }>
  >();

  for (const evaluation of analytics.evaluations) {
    if (!evaluation.systemId || !scopedSystemIds.has(evaluation.systemId)) {
      continue;
    }
    const current = evaluationsBySystemId.get(evaluation.systemId) ?? [];
    current.push({
      statuses: evaluation.evaluations.map((item) => item.status),
      discoveryCoverageCompliant: evaluation.discoveryCoverageCompliant
    });
    evaluationsBySystemId.set(evaluation.systemId, current);
  }

  const missionSystemMap = collectSystemIdsByMission(scopedSystems);
  const serviceSystemMap = collectSystemIdsByService(scopedSystems);
  const nodes: TopologyNode[] = [];
  const missionNodeIdByMissionId = new Map<string, string>();
  const serviceNodeIdByServiceId = new Map<string, string>();
  const systemNodeIdBySystemId = new Map<string, string>();

  const summarizeSystems = (systemIds: Iterable<string>) => {
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
  };
  const networkSummary = summarizeSystems(scopedSystemIds);
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
  const dependentMissionNames = Array.from(
    new Set(scopedSystems.flatMap((system) => system.missionCapabilities.map((mission) => mission.name)))
  ).sort((a, b) => a.localeCompare(b));
  const dependentServiceNames = Array.from(
    new Set(scopedSystems.flatMap((system) => system.businessServices.map((service) => service.name)))
  ).sort((a, b) => a.localeCompare(b));
  const dependentSystemNames = scopedSystems.map((system) => system.name).sort((a, b) => a.localeCompare(b));
  nodes.push({
    id: networkNodeId,
    entityId: networkId,
    entityType: "network",
    name: networkName,
    cyberCompliance: networkSummary.cyber,
    discoveryCompliance: networkSummary.discovery,
    details: {
      description: networkDetails.description,
      classification: network?.classification ?? "Unknown",
      discoveryStatus: network?.discoveryStatus ?? "Unknown",
      criticality: network?.criticality ?? "Unknown",
      owner: networkDetails.owner,
      supportEmail: networkDetails.supportEmail,
      serviceCatalogueUrl: networkDetails.serviceCatalogueUrl,
      atoNumber: networkDetails.atoNumber,
      diisUrl: networkDetails.diisUrl,
      grcUrl: networkDetails.grcUrl,
      missionCapabilities: dependentMissionNames,
      businessServices: dependentServiceNames,
      dependentSystems: dependentSystemNames
    }
  });

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
    const summaries = summarizeSystems(systemIds);
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
    const summaries = summarizeSystems(systemIds);
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
    const summaries = summarizeSystems([system.id]);
    const atoNumber = fallbackSystemAtoNumber(system);
    const apmNumber = fallbackSystemApmNumber(system);
    const nodeId = `system:${system.id}`;
    systemNodeIdBySystemId.set(system.id, nodeId);
    nodes.push({
      id: nodeId,
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
        businessServices: system.businessServices.map((service) => service.name).sort((a, b) => a.localeCompare(b))
      }
    });
  }

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

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const current = adjacency.get(edge.fromNodeId) ?? [];
    current.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, current);
  }
  const reachableNodeIds = new Set<string>([networkNodeId]);
  const queue: string[] = [networkNodeId];
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

  const assetsBySystemId = new Map<string, Asset[]>();
  for (const asset of dataset.assets) {
    if (asset.networkId !== networkId) {
      continue;
    }
    const systemId = asset.systemContext?.systemId;
    if (!systemId || !scopedSystemIds.has(systemId)) {
      continue;
    }
    const current = assetsBySystemId.get(systemId) ?? [];
    current.push(asset);
    assetsBySystemId.set(systemId, current);
  }

  const downstreamSystemIds = new Set(
    filteredNodes.filter((node) => node.entityType === "ict-system").map((node) => node.entityId)
  );
  const cmdbTopologies = scopedSystems
    .filter((system) => downstreamSystemIds.has(system.id))
    .map((system) => {
      const assets = assetsBySystemId.get(system.id) ?? [];
      const mappedAssets = assets
        .map((asset) => ({
          id: asset.id,
          name: asset.name,
          hostname: asset.hostname,
          ipAddress: resolveAssetIpAddress(asset),
          type: asset.type
        }))
        .sort((a, b) => a.hostname.localeCompare(b.hostname));
      return {
        systemId: system.id,
        systemName: system.name,
        networkDevices: mappedAssets.filter((asset) => asset.type === "network-device"),
        workstations: mappedAssets.filter((asset) => asset.type === "workstation"),
        servers: mappedAssets.filter((asset) => asset.type === "server")
      };
    })
    .sort((a, b) => a.systemName.localeCompare(b.systemName));

  return {
    networkId,
    networkName,
    nodes: filteredNodes,
    edges: filteredEdges,
    cmdbTopologies,
    preferredCoreNodeId: networkNodeId
  };
}

export function buildSystemTopologyData(
  dataset: Dataset,
  analytics: AnalyticsResult,
  systemId: string
): NetworkTopologyData {
  const system = dataset.ictSystems.find((item) => item.id === systemId);
  if (!system) {
    return {
      networkId: "unknown-network",
      networkName: "Unknown Network",
      nodes: [],
      edges: [],
      cmdbTopologies: []
    };
  }

  const managedNetwork = dataset.managedNetworks.find((network) => network.id === system.networkId);
  const baseTopology = buildNetworkTopologyData(
    dataset,
    analytics,
    system.networkId,
    managedNetwork?.name ?? system.networkId
  );
  const systemNode = baseTopology.nodes.find(
    (node) => node.entityType === "ict-system" && node.entityId === systemId
  );
  if (!systemNode) {
    return {
      ...baseTopology,
      preferredCoreNodeId: baseTopology.preferredCoreNodeId
    };
  }

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of baseTopology.edges) {
    const fromCurrent = outgoing.get(edge.fromNodeId) ?? [];
    fromCurrent.push(edge.toNodeId);
    outgoing.set(edge.fromNodeId, fromCurrent);
    const toCurrent = incoming.get(edge.toNodeId) ?? [];
    toCurrent.push(edge.fromNodeId);
    incoming.set(edge.toNodeId, toCurrent);
  }

  const descendantNodeIds = new Set<string>([systemNode.id]);
  const descendantsQueue = [systemNode.id];
  while (descendantsQueue.length) {
    const currentNodeId = descendantsQueue.shift();
    if (!currentNodeId) {
      continue;
    }
    for (const nextNodeId of outgoing.get(currentNodeId) ?? []) {
      if (descendantNodeIds.has(nextNodeId)) {
        continue;
      }
      descendantNodeIds.add(nextNodeId);
      descendantsQueue.push(nextNodeId);
    }
  }

  const ancestorNodeIds = new Set<string>([systemNode.id]);
  const ancestorsQueue = [systemNode.id];
  while (ancestorsQueue.length) {
    const currentNodeId = ancestorsQueue.shift();
    if (!currentNodeId) {
      continue;
    }
    for (const nextNodeId of incoming.get(currentNodeId) ?? []) {
      if (ancestorNodeIds.has(nextNodeId)) {
        continue;
      }
      ancestorNodeIds.add(nextNodeId);
      ancestorsQueue.push(nextNodeId);
    }
  }

  const scopedNodeIds = new Set<string>([...ancestorNodeIds, ...descendantNodeIds]);
  const scopedNodes = baseTopology.nodes.filter((node) => scopedNodeIds.has(node.id));
  const scopedEdges = baseTopology.edges.filter(
    (edge) => scopedNodeIds.has(edge.fromNodeId) && scopedNodeIds.has(edge.toNodeId)
  );
  const scopedSystemIds = new Set(
    scopedNodes.filter((node) => node.entityType === "ict-system").map((node) => node.entityId)
  );
  const scopedCmdbTopologies = baseTopology.cmdbTopologies.filter((item) => scopedSystemIds.has(item.systemId));

  return {
    ...baseTopology,
    nodes: scopedNodes,
    edges: scopedEdges,
    cmdbTopologies: scopedCmdbTopologies,
    preferredCoreNodeId: systemNode.id
  };
}
