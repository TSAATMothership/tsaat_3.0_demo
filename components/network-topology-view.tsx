"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { NetworkTopologyData, TopologyEntityType, TopologyNodeDetails } from "@/lib/network-topology";

type ComplianceMode = "cyber" | "discovery";
type TopologyLayoutMode = "hierarchical" | "partitioned" | "radial";
type CiAssetType = "network-device" | "workstation" | "server";
type CiEnvironmentLabel = "Production" | "Development" | "UAT" | "Test" | "Unassigned";
const MIN_CAMERA_DISTANCE = 260;
const MAX_CAMERA_DISTANCE = 8200;
const CI_ASSET_TYPES: CiAssetType[] = ["network-device", "workstation", "server"];
const CI_ENVIRONMENT_ORDER: CiEnvironmentLabel[] = ["Production", "Development", "UAT", "Test", "Unassigned"];
const DETAILED_TILE_WIDTH = 352;
const DETAILED_TILE_HEIGHT = 160;
const DETAILED_CI_TILE_WIDTH = 520;
const DETAILED_CI_TILE_HEIGHT = 82;
const DETAILED_CI_ROW_GAP = 16;
const DETAILED_CI_TILE_MAX_WIDTH = 980;
const DETAILED_CI_TEXT_AVG_CHAR_WIDTH = 6.7;
const DETAILED_CI_PROGRESS_WIDTH = 186;
const DETAILED_CI_PROGRESS_HEIGHT = 10;
const DETAILED_CI_PROGRESS_TO_TEXT_GAP = 16;
const DETAILED_CI_SCORE_TEXT_RESERVE = 165;
const DETAILED_COLUMN_GAP = 220;
const DETAILED_ROW_GAP = 42;
const DETAILED_SECTION_GAP = 70;
const DETAILED_CANVAS_PADDING_X = 130;
const DETAILED_CANVAS_PADDING_Y = 120;
const CI_FLOW_MAX_RELATED_NODES = 110;
const CI_FLOW_BASE_RADIUS = 420;
const CI_FLOW_RADIUS_STEP = 260;
const CI_FLOW_NODE_HEIGHT = 142;
const CI_FLOW_NODE_MIN_WIDTH = 760;
const CI_FLOW_NODE_MAX_WIDTH = 1320;
const CI_FLOW_NOT_MODELLED_WIDTH = 360;
const CI_FLOW_NOT_MODELLED_HEIGHT = 124;
const CI_FLOW_VIEWPORT_PADDING = 320;

interface ScopedCiItem {
  id: string;
  hostname: string;
  name: string;
  ipAddress: string;
  environment: CiEnvironmentLabel;
  type: CiAssetType;
  systemId: string;
  networkId: string;
  cyberCompliance: {
    score: number;
    compliant: number;
    nonCompliant: number;
    other: number;
  };
  discoveryCompliance: {
    score: number;
    compliant: number;
    nonCompliant: number;
    other: number;
  };
}

interface LayoutNode {
  id: string;
  entityId: string;
  entityType: TopologyEntityType;
  name: string;
  cyberCompliance: {
    score: number;
    compliant: number;
    nonCompliant: number;
    other: number;
  };
  discoveryCompliance: {
    score: number;
    compliant: number;
    nonCompliant: number;
    other: number;
  };
  details: TopologyNodeDetails;
  position: THREE.Vector3;
}

interface TopologyLayout {
  nodes: LayoutNode[];
  size: { width: number; height: number };
}

interface RuntimeNodeState {
  mesh: THREE.Mesh;
  currentPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
}

type DetailedTileEntityType = TopologyEntityType | "environment" | "ci" | "not-modelled";

interface DetailedTreeNode {
  id: string;
  sourceNodeId?: string;
  ciAssetId?: string;
  entityType: DetailedTileEntityType;
  name: string;
  subtitle: string;
  cyberCompliance: {
    score: number;
    compliant: number;
    nonCompliant: number;
    other: number;
  };
  discoveryCompliance: {
    score: number;
    compliant: number;
    nonCompliant: number;
    other: number;
  };
  width: number;
  height: number;
  x: number;
  y: number;
}

interface DetailedTreeEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

interface DetailedTreeData {
  rootNodeId: string;
  nodes: DetailedTreeNode[];
  edges: DetailedTreeEdge[];
  width: number;
  height: number;
}

interface CiFlowNodeLayout {
  id: string;
  assetId?: string;
  entityType: "ci" | "not-modelled";
  name: string;
  subtitle: string;
  typeLabel: string;
  modelLabel: string;
  cyberCompliance: {
    score: number;
    compliant: number;
    nonCompliant: number;
    other: number;
  };
  discoveryCompliance: {
    score: number;
    compliant: number;
    nonCompliant: number;
    other: number;
  };
  isInModelScope: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface CiFlowEdgeLayout {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  dependencyType: "Logical Dependency" | "Flow Dependency" | "Unmodelled Attachment";
}

interface CiFlowGraphData {
  rootAssetId: string;
  nodes: CiFlowNodeLayout[];
  edges: CiFlowEdgeLayout[];
  viewCenterX: number;
  viewCenterY: number;
  width: number;
  height: number;
}

function entityTypeLabel(entityType: TopologyEntityType): string {
  if (entityType === "network") {
    return "Network";
  }
  if (entityType === "mission-capability") {
    return "Mission Capability";
  }
  if (entityType === "service") {
    return "Service";
  }
  return "ICT System";
}

function baseLevelForEntity(entityType: TopologyEntityType): number {
  if (entityType === "network") {
    return -1;
  }
  if (entityType === "mission-capability") {
    return 0;
  }
  if (entityType === "service") {
    return 1;
  }
  return 2;
}

function nodeColor(entityType: TopologyEntityType): number {
  if (entityType === "network") {
    return 0xfacc15;
  }
  if (entityType === "mission-capability") {
    return 0x86efac;
  }
  if (entityType === "service") {
    return 0xd8b4fe;
  }
  return 0xfdba74;
}

function edgeColor(entityType: TopologyEntityType): number {
  if (entityType === "network") {
    return 0xfacc15;
  }
  if (entityType === "mission-capability") {
    return 0x06b6d4;
  }
  if (entityType === "service") {
    return 0x0ea5e9;
  }
  return 0x818cf8;
}

function tileSurfaceClass(entityType: TopologyEntityType): string {
  if (entityType === "network") {
    return "bg-white/95";
  }
  if (entityType === "mission-capability") {
    return "bg-emerald-100/95";
  }
  if (entityType === "service") {
    return "bg-violet-100/95";
  }
  if (entityType === "ict-system") {
    return "bg-orange-100/95";
  }
  return "bg-sky-100/95";
}

function legendSwatchClass(entityType: TopologyEntityType): string {
  if (entityType === "network") {
    return "bg-white";
  }
  if (entityType === "mission-capability") {
    return "bg-emerald-200";
  }
  if (entityType === "service") {
    return "bg-violet-200";
  }
  return "bg-orange-200";
}

function detailedEntityTypeLabel(entityType: DetailedTileEntityType): string {
  if (entityType === "environment") {
    return "Environment Group";
  }
  if (entityType === "ci") {
    return "Configuration Item";
  }
  if (entityType === "not-modelled") {
    return "Not Modelled";
  }
  return entityTypeLabel(entityType);
}

function detailedTileColor(entityType: DetailedTileEntityType): string {
  if (entityType === "network") {
    return "#ffffff";
  }
  if (entityType === "mission-capability") {
    return "#d1fae5";
  }
  if (entityType === "service") {
    return "#ede9fe";
  }
  if (entityType === "ict-system") {
    return "#ffedd5";
  }
  if (entityType === "environment") {
    return "#dbeafe";
  }
  if (entityType === "not-modelled") {
    return "#fda4af";
  }
  return "#e2e8f0";
}

function detailedTileStrokeColor(entityType: DetailedTileEntityType): string {
  if (entityType === "network") {
    return "#facc15";
  }
  if (entityType === "mission-capability") {
    return "#34d399";
  }
  if (entityType === "service") {
    return "#a78bfa";
  }
  if (entityType === "ict-system") {
    return "#fb923c";
  }
  if (entityType === "environment") {
    return "#38bdf8";
  }
  if (entityType === "not-modelled") {
    return "#ef4444";
  }
  return "#94a3b8";
}

function combineComplianceSummaries(
  summaries: Array<{ compliant: number; nonCompliant: number; other: number }>
): { score: number; compliant: number; nonCompliant: number; other: number } {
  const totals = summaries.reduce(
    (accumulator, summary) => {
      return {
        compliant: accumulator.compliant + summary.compliant,
        nonCompliant: accumulator.nonCompliant + summary.nonCompliant,
        other: accumulator.other + summary.other
      };
    },
    { compliant: 0, nonCompliant: 0, other: 0 }
  );
  const total = totals.compliant + totals.nonCompliant + totals.other;
  if (!total) {
    return {
      score: 0,
      compliant: 0,
      nonCompliant: 0,
      other: 1
    };
  }
  return {
    score: Number(((totals.compliant / total) * 100).toFixed(1)),
    compliant: totals.compliant,
    nonCompliant: totals.nonCompliant,
    other: totals.other
  };
}

function emptyComplianceSummary() {
  return {
    score: 0,
    compliant: 0,
    nonCompliant: 0,
    other: 1
  };
}

function ciComplianceForMode(item: ScopedCiItem, mode: ComplianceMode) {
  return mode === "cyber" ? item.cyberCompliance : item.discoveryCompliance;
}

function compareCiByCompliance(left: ScopedCiItem, right: ScopedCiItem, mode: ComplianceMode) {
  const leftSummary = ciComplianceForMode(left, mode);
  const rightSummary = ciComplianceForMode(right, mode);
  if (leftSummary.score !== rightSummary.score) {
    return leftSummary.score - rightSummary.score;
  }
  if (leftSummary.nonCompliant !== rightSummary.nonCompliant) {
    return rightSummary.nonCompliant - leftSummary.nonCompliant;
  }
  return left.hostname.localeCompare(right.hostname);
}

function ciAssetTypeLabel(assetType: CiAssetType): string {
  if (assetType === "network-device") {
    return "Network Devices";
  }
  if (assetType === "workstation") {
    return "Workstations";
  }
  return "Servers";
}

function ciSearchKey(nodeId: string, assetType: CiAssetType): string {
  return `${nodeId}:${assetType}`;
}

function ciEnvironmentSearchKey(nodeId: string, environment: CiEnvironmentLabel): string {
  return `${nodeId}:environment:${environment}`;
}

function ciAssetTypeSingularLabel(assetType: CiAssetType): string {
  if (assetType === "network-device") {
    return "Network Device";
  }
  if (assetType === "workstation") {
    return "Workstation";
  }
  return "Server";
}

function ciFlowNodeIdForAsset(assetId: string): string {
  return `ci-flow:ci:${assetId}`;
}

function ciFlowNodeIdForNotModelled(): string {
  return "ci-flow:not-modelled";
}

function ciFlowDependencyColor(
  dependencyType: "Logical Dependency" | "Flow Dependency" | "Unmodelled Attachment"
): string {
  if (dependencyType === "Flow Dependency") {
    return "#22c55e";
  }
  if (dependencyType === "Logical Dependency") {
    return "#f97316";
  }
  return "#fb7185";
}

function normalizeCiEnvironmentLabel(environmentType: string | null | undefined): CiEnvironmentLabel {
  if (environmentType === "Production") {
    return "Production";
  }
  if (environmentType === "Development") {
    return "Development";
  }
  if (environmentType === "UAT") {
    return "UAT";
  }
  if (environmentType === "Test") {
    return "Test";
  }
  return "Unassigned";
}

function compliancePercentages(compliance: { compliant: number; nonCompliant: number; other: number }) {
  const total = compliance.compliant + compliance.nonCompliant + compliance.other;
  if (total <= 0) {
    return {
      compliant: 0,
      nonCompliant: 0,
      other: 100
    };
  }
  const compliant = Math.round((compliance.compliant / total) * 100);
  const nonCompliant = Math.round((compliance.nonCompliant / total) * 100);
  const other = Math.max(0, 100 - compliant - nonCompliant);
  return {
    compliant,
    nonCompliant,
    other
  };
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function truncateLabel(value: string, maxLength = 46): string {
  if (value.length <= maxLength) {
    return value;
  }
  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function estimateDetailedCiTileWidth(firstLineLabel: string): number {
  const firstLineEstimatedWidth = Math.ceil(firstLineLabel.length * DETAILED_CI_TEXT_AVG_CHAR_WIDTH) + 28;
  const secondLineMinimumWidth =
    DETAILED_CI_PROGRESS_WIDTH +
    DETAILED_CI_PROGRESS_TO_TEXT_GAP +
    DETAILED_CI_SCORE_TEXT_RESERVE +
    28;
  return Math.max(
    DETAILED_CI_TILE_WIDTH,
    Math.min(DETAILED_CI_TILE_MAX_WIDTH, Math.max(firstLineEstimatedWidth, secondLineMinimumWidth))
  );
}

function estimateCiFlowTileWidth(firstLineLabel: string): number {
  const detailedWidth = estimateDetailedCiTileWidth(firstLineLabel);
  return Math.max(CI_FLOW_NODE_MIN_WIDTH, Math.min(CI_FLOW_NODE_MAX_WIDTH, Math.round(detailedWidth * 1.45)));
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function zPositionForEntity(entityType: TopologyEntityType): number {
  if (entityType === "network") {
    return 130;
  }
  if (entityType === "mission-capability") {
    return 90;
  }
  if (entityType === "service") {
    return 30;
  }
  return -60;
}

function calculateLayoutSize(nodes: LayoutNode[], minWidth: number, minHeight: number, padding = 900) {
  if (!nodes.length) {
    return { width: minWidth, height: minHeight };
  }
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    maxX = Math.max(maxX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxY = Math.max(maxY, node.position.y);
  }
  return {
    width: Math.max(minWidth, maxX - minX + padding),
    height: Math.max(minHeight, maxY - minY + padding)
  };
}

function buildHierarchyTopologyLayout(data: NetworkTopologyData): TopologyLayout {
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const indegree = new Map<string, number>(data.nodes.map((node) => [node.id, 0]));

  for (const edge of data.edges) {
    if (!nodeById.has(edge.fromNodeId) || !nodeById.has(edge.toNodeId)) {
      continue;
    }
    const current = adjacency.get(edge.fromNodeId) ?? [];
    current.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, current);
    const currentIncoming = incoming.get(edge.toNodeId) ?? [];
    currentIncoming.push(edge.fromNodeId);
    incoming.set(edge.toNodeId, currentIncoming);
    indegree.set(edge.toNodeId, (indegree.get(edge.toNodeId) ?? 0) + 1);
  }

  const queue = data.nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort((a, b) => {
      const levelDelta = baseLevelForEntity(a.entityType) - baseLevelForEntity(b.entityType);
      if (levelDelta !== 0) {
        return levelDelta;
      }
      return a.name.localeCompare(b.name);
    })
    .map((node) => node.id);

  const orderedIds: string[] = [];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    orderedIds.push(current);
    for (const childId of adjacency.get(current) ?? []) {
      const nextDegree = (indegree.get(childId) ?? 1) - 1;
      indegree.set(childId, nextDegree);
      if (nextDegree === 0) {
        queue.push(childId);
      }
    }
  }

  for (const node of data.nodes) {
    if (!orderedIds.includes(node.id)) {
      orderedIds.push(node.id);
    }
  }

  const levelByNodeId = new Map<string, number>(
    data.nodes.map((node) => [node.id, baseLevelForEntity(node.entityType)])
  );
  for (const nodeId of orderedIds) {
    const parentLevel = levelByNodeId.get(nodeId) ?? 0;
    for (const childId of adjacency.get(nodeId) ?? []) {
      const candidateLevel = parentLevel + 1;
      if (candidateLevel > (levelByNodeId.get(childId) ?? 0)) {
        levelByNodeId.set(childId, candidateLevel);
      }
    }
  }

  const levelGroups = new Map<number, typeof data.nodes>();
  for (const node of data.nodes) {
    const level = levelByNodeId.get(node.id) ?? baseLevelForEntity(node.entityType);
    const current = levelGroups.get(level) ?? [];
    current.push(node);
    levelGroups.set(level, current);
  }

  const levels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
  const orderByNodeId = new Map<string, number>();
  for (const level of levels) {
    const group = levelGroups.get(level) ?? [];
    group.sort((left, right) => {
      const leftParents = incoming.get(left.id) ?? [];
      const rightParents = incoming.get(right.id) ?? [];
      const leftParentOrder =
        leftParents.length > 0
          ? leftParents.reduce((sum, id) => sum + (orderByNodeId.get(id) ?? 0), 0) / leftParents.length
          : Number.POSITIVE_INFINITY;
      const rightParentOrder =
        rightParents.length > 0
          ? rightParents.reduce((sum, id) => sum + (orderByNodeId.get(id) ?? 0), 0) / rightParents.length
          : Number.POSITIVE_INFINITY;
      const leftFinite = Number.isFinite(leftParentOrder);
      const rightFinite = Number.isFinite(rightParentOrder);
      if (leftFinite && rightFinite && leftParentOrder !== rightParentOrder) {
        return leftParentOrder - rightParentOrder;
      }
      if (leftFinite !== rightFinite) {
        return leftFinite ? -1 : 1;
      }
      const typeDelta = baseLevelForEntity(left.entityType) - baseLevelForEntity(right.entityType);
      if (typeDelta !== 0) {
        return typeDelta;
      }
      return left.name.localeCompare(right.name);
    });
    group.forEach((node, index) => {
      orderByNodeId.set(node.id, index);
    });
  }

  const positionedNodes: LayoutNode[] = [];
  const maxLevel = levels.length ? levels[levels.length - 1] : 0;
  let maxColumns = 1;
  const horizontalGap = 430;
  const verticalGap = 340;
  for (const level of levels) {
    const group = levelGroups.get(level) ?? [];
    maxColumns = Math.max(maxColumns, group.length);
    const yPosition = (maxLevel / 2 - level) * verticalGap;
    for (let index = 0; index < group.length; index += 1) {
      const node = group[index];
      const xPosition = (index - (group.length - 1) / 2) * horizontalGap;
      positionedNodes.push({
        ...node,
        position: new THREE.Vector3(xPosition, yPosition, zPositionForEntity(node.entityType))
      });
    }
  }
  const width = Math.max(2000, maxColumns * horizontalGap + 1100);
  const height = Math.max(1500, (maxLevel + 1) * verticalGap + 900);
  return {
    nodes: positionedNodes,
    size: { width, height }
  };
}

function buildPartitionedTopologyLayout(data: NetworkTopologyData): TopologyLayout {
  const rootNode = data.nodes.find((node) => node.entityType === "network") ?? null;
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const undirected = new Map<string, Set<string>>();
  for (const node of data.nodes) {
    if (rootNode?.id === node.id) {
      continue;
    }
    undirected.set(node.id, new Set<string>());
  }
  for (const edge of data.edges) {
    if (rootNode && (edge.fromNodeId === rootNode.id || edge.toNodeId === rootNode.id)) {
      continue;
    }
    if (!undirected.has(edge.fromNodeId) || !undirected.has(edge.toNodeId)) {
      continue;
    }
    undirected.get(edge.fromNodeId)?.add(edge.toNodeId);
    undirected.get(edge.toNodeId)?.add(edge.fromNodeId);
  }

  const components: string[][] = [];
  const visited = new Set<string>();
  const componentCandidates = Array.from(undirected.keys());
  for (const startNodeId of componentCandidates) {
    if (visited.has(startNodeId)) {
      continue;
    }
    const queue = [startNodeId];
    visited.add(startNodeId);
    const componentIds: string[] = [];
    while (queue.length) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      componentIds.push(current);
      for (const next of undirected.get(current) ?? []) {
        if (visited.has(next)) {
          continue;
        }
        visited.add(next);
        queue.push(next);
      }
    }
    components.push(
      componentIds.sort((left, right) => {
        const leftNode = nodeById.get(left);
        const rightNode = nodeById.get(right);
        if (!leftNode || !rightNode) {
          return left.localeCompare(right);
        }
        const typeDelta = baseLevelForEntity(leftNode.entityType) - baseLevelForEntity(rightNode.entityType);
        if (typeDelta !== 0) {
          return typeDelta;
        }
        return leftNode.name.localeCompare(rightNode.name);
      })
    );
  }

  const positionedNodes: LayoutNode[] = [];
  if (rootNode) {
    positionedNodes.push({
      ...rootNode,
      position: new THREE.Vector3(0, 760, zPositionForEntity(rootNode.entityType))
    });
  }

  if (!components.length) {
    return {
      nodes: positionedNodes,
      size: calculateLayoutSize(positionedNodes, 1800, 1400)
    };
  }

  const clusterRadius = components.length === 1 ? 0 : Math.max(700, components.length * 230);
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index];
    const baseAngle = components.length === 1 ? 0 : (index / components.length) * Math.PI * 2 - Math.PI / 2;
    const centerX = Math.cos(baseAngle) * clusterRadius;
    const centerY = components.length === 1 ? -120 : Math.sin(baseAngle) * Math.max(280, clusterRadius * 0.58) - 180;
    const localRadius = Math.max(260, component.length * 52);
    for (let nodeIndex = 0; nodeIndex < component.length; nodeIndex += 1) {
      const node = nodeById.get(component[nodeIndex]);
      if (!node) {
        continue;
      }
      const angle = (nodeIndex / component.length) * Math.PI * 2 - Math.PI / 2;
      positionedNodes.push({
        ...node,
        position: new THREE.Vector3(
          centerX + Math.cos(angle) * localRadius,
          centerY + Math.sin(angle) * localRadius,
          zPositionForEntity(node.entityType)
        )
      });
    }
  }

  return {
    nodes: positionedNodes,
    size: calculateLayoutSize(positionedNodes, 2300, 1800, 1100)
  };
}

function buildRadialTopologyLayout(data: NetworkTopologyData): TopologyLayout {
  const rootNode = data.nodes.find((node) => node.entityType === "network") ?? data.nodes[0] ?? null;
  if (!rootNode) {
    return { nodes: [], size: { width: 1800, height: 1400 } };
  }
  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();
  for (const edge of data.edges) {
    const current = adjacency.get(edge.fromNodeId) ?? [];
    current.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, current);
  }

  const depthByNodeId = new Map<string, number>([[rootNode.id, 0]]);
  const queue = [rootNode.id];
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const currentDepth = depthByNodeId.get(current) ?? 0;
    for (const childId of adjacency.get(current) ?? []) {
      if (depthByNodeId.has(childId)) {
        continue;
      }
      depthByNodeId.set(childId, currentDepth + 1);
      queue.push(childId);
    }
  }

  const maxKnownDepth = Math.max(...depthByNodeId.values(), 0);
  for (const node of data.nodes) {
    if (!depthByNodeId.has(node.id)) {
      depthByNodeId.set(node.id, maxKnownDepth + 1);
    }
  }

  const depthGroups = new Map<number, LayoutNode[]>();
  for (const node of data.nodes) {
    const depth = depthByNodeId.get(node.id) ?? maxKnownDepth + 1;
    const group = depthGroups.get(depth) ?? [];
    group.push({
      ...node,
      position: new THREE.Vector3(0, 0, zPositionForEntity(node.entityType))
    });
    depthGroups.set(depth, group);
  }

  const positionedNodes: LayoutNode[] = [];
  const radiusStep = 420;
  const sortedDepths = Array.from(depthGroups.keys()).sort((a, b) => a - b);
  for (const depth of sortedDepths) {
    const group = depthGroups.get(depth) ?? [];
    group.sort((left, right) => {
      const typeDelta = baseLevelForEntity(left.entityType) - baseLevelForEntity(right.entityType);
      if (typeDelta !== 0) {
        return typeDelta;
      }
      return left.name.localeCompare(right.name);
    });
    if (depth === 0) {
      const root = group[0];
      positionedNodes.push({
        ...root,
        position: new THREE.Vector3(0, 0, zPositionForEntity(root.entityType))
      });
      continue;
    }
    const radius = depth * radiusStep;
    for (let index = 0; index < group.length; index += 1) {
      const angle = (index / group.length) * Math.PI * 2 - Math.PI / 2;
      positionedNodes.push({
        ...group[index],
        position: new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          zPositionForEntity(group[index].entityType)
        )
      });
    }
  }

  return {
    nodes: positionedNodes,
    size: calculateLayoutSize(positionedNodes, 2200, 2000, 1200)
  };
}

function buildTopologyLayout(data: NetworkTopologyData, mode: TopologyLayoutMode): TopologyLayout {
  if (mode === "partitioned") {
    return buildPartitionedTopologyLayout(data);
  }
  if (mode === "radial") {
    return buildRadialTopologyLayout(data);
  }
  return buildHierarchyTopologyLayout(data);
}

export function NetworkTopologyView({
  isOpen,
  onClose,
  data
}: {
  isOpen: boolean;
  onClose: () => void;
  data: NetworkTopologyData;
}) {
  const [complianceMode, setComplianceMode] = useState<ComplianceMode>("cyber");
  const [selectedTileFilterId, setSelectedTileFilterId] = useState("__all__");
  const [tileFilterSearchText, setTileFilterSearchText] = useState("");
  const [isTileSearchFocused, setIsTileSearchFocused] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedDetailNodeId, setSelectedDetailNodeId] = useState<string | null>(null);
  const [renderedDetailNodeId, setRenderedDetailNodeId] = useState<string | null>(null);
  const [isDetailPanelVisible, setIsDetailPanelVisible] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [nodeCiSearchByKey, setNodeCiSearchByKey] = useState<Record<string, string>>({});
  const [nodeCiEnvironmentSearchByKey, setNodeCiEnvironmentSearchByKey] = useState<Record<string, string>>({});
  const [isDetailedTopologyOpen, setIsDetailedTopologyOpen] = useState(false);
  const [detailedRootNodeId, setDetailedRootNodeId] = useState<string | null>(null);
  const [detailedSelectedNodeId, setDetailedSelectedNodeId] = useState<string | null>(null);
  const [detailedSelectedTileFilterId, setDetailedSelectedTileFilterId] = useState("__all__");
  const [detailedTileFilterSearchText, setDetailedTileFilterSearchText] = useState("");
  const [isDetailedTileSearchFocused, setIsDetailedTileSearchFocused] = useState(false);
  const [detailedZoom, setDetailedZoom] = useState(1);
  const [focusedCiFlowRootAssetId, setFocusedCiFlowRootAssetId] = useState<string | null>(null);
  const [selectedCiFlowNodeId, setSelectedCiFlowNodeId] = useState<string | null>(null);
  const [ciFlowTweenProgress, setCiFlowTweenProgress] = useState(0);
  const [ciFlowViewportCenter, setCiFlowViewportCenter] = useState<{ x: number; y: number } | null>(null);
  const [ciFlowOriginCenter, setCiFlowOriginCenter] = useState<{ x: number; y: number } | null>(null);
  const [rendererInitError, setRendererInitError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const tileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const detailedTileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const detailedScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const ciFlowScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const detailedSvgRef = useRef<SVGSVGElement | null>(null);
  const tileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const runtimeNodesRef = useRef<Map<string, RuntimeNodeState>>(new Map());
  const nodePositionsDirtyRef = useRef(false);
  const suppressPersistedPositionsOnCleanupRef = useRef(false);
  const tileDragStateRef = useRef<{
    nodeId: string;
    pointerId: number;
    lastClientX: number;
    lastClientY: number;
  } | null>(null);
  const detailPanelCloseTimerRef = useRef<number | null>(null);
  const tileSearchBlurTimerRef = useRef<number | null>(null);
  const detailedTileSearchBlurTimerRef = useRef<number | null>(null);
  const detailedPanStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startScrollLeft: number;
    startScrollTop: number;
    hasMoved: boolean;
  } | null>(null);
  const suppressDetailedNodeClickRef = useRef(false);
  const detailedNodeClickSuppressTimerRef = useRef<number | null>(null);
  const ciFlowTweenFrameRef = useRef<number | null>(null);
  const detailedZoomBeforeCiFlowRef = useRef<number | null>(null);
  const ciFlowAutoFitPendingRef = useRef(false);
  const persistedCameraStateRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const persistedNodePositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const manualNodePositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const initialCameraPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 120, 2050));
  const initialTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  const layout = useMemo(() => buildTopologyLayout(data, "hierarchical"), [data]);
  const coreNode = useMemo(
    () =>
      (data.preferredCoreNodeId ? layout.nodes.find((node) => node.id === data.preferredCoreNodeId) : null) ??
      layout.nodes.find((node) => node.entityType === "network") ??
      layout.nodes[0] ??
      null,
    [data.preferredCoreNodeId, layout.nodes]
  );
  const nodeById = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout.nodes]);
  const selectedDetailNode = useMemo(
    () => (renderedDetailNodeId ? nodeById.get(renderedDetailNodeId) ?? null : null),
    [nodeById, renderedDetailNodeId]
  );
  const detailDrillthroughHref = useMemo(() => {
    if (!selectedDetailNode) {
      return null;
    }
    if (selectedDetailNode.entityType === "network") {
      return `/networks/${selectedDetailNode.entityId}`;
    }
    if (selectedDetailNode.entityType === "ict-system") {
      return `/systems/${selectedDetailNode.entityId}`;
    }
    return null;
  }, [selectedDetailNode]);
  const cmdbBySystemId = useMemo(() => new Map(data.cmdbTopologies.map((item) => [item.systemId, item])), [data]);
  const selectedCmdb = selectedSystemId ? cmdbBySystemId.get(selectedSystemId) ?? null : null;
  const allScopedCiItems = useMemo(() => {
    const items: ScopedCiItem[] = [];
    for (const topology of data.cmdbTopologies) {
      const systemAssets = [...topology.networkDevices, ...topology.workstations, ...topology.servers];
      for (const asset of systemAssets) {
        items.push({
          id: asset.id,
          hostname: asset.hostname,
          name: asset.name,
          ipAddress: asset.ipAddress,
          environment: normalizeCiEnvironmentLabel(asset.environmentType),
          type: asset.type,
          systemId: topology.systemId,
          networkId: asset.networkId,
          cyberCompliance: asset.cyberCompliance ?? emptyComplianceSummary(),
          discoveryCompliance: asset.discoveryCompliance ?? emptyComplianceSummary()
        });
      }
    }
    return items;
  }, [data.cmdbTopologies]);
  const scopedCiItemByAssetId = useMemo(() => {
    return new Map(allScopedCiItems.map((item) => [item.id, item]));
  }, [allScopedCiItems]);
  const flowCiNodeByAssetId = useMemo(() => {
    return new Map(data.ciNodes.map((node) => [node.id, node]));
  }, [data.ciNodes]);
  const modelAssetIdSet = useMemo(() => new Set(data.modelAssetIds), [data.modelAssetIds]);
  const ciItemsBySystemId = useMemo(() => {
    const map = new Map<string, ScopedCiItem[]>();
    for (const item of allScopedCiItems) {
      const current = map.get(item.systemId) ?? [];
      current.push(item);
      map.set(item.systemId, current);
    }
    return map;
  }, [allScopedCiItems]);
  const ciItemsByNetworkId = useMemo(() => {
    const map = new Map<string, ScopedCiItem[]>();
    for (const item of allScopedCiItems) {
      const current = map.get(item.networkId) ?? [];
      current.push(item);
      map.set(item.networkId, current);
    }
    return map;
  }, [allScopedCiItems]);
  const dependentSystemIdsByNodeId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const adjacency = new Map<string, string[]>();
    for (const edge of data.edges) {
      const current = adjacency.get(edge.fromNodeId) ?? [];
      current.push(edge.toNodeId);
      adjacency.set(edge.fromNodeId, current);
    }

    for (const node of layout.nodes) {
      if (node.entityType === "ict-system") {
        map.set(node.id, new Set([node.entityId]));
        continue;
      }
      if (node.entityType === "network") {
        map.set(node.id, new Set());
        continue;
      }

      const dependentSystemIds = new Set<string>();
      const visitedNodeIds = new Set<string>([node.id]);
      const queue = [...(adjacency.get(node.id) ?? [])];
      while (queue.length) {
        const currentNodeId = queue.shift();
        if (!currentNodeId || visitedNodeIds.has(currentNodeId)) {
          continue;
        }
        visitedNodeIds.add(currentNodeId);
        const currentNode = nodeById.get(currentNodeId);
        if (!currentNode) {
          continue;
        }
        if (currentNode.entityType === "ict-system") {
          dependentSystemIds.add(currentNode.entityId);
        }
        for (const nextNodeId of adjacency.get(currentNodeId) ?? []) {
          if (!visitedNodeIds.has(nextNodeId)) {
            queue.push(nextNodeId);
          }
        }
      }
      map.set(node.id, dependentSystemIds);
    }

    return map;
  }, [data.edges, layout.nodes, nodeById]);
  const ciItemsByNodeId = useMemo(() => {
    const map = new Map<string, ScopedCiItem[]>();
    for (const node of layout.nodes) {
      if (node.entityType === "network") {
        map.set(node.id, [...(ciItemsByNetworkId.get(node.entityId) ?? [])]);
        continue;
      }
      if (node.entityType === "ict-system") {
        map.set(node.id, [...(ciItemsBySystemId.get(node.entityId) ?? [])]);
        continue;
      }

      const nodeItems: ScopedCiItem[] = [];
      for (const dependentSystemId of dependentSystemIdsByNodeId.get(node.id) ?? []) {
        nodeItems.push(...(ciItemsBySystemId.get(dependentSystemId) ?? []));
      }

      const deduplicatedItems: ScopedCiItem[] = [];
      const seenAssetIds = new Set<string>();
      for (const item of nodeItems) {
        if (seenAssetIds.has(item.id)) {
          continue;
        }
        seenAssetIds.add(item.id);
        deduplicatedItems.push(item);
      }
      map.set(node.id, deduplicatedItems);
    }
    return map;
  }, [ciItemsByNetworkId, ciItemsBySystemId, dependentSystemIdsByNodeId, layout.nodes]);
  const ciAssetsByNodeId = useMemo(() => {
    const groupedByNodeId = new Map<
      string,
      Array<{
        assetType: CiAssetType;
        items: ScopedCiItem[];
      }>
    >();

    for (const node of layout.nodes) {
      const nodeItems = ciItemsByNodeId.get(node.id) ?? [];
      groupedByNodeId.set(
        node.id,
        CI_ASSET_TYPES.map((assetType) => ({
          assetType,
          items: nodeItems
            .filter((item) => item.type === assetType)
            .sort((left, right) => left.hostname.localeCompare(right.hostname))
        }))
      );
    }
    return groupedByNodeId;
  }, [ciItemsByNodeId, layout.nodes]);
  const ciEnvironmentGroupsByNodeId = useMemo(() => {
    const byNodeId = new Map<
      string,
      Array<{
        environment: CiEnvironmentLabel;
        items: ScopedCiItem[];
      }>
    >();

    for (const node of layout.nodes) {
      const byEnvironment = new Map<CiEnvironmentLabel, ScopedCiItem[]>();
      for (const item of ciItemsByNodeId.get(node.id) ?? []) {
        const current = byEnvironment.get(item.environment) ?? [];
        current.push(item);
        byEnvironment.set(item.environment, current);
      }

      const environmentGroups = CI_ENVIRONMENT_ORDER.filter((environment) => (byEnvironment.get(environment) ?? []).length)
        .map((environment) => ({
          environment,
          items: (byEnvironment.get(environment) ?? []).sort((left, right) =>
            compareCiByCompliance(left, right, complianceMode)
          )
        }));
      byNodeId.set(node.id, environmentGroups);
    }

    return byNodeId;
  }, [ciItemsByNodeId, complianceMode, layout.nodes]);
  const detailedRootNode = useMemo(() => {
    if (detailedRootNodeId) {
      const explicitRoot = nodeById.get(detailedRootNodeId);
      if (explicitRoot) {
        return explicitRoot;
      }
    }
    return coreNode ?? layout.nodes[0] ?? null;
  }, [coreNode, detailedRootNodeId, layout.nodes, nodeById]);
  const detailedTree = useMemo<DetailedTreeData | null>(() => {
    if (!detailedRootNode) {
      return null;
    }

    const rootCiItems = [...(ciItemsByNodeId.get(detailedRootNode.id) ?? [])].sort((left, right) =>
      compareCiByCompliance(left, right, complianceMode)
    );
    const ciItemsByEnvironment = new Map<CiEnvironmentLabel, ScopedCiItem[]>();
    for (const item of rootCiItems) {
      const current = ciItemsByEnvironment.get(item.environment) ?? [];
      current.push(item);
      ciItemsByEnvironment.set(item.environment, current);
    }

    const orderedEnvironments = CI_ENVIRONMENT_ORDER.filter((environment) =>
      ciItemsByEnvironment.has(environment)
    );
    if (!orderedEnvironments.length) {
      orderedEnvironments.push("Unassigned");
    }

    const resolveCiCompliance = (item: ScopedCiItem) => ({
      cyber: item.cyberCompliance,
      discovery: item.discoveryCompliance
    });
    const rootCyberCompliance = combineComplianceSummaries(rootCiItems.map((item) => item.cyberCompliance));
    const rootDiscoveryCompliance = combineComplianceSummaries(rootCiItems.map((item) => item.discoveryCompliance));

    const environmentSections = orderedEnvironments.map((environment) => {
      const ciItems = [...(ciItemsByEnvironment.get(environment) ?? [])].sort((left, right) =>
        compareCiByCompliance(left, right, complianceMode)
      );
      const ciRowsHeight = ciItems.length
        ? ciItems.length * DETAILED_CI_TILE_HEIGHT + (ciItems.length - 1) * DETAILED_CI_ROW_GAP
        : DETAILED_CI_TILE_HEIGHT;
      return {
        environment,
        ciItems,
        sectionHeight: Math.max(DETAILED_TILE_HEIGHT, ciRowsHeight),
        ciRowsHeight
      };
    });

    const bodyHeight =
      environmentSections.reduce((sum, section) => sum + section.sectionHeight, 0) +
      Math.max(0, environmentSections.length - 1) * DETAILED_SECTION_GAP;

    const rootNodeId = `detailed:root:${detailedRootNode.id}`;
    const nodes: DetailedTreeNode[] = [];
    const edges: DetailedTreeEdge[] = [];

    nodes.push({
      id: rootNodeId,
      sourceNodeId: detailedRootNode.id,
      entityType: detailedRootNode.entityType,
      name: detailedRootNode.name,
      subtitle: detailedEntityTypeLabel(detailedRootNode.entityType),
      cyberCompliance: rootCyberCompliance,
      discoveryCompliance: rootDiscoveryCompliance,
      width: DETAILED_TILE_WIDTH,
      height: DETAILED_TILE_HEIGHT,
      x: DETAILED_CANVAS_PADDING_X,
      y: DETAILED_CANVAS_PADDING_Y + (bodyHeight - DETAILED_TILE_HEIGHT) / 2
    });

    const environmentColumnX = DETAILED_CANVAS_PADDING_X + DETAILED_TILE_WIDTH + DETAILED_COLUMN_GAP;
    const ciColumnX = environmentColumnX + DETAILED_TILE_WIDTH + DETAILED_COLUMN_GAP;
    let maxCiTileWidth = DETAILED_CI_TILE_WIDTH;
    let cursorY = DETAILED_CANVAS_PADDING_Y;

    for (const section of environmentSections) {
      const environmentNodeId = `detailed:environment:${rootNodeId}:${section.environment}`;
      const environmentNodeY = cursorY + (section.sectionHeight - DETAILED_TILE_HEIGHT) / 2;
      const environmentCyberCompliance = combineComplianceSummaries(section.ciItems.map((item) => item.cyberCompliance));
      const environmentDiscoveryCompliance = combineComplianceSummaries(
        section.ciItems.map((item) => item.discoveryCompliance)
      );

      nodes.push({
        id: environmentNodeId,
        entityType: "environment",
        name: section.environment,
        subtitle: "Environment Group",
        cyberCompliance: environmentCyberCompliance,
        discoveryCompliance: environmentDiscoveryCompliance,
        width: DETAILED_TILE_WIDTH,
        height: DETAILED_TILE_HEIGHT,
        x: environmentColumnX,
        y: environmentNodeY
      });
      edges.push({
        id: `${rootNodeId}->${environmentNodeId}`,
        fromNodeId: rootNodeId,
        toNodeId: environmentNodeId
      });

      if (section.ciItems.length) {
        const ciRowsTop = cursorY + (section.sectionHeight - section.ciRowsHeight) / 2;
        section.ciItems.forEach((item, index) => {
          const ciNodeId = `detailed:ci:${environmentNodeId}:${item.id}`;
          const ciCompliance = resolveCiCompliance(item);
          const ciSubtitle = `${ciAssetTypeSingularLabel(item.type)} | ${item.environment}`;
          const ciFirstLineLabel = `Type: CI | Name: ${item.hostname} | ${ciSubtitle}`;
          const ciTileWidth = estimateDetailedCiTileWidth(ciFirstLineLabel);
          maxCiTileWidth = Math.max(maxCiTileWidth, ciTileWidth);
          nodes.push({
            id: ciNodeId,
            ciAssetId: item.id,
            entityType: "ci",
            name: item.hostname,
            subtitle: ciSubtitle,
            cyberCompliance: ciCompliance.cyber,
            discoveryCompliance: ciCompliance.discovery,
            width: ciTileWidth,
            height: DETAILED_CI_TILE_HEIGHT,
            x: ciColumnX,
            y: ciRowsTop + index * (DETAILED_CI_TILE_HEIGHT + DETAILED_CI_ROW_GAP)
          });
          edges.push({
            id: `${environmentNodeId}->${ciNodeId}`,
            fromNodeId: environmentNodeId,
            toNodeId: ciNodeId
          });
        });
      }

      cursorY += section.sectionHeight + DETAILED_SECTION_GAP;
    }

    return {
      rootNodeId,
      nodes,
      edges,
      width: ciColumnX + maxCiTileWidth + DETAILED_CANVAS_PADDING_X,
      height: bodyHeight + DETAILED_CANVAS_PADDING_Y * 2
    };
  }, [ciItemsByNodeId, complianceMode, detailedRootNode]);
  const ciFlowGraph = useMemo<CiFlowGraphData | null>(() => {
    if (!focusedCiFlowRootAssetId) {
      return null;
    }
    const rootFlowNode = flowCiNodeByAssetId.get(focusedCiFlowRootAssetId);
    if (!rootFlowNode) {
      return null;
    }

    const undirectedAdjacency = new Map<string, Set<string>>();
    const dependencies: Array<{
      id: string;
      sourceAssetId: string;
      targetAssetId: string;
      dependencyType: "Logical Dependency" | "Flow Dependency";
    }> = [];
    for (const dependency of data.ciDependencies) {
      if (!flowCiNodeByAssetId.has(dependency.sourceAssetId) || !flowCiNodeByAssetId.has(dependency.targetAssetId)) {
        continue;
      }
      if (dependency.sourceAssetId === dependency.targetAssetId) {
        continue;
      }
      dependencies.push({
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

    const includedAssetIds = new Set<string>([focusedCiFlowRootAssetId]);
    const traversalQueue = [focusedCiFlowRootAssetId];
    while (traversalQueue.length && includedAssetIds.size < CI_FLOW_MAX_RELATED_NODES) {
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
        if (includedAssetIds.size >= CI_FLOW_MAX_RELATED_NODES) {
          break;
        }
      }
    }

    const includedDependencies = dependencies.filter(
      (dependency) => includedAssetIds.has(dependency.sourceAssetId) && includedAssetIds.has(dependency.targetAssetId)
    );
    const depthByAssetId = new Map<string, number>([[focusedCiFlowRootAssetId, 0]]);
    const depthQueue = [focusedCiFlowRootAssetId];
    while (depthQueue.length) {
      const currentAssetId = depthQueue.shift();
      if (!currentAssetId) {
        continue;
      }
      const currentDepth = depthByAssetId.get(currentAssetId) ?? 0;
      for (const relatedAssetId of undirectedAdjacency.get(currentAssetId) ?? []) {
        if (!includedAssetIds.has(relatedAssetId) || depthByAssetId.has(relatedAssetId)) {
          continue;
        }
        depthByAssetId.set(relatedAssetId, currentDepth + 1);
        depthQueue.push(relatedAssetId);
      }
    }
    for (const assetId of includedAssetIds) {
      if (!depthByAssetId.has(assetId)) {
        depthByAssetId.set(assetId, 1);
      }
    }

    const rootScopedCi = scopedCiItemByAssetId.get(focusedCiFlowRootAssetId);
    const rootFirstLine = `Type: CI | Name: ${rootFlowNode.hostname}`;
    const rootWidth = estimateCiFlowTileWidth(rootFirstLine);
    const defaultCenterX =
      DETAILED_CANVAS_PADDING_X +
      Math.max(rootWidth, CI_FLOW_NOT_MODELLED_WIDTH) / 2 +
      Math.max(CI_FLOW_BASE_RADIUS * 0.72, 240);
    const defaultCenterY =
      DETAILED_CANVAS_PADDING_Y +
      CI_FLOW_NODE_HEIGHT / 2 +
      Math.max(CI_FLOW_BASE_RADIUS * 0.55, 180);
    const initialCenterX = ciFlowViewportCenter?.x ?? defaultCenterX;
    const initialCenterY = ciFlowViewportCenter?.y ?? defaultCenterY;

    const ciNodes: CiFlowNodeLayout[] = [];
    const groupedByDepth = new Map<number, string[]>();
    for (const assetId of includedAssetIds) {
      if (assetId === focusedCiFlowRootAssetId) {
        continue;
      }
      const depth = Math.max(1, depthByAssetId.get(assetId) ?? 1);
      const current = groupedByDepth.get(depth) ?? [];
      current.push(assetId);
      groupedByDepth.set(depth, current);
    }

    ciNodes.push({
      id: ciFlowNodeIdForAsset(focusedCiFlowRootAssetId),
      assetId: focusedCiFlowRootAssetId,
      entityType: "ci",
      name: rootFlowNode.hostname,
      subtitle: `${ciAssetTypeSingularLabel(rootFlowNode.type)} | ${normalizeCiEnvironmentLabel(rootFlowNode.environmentType)}`,
      typeLabel: "Configuration Item",
      modelLabel: "Model Scope: Focus CI",
      cyberCompliance: rootScopedCi?.cyberCompliance ?? emptyComplianceSummary(),
      discoveryCompliance: rootScopedCi?.discoveryCompliance ?? emptyComplianceSummary(),
      isInModelScope: true,
      width: rootWidth,
      height: CI_FLOW_NODE_HEIGHT,
      x: initialCenterX - rootWidth / 2,
      y: initialCenterY - CI_FLOW_NODE_HEIGHT / 2
    });

    const depthLevels = Array.from(groupedByDepth.keys()).sort((left, right) => left - right);
    for (const depthLevel of depthLevels) {
      const groupedAssetIds = (groupedByDepth.get(depthLevel) ?? [])
        .map((assetId) => flowCiNodeByAssetId.get(assetId))
        .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
        .sort((left, right) => left.hostname.localeCompare(right.hostname))
        .map((asset) => asset.id);
      const radius = CI_FLOW_BASE_RADIUS + (depthLevel - 1) * CI_FLOW_RADIUS_STEP;
      for (let index = 0; index < groupedAssetIds.length; index += 1) {
        const assetId = groupedAssetIds[index];
        const flowNode = flowCiNodeByAssetId.get(assetId);
        if (!flowNode) {
          continue;
        }
        const scopedCi = scopedCiItemByAssetId.get(assetId);
        const isInModelScope = modelAssetIdSet.has(assetId);
        const hasExplicitModel = Boolean(flowNode.systemId && flowNode.systemName && flowNode.systemModelled);
        const modelLabel = isInModelScope
          ? "Model Scope: In Scope"
          : hasExplicitModel
            ? `Model: ${flowNode.systemName}`
            : "Not Modelled";
        const firstLine = `Type: CI | Name: ${flowNode.hostname}`;
        const nodeWidth = estimateCiFlowTileWidth(firstLine);
        const angle = groupedAssetIds.length === 1 ? -Math.PI / 2 : (index / groupedAssetIds.length) * Math.PI * 2 - Math.PI / 2;
        const centerX = initialCenterX + Math.cos(angle) * radius;
        const centerY = initialCenterY + Math.sin(angle) * radius;
        ciNodes.push({
          id: ciFlowNodeIdForAsset(assetId),
          assetId,
          entityType: "ci",
          name: flowNode.hostname,
          subtitle: `${ciAssetTypeSingularLabel(flowNode.type)} | ${normalizeCiEnvironmentLabel(flowNode.environmentType)}`,
          typeLabel: "Configuration Item",
          modelLabel,
          cyberCompliance: scopedCi?.cyberCompliance ?? emptyComplianceSummary(),
          discoveryCompliance: scopedCi?.discoveryCompliance ?? emptyComplianceSummary(),
          isInModelScope,
          width: nodeWidth,
          height: CI_FLOW_NODE_HEIGHT,
          x: centerX - nodeWidth / 2,
          y: centerY - CI_FLOW_NODE_HEIGHT / 2
        });
      }
    }

    const ciFlowEdges: CiFlowEdgeLayout[] = includedDependencies.map((dependency) => ({
      id: `ci-flow-edge:${dependency.id}:${dependency.sourceAssetId}->${dependency.targetAssetId}`,
      fromNodeId: ciFlowNodeIdForAsset(dependency.sourceAssetId),
      toNodeId: ciFlowNodeIdForAsset(dependency.targetAssetId),
      dependencyType: dependency.dependencyType
    }));

    const unmodelledNodes = ciNodes.filter(
      (node) => node.entityType === "ci" && !node.isInModelScope && node.modelLabel === "Not Modelled"
    );
    if (unmodelledNodes.length) {
      const aggregatedCyber = combineComplianceSummaries(unmodelledNodes.map((node) => node.cyberCompliance));
      const aggregatedDiscovery = combineComplianceSummaries(unmodelledNodes.map((node) => node.discoveryCompliance));
      const notModelledCenterY =
        Math.max(
          ...ciNodes.map((node) => node.y + node.height / 2),
          initialCenterY + CI_FLOW_BASE_RADIUS + CI_FLOW_RADIUS_STEP * 0.4
        ) + 160;
      const notModelledNodeId = ciFlowNodeIdForNotModelled();
      ciNodes.push({
        id: notModelledNodeId,
        entityType: "not-modelled",
        name: "Not Modelled",
        subtitle: `${unmodelledNodes.length} related CI${unmodelledNodes.length === 1 ? "" : "s"} with no model`,
        typeLabel: "Grouping Tile",
        modelLabel: "Not Modelled",
        cyberCompliance: aggregatedCyber,
        discoveryCompliance: aggregatedDiscovery,
        isInModelScope: false,
        width: CI_FLOW_NOT_MODELLED_WIDTH,
        height: CI_FLOW_NOT_MODELLED_HEIGHT,
        x: initialCenterX - CI_FLOW_NOT_MODELLED_WIDTH / 2,
        y: notModelledCenterY - CI_FLOW_NOT_MODELLED_HEIGHT / 2
      });
      for (const node of unmodelledNodes) {
        ciFlowEdges.push({
          id: `ci-flow-edge:not-modelled:${node.id}`,
          fromNodeId: notModelledNodeId,
          toNodeId: node.id,
          dependencyType: "Unmodelled Attachment"
        });
      }
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const node of ciNodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    const offsetX = minX < DETAILED_CANVAS_PADDING_X ? DETAILED_CANVAS_PADDING_X - minX : 0;
    const offsetY = minY < DETAILED_CANVAS_PADDING_Y ? DETAILED_CANVAS_PADDING_Y - minY : 0;
    if (offsetX || offsetY) {
      for (const node of ciNodes) {
        node.x += offsetX;
        node.y += offsetY;
      }
      minX += offsetX;
      minY += offsetY;
      maxX += offsetX;
      maxY += offsetY;
    }

    const width = Math.max(1, Math.ceil(maxX + DETAILED_CANVAS_PADDING_X));
    const height = Math.max(1, Math.ceil(maxY + DETAILED_CANVAS_PADDING_Y));

    return {
      rootAssetId: focusedCiFlowRootAssetId,
      nodes: ciNodes,
      edges: ciFlowEdges,
      viewCenterX: initialCenterX + offsetX,
      viewCenterY: initialCenterY + offsetY,
      width,
      height
    };
  }, [
    ciFlowViewportCenter?.x,
    ciFlowViewportCenter?.y,
    data.ciDependencies,
    flowCiNodeByAssetId,
    focusedCiFlowRootAssetId,
    modelAssetIdSet,
    scopedCiItemByAssetId
  ]);
  const detailedNodeById = useMemo(() => {
    return new Map((detailedTree?.nodes ?? []).map((node) => [node.id, node]));
  }, [detailedTree?.nodes]);
  const ciFlowNodeById = useMemo(() => {
    return new Map((ciFlowGraph?.nodes ?? []).map((node) => [node.id, node]));
  }, [ciFlowGraph?.nodes]);
  const ciFlowRootNodeId = ciFlowGraph ? ciFlowNodeIdForAsset(ciFlowGraph.rootAssetId) : null;
  const isCiFlowMode = Boolean(ciFlowGraph && focusedCiFlowRootAssetId);
  const isCiFlowFocusPanelOpen = Boolean(isDetailedTopologyOpen && isCiFlowMode);
  const detailedSelectedPathEdgeIds = useMemo(() => {
    if (!detailedTree || !detailedSelectedNodeId || detailedSelectedNodeId === detailedTree.rootNodeId) {
      return new Set<string>();
    }
    const adjacency = new Map<string, Array<{ toNodeId: string; edgeId: string }>>();
    for (const edge of detailedTree.edges) {
      const current = adjacency.get(edge.fromNodeId) ?? [];
      current.push({ toNodeId: edge.toNodeId, edgeId: edge.id });
      adjacency.set(edge.fromNodeId, current);
    }

    const queue = [detailedTree.rootNodeId];
    const visited = new Set<string>([detailedTree.rootNodeId]);
    const previousByNodeId = new Map<string, { nodeId: string; edgeId: string }>();
    while (queue.length) {
      const currentNodeId = queue.shift();
      if (!currentNodeId) {
        continue;
      }
      if (currentNodeId === detailedSelectedNodeId) {
        break;
      }
      for (const next of adjacency.get(currentNodeId) ?? []) {
        if (visited.has(next.toNodeId)) {
          continue;
        }
        visited.add(next.toNodeId);
        previousByNodeId.set(next.toNodeId, { nodeId: currentNodeId, edgeId: next.edgeId });
        queue.push(next.toNodeId);
      }
    }

    if (!visited.has(detailedSelectedNodeId)) {
      return new Set<string>();
    }
    const edgeIds = new Set<string>();
    let cursor = detailedSelectedNodeId;
    while (cursor !== detailedTree.rootNodeId) {
      const previous = previousByNodeId.get(cursor);
      if (!previous) {
        break;
      }
      edgeIds.add(previous.edgeId);
      cursor = previous.nodeId;
    }
    return edgeIds;
  }, [detailedSelectedNodeId, detailedTree]);
  const detailedSelectedConnectedEdgeIds = useMemo(() => {
    if (!detailedTree || !detailedSelectedNodeId) {
      return new Set<string>();
    }
    return new Set(
      detailedTree.edges
        .filter((edge) => edge.fromNodeId === detailedSelectedNodeId || edge.toNodeId === detailedSelectedNodeId)
        .map((edge) => edge.id)
    );
  }, [detailedSelectedNodeId, detailedTree]);
  const detailedHighlightedEdgeIds = useMemo(() => {
    return new Set<string>([...detailedSelectedPathEdgeIds, ...detailedSelectedConnectedEdgeIds]);
  }, [detailedSelectedConnectedEdgeIds, detailedSelectedPathEdgeIds]);
  const ciFlowSelectedPathEdgeIds = useMemo(() => {
    if (!ciFlowGraph || !ciFlowRootNodeId || !selectedCiFlowNodeId || selectedCiFlowNodeId === ciFlowRootNodeId) {
      return new Set<string>();
    }
    const adjacency = new Map<string, Array<{ toNodeId: string; edgeId: string }>>();
    for (const edge of ciFlowGraph.edges) {
      const fromCurrent = adjacency.get(edge.fromNodeId) ?? [];
      fromCurrent.push({ toNodeId: edge.toNodeId, edgeId: edge.id });
      adjacency.set(edge.fromNodeId, fromCurrent);
      const toCurrent = adjacency.get(edge.toNodeId) ?? [];
      toCurrent.push({ toNodeId: edge.fromNodeId, edgeId: edge.id });
      adjacency.set(edge.toNodeId, toCurrent);
    }

    const queue = [ciFlowRootNodeId];
    const visited = new Set<string>([ciFlowRootNodeId]);
    const previousByNodeId = new Map<string, { nodeId: string; edgeId: string }>();
    while (queue.length) {
      const currentNodeId = queue.shift();
      if (!currentNodeId) {
        continue;
      }
      if (currentNodeId === selectedCiFlowNodeId) {
        break;
      }
      for (const next of adjacency.get(currentNodeId) ?? []) {
        if (visited.has(next.toNodeId)) {
          continue;
        }
        visited.add(next.toNodeId);
        previousByNodeId.set(next.toNodeId, { nodeId: currentNodeId, edgeId: next.edgeId });
        queue.push(next.toNodeId);
      }
    }

    if (!visited.has(selectedCiFlowNodeId)) {
      return new Set<string>();
    }
    const edgeIds = new Set<string>();
    let cursor = selectedCiFlowNodeId;
    while (cursor !== ciFlowRootNodeId) {
      const previous = previousByNodeId.get(cursor);
      if (!previous) {
        break;
      }
      edgeIds.add(previous.edgeId);
      cursor = previous.nodeId;
    }
    return edgeIds;
  }, [ciFlowGraph, ciFlowRootNodeId, selectedCiFlowNodeId]);
  const ciFlowSelectedConnectedEdgeIds = useMemo(() => {
    if (!ciFlowGraph || !selectedCiFlowNodeId) {
      return new Set<string>();
    }
    return new Set(
      ciFlowGraph.edges
        .filter((edge) => edge.fromNodeId === selectedCiFlowNodeId || edge.toNodeId === selectedCiFlowNodeId)
        .map((edge) => edge.id)
    );
  }, [ciFlowGraph, selectedCiFlowNodeId]);
  const ciFlowHighlightedEdgeIds = useMemo(() => {
    return new Set<string>([...ciFlowSelectedPathEdgeIds, ...ciFlowSelectedConnectedEdgeIds]);
  }, [ciFlowSelectedConnectedEdgeIds, ciFlowSelectedPathEdgeIds]);
  const detailedTileDropdownOptions = useMemo<
    Array<{ id: string; entityType: DetailedTileEntityType; name: string; subtitle: string; level: number }>
  >(() => {
    if (isCiFlowFocusPanelOpen && ciFlowGraph) {
      return [...ciFlowGraph.nodes]
        .map((node) => ({
          id: node.id,
          entityType: node.entityType,
          name: node.name,
          subtitle: node.subtitle,
          level: node.entityType === "not-modelled" ? 2 : node.id === ciFlowRootNodeId ? 0 : 1
        }))
        .sort((left, right) => {
          const levelDelta = left.level - right.level;
          if (levelDelta !== 0) {
            return levelDelta;
          }
          return left.name.localeCompare(right.name);
        });
    }
    if (!detailedTree) {
      return [];
    }
    return [...detailedTree.nodes]
      .map((node) => ({
        id: node.id,
        entityType: node.entityType,
        name: node.name,
        subtitle: node.subtitle,
        level: node.entityType === "environment" ? 1 : node.entityType === "ci" ? 2 : 0
      }))
      .sort((left, right) => {
        const levelDelta = left.level - right.level;
        if (levelDelta !== 0) {
          return levelDelta;
        }
        return left.name.localeCompare(right.name);
      });
  }, [ciFlowGraph, ciFlowRootNodeId, detailedTree, isCiFlowFocusPanelOpen]);
  const filteredDetailedTileDropdownOptions = useMemo(() => {
    const normalizedSearch = detailedTileFilterSearchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return detailedTileDropdownOptions;
    }
    return detailedTileDropdownOptions.filter((node) => {
      const type = detailedEntityTypeLabel(node.entityType).toLowerCase();
      return (
        node.name.toLowerCase().includes(normalizedSearch) ||
        node.subtitle.toLowerCase().includes(normalizedSearch) ||
        type.includes(normalizedSearch)
      );
    });
  }, [detailedTileFilterSearchText, detailedTileDropdownOptions]);
  const detailedFilteredNodeIds = useMemo(() => {
    if (isCiFlowFocusPanelOpen && ciFlowGraph) {
      if (detailedSelectedTileFilterId === "__all__") {
        return new Set(ciFlowGraph.nodes.map((node) => node.id));
      }
      const visibleNodeIds = new Set<string>();
      for (const edge of ciFlowGraph.edges) {
        if (!ciFlowHighlightedEdgeIds.has(edge.id)) {
          continue;
        }
        visibleNodeIds.add(edge.fromNodeId);
        visibleNodeIds.add(edge.toNodeId);
      }
      if (ciFlowRootNodeId) {
        visibleNodeIds.add(ciFlowRootNodeId);
      }
      if (selectedCiFlowNodeId) {
        visibleNodeIds.add(selectedCiFlowNodeId);
      }
      if (!visibleNodeIds.size) {
        visibleNodeIds.add(detailedSelectedTileFilterId);
      }
      return visibleNodeIds;
    }
    if (!detailedTree) {
      return new Set<string>();
    }
    if (detailedSelectedTileFilterId === "__all__") {
      return new Set(detailedTree.nodes.map((node) => node.id));
    }
    const visibleNodeIds = new Set<string>();
    for (const edge of detailedTree.edges) {
      if (!detailedHighlightedEdgeIds.has(edge.id)) {
        continue;
      }
      visibleNodeIds.add(edge.fromNodeId);
      visibleNodeIds.add(edge.toNodeId);
    }
    visibleNodeIds.add(detailedTree.rootNodeId);
    if (detailedSelectedNodeId) {
      visibleNodeIds.add(detailedSelectedNodeId);
    }
    if (!visibleNodeIds.size) {
      visibleNodeIds.add(detailedSelectedTileFilterId);
    }
    return visibleNodeIds;
  }, [
    ciFlowGraph,
    ciFlowHighlightedEdgeIds,
    ciFlowRootNodeId,
    detailedHighlightedEdgeIds,
    detailedSelectedNodeId,
    detailedSelectedTileFilterId,
    detailedTree,
    isCiFlowFocusPanelOpen,
    selectedCiFlowNodeId
  ]);
  const isDetailedTileFilterActive = detailedSelectedTileFilterId !== "__all__";
  const hasDetailedTileSearchTerm = detailedTileFilterSearchText.trim().length > 0;
  const detailedPresentEntityTypes = useMemo(() => {
    if (isCiFlowFocusPanelOpen && ciFlowGraph) {
      return new Set(ciFlowGraph.nodes.map((node) => node.entityType));
    }
    return new Set((detailedTree?.nodes ?? []).map((node) => node.entityType));
  }, [ciFlowGraph, detailedTree?.nodes, isCiFlowFocusPanelOpen]);
  const selectedPathEdgeIds = useMemo(() => {
    if (!coreNode?.id || !selectedNodeId || selectedNodeId === coreNode.id) {
      return new Set<string>();
    }
    const adjacency = new Map<string, Array<{ toNodeId: string; edgeId: string }>>();
    for (const edge of data.edges) {
      const current = adjacency.get(edge.fromNodeId) ?? [];
      current.push({ toNodeId: edge.toNodeId, edgeId: edge.id });
      adjacency.set(edge.fromNodeId, current);
    }
    const queue = [coreNode.id];
    const visited = new Set<string>([coreNode.id]);
    const previousByNodeId = new Map<string, { nodeId: string; edgeId: string }>();
    while (queue.length) {
      const currentNodeId = queue.shift();
      if (!currentNodeId) {
        continue;
      }
      if (currentNodeId === selectedNodeId) {
        break;
      }
      for (const next of adjacency.get(currentNodeId) ?? []) {
        if (visited.has(next.toNodeId)) {
          continue;
        }
        visited.add(next.toNodeId);
        previousByNodeId.set(next.toNodeId, { nodeId: currentNodeId, edgeId: next.edgeId });
        queue.push(next.toNodeId);
      }
    }
    if (!visited.has(selectedNodeId)) {
      return new Set<string>();
    }
    const edgeIds = new Set<string>();
    let cursor = selectedNodeId;
    while (cursor !== coreNode.id) {
      const previous = previousByNodeId.get(cursor);
      if (!previous) {
        break;
      }
      edgeIds.add(previous.edgeId);
      cursor = previous.nodeId;
    }
    return edgeIds;
  }, [coreNode?.id, data.edges, selectedNodeId]);
  const selectedConnectedEdgeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }
    return new Set(
      data.edges
        .filter((edge) => edge.fromNodeId === selectedNodeId || edge.toNodeId === selectedNodeId)
        .map((edge) => edge.id)
    );
  }, [data.edges, selectedNodeId]);
  const highlightedEdgeIds = useMemo(() => {
    return new Set<string>([...selectedPathEdgeIds, ...selectedConnectedEdgeIds]);
  }, [selectedConnectedEdgeIds, selectedPathEdgeIds]);
  const tileDropdownOptions = useMemo(() => {
    return [...layout.nodes].sort((left, right) => {
      const typeDelta = baseLevelForEntity(left.entityType) - baseLevelForEntity(right.entityType);
      if (typeDelta !== 0) {
        return typeDelta;
      }
      return left.name.localeCompare(right.name);
    });
  }, [layout.nodes]);
  const filteredTileDropdownOptions = useMemo(() => {
    const normalizedSearch = tileFilterSearchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return tileDropdownOptions;
    }
    return tileDropdownOptions.filter((node) => {
      const type = entityTypeLabel(node.entityType).toLowerCase();
      return (
        node.name.toLowerCase().includes(normalizedSearch) ||
        type.includes(normalizedSearch) ||
        `${type} ${node.name.toLowerCase()}`.includes(normalizedSearch)
      );
    });
  }, [tileDropdownOptions, tileFilterSearchText]);
  const filteredTileNodeIds = useMemo(() => {
    if (selectedTileFilterId === "__all__") {
      return new Set(layout.nodes.map((node) => node.id));
    }
    const visibleNodeIds = new Set<string>();
    for (const edge of data.edges) {
      if (!highlightedEdgeIds.has(edge.id)) {
        continue;
      }
      visibleNodeIds.add(edge.fromNodeId);
      visibleNodeIds.add(edge.toNodeId);
    }
    if (coreNode?.id) {
      visibleNodeIds.add(coreNode.id);
    }
    if (selectedNodeId) {
      visibleNodeIds.add(selectedNodeId);
    }
    if (!visibleNodeIds.size) {
      visibleNodeIds.add(selectedTileFilterId);
    }
    return visibleNodeIds;
  }, [coreNode?.id, data.edges, highlightedEdgeIds, layout.nodes, selectedNodeId, selectedTileFilterId]);
  const isTileFilterActive = selectedTileFilterId !== "__all__";
  const hasTileSearchTerm = tileFilterSearchText.trim().length > 0;
  const presentEntityTypes = useMemo(
    () => new Set(layout.nodes.map((node) => node.entityType)),
    [layout.nodes]
  );

  useEffect(() => {
    if (!coreNode) {
      initialTargetRef.current.set(0, 0, 0);
      initialCameraPositionRef.current.set(0, 120, 2050);
      return;
    }
    initialTargetRef.current.copy(coreNode.position);
    initialCameraPositionRef.current.copy(coreNode.position.clone().add(new THREE.Vector3(0, 120, 2050)));
  }, [coreNode]);

  const centerViewportScroll = () => {
    const scrollContainer = scrollContainerRef.current;
    const viewport = viewportRef.current;
    if (!scrollContainer || !viewport) {
      return;
    }
    const nextScrollLeft = Math.max(0, (viewport.clientWidth - scrollContainer.clientWidth) / 2);
    const nextScrollTop = Math.max(0, (viewport.clientHeight - scrollContainer.clientHeight) / 2);
    scrollContainer.scrollLeft = nextScrollLeft;
    scrollContainer.scrollTop = nextScrollTop;
  };

  const centerDetailedViewportScroll = () => {
    const scrollContainer = detailedScrollContainerRef.current;
    if (!scrollContainer) {
      return;
    }
    const nextScrollLeft = Math.max(0, (scrollContainer.scrollWidth - scrollContainer.clientWidth) / 2);
    const nextScrollTop = Math.max(0, (scrollContainer.scrollHeight - scrollContainer.clientHeight) / 2);
    scrollContainer.scrollLeft = nextScrollLeft;
    scrollContainer.scrollTop = nextScrollTop;
  };

  useEffect(() => {
    if (!isOpen) {
      setRendererInitError(null);
      setSelectedDetailNodeId(null);
      setRenderedDetailNodeId(null);
      setIsDetailPanelVisible(false);
      setSelectedSystemId(null);
      setExpandedNodeIds(new Set());
      setNodeCiSearchByKey({});
      setNodeCiEnvironmentSearchByKey({});
      setIsDetailedTopologyOpen(false);
      setDetailedRootNodeId(null);
      setDetailedSelectedNodeId(null);
      setDetailedSelectedTileFilterId("__all__");
      setDetailedTileFilterSearchText("");
      setIsDetailedTileSearchFocused(false);
      setDetailedZoom(1);
      setFocusedCiFlowRootAssetId(null);
      setSelectedCiFlowNodeId(null);
      setCiFlowOriginCenter(null);
      setCiFlowViewportCenter(null);
      setCiFlowTweenProgress(0);
      ciFlowAutoFitPendingRef.current = false;
      detailedZoomBeforeCiFlowRef.current = null;
      setSelectedTileFilterId("__all__");
      setTileFilterSearchText("");
      setIsTileSearchFocused(false);
      setDraggingNodeId(null);
      tileDragStateRef.current = null;
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      if (detailPanelCloseTimerRef.current !== null) {
        window.clearTimeout(detailPanelCloseTimerRef.current);
        detailPanelCloseTimerRef.current = null;
      }
      if (tileSearchBlurTimerRef.current !== null) {
        window.clearTimeout(tileSearchBlurTimerRef.current);
        tileSearchBlurTimerRef.current = null;
      }
      if (detailedTileSearchBlurTimerRef.current !== null) {
        window.clearTimeout(detailedTileSearchBlurTimerRef.current);
        detailedTileSearchBlurTimerRef.current = null;
      }
      if (detailedNodeClickSuppressTimerRef.current !== null) {
        window.clearTimeout(detailedNodeClickSuppressTimerRef.current);
        detailedNodeClickSuppressTimerRef.current = null;
      }
      if (ciFlowTweenFrameRef.current !== null) {
        window.cancelAnimationFrame(ciFlowTweenFrameRef.current);
        ciFlowTweenFrameRef.current = null;
      }
      detailedPanStateRef.current = null;
      suppressDetailedNodeClickRef.current = false;
      persistedCameraStateRef.current = null;
      persistedNodePositionsRef.current = new Map();
      manualNodePositionsRef.current = new Map();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedNodeId(null);
      return;
    }
    setSelectedDetailNodeId(null);
    setSelectedSystemId(null);
    setExpandedNodeIds(new Set());
    setNodeCiSearchByKey({});
    setNodeCiEnvironmentSearchByKey({});
    setIsDetailedTopologyOpen(false);
    setDetailedRootNodeId(null);
    setDetailedSelectedNodeId(null);
    setDetailedSelectedTileFilterId("__all__");
    setDetailedTileFilterSearchText("");
    setIsDetailedTileSearchFocused(false);
    setDetailedZoom(1);
    setFocusedCiFlowRootAssetId(null);
    setSelectedCiFlowNodeId(null);
    setCiFlowOriginCenter(null);
    setCiFlowViewportCenter(null);
    setCiFlowTweenProgress(0);
    ciFlowAutoFitPendingRef.current = false;
    detailedZoomBeforeCiFlowRef.current = null;
    if (coreNode?.id) {
      setSelectedNodeId(coreNode.id);
    }
  }, [coreNode?.id, isOpen]);

  useEffect(() => {
    if (detailPanelCloseTimerRef.current !== null) {
      window.clearTimeout(detailPanelCloseTimerRef.current);
      detailPanelCloseTimerRef.current = null;
    }
    if (selectedDetailNodeId) {
      setRenderedDetailNodeId(selectedDetailNodeId);
      const raf = window.requestAnimationFrame(() => {
        setIsDetailPanelVisible(true);
      });
      return () => {
        window.cancelAnimationFrame(raf);
      };
    }
    setIsDetailPanelVisible(false);
    detailPanelCloseTimerRef.current = window.setTimeout(() => {
      setRenderedDetailNodeId(null);
      detailPanelCloseTimerRef.current = null;
    }, 320);
  }, [selectedDetailNodeId]);

  useEffect(() => {
    return () => {
      if (detailPanelCloseTimerRef.current !== null) {
        window.clearTimeout(detailPanelCloseTimerRef.current);
      }
      if (tileSearchBlurTimerRef.current !== null) {
        window.clearTimeout(tileSearchBlurTimerRef.current);
      }
      if (detailedTileSearchBlurTimerRef.current !== null) {
        window.clearTimeout(detailedTileSearchBlurTimerRef.current);
      }
      if (detailedNodeClickSuppressTimerRef.current !== null) {
        window.clearTimeout(detailedNodeClickSuppressTimerRef.current);
      }
      if (ciFlowTweenFrameRef.current !== null) {
        window.cancelAnimationFrame(ciFlowTweenFrameRef.current);
        ciFlowTweenFrameRef.current = null;
      }
      detailedPanStateRef.current = null;
      suppressDetailedNodeClickRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      centerViewportScroll();
    });
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [isOpen, layout.size.height, layout.size.width]);

  useEffect(() => {
    if (selectedTileFilterId === "__all__") {
      return;
    }
    const selectedExists = layout.nodes.some((node) => node.id === selectedTileFilterId);
    if (!selectedExists) {
      setSelectedTileFilterId("__all__");
    }
  }, [layout.nodes, selectedTileFilterId]);

  useEffect(() => {
    if (!isDetailedTopologyOpen || !detailedTree || isCiFlowFocusPanelOpen) {
      return;
    }
    setDetailedSelectedNodeId(detailedTree.rootNodeId);
  }, [detailedTree, isCiFlowFocusPanelOpen, isDetailedTopologyOpen]);

  useEffect(() => {
    if (!isDetailedTopologyOpen || !ciFlowRootNodeId || !isCiFlowFocusPanelOpen) {
      return;
    }
    setSelectedCiFlowNodeId(ciFlowRootNodeId);
  }, [ciFlowRootNodeId, isCiFlowFocusPanelOpen, isDetailedTopologyOpen]);

  useEffect(() => {
    if (isCiFlowFocusPanelOpen) {
      return;
    }
    setSelectedCiFlowNodeId(null);
  }, [isCiFlowFocusPanelOpen]);

  useEffect(() => {
    if (!isDetailedTopologyOpen || !detailedTree || isCiFlowFocusPanelOpen) {
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      centerDetailedViewportScroll();
    });
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [detailedRootNodeId, detailedTree, isCiFlowFocusPanelOpen, isDetailedTopologyOpen]);

  useEffect(() => {
    if (!isDetailedTopologyOpen || !isCiFlowFocusPanelOpen || !ciFlowGraph) {
      return;
    }
    const container = ciFlowScrollContainerRef.current;
    if (!container) {
      return;
    }
    if (ciFlowAutoFitPendingRef.current && container.clientWidth > 0 && container.clientHeight > 0) {
      const fitViewportWidth = Math.max(1, container.clientWidth - CI_FLOW_VIEWPORT_PADDING * 2);
      const fitViewportHeight = Math.max(1, container.clientHeight - CI_FLOW_VIEWPORT_PADDING * 2);
      const fitByWidth = fitViewportWidth / Math.max(1, ciFlowGraph.width);
      const fitByHeight = fitViewportHeight / Math.max(1, ciFlowGraph.height);
      const fitZoom = Number((Math.min(fitByWidth, fitByHeight) * 0.94).toFixed(4));
      const normalizedFitZoom = Number(Math.max(0.22, Math.min(1.2, fitZoom)).toFixed(4));
      ciFlowAutoFitPendingRef.current = false;
      if (Number.isFinite(normalizedFitZoom) && Math.abs(normalizedFitZoom - detailedZoom) > 0.005) {
        setDetailedZoom(normalizedFitZoom);
        return;
      }
    }
    const zoom = detailedZoom > 0 ? detailedZoom : 1;
    const nextLeft = Math.max(
      0,
      ciFlowGraph.viewCenterX * zoom + CI_FLOW_VIEWPORT_PADDING - container.clientWidth / 2
    );
    const nextTop = Math.max(
      0,
      ciFlowGraph.viewCenterY * zoom + CI_FLOW_VIEWPORT_PADDING - container.clientHeight / 2
    );
    container.scrollLeft = nextLeft;
    container.scrollTop = nextTop;
  }, [ciFlowGraph, detailedZoom, isCiFlowFocusPanelOpen, isDetailedTopologyOpen]);

  useEffect(() => {
    if (detailedSelectedTileFilterId === "__all__") {
      return;
    }
    const selectedExists = detailedTileDropdownOptions.some((node) => node.id === detailedSelectedTileFilterId);
    if (!selectedExists) {
      setDetailedSelectedTileFilterId("__all__");
    }
  }, [detailedSelectedTileFilterId, detailedTileDropdownOptions]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    persistedCameraStateRef.current = null;
    const raf = window.requestAnimationFrame(() => {
      centerViewportScroll();
    });
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (focusedCiFlowRootAssetId) {
          if (ciFlowTweenFrameRef.current !== null) {
            window.cancelAnimationFrame(ciFlowTweenFrameRef.current);
            ciFlowTweenFrameRef.current = null;
          }
          setFocusedCiFlowRootAssetId(null);
          setSelectedCiFlowNodeId(null);
          setCiFlowOriginCenter(null);
          setCiFlowViewportCenter(null);
          setCiFlowTweenProgress(0);
          ciFlowAutoFitPendingRef.current = false;
          if (detailedZoomBeforeCiFlowRef.current !== null) {
            setDetailedZoom(detailedZoomBeforeCiFlowRef.current);
            detailedZoomBeforeCiFlowRef.current = null;
          }
          return;
        }
        if (isDetailedTopologyOpen) {
          setIsDetailedTopologyOpen(false);
          return;
        }
        if (selectedSystemId) {
          setSelectedSystemId(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [focusedCiFlowRootAssetId, isDetailedTopologyOpen, isOpen, onClose, selectedSystemId]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current || !viewportRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const keyLight = new THREE.DirectionalLight(0x8be9ff, 0.55);
    keyLight.position.set(200, 200, 320);
    scene.add(keyLight);

    const camera = new THREE.PerspectiveCamera(52, 1, 1, 18000);
    const persistedCameraState = persistedCameraStateRef.current;
    camera.position.copy(persistedCameraState?.position ?? initialCameraPositionRef.current);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true
      });
      setRendererInitError(null);
    } catch {
      setRendererInitError("WebGL renderer is unavailable in this browser/session.");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = MIN_CAMERA_DISTANCE;
    controls.maxDistance = MAX_CAMERA_DISTANCE;
    controls.target.copy(persistedCameraState?.target ?? initialTargetRef.current);
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.enableZoom = false;
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.update();

    cameraRef.current = camera;
    controlsRef.current = controls;

    const nodeGroup = new THREE.Group();
    const runtimeNodes = new Map<string, RuntimeNodeState>();
    for (const node of layout.nodes) {
      const manualPosition = manualNodePositionsRef.current.get(node.id);
      const persistedPosition = persistedNodePositionsRef.current.get(node.id);
      const startPosition = (manualPosition ?? persistedPosition ?? node.position).clone();
      const targetPosition = (manualPosition ?? node.position).clone();
      const geometry = new THREE.SphereGeometry(8, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color: nodeColor(node.entityType),
        transparent: true,
        opacity: 0.92
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(startPosition);
      mesh.visible = false;
      nodeGroup.add(mesh);
      runtimeNodes.set(node.id, {
        mesh,
        currentPosition: startPosition.clone(),
        targetPosition
      });
    }
    scene.add(nodeGroup);
    runtimeNodesRef.current = runtimeNodes;

    const edgeGroup = new THREE.Group();
    const purplePulseMaterials: THREE.MeshPhongMaterial[] = [];
    const yellowPulseMaterials: THREE.MeshPhongMaterial[] = [];
    const runtimeEdges: Array<{
      edgeId: string;
      fromNodeId: string;
      toNodeId: string;
      line: THREE.Line;
      arrow: THREE.Mesh;
      purpleTube: THREE.Mesh | null;
      yellowTube: THREE.Mesh | null;
    }> = [];
    const computeCurve = (start: THREE.Vector3, end: THREE.Vector3) => {
      const verticalDistance = Math.abs(start.y - end.y);
      const controlDrop = Math.max(70, verticalDistance * 0.45);
      const curveLift = Math.max(40, Math.abs(end.x - start.x) * 0.18);
      const control1 = new THREE.Vector3(start.x, start.y - controlDrop, start.z + curveLift);
      const control2 = new THREE.Vector3(end.x, end.y + controlDrop * 0.25, end.z + curveLift);
      return new THREE.CubicBezierCurve3(start, control1, control2, end);
    };

    const resolveWorldAnchorFromTile = (nodeId: string, runtimeNode: RuntimeNodeState) => {
      const element = tileRefs.current[nodeId];
      if (!element || element.style.display === "none") {
        return runtimeNode.currentPosition.clone();
      }
      const viewportRect = viewport.getBoundingClientRect();
      const tileRect = element.getBoundingClientRect();
      if (!viewportRect.width || !viewportRect.height || !tileRect.width || !tileRect.height) {
        return runtimeNode.currentPosition.clone();
      }
      const centerX = tileRect.left + tileRect.width / 2;
      const centerY = tileRect.top + tileRect.height / 2;
      const ndcX = ((centerX - viewportRect.left) / viewportRect.width) * 2 - 1;
      const ndcY = -(((centerY - viewportRect.top) / viewportRect.height) * 2 - 1);
      const projected = runtimeNode.currentPosition.clone().project(camera);
      const ndcZ = THREE.MathUtils.clamp(projected.z, -0.999, 0.999);
      return new THREE.Vector3(ndcX, ndcY, ndcZ).unproject(camera);
    };

    const updateEdgeGeometry = (edgeRuntime: (typeof runtimeEdges)[number], includeTubeRebuild: boolean) => {
      const fromRuntimeNode = runtimeNodes.get(edgeRuntime.fromNodeId);
      const toRuntimeNode = runtimeNodes.get(edgeRuntime.toNodeId);
      if (!fromRuntimeNode || !toRuntimeNode) {
        return;
      }
      const fromAnchor = resolveWorldAnchorFromTile(edgeRuntime.fromNodeId, fromRuntimeNode);
      const toAnchor = resolveWorldAnchorFromTile(edgeRuntime.toNodeId, toRuntimeNode);
      const curve = computeCurve(fromAnchor, toAnchor);
      const points = curve.getPoints(34);
      edgeRuntime.line.geometry.setFromPoints(points);

      const arrowPosition = curve.getPoint(0.985);
      const tangent = curve.getTangent(0.985).normalize();
      edgeRuntime.arrow.position.copy(arrowPosition);
      edgeRuntime.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

      if (includeTubeRebuild && edgeRuntime.purpleTube) {
        edgeRuntime.purpleTube.geometry.dispose();
        edgeRuntime.purpleTube.geometry = new THREE.TubeGeometry(curve, 48, 2.8, 10, false);
      }
      if (includeTubeRebuild && edgeRuntime.yellowTube) {
        edgeRuntime.yellowTube.geometry.dispose();
        edgeRuntime.yellowTube.geometry = new THREE.TubeGeometry(curve, 48, 2.2, 10, false);
      }
    };

    for (const edge of data.edges) {
      const from = nodeById.get(edge.fromNodeId);
      const to = nodeById.get(edge.toNodeId);
      if (!from || !to) {
        continue;
      }
      const isCoreMissionEdge = from.entityType === "network" && to.entityType === "mission-capability";
      const isPathEdge = selectedPathEdgeIds.has(edge.id);
      const isConnectedEdge = selectedConnectedEdgeIds.has(edge.id);
      const isYellowConnectedOnly = isConnectedEdge && !isPathEdge;
      const baseEdgeColor = isCoreMissionEdge ? 0x84cc16 : edgeColor(from.entityType);
      const connectedEdgeColor = isCoreMissionEdge ? 0x84cc16 : 0xeab308;
      const connectedEdgeEmissive = isCoreMissionEdge ? 0x4d7c0f : 0xf59e0b;
      const fromRuntimeNode = runtimeNodes.get(edge.fromNodeId);
      const toRuntimeNode = runtimeNodes.get(edge.toNodeId);
      if (!fromRuntimeNode || !toRuntimeNode) {
        continue;
      }
      const curve = computeCurve(fromRuntimeNode.currentPosition, toRuntimeNode.currentPosition);
      const points = curve.getPoints(34);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: isPathEdge ? 0x9333ea : isYellowConnectedOnly ? connectedEdgeColor : baseEdgeColor,
        transparent: true,
        opacity: isPathEdge || isYellowConnectedOnly ? 0.92 : 0.56
      });
      const line = new THREE.Line(geometry, material);
      edgeGroup.add(line);

      let purpleTube: THREE.Mesh | null = null;
      if (isPathEdge) {
        const tubeGeometry = new THREE.TubeGeometry(curve, 48, 2.8, 10, false);
        const pulseMaterial = new THREE.MeshPhongMaterial({
          color: 0x9333ea,
          emissive: 0x6d28d9,
          transparent: true,
          opacity: 0.72
        });
        purpleTube = new THREE.Mesh(tubeGeometry, pulseMaterial);
        edgeGroup.add(purpleTube);
        purplePulseMaterials.push(pulseMaterial);
      }

      let yellowTube: THREE.Mesh | null = null;
      if (isYellowConnectedOnly) {
        const tubeGeometry = new THREE.TubeGeometry(curve, 48, 2.2, 10, false);
        const pulseMaterial = new THREE.MeshPhongMaterial({
          color: connectedEdgeColor,
          emissive: connectedEdgeEmissive,
          transparent: true,
          opacity: 0.66
        });
        yellowTube = new THREE.Mesh(tubeGeometry, pulseMaterial);
        edgeGroup.add(yellowTube);
        yellowPulseMaterials.push(pulseMaterial);
      }

      const arrowPosition = curve.getPoint(0.985);
      const tangent = curve.getTangent(0.985).normalize();
      const arrowGeometry = new THREE.ConeGeometry(5.5, 18, 10);
      const arrowMaterial = new THREE.MeshPhongMaterial({
        color: isPathEdge ? 0x9333ea : baseEdgeColor
      });
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
      arrow.position.copy(arrowPosition);
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      edgeGroup.add(arrow);
      runtimeEdges.push({
        edgeId: edge.id,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        line,
        arrow,
        purpleTube,
        yellowTube
      });
    }
    scene.add(edgeGroup);

    const resize = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (!width || !height) {
        return;
      }
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(viewport);

    const positionTiles = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      for (const [nodeId, runtimeNode] of runtimeNodes.entries()) {
        const element = tileRefs.current[nodeId];
        if (!element) {
          continue;
        }
        const projected = runtimeNode.currentPosition.clone().project(camera);
        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-projected.y * 0.5 + 0.5) * height;
        const isVisibleInProjection = projected.z > -1 && projected.z < 1;
        const isVisibleByFilter = !isTileFilterActive || filteredTileNodeIds.has(nodeId);
        const isVisible = isVisibleInProjection && isVisibleByFilter;
        element.style.display = isVisible ? "block" : "none";
        if (!isVisible) {
          continue;
        }
        const distance = camera.position.distanceTo(runtimeNode.currentPosition);
        const scale = THREE.MathUtils.clamp(1700 / Math.max(distance, 1), 0.56, 1.48);
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    };

    let isDisposed = false;
    let animationFrame = 0;
    let hasMovement = true;
    let hasInitializedEdgeAnchors = false;
    let previousCameraPosition = camera.position.clone();
    let previousCameraTarget = controls.target.clone();
    const renderFrame = () => {
      if (isDisposed) {
        return;
      }
      controls.update();
      const cameraMoved =
        camera.position.distanceToSquared(previousCameraPosition) > 0.000001 ||
        controls.target.distanceToSquared(previousCameraTarget) > 0.000001;
      hasMovement = false;
      for (const runtimeNode of runtimeNodes.values()) {
        runtimeNode.currentPosition.lerp(runtimeNode.targetPosition, 0.14);
        if (runtimeNode.currentPosition.distanceToSquared(runtimeNode.targetPosition) < 0.04) {
          runtimeNode.currentPosition.copy(runtimeNode.targetPosition);
        } else {
          hasMovement = true;
        }
        runtimeNode.mesh.position.copy(runtimeNode.currentPosition);
      }
      for (const runtimeNode of runtimeNodes.values()) {
        runtimeNode.mesh.visible = false;
      }
      positionTiles();
      const shouldRebuildTubes =
        !hasInitializedEdgeAnchors || hasMovement || nodePositionsDirtyRef.current || cameraMoved;
      for (const runtimeEdge of runtimeEdges) {
        updateEdgeGeometry(runtimeEdge, shouldRebuildTubes);
      }
      hasInitializedEdgeAnchors = true;
      nodePositionsDirtyRef.current = false;
      for (const runtimeEdge of runtimeEdges) {
        const isEdgeVisible = isTileFilterActive
          ? highlightedEdgeIds.has(runtimeEdge.edgeId)
          : filteredTileNodeIds.has(runtimeEdge.fromNodeId) && filteredTileNodeIds.has(runtimeEdge.toNodeId);
        runtimeEdge.line.visible = isEdgeVisible;
        runtimeEdge.arrow.visible = isEdgeVisible;
        if (runtimeEdge.purpleTube) {
          runtimeEdge.purpleTube.visible = isEdgeVisible;
        }
        if (runtimeEdge.yellowTube) {
          runtimeEdge.yellowTube.visible = isEdgeVisible;
        }
      }
      persistedCameraStateRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone()
      };
      if (purplePulseMaterials.length) {
        const pulse = 0.56 + 0.38 * (0.5 + 0.5 * Math.sin(performance.now() * 0.008));
        for (const material of purplePulseMaterials) {
          material.opacity = pulse;
        }
      }
      if (yellowPulseMaterials.length) {
        const pulse = 0.48 + 0.44 * (0.5 + 0.5 * Math.sin(performance.now() * 0.01 + 1.1));
        for (const material of yellowPulseMaterials) {
          material.opacity = pulse;
        }
      }
      renderer.render(scene, camera);
      previousCameraPosition = camera.position.clone();
      previousCameraTarget = controls.target.clone();
      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    renderFrame();

    return () => {
      isDisposed = true;
      if (suppressPersistedPositionsOnCleanupRef.current) {
        persistedNodePositionsRef.current = new Map();
      } else {
        const persistedPositions = new Map<string, THREE.Vector3>();
        for (const [nodeId, runtimeNode] of runtimeNodes.entries()) {
          persistedPositions.set(nodeId, runtimeNode.currentPosition.clone());
        }
        persistedNodePositionsRef.current = persistedPositions;
      }
      suppressPersistedPositionsOnCleanupRef.current = false;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      nodeGroup.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          for (const material of object.material) {
            material.dispose();
          }
        } else {
          object.material.dispose();
        }
      });
      edgeGroup.traverse((object) => {
        if (object instanceof THREE.Line) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            for (const material of object.material) {
              material.dispose();
            }
          } else {
            object.material.dispose();
          }
        }
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            for (const material of object.material) {
              material.dispose();
            }
          } else {
            object.material.dispose();
          }
        }
      });
      runtimeNodesRef.current = new Map();
      nodePositionsDirtyRef.current = false;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [
    data.edges,
    filteredTileNodeIds,
    highlightedEdgeIds,
    isOpen,
    isTileFilterActive,
    layout.nodes,
    nodeById,
    selectedConnectedEdgeIds,
    selectedPathEdgeIds
  ]);

  const zoomBy = (factor: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }
    const targetZ = controls.target.z;
    const currentZOffset = camera.position.z - targetZ;
    const normalizedOffset = Number.isFinite(currentZOffset) ? currentZOffset : MIN_CAMERA_DISTANCE;
    const nextZOffset = THREE.MathUtils.clamp(
      Math.max(1, normalizedOffset) * factor,
      MIN_CAMERA_DISTANCE,
      MAX_CAMERA_DISTANCE
    );
    camera.position.z = targetZ + nextZOffset;
    controls.update();
  };

  const resetView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const runtimeNodes = runtimeNodesRef.current;
    manualNodePositionsRef.current = new Map();
    if (runtimeNodes.size) {
      const layoutNodeById = new Map(layout.nodes.map((node) => [node.id, node]));
      for (const [nodeId, runtimeNode] of runtimeNodes.entries()) {
        const layoutNode = layoutNodeById.get(nodeId);
        if (!layoutNode) {
          continue;
        }
        runtimeNode.targetPosition.copy(layoutNode.position);
      }
      nodePositionsDirtyRef.current = true;
    }
    if (camera && controls) {
      camera.position.copy(initialCameraPositionRef.current);
      controls.target.copy(initialTargetRef.current);
      controls.update();
    }
    centerViewportScroll();
  };

  const registerTileRef =
    (nodeId: string) =>
    (element: HTMLDivElement | null): void => {
      tileRefs.current[nodeId] = element;
    };

  const dragRuntimeNodeByScreenDelta = (nodeId: string, deltaX: number, deltaY: number) => {
    const camera = cameraRef.current;
    const viewport = viewportRef.current;
    const runtimeNode = runtimeNodesRef.current.get(nodeId);
    if (!camera || !viewport || !runtimeNode || !viewport.clientHeight) {
      return;
    }

    const viewDirection = new THREE.Vector3();
    camera.getWorldDirection(viewDirection);
    const distanceToNode = Math.abs(runtimeNode.currentPosition.clone().sub(camera.position).dot(viewDirection));
    if (!Number.isFinite(distanceToNode) || distanceToNode <= 0.001) {
      return;
    }

    const worldUnitsPerPixel =
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distanceToNode) / viewport.clientHeight;
    const right = new THREE.Vector3().crossVectors(viewDirection, camera.up).normalize();
    if (right.lengthSq() <= 0.000001) {
      return;
    }
    const up = camera.up.clone().normalize();
    const worldDelta = right.multiplyScalar(deltaX * worldUnitsPerPixel).add(up.multiplyScalar(-deltaY * worldUnitsPerPixel));

    runtimeNode.currentPosition.add(worldDelta);
    runtimeNode.targetPosition.add(worldDelta);
    runtimeNode.mesh.position.copy(runtimeNode.currentPosition);
    manualNodePositionsRef.current.set(nodeId, runtimeNode.currentPosition.clone());
    persistedNodePositionsRef.current.set(nodeId, runtimeNode.currentPosition.clone());
    nodePositionsDirtyRef.current = true;
  };

  const beginTileDrag =
    (nodeId: string) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      if (isTileFilterActive) {
        setSelectedTileFilterId(nodeId);
      }
      setSelectedNodeId(nodeId);
      tileDragStateRef.current = {
        nodeId,
        pointerId: event.pointerId,
        lastClientX: event.clientX,
        lastClientY: event.clientY
      };
      setDraggingNodeId(nodeId);
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

  const moveTileDrag =
    (nodeId: string) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = tileDragStateRef.current;
      if (!dragState || dragState.nodeId !== nodeId || dragState.pointerId !== event.pointerId) {
        return;
      }
      const deltaX = event.clientX - dragState.lastClientX;
      const deltaY = event.clientY - dragState.lastClientY;
      dragState.lastClientX = event.clientX;
      dragState.lastClientY = event.clientY;
      if (!deltaX && !deltaY) {
        return;
      }
      dragRuntimeNodeByScreenDelta(nodeId, deltaX, deltaY);
      event.preventDefault();
    };

  const endTileDrag =
    (nodeId: string) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = tileDragStateRef.current;
      if (!dragState || dragState.nodeId !== nodeId || dragState.pointerId !== event.pointerId) {
        return;
      }
      tileDragStateRef.current = null;
      setDraggingNodeId(null);
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    };

  const selectTileFilter = (nextId: string) => {
    setSelectedTileFilterId(nextId);
    if (nextId !== "__all__") {
      setSelectedNodeId(nextId);
      setSelectedSystemId(null);
      const selectedNode = nodeById.get(nextId);
      if (selectedNode) {
        setTileFilterSearchText(`${entityTypeLabel(selectedNode.entityType)}: ${selectedNode.name}`);
      }
    } else {
      setTileFilterSearchText("");
    }
    setIsTileSearchFocused(false);
  };

  const clearTileSearchSelection = () => {
    setSelectedTileFilterId("__all__");
    setTileFilterSearchText("");
    setIsTileSearchFocused(false);
    setSelectedDetailNodeId(null);
    if (coreNode?.id) {
      setSelectedNodeId(coreNode.id);
    }
  };

  const runSearch = () => {
    setSearchQuery(searchInput.trim().toLowerCase());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
  };

  const stopCiFlowTween = () => {
    if (ciFlowTweenFrameRef.current !== null) {
      window.cancelAnimationFrame(ciFlowTweenFrameRef.current);
      ciFlowTweenFrameRef.current = null;
    }
  };

  const animateCiFlowTween = (
    from: number,
    to: number,
    durationMs: number,
    onComplete?: () => void
  ) => {
    stopCiFlowTween();
    const start = performance.now();
    const tick = (timestamp: number) => {
      const elapsed = timestamp - start;
      const progress = Math.max(0, Math.min(1, elapsed / durationMs));
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const nextValue = from + (to - from) * eased;
      setCiFlowTweenProgress(nextValue);
      if (progress >= 1) {
        ciFlowTweenFrameRef.current = null;
        if (onComplete) {
          onComplete();
        }
        return;
      }
      ciFlowTweenFrameRef.current = window.requestAnimationFrame(tick);
    };
    ciFlowTweenFrameRef.current = window.requestAnimationFrame(tick);
  };

  const openCiFlowFocusForNode = (node: DetailedTreeNode) => {
    if (node.entityType !== "ci" || !node.ciAssetId) {
      return;
    }

    setFocusedCiFlowRootAssetId(node.ciAssetId);
    setSelectedCiFlowNodeId(ciFlowNodeIdForAsset(node.ciAssetId));
    setDetailedSelectedTileFilterId("__all__");
    setDetailedTileFilterSearchText("");
    detailedZoomBeforeCiFlowRef.current = detailedZoom;
    ciFlowAutoFitPendingRef.current = true;
    setCiFlowOriginCenter({ x: node.x + node.width / 2, y: node.y + node.height / 2 });
    setCiFlowViewportCenter(null);
    setCiFlowTweenProgress(0);
    window.requestAnimationFrame(() => {
      animateCiFlowTween(0, 1, 520);
    });
  };

  const closeCiFlowFocus = () => {
    if (!focusedCiFlowRootAssetId) {
      return;
    }
    const from = ciFlowTweenProgress;
    animateCiFlowTween(from, 0, 320, () => {
      setFocusedCiFlowRootAssetId(null);
      setSelectedCiFlowNodeId(null);
      setCiFlowOriginCenter(null);
      setCiFlowViewportCenter(null);
      setCiFlowTweenProgress(0);
      ciFlowAutoFitPendingRef.current = false;
      if (detailedZoomBeforeCiFlowRef.current !== null) {
        setDetailedZoom(detailedZoomBeforeCiFlowRef.current);
        detailedZoomBeforeCiFlowRef.current = null;
      }
    });
  };

  const openDetailsPanelForNode = (nodeId: string) => {
    if (!nodeById.has(nodeId)) {
      return;
    }
    setSelectedDetailNodeId(nodeId);
    setSelectedSystemId(null);
  };

  const openDetailedTopologyForNode = (nodeId: string) => {
    const node = nodeById.get(nodeId);
    if (!node) {
      return;
    }
    setDetailedRootNodeId(node.id);
    setDetailedSelectedTileFilterId("__all__");
    setDetailedTileFilterSearchText("");
    setIsDetailedTileSearchFocused(false);
    setDetailedZoom(1);
    setFocusedCiFlowRootAssetId(null);
    setSelectedCiFlowNodeId(null);
    setCiFlowOriginCenter(null);
    setCiFlowViewportCenter(null);
    setCiFlowTweenProgress(0);
    ciFlowAutoFitPendingRef.current = false;
    detailedZoomBeforeCiFlowRef.current = null;
    setIsDetailedTopologyOpen(true);
  };

  const closeDetailedTopologyView = () => {
    stopCiFlowTween();
    if (detailedTileSearchBlurTimerRef.current !== null) {
      window.clearTimeout(detailedTileSearchBlurTimerRef.current);
      detailedTileSearchBlurTimerRef.current = null;
    }
    if (detailedNodeClickSuppressTimerRef.current !== null) {
      window.clearTimeout(detailedNodeClickSuppressTimerRef.current);
      detailedNodeClickSuppressTimerRef.current = null;
    }
    detailedPanStateRef.current = null;
    suppressDetailedNodeClickRef.current = false;
    setIsDetailedTopologyOpen(false);
    setDetailedSelectedTileFilterId("__all__");
    setDetailedTileFilterSearchText("");
    setIsDetailedTileSearchFocused(false);
    setDetailedZoom(1);
    setFocusedCiFlowRootAssetId(null);
    setSelectedCiFlowNodeId(null);
    setCiFlowOriginCenter(null);
    setCiFlowViewportCenter(null);
    setCiFlowTweenProgress(0);
    ciFlowAutoFitPendingRef.current = false;
    detailedZoomBeforeCiFlowRef.current = null;
  };

  const selectDetailedTileFilter = (nextId: string) => {
    setDetailedSelectedTileFilterId(nextId);
    if (nextId !== "__all__") {
      if (isCiFlowFocusPanelOpen && ciFlowGraph) {
        setSelectedCiFlowNodeId(nextId);
        const selectedFlowNode = ciFlowNodeById.get(nextId);
        if (selectedFlowNode) {
          setDetailedTileFilterSearchText(
            `${detailedEntityTypeLabel(selectedFlowNode.entityType)}: ${selectedFlowNode.name}`
          );
        }
      } else {
        setDetailedSelectedNodeId(nextId);
        const selectedNode = detailedNodeById.get(nextId);
        if (selectedNode) {
          setDetailedTileFilterSearchText(`${detailedEntityTypeLabel(selectedNode.entityType)}: ${selectedNode.name}`);
        }
      }
    } else {
      setDetailedTileFilterSearchText("");
    }
    setIsDetailedTileSearchFocused(false);
  };

  const clearDetailedTileSearchSelection = () => {
    setDetailedSelectedTileFilterId("__all__");
    setDetailedTileFilterSearchText("");
    setIsDetailedTileSearchFocused(false);
    if (isCiFlowFocusPanelOpen && ciFlowRootNodeId) {
      setSelectedCiFlowNodeId(ciFlowRootNodeId);
      return;
    }
    if (detailedTree?.rootNodeId) {
      setDetailedSelectedNodeId(detailedTree.rootNodeId);
    }
  };

  const zoomDetailedBy = (factor: number) => {
    setDetailedZoom((current) => Number((current * factor).toFixed(4)));
  };

  const resetDetailedTopologyView = () => {
    setDetailedZoom(1);
    if (isCiFlowFocusPanelOpen && ciFlowRootNodeId) {
      setDetailedSelectedTileFilterId("__all__");
      setSelectedCiFlowNodeId(ciFlowRootNodeId);
    } else if (detailedTree?.rootNodeId) {
      setDetailedSelectedNodeId(detailedTree.rootNodeId);
    }
    window.requestAnimationFrame(() => {
      centerDetailedViewportScroll();
    });
  };

  const beginDetailedCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType !== "touch") {
      return;
    }
    const targetElement = event.target instanceof Element ? event.target : null;
    if (targetElement?.closest("button,input,select,textarea,a,label,[role='button'],[data-no-pan='true']")) {
      return;
    }
    const container = event.currentTarget;
    detailedPanStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: container.scrollLeft,
      startScrollTop: container.scrollTop,
      hasMoved: false
    };
    container.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveDetailedCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const panState = detailedPanStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - panState.startClientX;
    const deltaY = event.clientY - panState.startClientY;
    if (!panState.hasMoved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
      panState.hasMoved = true;
    }
    event.currentTarget.scrollLeft = panState.startScrollLeft - deltaX;
    event.currentTarget.scrollTop = panState.startScrollTop - deltaY;
    if (panState.hasMoved) {
      suppressDetailedNodeClickRef.current = true;
    }
    event.preventDefault();
  };

  const endDetailedCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const panState = detailedPanStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) {
      return;
    }
    detailedPanStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!panState.hasMoved) {
      return;
    }
    suppressDetailedNodeClickRef.current = true;
    if (detailedNodeClickSuppressTimerRef.current !== null) {
      window.clearTimeout(detailedNodeClickSuppressTimerRef.current);
    }
    detailedNodeClickSuppressTimerRef.current = window.setTimeout(() => {
      suppressDetailedNodeClickRef.current = false;
      detailedNodeClickSuppressTimerRef.current = null;
    }, 0);
  };

  const exportDetailedTopologyAsPng = async () => {
    const isFlowExport = isCiFlowFocusPanelOpen && Boolean(ciFlowGraph);
    if (!isFlowExport && !detailedTree) {
      return;
    }

    let serializedSvg = "";
    let exportWidth = 1;
    let exportHeight = 1;

    if (isFlowExport && ciFlowGraph) {
      const visibleNodeIds = isDetailedTileFilterActive
        ? detailedFilteredNodeIds
        : new Set(ciFlowGraph.nodes.map((node) => node.id));
      const edgeMarkup = ciFlowGraph.edges
        .map((edge) => {
          if (
            !visibleNodeIds.has(edge.fromNodeId) ||
            !visibleNodeIds.has(edge.toNodeId)
          ) {
            return "";
          }
          const fromNode = ciFlowNodeById.get(edge.fromNodeId);
          const toNode = ciFlowNodeById.get(edge.toNodeId);
          if (!fromNode || !toNode) {
            return "";
          }
          const edgeColor = ciFlowDependencyColor(edge.dependencyType);
          const isHighlighted = ciFlowHighlightedEdgeIds.has(edge.id);
          const strokeWidth = edge.dependencyType === "Unmodelled Attachment" ? 2.4 : isHighlighted ? 4.1 : 2.9;
          const opacity = isHighlighted ? 0.98 : 0.74;
          const markerId =
            edge.dependencyType === "Flow Dependency"
              ? "ci-flow-arrow-flow"
              : edge.dependencyType === "Logical Dependency"
                ? "ci-flow-arrow-logical"
                : "ci-flow-arrow-attachment";
          return `<path d="${ciFlowEdgePath(fromNode, toNode)}" fill="none" stroke="${edgeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-linecap="round" marker-end="url(#${markerId})" />`;
        })
        .join("");

      const nodeMarkup = ciFlowGraph.nodes
        .map((node) => {
          if (!visibleNodeIds.has(node.id)) {
            return "";
          }
          const compliance = complianceMode === "cyber" ? node.cyberCompliance : node.discoveryCompliance;
          const percentages = compliancePercentages(compliance);
          const isSelected = selectedCiFlowNodeId === node.id;
          const flowHorizontalPadding = 20;
          const flowProgressHeight = 14;
          const flowScoreReserve = 235;
          if (node.entityType === "not-modelled") {
            return `
              <g>
                <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="16" fill="#fda4af" stroke="#ef4444" stroke-width="${isSelected ? 4 : 3}" />
                <text x="${node.x + node.width / 2}" y="${node.y + 44}" text-anchor="middle" font-size="20" font-weight="700" fill="#7f1d1d">Not Modelled</text>
                <text x="${node.x + node.width / 2}" y="${node.y + 72}" text-anchor="middle" font-size="14" font-weight="600" fill="#7f1d1d">${escapeSvgText(
                  truncateLabel(node.subtitle, 52)
                )}</text>
              </g>
            `.trim();
          }
          const firstLineLabel = `Type: CI | Name: ${node.name}`;
          const firstLineMaxChars = Math.max(
            70,
            Math.floor((node.width - 2 * flowHorizontalPadding) / DETAILED_CI_TEXT_AVG_CHAR_WIDTH)
          );
          const ciProgressWidth = Math.max(
            240,
            Math.min(
              440,
              node.width - 2 * flowHorizontalPadding - flowScoreReserve
            )
          );
          const borderColor = node.isInModelScope ? "#22c55e" : "#ef4444";
          return `
            <g>
              <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="14" fill="#e2e8f0" stroke="${borderColor}" stroke-width="${isSelected ? 4 : 2.6}" />
              <text x="${node.x + flowHorizontalPadding}" y="${node.y + 36}" font-size="16" font-weight="700" fill="#0f172a">${escapeSvgText(
                truncateLabel(firstLineLabel, firstLineMaxChars)
              )}</text>
              <text x="${node.x + flowHorizontalPadding}" y="${node.y + 58}" font-size="13" font-weight="600" fill="#334155">${escapeSvgText(
                truncateLabel(node.modelLabel, firstLineMaxChars)
              )}</text>
              <rect x="${node.x + flowHorizontalPadding}" y="${node.y + node.height - 38}" width="${ciProgressWidth}" height="${flowProgressHeight}" rx="3" fill="#cbd5e1" />
              <rect x="${node.x + flowHorizontalPadding}" y="${node.y + node.height - 38}" width="${(ciProgressWidth * percentages.compliant) / 100}" height="${flowProgressHeight}" rx="3" fill="#16a34a" />
              <rect x="${node.x + flowHorizontalPadding + (ciProgressWidth * percentages.compliant) / 100}" y="${node.y + node.height - 38}" width="${(ciProgressWidth * percentages.nonCompliant) / 100}" height="${flowProgressHeight}" fill="#ef4444" />
              <rect x="${node.x + flowHorizontalPadding + (ciProgressWidth * (percentages.compliant + percentages.nonCompliant)) / 100}" y="${node.y + node.height - 38}" width="${(ciProgressWidth * percentages.other) / 100}" height="${flowProgressHeight}" fill="#94a3b8" />
              <text x="${node.x + node.width - flowHorizontalPadding}" y="${node.y + node.height - 18}" text-anchor="end" font-size="13" font-weight="700" fill="#0f172a">${escapeSvgText(
                `${percentages.compliant}% C | ${percentages.nonCompliant}% NC | ${percentages.other}% O`
              )}</text>
            </g>
          `.trim();
        })
        .join("");

      exportWidth = Math.max(1, Math.ceil(ciFlowGraph.width));
      exportHeight = Math.max(1, Math.ceil(ciFlowGraph.height));
      serializedSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}">
          <defs>
            <marker id="ci-flow-arrow-logical" markerWidth="9" markerHeight="7" refX="8.2" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,7 L8.2,3.5 z" fill="#f97316" />
            </marker>
            <marker id="ci-flow-arrow-flow" markerWidth="9" markerHeight="7" refX="8.2" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,7 L8.2,3.5 z" fill="#22c55e" />
            </marker>
            <marker id="ci-flow-arrow-attachment" markerWidth="9" markerHeight="7" refX="8.2" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,7 L8.2,3.5 z" fill="#fb7185" />
            </marker>
          </defs>
          <rect x="0" y="0" width="${exportWidth}" height="${exportHeight}" fill="#020617" />
          <g>${edgeMarkup}</g>
          <g>${nodeMarkup}</g>
        </svg>
      `.trim();
    } else if (detailedTree) {
      const visibleNodeIds = isDetailedTileFilterActive
        ? detailedFilteredNodeIds
        : new Set(detailedTree.nodes.map((node) => node.id));
      const localNodeById = new Map(detailedTree.nodes.map((node) => [node.id, node]));
      const edgeMarkup = detailedTree.edges
        .map((edge) => {
          if (!visibleNodeIds.has(edge.fromNodeId) || !visibleNodeIds.has(edge.toNodeId)) {
            return "";
          }
          const fromNode = localNodeById.get(edge.fromNodeId);
          const toNode = localNodeById.get(edge.toNodeId);
          if (!fromNode || !toNode) {
            return "";
          }
          const isPathEdge = detailedSelectedPathEdgeIds.has(edge.id);
          const isConnectedEdge = detailedSelectedConnectedEdgeIds.has(edge.id);
          const strokeColor = isPathEdge ? "#9333ea" : isConnectedEdge ? "#eab308" : "#38bdf8";
          const strokeWidth = isPathEdge ? 4 : isConnectedEdge ? 3.2 : 2.1;
          const opacity = isPathEdge || isConnectedEdge ? 0.94 : 0.58;
          return `<path d="${detailedEdgePath(fromNode, toNode)}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-linecap="round" />`;
        })
        .join("");

      const nodeMarkup = detailedTree.nodes
        .map((node) => {
          if (!visibleNodeIds.has(node.id)) {
            return "";
          }
          const compliance = complianceMode === "cyber" ? node.cyberCompliance : node.discoveryCompliance;
          const percentages = compliancePercentages(compliance);
          const isRootNode = node.id === detailedTree.rootNodeId;
          const isCiNode = node.entityType === "ci";
          const isSelectedNode = detailedSelectedNodeId === node.id;
          const tileWidth = node.width;
          const tileHeight = node.height;
          const tileRadius = isCiNode ? 14 : 24;
          const strokeColor = isRootNode ? "#ef4444" : isSelectedNode ? "#a855f7" : detailedTileStrokeColor(node.entityType);
          const strokeWidth = isRootNode || isSelectedNode ? 4 : 2;

          if (isCiNode) {
            const ciFirstLineLabel = `Type: CI | Name: ${node.name} | ${node.subtitle}`;
            const ciFirstLineMaxChars = Math.max(62, Math.floor((tileWidth - 28) / DETAILED_CI_TEXT_AVG_CHAR_WIDTH));
            const ciProgressWidth = Math.max(
              140,
              Math.min(
                DETAILED_CI_PROGRESS_WIDTH,
                tileWidth - 28 - DETAILED_CI_PROGRESS_TO_TEXT_GAP - DETAILED_CI_SCORE_TEXT_RESERVE
              )
            );
            const ciBarBaseX = node.x + 14;
            const ciBarY = node.y + tileHeight - 24;
            return `
              <g>
                <rect x="${node.x}" y="${node.y}" width="${tileWidth}" height="${tileHeight}" rx="${tileRadius}" fill="${detailedTileColor(node.entityType)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
                <text x="${node.x + 14}" y="${node.y + 24}" font-size="11.5" font-weight="700" fill="#0f172a">${escapeSvgText(
                  truncateLabel(ciFirstLineLabel, ciFirstLineMaxChars)
                )}</text>
                <rect x="${ciBarBaseX}" y="${ciBarY}" width="${ciProgressWidth}" height="${DETAILED_CI_PROGRESS_HEIGHT}" rx="3" fill="#cbd5e1" />
                <rect x="${ciBarBaseX}" y="${ciBarY}" width="${(ciProgressWidth * percentages.compliant) / 100}" height="${DETAILED_CI_PROGRESS_HEIGHT}" rx="3" fill="#16a34a" />
                <rect x="${ciBarBaseX + (ciProgressWidth * percentages.compliant) / 100}" y="${ciBarY}" width="${(ciProgressWidth * percentages.nonCompliant) / 100}" height="${DETAILED_CI_PROGRESS_HEIGHT}" fill="#ef4444" />
                <rect x="${ciBarBaseX + (ciProgressWidth * (percentages.compliant + percentages.nonCompliant)) / 100}" y="${ciBarY}" width="${(ciProgressWidth * percentages.other) / 100}" height="${DETAILED_CI_PROGRESS_HEIGHT}" fill="#94a3b8" />
                <text x="${node.x + tileWidth - 14}" y="${node.y + tileHeight - 16}" text-anchor="end" font-size="10.5" font-weight="700" fill="#0f172a">${escapeSvgText(
                  `${percentages.compliant}% C | ${percentages.nonCompliant}% NC | ${percentages.other}% O`
                )}</text>
              </g>
            `.trim();
          }

          const barWidth = tileWidth - 36;
          return `
            <g>
              <rect x="${node.x}" y="${node.y}" width="${tileWidth}" height="${tileHeight}" rx="${tileRadius}" fill="${detailedTileColor(node.entityType)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
              <text x="${node.x + 18}" y="${node.y + 30}" font-size="14" font-weight="700" fill="#0f172a">${escapeSvgText(
                truncateLabel(`Type: ${detailedEntityTypeLabel(node.entityType)}`, 44)
              )}</text>
              <text x="${node.x + 18}" y="${node.y + 52}" font-size="14" font-weight="700" fill="#0f172a">${escapeSvgText(
                truncateLabel(`Name: ${node.name}`, 44)
              )}</text>
              <text x="${node.x + 18}" y="${node.y + 72}" font-size="12" fill="#334155">${escapeSvgText(
                truncateLabel(node.subtitle, 49)
              )}</text>
              <rect x="${node.x + 18}" y="${node.y + 88}" width="${barWidth}" height="12" rx="3" fill="#cbd5e1" />
              <rect x="${node.x + 18}" y="${node.y + 88}" width="${(barWidth * percentages.compliant) / 100}" height="12" rx="3" fill="#16a34a" />
              <rect x="${node.x + 18 + (barWidth * percentages.compliant) / 100}" y="${node.y + 88}" width="${(barWidth * percentages.nonCompliant) / 100}" height="12" fill="#ef4444" />
              <rect x="${node.x + 18 + (barWidth * (percentages.compliant + percentages.nonCompliant)) / 100}" y="${node.y + 88}" width="${(barWidth * percentages.other) / 100}" height="12" fill="#94a3b8" />
              <text x="${node.x + tileWidth / 2}" y="${node.y + 123}" text-anchor="middle" font-size="16" font-weight="600" fill="#0f172a">${escapeSvgText(
                `${percentages.compliant}% C | ${percentages.nonCompliant}% NC | ${percentages.other}% O`
              )}</text>
            </g>
          `.trim();
        })
        .join("");

      exportWidth = Math.max(1, Math.ceil(detailedTree.width));
      exportHeight = Math.max(1, Math.ceil(detailedTree.height));
      serializedSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}">
          <rect x="0" y="0" width="${exportWidth}" height="${exportHeight}" fill="#020617" />
          <g>${edgeMarkup}</g>
          <g>${nodeMarkup}</g>
        </svg>
      `.trim();
    }
    const svgBlob = new Blob([serializedSvg], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(svgBlob);
    let pngObjectUrl: string | null = null;

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error("Failed to render detailed topology image"));
        nextImage.src = objectUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      context.fillStyle = "#020617";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const pngBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });
      if (!pngBlob) {
        return;
      }
      pngObjectUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = pngObjectUrl;
      link.download = `detailed-topology-view-${timestamp}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to export detailed topology PNG", error);
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (pngObjectUrl) {
        URL.revokeObjectURL(pngObjectUrl);
      }
    }
  };

  const toggleNodeCiExpansion = (nodeId: string) => {
    setExpandedNodeIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const setNodeCiSearch = (nodeId: string, assetType: CiAssetType, value: string) => {
    const key = ciSearchKey(nodeId, assetType);
    setNodeCiSearchByKey((current) => ({
      ...current,
      [key]: value
    }));
  };

  const setNodeCiEnvironmentSearch = (nodeId: string, environment: CiEnvironmentLabel, value: string) => {
    const key = ciEnvironmentSearchKey(nodeId, environment);
    setNodeCiEnvironmentSearchByKey((current) => ({
      ...current,
      [key]: value
    }));
  };

  const detailedEdgePath = (fromNode: DetailedTreeNode, toNode: DetailedTreeNode) => {
    const startX = fromNode.x + fromNode.width;
    const startY = fromNode.y + fromNode.height / 2;
    const endX = toNode.x;
    const endY = toNode.y + toNode.height / 2;
    const horizontalDelta = Math.max(45, (endX - startX) * 0.5);
    return `M ${startX} ${startY} C ${startX + horizontalDelta} ${startY}, ${endX - horizontalDelta} ${endY}, ${endX} ${endY}`;
  };

  const ciFlowEdgePath = (fromNode: CiFlowNodeLayout, toNode: CiFlowNodeLayout) => {
    const startX = fromNode.x + fromNode.width / 2;
    const startY = fromNode.y + fromNode.height / 2;
    const endX = toNode.x + toNode.width / 2;
    const endY = toNode.y + toNode.height / 2;
    const horizontalGap = endX - startX;
    const controlOffsetX = Math.max(50, Math.abs(horizontalGap) * 0.36);
    const controlOffsetY = Math.max(18, Math.abs(endY - startY) * 0.24);
    const control1X = startX + (horizontalGap >= 0 ? controlOffsetX : -controlOffsetX);
    const control2X = endX - (horizontalGap >= 0 ? controlOffsetX : -controlOffsetX);
    const control1Y = startY - controlOffsetY;
    const control2Y = endY + controlOffsetY;
    return `M ${startX} ${startY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${endX} ${endY}`;
  };

  const renderDetailList = (label: string, values?: string[]) => {
    if (typeof values === "undefined") {
      return null;
    }
    return (
      <div className="panel-alt p-3">
        <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">{label}</dt>
        <dd className="mt-1 text-sm text-slate-100">{values.length ? values.join(", ") : "-"}</dd>
      </div>
    );
  };

  const detailedViewWidth = detailedTree?.width ?? 1;
  const detailedViewHeight = detailedTree?.height ?? 1;
  const detailedCanvasWidth = Math.max(1, Math.ceil(detailedViewWidth * detailedZoom));
  const detailedCanvasHeight = Math.max(1, Math.ceil(detailedViewHeight * detailedZoom));
  const ciFlowViewWidth = ciFlowGraph?.width ?? 1;
  const ciFlowViewHeight = ciFlowGraph?.height ?? 1;
  const ciFlowCanvasWidth = Math.max(
    1,
    Math.ceil(ciFlowViewWidth * detailedZoom) + CI_FLOW_VIEWPORT_PADDING * 2
  );
  const ciFlowCanvasHeight = Math.max(
    1,
    Math.ceil(ciFlowViewHeight * detailedZoom) + CI_FLOW_VIEWPORT_PADDING * 2
  );
  const detailedZoomPercent = Math.round(detailedZoom * 100);
  const ciFlowRootTile = ciFlowRootNodeId ? ciFlowNodeById.get(ciFlowRootNodeId) ?? null : null;

  return (
    <div
      className={`fixed inset-0 z-[1200] transition-transform duration-300 ease-out ${
        isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
      }`}
      aria-hidden={!isOpen}
    >
      <div className="absolute inset-0 bg-slate-950/70" />
      <section className="absolute inset-2 flex flex-col overflow-hidden rounded-2xl border border-sky-300/30 bg-slate-950/95 shadow-[0_26px_90px_rgba(0,0,0,0.65)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-400/20 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-300/80">{data.networkName}</p>
            <h2 className="text-lg font-semibold text-sky-100">Network Topology View</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-red-300/45 bg-red-500/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 hover:bg-red-500/25"
            >
              Close
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-sky-400/15 px-4 py-3 text-xs">
          <label className="text-slate-300/85" htmlFor="network-topology-compliance-mode">
            Compliance
          </label>
          <select
            id="network-topology-compliance-mode"
            value={complianceMode}
            onChange={(event) => setComplianceMode(event.target.value as ComplianceMode)}
            className="rounded-md border border-sky-400/35 bg-slate-900/85 px-2.5 py-1.5 text-slate-100"
          >
            <option value="cyber">Cyber Security Compliance</option>
            <option value="discovery">Discovery Compliance</option>
          </select>
          <label className="ml-2 text-slate-300/85" htmlFor="network-topology-tile-filter-search">
            Tile Search
          </label>
          <div className="relative w-[440px] max-w-full">
            <div className="flex items-center gap-2">
              <input
                ref={tileSearchInputRef}
                id="network-topology-tile-filter-search"
                type="search"
                value={tileFilterSearchText}
                onChange={(event) => setTileFilterSearchText(event.target.value)}
                onFocus={() => setIsTileSearchFocused(true)}
                onBlur={() => {
                  tileSearchBlurTimerRef.current = window.setTimeout(() => {
                    setIsTileSearchFocused(false);
                    setTileFilterSearchText((currentText) => currentText.trim());
                    tileSearchBlurTimerRef.current = null;
                  }, 120);
                }}
                placeholder="Search tile type or name"
                className="min-w-0 flex-1 rounded-md border border-sky-400/35 bg-slate-900/85 px-2.5 py-1.5 text-slate-100 placeholder:text-slate-400/90"
              />
              {selectedTileFilterId !== "__all__" ? (
                <button
                  type="button"
                  onClick={clearTileSearchSelection}
                  className="rounded-md border border-slate-500/45 bg-slate-900/70 px-2.5 py-1.5 font-semibold text-slate-200"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {hasTileSearchTerm && isTileSearchFocused ? (
              <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-40 max-h-56 overflow-auto rounded-md border border-sky-400/35 bg-slate-950/95 p-1 shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
                {filteredTileDropdownOptions.length ? (
                  <ul className="space-y-1">
                    {filteredTileDropdownOptions.map((node) => (
                      <li key={`tile-search-result-${node.id}`}>
                        <button
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            if (tileSearchBlurTimerRef.current !== null) {
                              window.clearTimeout(tileSearchBlurTimerRef.current);
                              tileSearchBlurTimerRef.current = null;
                            }
                            selectTileFilter(node.id);
                            tileSearchInputRef.current?.blur();
                          }}
                          className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${
                            selectedTileFilterId === node.id
                              ? "border-violet-300/75 bg-violet-500/15 text-violet-100"
                              : "border-sky-400/20 bg-slate-900/70 text-slate-100 hover:border-sky-300/45 hover:bg-slate-800/85"
                          }`}
                        >
                          {entityTypeLabel(node.entityType)}: {node.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300">
                    No matching tiles
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <span className="mx-1 h-5 w-px bg-sky-400/20" />
          <button
            type="button"
            onClick={() => zoomBy(0.86)}
            className="rounded-md border border-sky-400/35 bg-slate-900/60 px-2.5 py-1.5 font-semibold text-sky-100"
          >
            Zoom In
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1.16)}
            className="rounded-md border border-sky-400/35 bg-slate-900/60 px-2.5 py-1.5 font-semibold text-sky-100"
          >
            Zoom Out
          </button>
          <button
            type="button"
            className="rounded-md border border-sky-200/70 bg-sky-500/18 px-2.5 py-1.5 font-semibold text-sky-100"
            aria-pressed="true"
          >
            Panning
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded-md border border-slate-400/45 bg-slate-800/70 px-2.5 py-1.5 font-semibold text-slate-100"
          >
            Reset View
          </button>

          <div className="ml-auto flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Green compliant
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              Red non-compliant
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              Grey other
            </span>
            <span className="mx-1 h-5 w-px bg-sky-400/20" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-300/70">Entity Key</span>
            {(["network", "mission-capability", "service", "ict-system"] as TopologyEntityType[])
              .filter((entityType) => presentEntityTypes.has(entityType))
              .map((entityType) => (
                <span key={`entity-key-${entityType}`} className="inline-flex items-center gap-1">
                  <span className={`h-2.5 w-2.5 rounded-sm ${legendSwatchClass(entityType)}`} />
                  {entityTypeLabel(entityType)}
                </span>
              ))}
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <div ref={scrollContainerRef} className="h-full overflow-auto px-4 py-4">
            <div
              ref={viewportRef}
              onWheel={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const factor = event.deltaY > 0 ? 1.1 : 0.9;
                zoomBy(factor);
              }}
              className="relative overflow-hidden rounded-xl border border-sky-400/20 bg-slate-950/65"
              style={{ width: layout.size.width, height: layout.size.height }}
            >
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            {rendererInitError ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-6 text-center">
                <p className="max-w-xl rounded-lg border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {rendererInitError}
                </p>
              </div>
            ) : null}
            <div className="absolute inset-0 pointer-events-none">
              {rendererInitError
                ? null
                : layout.nodes.map((node) => {
                const compliance = complianceMode === "cyber" ? node.cyberCompliance : node.discoveryCompliance;
                const percentage = compliancePercentages(compliance);
                const isCoreTile = coreNode?.id === node.id;
                const nodeCiGroups = ciAssetsByNodeId.get(node.id) ?? [];
                const nodeEnvironmentGroups = ciEnvironmentGroupsByNodeId.get(node.id) ?? [];
                const nodeCiCount = nodeCiGroups.reduce((sum, group) => sum + group.items.length, 0);
                const isNodeExpanded = expandedNodeIds.has(node.id);
                return (
                  <div
                    key={node.id}
                    ref={registerTileRef(node.id)}
                    onPointerDown={beginTileDrag(node.id)}
                    onPointerMove={moveTileDrag(node.id)}
                    onPointerUp={endTileDrag(node.id)}
                    onPointerCancel={endTileDrag(node.id)}
                    className={`pointer-events-auto absolute w-[22rem] rounded-3xl px-4 py-3 text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] ${tileSurfaceClass(
                      node.entityType
                    )} ${
                      isCoreTile
                        ? "border-4 border-red-500"
                        : node.id === selectedNodeId
                          ? "border-4 border-violet-500"
                        : "border-2 border-sky-950/90"
                    } ${draggingNodeId === node.id ? "cursor-grabbing" : "cursor-grab"} relative origin-center select-none touch-none`}
                  >
                    <button
                      type="button"
                      aria-label={`${isNodeExpanded ? "Collapse" : "Expand"} ${node.name} CIs in scope`}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleNodeCiExpansion(node.id);
                      }}
                      className="absolute -right-3 -top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-900/80 bg-slate-950 text-sky-100 shadow-[0_6px_16px_rgba(0,0,0,0.5)] transition hover:border-cyan-300 hover:text-cyan-100"
                    >
                      {isNodeExpanded ? (
                        <svg
                          viewBox="0 0 12 12"
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 6h8" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 12 12"
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 2v8" />
                          <path d="M2 6h8" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      title="Detailed Toplogy View"
                      aria-label={`Open Detailed Toplogy View for ${node.name}`}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetailedTopologyForNode(node.id);
                      }}
                      className="absolute -right-3 -bottom-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-900/80 bg-slate-950 text-sky-100 shadow-[0_6px_16px_rgba(0,0,0,0.5)] transition hover:border-cyan-300 hover:text-cyan-100"
                    >
                      <svg
                        viewBox="0 0 12 12"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 2v8" />
                        <path d="M2 6h8" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Tile Details"
                      aria-label={`Open details for ${node.name}`}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetailsPanelForNode(node.id);
                      }}
                      className="absolute -left-3 -bottom-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-900/80 bg-slate-950 text-sky-100 shadow-[0_6px_16px_rgba(0,0,0,0.5)] transition hover:border-cyan-300 hover:text-cyan-100"
                    >
                      <span className="text-[11px] font-bold leading-none">D</span>
                    </button>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold leading-snug text-slate-900">
                        Type: <span className="font-medium">{entityTypeLabel(node.entityType)}</span>
                      </p>
                      <p className="text-sm font-semibold leading-snug text-slate-900">
                        Name: <span className="font-medium">{node.name}</span>
                      </p>
                    </div>
                    <div className="mt-3 h-3 w-full overflow-hidden rounded-sm bg-slate-300/95">
                      <div className="flex h-full w-full">
                        <div className="h-full bg-emerald-600" style={{ width: `${percentage.compliant}%` }} />
                        <div className="h-full bg-red-500" style={{ width: `${percentage.nonCompliant}%` }} />
                        <div className="h-full bg-slate-400" style={{ width: `${percentage.other}%` }} />
                      </div>
                    </div>
                    <p className="mt-2 text-center text-base font-medium text-slate-900">
                      {percentage.compliant}% C | {percentage.nonCompliant}% NC | {percentage.other}% O
                    </p>
                    {isNodeExpanded ? (
                      <div
                        onPointerDown={(event) => event.stopPropagation()}
                        className="absolute left-1/2 top-[calc(100%+0.55rem)] z-20 w-[min(85.8rem,calc(100vw-3rem))] -translate-x-1/2 rounded-2xl border border-slate-700/85 bg-slate-950/96 p-3 shadow-[0_20px_48px_rgba(0,0,0,0.58)]"
                      >
                        <p className="px-1 text-[11px] uppercase tracking-[0.13em] text-slate-300/85">
                          CIs In Scope ({nodeCiCount})
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {CI_ASSET_TYPES.map((assetType) => {
                            const group = nodeCiGroups.find((item) => item.assetType === assetType);
                            const searchValue = nodeCiSearchByKey[ciSearchKey(node.id, assetType)] ?? "";
                            const normalizedSearchValue = searchValue.trim().toLowerCase();
                            const filteredItems = (group?.items ?? []).filter((asset) => {
                              if (!normalizedSearchValue) {
                                return true;
                              }
                              return `${asset.hostname} ${asset.name} ${asset.ipAddress}`
                                .toLowerCase()
                                .includes(normalizedSearchValue);
                            });
                            return (
                              <section
                                key={`${node.id}-${assetType}`}
                                className="flex h-64 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-700/75 bg-slate-900/88 p-2"
                              >
                                <p className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/90">
                                  {ciAssetTypeLabel(assetType)} ({filteredItems.length}/{group?.items.length ?? 0})
                                </p>
                                <input
                                  type="search"
                                  value={searchValue}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onChange={(event) => setNodeCiSearch(node.id, assetType, event.target.value)}
                                  placeholder="Filter CIs"
                                  className="mt-1 rounded border border-slate-600/80 bg-slate-950/90 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-400"
                                />
                                <div className="mt-2 min-h-0 flex-1 overflow-auto">
                                  <table className="w-full table-fixed border-collapse text-[11px] text-slate-200">
                                    <thead className="sticky top-0 bg-slate-900/95 text-left uppercase tracking-[0.11em] text-slate-300/85">
                                      <tr>
                                        <th className="w-full border-b border-slate-700/80 px-1 py-1">Hostname</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filteredItems.length ? (
                                        filteredItems.map((asset) => (
                                          <tr key={asset.id} className="align-top">
                                            <td className="border-b border-slate-800/80 px-1 py-1 break-words">
                                              {asset.hostname}
                                            </td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td className="px-1 py-2 text-slate-400" colSpan={1}>
                                            No matching CIs.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </section>
                            );
                          })}
                        </div>
                        <div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-900/65 p-2">
                          <p className="px-1 text-[11px] uppercase tracking-[0.13em] text-slate-300/85">
                            CIs In Scope By Environment
                          </p>
                          {nodeEnvironmentGroups.length ? (
                            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                              {nodeEnvironmentGroups.map((group) => {
                                const searchKey = ciEnvironmentSearchKey(node.id, group.environment);
                                const searchValue = nodeCiEnvironmentSearchByKey[searchKey] ?? "";
                                const normalizedSearch = searchValue.trim().toLowerCase();
                                const filteredItems = group.items.filter((asset) => {
                                  if (!normalizedSearch) {
                                    return true;
                                  }
                                  return `${asset.hostname} ${asset.name} ${asset.ipAddress} ${asset.type}`
                                    .toLowerCase()
                                    .includes(normalizedSearch);
                                });
                                return (
                                  <section
                                    key={`${node.id}-environment-${group.environment}`}
                                    className="flex h-64 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-700/75 bg-slate-900/88 p-2"
                                  >
                                    <p className="text-[11px] uppercase tracking-[0.12em] text-cyan-100/90">
                                      {group.environment} ({filteredItems.length}/{group.items.length})
                                    </p>
                                    <input
                                      type="search"
                                      value={searchValue}
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onChange={(event) =>
                                        setNodeCiEnvironmentSearch(node.id, group.environment, event.target.value)
                                      }
                                      placeholder="Filter CIs"
                                      className="mt-1 rounded border border-slate-600/80 bg-slate-950/90 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-400"
                                    />
                                    <div className="mt-2 min-h-0 flex-1 overflow-auto">
                                      <table className="w-full table-fixed border-collapse text-[11px] text-slate-200">
                                        <thead className="sticky top-0 bg-slate-900/95 text-left uppercase tracking-[0.11em] text-slate-300/85">
                                          <tr>
                                            <th className="w-[70%] border-b border-slate-700/80 px-1 py-1">Hostname</th>
                                            <th className="w-[30%] border-b border-slate-700/80 px-1 py-1">Type</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {filteredItems.length ? (
                                            filteredItems.map((asset) => (
                                              <tr key={asset.id} className="align-top">
                                                <td className="border-b border-slate-800/80 px-1 py-1 break-words">
                                                  {asset.hostname}
                                                </td>
                                                <td className="border-b border-slate-800/80 px-1 py-1 break-words">
                                                  {ciAssetTypeSingularLabel(asset.type)}
                                                </td>
                                              </tr>
                                            ))
                                          ) : (
                                            <tr>
                                              <td className="px-1 py-2 text-slate-400" colSpan={2}>
                                                No matching CIs.
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </section>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="mt-2 px-1 text-xs text-slate-400">No environment-linked CIs in this scope.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <aside
              className={`absolute inset-0 border-l border-sky-400/20 bg-slate-950/96 transition-transform duration-300 ${
                selectedCmdb ? "translate-x-0" : "translate-x-full pointer-events-none"
              }`}
            >
              <div className="flex h-full flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-400/18 px-4 py-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Detailed CMDB Topology</p>
                    <h3 className="text-base font-semibold text-sky-100">
                      {selectedCmdb?.systemName ?? "ICT System"}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSystemId(null)}
                    className="rounded-md border border-slate-400/45 bg-slate-800/75 px-3 py-1.5 text-xs font-semibold text-slate-100"
                  >
                    Back To Network Topology
                  </button>
                </div>

                <div className="border-b border-sky-400/15 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="search"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          runSearch();
                        }
                      }}
                      placeholder="Search by IP or Name"
                      className="min-w-[260px] flex-1 rounded-md border border-sky-400/28 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/80"
                    />
                    <button
                      type="button"
                      onClick={runSearch}
                      className="rounded-md border border-sky-300/45 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100"
                    >
                      Search
                    </button>
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="rounded-md border border-slate-500/45 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
                  {selectedCmdb ? (
                    <ul className="space-y-3 text-sm">
                      {[
                        { key: "networkDevices", label: "Network Devices", items: selectedCmdb.networkDevices },
                        { key: "workstations", label: "Workstations", items: selectedCmdb.workstations },
                        { key: "servers", label: "Servers", items: selectedCmdb.servers }
                      ].map((group) => (
                        <li key={group.key} className="rounded-xl border border-sky-400/20 bg-slate-900/55 p-3">
                          <p className="text-xs uppercase tracking-[0.13em] text-slate-300/80">
                            {group.label} ({group.items.length})
                          </p>
                          <ul className="mt-2 space-y-1.5 border-l border-sky-400/15 pl-3">
                            {group.items.length ? (
                              group.items.map((asset) => {
                                const isMatched = searchQuery
                                  ? `${asset.hostname} ${asset.name} ${asset.ipAddress}`.toLowerCase().includes(searchQuery)
                                  : false;
                                return (
                                  <li
                                    key={asset.id}
                                    className={`rounded-md border px-2.5 py-1.5 ${
                                      isMatched
                                        ? "border-amber-300/70 bg-amber-500/16 text-amber-100"
                                        : "border-sky-400/15 bg-slate-950/55 text-slate-200"
                                    }`}
                                  >
                                    <p className="font-medium">{asset.hostname}</p>
                                    <p className="text-xs text-slate-300/90">
                                      {asset.name} | {asset.ipAddress}
                                    </p>
                                  </li>
                                );
                              })
                            ) : (
                              <li className="rounded-md border border-slate-700/70 bg-slate-950/45 px-2.5 py-1.5 text-xs text-slate-400">
                                No assets in this group.
                              </li>
                            )}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </aside>
            </div>
          </div>
        </div>

          {isDetailedTopologyOpen && detailedTree ? (
            <aside className="absolute inset-0 z-50 bg-slate-950">
              <div className="flex h-full flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-400/20 px-4 py-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">
                      Detailed Toplogy View
                    </p>
                    <h3 className="text-base font-semibold text-sky-100">
                      {detailedRootNode?.name ?? "Topology Root"}
                    </h3>
                  </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportDetailedTopologyAsPng}
                    className="rounded-md border border-emerald-300/45 bg-emerald-500/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100 hover:bg-emerald-500/25"
                  >
                    Export PNG
                  </button>
                  <button
                    type="button"
                    onClick={closeDetailedTopologyView}
                    className="rounded-md border border-red-300/45 bg-red-500/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 hover:bg-red-500/25"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b border-sky-400/15 px-4 py-3 text-xs">
                <label className="text-slate-300/85" htmlFor="detailed-topology-compliance-mode">
                  Compliance
                </label>
                <select
                  id="detailed-topology-compliance-mode"
                  value={complianceMode}
                  onChange={(event) => setComplianceMode(event.target.value as ComplianceMode)}
                  className="rounded-md border border-sky-400/35 bg-slate-900/85 px-2.5 py-1.5 text-slate-100"
                >
                  <option value="cyber">Cyber Security Compliance</option>
                  <option value="discovery">Discovery Compliance</option>
                </select>
                <label className="ml-2 text-slate-300/85" htmlFor="detailed-topology-tile-filter-search">
                  Tile Search
                </label>
                <div className="relative w-[440px] max-w-full">
                  <div className="flex items-center gap-2">
                    <input
                      ref={detailedTileSearchInputRef}
                      id="detailed-topology-tile-filter-search"
                      type="search"
                      value={detailedTileFilterSearchText}
                      onChange={(event) => setDetailedTileFilterSearchText(event.target.value)}
                      onFocus={() => setIsDetailedTileSearchFocused(true)}
                      onBlur={() => {
                        detailedTileSearchBlurTimerRef.current = window.setTimeout(() => {
                          setIsDetailedTileSearchFocused(false);
                          setDetailedTileFilterSearchText((currentText) => currentText.trim());
                          detailedTileSearchBlurTimerRef.current = null;
                        }, 120);
                      }}
                      placeholder="Search tile type or name"
                      className="min-w-0 flex-1 rounded-md border border-sky-400/35 bg-slate-900/85 px-2.5 py-1.5 text-slate-100 placeholder:text-slate-400/90"
                    />
                    {detailedSelectedTileFilterId !== "__all__" ? (
                      <button
                        type="button"
                        onClick={clearDetailedTileSearchSelection}
                        className="rounded-md border border-slate-500/45 bg-slate-900/70 px-2.5 py-1.5 font-semibold text-slate-200"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  {hasDetailedTileSearchTerm && isDetailedTileSearchFocused ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-40 max-h-56 overflow-auto rounded-md border border-sky-400/35 bg-slate-950/95 p-1 shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
                      {filteredDetailedTileDropdownOptions.length ? (
                        <ul className="space-y-1">
                          {filteredDetailedTileDropdownOptions.map((node) => (
                            <li key={`detailed-tile-search-result-${node.id}`}>
                              <button
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  if (detailedTileSearchBlurTimerRef.current !== null) {
                                    window.clearTimeout(detailedTileSearchBlurTimerRef.current);
                                    detailedTileSearchBlurTimerRef.current = null;
                                  }
                                  selectDetailedTileFilter(node.id);
                                  detailedTileSearchInputRef.current?.blur();
                                }}
                                className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${
                                  detailedSelectedTileFilterId === node.id
                                    ? "border-violet-300/75 bg-violet-500/15 text-violet-100"
                                    : "border-sky-400/20 bg-slate-900/70 text-slate-100 hover:border-sky-300/45 hover:bg-slate-800/85"
                                }`}
                              >
                                {detailedEntityTypeLabel(node.entityType)}: {node.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300">
                          No matching tiles
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
                <span className="mx-1 h-5 w-px bg-sky-400/20" />
                <button
                  type="button"
                  onClick={() => zoomDetailedBy(1.14)}
                  className="rounded-md border border-sky-400/35 bg-slate-900/60 px-2.5 py-1.5 font-semibold text-sky-100"
                >
                  Zoom In
                </button>
                <button
                  type="button"
                  onClick={() => zoomDetailedBy(0.88)}
                  className="rounded-md border border-sky-400/35 bg-slate-900/60 px-2.5 py-1.5 font-semibold text-sky-100"
                >
                  Zoom Out
                </button>
                <button
                  type="button"
                  className="rounded-md border border-sky-200/70 bg-sky-500/18 px-2.5 py-1.5 font-semibold text-sky-100"
                  aria-pressed="true"
                >
                  Panning
                </button>
                <button
                  type="button"
                  onClick={resetDetailedTopologyView}
                  className="rounded-md border border-slate-400/45 bg-slate-800/70 px-2.5 py-1.5 font-semibold text-slate-100"
                >
                  Reset View
                </button>
                <span className="rounded-md border border-slate-500/40 bg-slate-900/70 px-2 py-1 text-slate-200">
                  Zoom {detailedZoomPercent}%
                </span>

                <div className="ml-auto flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    Green compliant
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    Red non-compliant
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                    Grey other
                  </span>
                  <span className="mx-1 h-5 w-px bg-sky-400/20" />
                  <span className="text-[10px] uppercase tracking-[0.14em] text-slate-300/70">Entity Key</span>
                  {(
                    [
                      "network",
                      "mission-capability",
                      "service",
                      "ict-system",
                      "environment",
                      "ci",
                      "not-modelled"
                    ] as DetailedTileEntityType[]
                  )
                    .filter((entityType) => detailedPresentEntityTypes.has(entityType))
                    .map((entityType) => (
                      <span key={`detailed-entity-key-${entityType}`} className="inline-flex items-center gap-1">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: detailedTileColor(entityType) }}
                        />
                        {detailedEntityTypeLabel(entityType)}
                      </span>
                    ))}
                </div>
              </div>

              <div
                ref={detailedScrollContainerRef}
                onPointerDown={beginDetailedCanvasPan}
                onPointerMove={moveDetailedCanvasPan}
                onPointerUp={endDetailedCanvasPan}
                onPointerCancel={endDetailedCanvasPan}
                className="min-h-0 flex-1 overflow-auto cursor-grab select-none touch-none active:cursor-grabbing"
              >
                <div
                  className="relative min-h-full min-w-full overflow-hidden bg-slate-950/75"
                  style={{
                    width: `max(${detailedCanvasWidth}px, 100%)`,
                    height: `max(${detailedCanvasHeight}px, 100%)`
                  }}
                >
                  <svg
                    ref={detailedSvgRef}
                    width={detailedViewWidth}
                    height={detailedViewHeight}
                    viewBox={`0 0 ${detailedViewWidth} ${detailedViewHeight}`}
                    className="absolute left-0 top-0"
                    style={{ transform: `scale(${detailedZoom})`, transformOrigin: "top left" }}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={detailedViewWidth}
                      height={detailedViewHeight}
                      fill="#020617"
                    />

                    <g>
                      {detailedTree.edges.map((edge) => {
                        if (isDetailedTileFilterActive) {
                          if (
                            !detailedFilteredNodeIds.has(edge.fromNodeId) ||
                            !detailedFilteredNodeIds.has(edge.toNodeId)
                          ) {
                            return null;
                          }
                        }
                        const fromNode = detailedNodeById.get(edge.fromNodeId);
                        const toNode = detailedNodeById.get(edge.toNodeId);
                        if (!fromNode || !toNode) {
                          return null;
                        }
                        const isPathEdge = detailedSelectedPathEdgeIds.has(edge.id);
                        const isConnectedEdge = detailedSelectedConnectedEdgeIds.has(edge.id);
                        const strokeColor = isPathEdge
                          ? "#9333ea"
                          : isConnectedEdge
                            ? "#eab308"
                            : "#38bdf8";
                        const strokeWidth = isPathEdge ? 4 : isConnectedEdge ? 3.2 : 2.1;
                        const opacity = isPathEdge || isConnectedEdge ? 0.94 : 0.58;

                        return (
                          <path
                            key={`detailed-edge-${edge.id}`}
                            d={detailedEdgePath(fromNode, toNode)}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            opacity={opacity}
                            strokeLinecap="round"
                          />
                        );
                      })}
                    </g>

                    <g>
                      {detailedTree.nodes.map((node) => {
                        if (isDetailedTileFilterActive && !detailedFilteredNodeIds.has(node.id)) {
                          return null;
                        }
                        const compliance = complianceMode === "cyber" ? node.cyberCompliance : node.discoveryCompliance;
                        const percentages = compliancePercentages(compliance);
                        const isRootNode = node.id === detailedTree.rootNodeId;
                        const isCiNode = node.entityType === "ci";
                        const isSelectedNode = detailedSelectedNodeId === node.id;
                        const tileWidth = node.width;
                        const tileHeight = node.height;
                        const tileRadius = isCiNode ? 14 : 24;
                        const ciFirstLineLabel = `Type: CI | Name: ${node.name} | ${node.subtitle}`;
                        const ciFirstLineMaxChars = Math.max(
                          62,
                          Math.floor((tileWidth - 28) / DETAILED_CI_TEXT_AVG_CHAR_WIDTH)
                        );
                        const ciProgressWidth = Math.max(
                          140,
                          Math.min(
                            DETAILED_CI_PROGRESS_WIDTH,
                            tileWidth - 28 - DETAILED_CI_PROGRESS_TO_TEXT_GAP - DETAILED_CI_SCORE_TEXT_RESERVE
                          )
                        );
                        const strokeColor = isRootNode
                          ? "#ef4444"
                          : isSelectedNode
                            ? "#a855f7"
                            : detailedTileStrokeColor(node.entityType);
                        const strokeWidth = isRootNode || isSelectedNode ? 4 : 2;

                        return (
                          <g
                            key={`detailed-node-${node.id}`}
                            onClick={() => {
                              if (suppressDetailedNodeClickRef.current) {
                                suppressDetailedNodeClickRef.current = false;
                                return;
                              }
                              setDetailedSelectedNodeId(node.id);
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            <rect
                              x={node.x}
                              y={node.y}
                              width={tileWidth}
                              height={tileHeight}
                              rx={tileRadius}
                              fill={detailedTileColor(node.entityType)}
                              stroke={strokeColor}
                              strokeWidth={strokeWidth}
                            />
                            {isCiNode ? (
                              <>
                                <g
                                  data-no-pan="true"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openCiFlowFocusForNode(node);
                                  }}
                                >
                                  <circle
                                    cx={node.x + tileWidth - 13}
                                    cy={node.y + 13}
                                    r={11}
                                    fill="#020617"
                                    stroke="#0ea5e9"
                                    strokeWidth={1.5}
                                  />
                                  <text
                                    x={node.x + tileWidth - 13}
                                    y={node.y + 16.5}
                                    textAnchor="middle"
                                    fontSize={10}
                                    fontWeight={700}
                                    fill="#e0f2fe"
                                  >
                                    F
                                  </text>
                                </g>
                                <text x={node.x + 30} y={node.y + 24} fontSize={11.5} fontWeight={700} fill="#0f172a">
                                  {truncateLabel(ciFirstLineLabel, ciFirstLineMaxChars)}
                                </text>
                                <rect
                                  x={node.x + 14}
                                  y={node.y + tileHeight - 24}
                                  width={ciProgressWidth}
                                  height={DETAILED_CI_PROGRESS_HEIGHT}
                                  rx={3}
                                  fill="#cbd5e1"
                                />
                                <rect
                                  x={node.x + 14}
                                  y={node.y + tileHeight - 24}
                                  width={(ciProgressWidth * percentages.compliant) / 100}
                                  height={DETAILED_CI_PROGRESS_HEIGHT}
                                  rx={3}
                                  fill="#16a34a"
                                />
                                <rect
                                  x={node.x + 14 + (ciProgressWidth * percentages.compliant) / 100}
                                  y={node.y + tileHeight - 24}
                                  width={(ciProgressWidth * percentages.nonCompliant) / 100}
                                  height={DETAILED_CI_PROGRESS_HEIGHT}
                                  fill="#ef4444"
                                />
                                <rect
                                  x={
                                    node.x +
                                    14 +
                                    (ciProgressWidth * (percentages.compliant + percentages.nonCompliant)) / 100
                                  }
                                  y={node.y + tileHeight - 24}
                                  width={(ciProgressWidth * percentages.other) / 100}
                                  height={DETAILED_CI_PROGRESS_HEIGHT}
                                  fill="#94a3b8"
                                />
                                <text
                                  x={node.x + tileWidth - 14}
                                  y={node.y + tileHeight - 16}
                                  textAnchor="end"
                                  fontSize={10.5}
                                  fontWeight={700}
                                  fill="#0f172a"
                                >
                                  {`${percentages.compliant}% C | ${percentages.nonCompliant}% NC | ${percentages.other}% O`}
                                </text>
                              </>
                            ) : (
                              <>
                                <text x={node.x + 18} y={node.y + 30} fontSize={14} fontWeight={700} fill="#0f172a">
                                  {truncateLabel(`Type: ${detailedEntityTypeLabel(node.entityType)}`, 44)}
                                </text>
                                <text x={node.x + 18} y={node.y + 52} fontSize={14} fontWeight={700} fill="#0f172a">
                                  {truncateLabel(`Name: ${node.name}`, 44)}
                                </text>
                                <text x={node.x + 18} y={node.y + 72} fontSize={12} fill="#334155">
                                  {truncateLabel(node.subtitle, 49)}
                                </text>

                                <rect
                                  x={node.x + 18}
                                  y={node.y + 88}
                                  width={tileWidth - 36}
                                  height={12}
                                  rx={3}
                                  fill="#cbd5e1"
                                />
                                <rect
                                  x={node.x + 18}
                                  y={node.y + 88}
                                  width={((tileWidth - 36) * percentages.compliant) / 100}
                                  height={12}
                                  rx={3}
                                  fill="#16a34a"
                                />
                                <rect
                                  x={node.x + 18 + ((tileWidth - 36) * percentages.compliant) / 100}
                                  y={node.y + 88}
                                  width={((tileWidth - 36) * percentages.nonCompliant) / 100}
                                  height={12}
                                  fill="#ef4444"
                                />
                                <rect
                                  x={node.x + 18 + ((tileWidth - 36) * (percentages.compliant + percentages.nonCompliant)) / 100}
                                  y={node.y + 88}
                                  width={((tileWidth - 36) * percentages.other) / 100}
                                  height={12}
                                  fill="#94a3b8"
                                />
                                <text
                                  x={node.x + tileWidth / 2}
                                  y={node.y + 123}
                                  textAnchor="middle"
                                  fontSize={16}
                                  fontWeight={600}
                                  fill="#0f172a"
                                >
                                  {`${percentages.compliant}% C | ${percentages.nonCompliant}% NC | ${percentages.other}% O`}
                                </text>
                              </>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                </div>
              </div>
              </div>
            </aside>
          ) : null}

          {isCiFlowFocusPanelOpen && ciFlowGraph ? (
            <aside className="absolute inset-0 z-[60] bg-slate-950">
              <div className="flex h-full flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-400/20 px-4 py-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">
                      Detailed Toplogy View - CI Flow Focus
                    </p>
                    <h3 className="text-base font-semibold text-sky-100">
                      {ciFlowRootTile?.name ?? "Topology Root"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={exportDetailedTopologyAsPng}
                      className="rounded-md border border-emerald-300/45 bg-emerald-500/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100 hover:bg-emerald-500/25"
                    >
                      Export PNG
                    </button>
                    <button
                      type="button"
                      onClick={closeCiFlowFocus}
                      className="rounded-md border border-red-300/45 bg-red-500/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-100 hover:bg-red-500/25"
                    >
                      Close Focus
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-b border-sky-400/15 px-4 py-3 text-xs">
                  <label className="text-slate-300/85" htmlFor="ci-flow-topology-compliance-mode">
                    Compliance
                  </label>
                  <select
                    id="ci-flow-topology-compliance-mode"
                    value={complianceMode}
                    onChange={(event) => setComplianceMode(event.target.value as ComplianceMode)}
                    className="rounded-md border border-sky-400/35 bg-slate-900/85 px-2.5 py-1.5 text-slate-100"
                  >
                    <option value="cyber">Cyber Security Compliance</option>
                    <option value="discovery">Discovery Compliance</option>
                  </select>
                  <label className="ml-2 text-slate-300/85" htmlFor="ci-flow-topology-tile-filter-search">
                    Tile Search
                  </label>
                  <div className="relative w-[440px] max-w-full">
                    <div className="flex items-center gap-2">
                      <input
                        ref={detailedTileSearchInputRef}
                        id="ci-flow-topology-tile-filter-search"
                        type="search"
                        value={detailedTileFilterSearchText}
                        onChange={(event) => setDetailedTileFilterSearchText(event.target.value)}
                        onFocus={() => setIsDetailedTileSearchFocused(true)}
                        onBlur={() => {
                          detailedTileSearchBlurTimerRef.current = window.setTimeout(() => {
                            setIsDetailedTileSearchFocused(false);
                            setDetailedTileFilterSearchText((currentText) => currentText.trim());
                            detailedTileSearchBlurTimerRef.current = null;
                          }, 120);
                        }}
                        placeholder="Search tile type or name"
                        className="min-w-0 flex-1 rounded-md border border-sky-400/35 bg-slate-900/85 px-2.5 py-1.5 text-slate-100 placeholder:text-slate-400/90"
                      />
                      {detailedSelectedTileFilterId !== "__all__" ? (
                        <button
                          type="button"
                          onClick={clearDetailedTileSearchSelection}
                          className="rounded-md border border-slate-500/45 bg-slate-900/70 px-2.5 py-1.5 font-semibold text-slate-200"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                    {hasDetailedTileSearchTerm && isDetailedTileSearchFocused ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-40 max-h-56 overflow-auto rounded-md border border-sky-400/35 bg-slate-950/95 p-1 shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
                        {filteredDetailedTileDropdownOptions.length ? (
                          <ul className="space-y-1">
                            {filteredDetailedTileDropdownOptions.map((node) => (
                              <li key={`ci-flow-tile-search-result-${node.id}`}>
                                <button
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    if (detailedTileSearchBlurTimerRef.current !== null) {
                                      window.clearTimeout(detailedTileSearchBlurTimerRef.current);
                                      detailedTileSearchBlurTimerRef.current = null;
                                    }
                                    selectDetailedTileFilter(node.id);
                                    detailedTileSearchInputRef.current?.blur();
                                  }}
                                  className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${
                                    detailedSelectedTileFilterId === node.id
                                      ? "border-violet-300/75 bg-violet-500/15 text-violet-100"
                                      : "border-sky-400/20 bg-slate-900/70 text-slate-100 hover:border-sky-300/45 hover:bg-slate-800/85"
                                  }`}
                                >
                                  {detailedEntityTypeLabel(node.entityType)}: {node.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300">
                            No matching tiles
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <span className="mx-1 h-5 w-px bg-sky-400/20" />
                  <button
                    type="button"
                    onClick={() => zoomDetailedBy(1.14)}
                    className="rounded-md border border-sky-400/35 bg-slate-900/60 px-2.5 py-1.5 font-semibold text-sky-100"
                  >
                    Zoom In
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomDetailedBy(0.88)}
                    className="rounded-md border border-sky-400/35 bg-slate-900/60 px-2.5 py-1.5 font-semibold text-sky-100"
                  >
                    Zoom Out
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-sky-200/70 bg-sky-500/18 px-2.5 py-1.5 font-semibold text-sky-100"
                    aria-pressed="true"
                  >
                    Panning
                  </button>
                  <button
                    type="button"
                    onClick={resetDetailedTopologyView}
                    className="rounded-md border border-slate-400/45 bg-slate-800/70 px-2.5 py-1.5 font-semibold text-slate-100"
                  >
                    Reset View
                  </button>
                  <span className="rounded-md border border-slate-500/40 bg-slate-900/70 px-2 py-1 text-slate-200">
                    Zoom {detailedZoomPercent}%
                  </span>

                  <div className="ml-auto flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                      Green compliant
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      Red non-compliant
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                      Grey other
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                      Flow dependency
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-orange-500" />
                      Logical dependency
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm border border-emerald-400 bg-slate-200" />
                      In-model CI
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm border border-red-400 bg-slate-200" />
                      Out-of-model CI
                    </span>
                    <span className="mx-1 h-5 w-px bg-sky-400/20" />
                    <span className="text-[10px] uppercase tracking-[0.14em] text-slate-300/70">Entity Key</span>
                    {(
                      [
                        "network",
                        "mission-capability",
                        "service",
                        "ict-system",
                        "environment",
                        "ci",
                        "not-modelled"
                      ] as DetailedTileEntityType[]
                    )
                      .filter((entityType) => detailedPresentEntityTypes.has(entityType))
                      .map((entityType) => (
                        <span key={`ci-flow-entity-key-${entityType}`} className="inline-flex items-center gap-1">
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: detailedTileColor(entityType) }}
                          />
                          {detailedEntityTypeLabel(entityType)}
                        </span>
                      ))}
                  </div>
                </div>

                <div
                  ref={ciFlowScrollContainerRef}
                  onPointerDown={beginDetailedCanvasPan}
                  onPointerMove={moveDetailedCanvasPan}
                  onPointerUp={endDetailedCanvasPan}
                  onPointerCancel={endDetailedCanvasPan}
                  className="min-h-0 flex-1 overflow-auto cursor-grab select-none touch-none active:cursor-grabbing"
                >
                  <div
                    className="relative min-h-full min-w-full overflow-hidden bg-slate-950/75"
                    style={{
                      width: `max(${ciFlowCanvasWidth}px, 100%)`,
                      height: `max(${ciFlowCanvasHeight}px, 100%)`
                    }}
                  >
                    <svg
                      width={ciFlowViewWidth}
                      height={ciFlowViewHeight}
                      viewBox={`0 0 ${ciFlowViewWidth} ${ciFlowViewHeight}`}
                      className="absolute"
                      style={{
                        left: `${CI_FLOW_VIEWPORT_PADDING}px`,
                        top: `${CI_FLOW_VIEWPORT_PADDING}px`,
                        transform: `scale(${detailedZoom})`,
                        transformOrigin: "top left"
                      }}
                    >
                      <defs>
                        <marker
                          id="ci-flow-arrow-logical"
                          markerWidth="9"
                          markerHeight="7"
                          refX="8.2"
                          refY="3.5"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path d="M0,0 L0,7 L8.2,3.5 z" fill="#f97316" />
                        </marker>
                        <marker
                          id="ci-flow-arrow-flow"
                          markerWidth="9"
                          markerHeight="7"
                          refX="8.2"
                          refY="3.5"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path d="M0,0 L0,7 L8.2,3.5 z" fill="#22c55e" />
                        </marker>
                        <marker
                          id="ci-flow-arrow-attachment"
                          markerWidth="9"
                          markerHeight="7"
                          refX="8.2"
                          refY="3.5"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path d="M0,0 L0,7 L8.2,3.5 z" fill="#fb7185" />
                        </marker>
                      </defs>
                      <rect x={0} y={0} width={ciFlowViewWidth} height={ciFlowViewHeight} fill="#020617" />

                      <g>
                        {ciFlowGraph.edges.map((edge) => {
                          if (
                            isDetailedTileFilterActive &&
                            (!detailedFilteredNodeIds.has(edge.fromNodeId) || !detailedFilteredNodeIds.has(edge.toNodeId))
                          ) {
                            return null;
                          }
                          const fromNode = ciFlowNodeById.get(edge.fromNodeId);
                          const toNode = ciFlowNodeById.get(edge.toNodeId);
                          if (!fromNode || !toNode) {
                            return null;
                          }
                          const strokeColor = ciFlowDependencyColor(edge.dependencyType);
                          const isHighlighted = ciFlowHighlightedEdgeIds.has(edge.id);
                          const progressOpacity = Math.max(0, Math.min(1, ciFlowTweenProgress));
                          if (progressOpacity <= 0.01) {
                            return null;
                          }
                          const opacity = (isHighlighted ? 0.98 : 0.74) * progressOpacity;
                          const strokeWidth =
                            edge.dependencyType === "Unmodelled Attachment" ? 2.4 : isHighlighted ? 4.1 : 2.9;
                          const markerId =
                            edge.dependencyType === "Flow Dependency"
                              ? "ci-flow-arrow-flow"
                              : edge.dependencyType === "Logical Dependency"
                                ? "ci-flow-arrow-logical"
                                : "ci-flow-arrow-attachment";
                          return (
                            <path
                              key={`ci-flow-overlay-edge-${edge.id}`}
                              d={ciFlowEdgePath(fromNode, toNode)}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth={strokeWidth}
                              opacity={opacity}
                              strokeLinecap="round"
                              markerEnd={`url(#${markerId})`}
                            />
                          );
                        })}
                      </g>

                      <g>
                        {ciFlowGraph.nodes.map((node) => {
                          if (isDetailedTileFilterActive && !detailedFilteredNodeIds.has(node.id)) {
                            return null;
                          }
                          const compliance = complianceMode === "cyber" ? node.cyberCompliance : node.discoveryCompliance;
                          const percentages = compliancePercentages(compliance);
                          const isRootNode = node.id === ciFlowRootNodeId;
                          const isSelected = selectedCiFlowNodeId === node.id;
                          const firstLineLabel = `Type: CI | Name: ${node.name}`;
                          const flowHorizontalPadding = 20;
                          const flowProgressHeight = 14;
                          const flowScoreReserve = 235;
                          const firstLineMaxChars = Math.max(
                            70,
                            Math.floor((node.width - 2 * flowHorizontalPadding) / DETAILED_CI_TEXT_AVG_CHAR_WIDTH)
                          );
                          const ciProgressWidth = Math.max(
                            240,
                            Math.min(
                              440,
                              node.width - 2 * flowHorizontalPadding - flowScoreReserve
                            )
                          );
                          const opacity = isRootNode ? 1 : Math.max(0, Math.min(1, ciFlowTweenProgress));
                          if (!isRootNode && opacity <= 0.01) {
                            return null;
                          }
                          const centerX = node.x + node.width / 2;
                          const centerY = node.y + node.height / 2;
                          const animatedCenterX =
                            isRootNode && ciFlowOriginCenter
                              ? ciFlowOriginCenter.x + (centerX - ciFlowOriginCenter.x) * ciFlowTweenProgress
                              : centerX;
                          const animatedCenterY =
                            isRootNode && ciFlowOriginCenter
                              ? ciFlowOriginCenter.y + (centerY - ciFlowOriginCenter.y) * ciFlowTweenProgress
                              : centerY;
                          const renderX = animatedCenterX - node.width / 2;
                          const renderY = animatedCenterY - node.height / 2;

                          if (node.entityType === "not-modelled") {
                            return (
                              <g
                                key={`ci-flow-overlay-node-${node.id}`}
                                onClick={() => {
                                  if (suppressDetailedNodeClickRef.current) {
                                    suppressDetailedNodeClickRef.current = false;
                                    return;
                                  }
                                  setSelectedCiFlowNodeId(node.id);
                                }}
                                style={{ cursor: "pointer" }}
                                opacity={opacity}
                              >
                                <rect
                                  x={renderX}
                                  y={renderY}
                                  width={node.width}
                                  height={node.height}
                                  rx={16}
                                  fill="#fda4af"
                                  stroke="#ef4444"
                                  strokeWidth={isSelected ? 4 : 3}
                                />
                                <text
                                  x={renderX + node.width / 2}
                                  y={renderY + 44}
                                  textAnchor="middle"
                                  fontSize={20}
                                  fontWeight={700}
                                  fill="#7f1d1d"
                                >
                                  Not Modelled
                                </text>
                                <text
                                  x={renderX + node.width / 2}
                                  y={renderY + 72}
                                  textAnchor="middle"
                                  fontSize={14}
                                  fontWeight={600}
                                  fill="#7f1d1d"
                                >
                                  {truncateLabel(node.subtitle, 52)}
                                </text>
                              </g>
                            );
                          }

                          const borderColor = node.isInModelScope ? "#22c55e" : "#ef4444";
                          return (
                            <g
                              key={`ci-flow-overlay-node-${node.id}`}
                              onClick={() => {
                                if (suppressDetailedNodeClickRef.current) {
                                  suppressDetailedNodeClickRef.current = false;
                                  return;
                                }
                                setSelectedCiFlowNodeId(node.id);
                              }}
                              style={{ cursor: "pointer" }}
                              opacity={opacity}
                            >
                              <rect
                                x={renderX}
                                y={renderY}
                                width={node.width}
                                height={node.height}
                                rx={14}
                                fill="#e2e8f0"
                                stroke={borderColor}
                                strokeWidth={isRootNode || isSelected ? 4 : 2.6}
                              />
                              <text
                                x={renderX + flowHorizontalPadding}
                                y={renderY + 36}
                                fontSize={16}
                                fontWeight={700}
                                fill="#0f172a"
                              >
                                {truncateLabel(firstLineLabel, firstLineMaxChars)}
                              </text>
                              <text
                                x={renderX + flowHorizontalPadding}
                                y={renderY + 58}
                                fontSize={13}
                                fontWeight={600}
                                fill="#334155"
                              >
                                {truncateLabel(node.modelLabel, firstLineMaxChars)}
                              </text>
                              <rect
                                x={renderX + flowHorizontalPadding}
                                y={renderY + node.height - 38}
                                width={ciProgressWidth}
                                height={flowProgressHeight}
                                rx={3}
                                fill="#cbd5e1"
                              />
                              <rect
                                x={renderX + flowHorizontalPadding}
                                y={renderY + node.height - 38}
                                width={(ciProgressWidth * percentages.compliant) / 100}
                                height={flowProgressHeight}
                                rx={3}
                                fill="#16a34a"
                              />
                              <rect
                                x={renderX + flowHorizontalPadding + (ciProgressWidth * percentages.compliant) / 100}
                                y={renderY + node.height - 38}
                                width={(ciProgressWidth * percentages.nonCompliant) / 100}
                                height={flowProgressHeight}
                                fill="#ef4444"
                              />
                              <rect
                                x={
                                  renderX +
                                  flowHorizontalPadding +
                                  (ciProgressWidth * (percentages.compliant + percentages.nonCompliant)) / 100
                                }
                                y={renderY + node.height - 38}
                                width={(ciProgressWidth * percentages.other) / 100}
                                height={flowProgressHeight}
                                fill="#94a3b8"
                              />
                              <text
                                x={renderX + node.width - flowHorizontalPadding}
                                y={renderY + node.height - 18}
                                textAnchor="end"
                                fontSize={13}
                                fontWeight={700}
                                fill="#0f172a"
                              >
                                {`${percentages.compliant}% C | ${percentages.nonCompliant}% NC | ${percentages.other}% O`}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    </svg>
                  </div>
                </div>
              </div>
            </aside>
          ) : null}

        {selectedDetailNode ? (
            <aside
              className={`absolute right-0 top-0 z-20 h-full w-[min(560px,94vw)] overflow-auto border-l border-sky-300/35 bg-slate-950 p-5 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-300 ease-out ${
                isDetailPanelVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
              }`}
              role="dialog"
              aria-modal="false"
              aria-labelledby="topology-details-title"
            >
              <button
                type="button"
                onClick={() => setSelectedDetailNodeId(null)}
                className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
              >
                Close
              </button>

              <div className="pt-2">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">{entityTypeLabel(selectedDetailNode.entityType)} Details</p>
                <h3 id="topology-details-title" className="mt-2 pr-16 text-2xl font-semibold text-slate-100">
                  {selectedDetailNode.name}
                </h3>
              </div>

              <dl className="mt-5 space-y-4">
                {detailDrillthroughHref ? (
                  <div className="panel-alt p-3">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Drill-Through</dt>
                    <dd className="mt-1 text-sm text-sky-100">
                      <a
                        href={detailDrillthroughHref}
                        target="_blank"
                        rel="noreferrer"
                        className="underline decoration-sky-300/60 underline-offset-2"
                      >
                        Open Drill-Through In New Window
                      </a>
                    </dd>
                  </div>
                ) : null}

                <div className="panel-alt p-3">
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Description</dt>
                  <dd className="mt-1 text-sm text-slate-100">{selectedDetailNode.details.description}</dd>
                </div>

                {selectedDetailNode.details.classification ? (
                  <div className="panel-alt p-3">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Classification</dt>
                    <dd className="mt-1 text-sm text-slate-100">{selectedDetailNode.details.classification}</dd>
                  </div>
                ) : null}

                {selectedDetailNode.details.criticality ? (
                  <div className="panel-alt p-3">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Criticality</dt>
                    <dd className="mt-1 text-sm text-slate-100">{selectedDetailNode.details.criticality}</dd>
                  </div>
                ) : null}

                {selectedDetailNode.details.securityDomain ? (
                  <div className="panel-alt p-3">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Security Domain</dt>
                    <dd className="mt-1 text-sm text-slate-100">{selectedDetailNode.details.securityDomain}</dd>
                  </div>
                ) : null}

                {selectedDetailNode.details.discoveryStatus ? (
                  <div className="panel-alt p-3">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Discovery Status</dt>
                    <dd className="mt-1 text-sm text-slate-100">{selectedDetailNode.details.discoveryStatus}</dd>
                  </div>
                ) : null}

                {selectedDetailNode.details.owner ? (
                  <div className="panel-alt p-3">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Owner</dt>
                    <dd className="mt-1 text-sm text-slate-100">{selectedDetailNode.details.owner}</dd>
                  </div>
                ) : null}

                {selectedDetailNode.details.supportEmail ? (
                  <div className="panel-alt p-3">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Support Mailbox</dt>
                    <dd className="mt-1 text-sm text-sky-100">
                      <a
                        className="underline decoration-sky-300/60 underline-offset-2"
                        href={`mailto:${selectedDetailNode.details.supportEmail}`}
                      >
                        {selectedDetailNode.details.supportEmail}
                      </a>
                    </dd>
                  </div>
                ) : null}

                {selectedDetailNode.details.serviceCatalogueUrl ? (
                  <div className="panel-alt p-3">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Service Catalogue Item</dt>
                    <dd className="mt-1 text-sm text-sky-100">
                      <a
                        href={selectedDetailNode.details.serviceCatalogueUrl}
                        className="underline decoration-sky-300/60 underline-offset-2"
                        target={isExternalLink(selectedDetailNode.details.serviceCatalogueUrl) ? "_blank" : undefined}
                        rel={isExternalLink(selectedDetailNode.details.serviceCatalogueUrl) ? "noreferrer" : undefined}
                      >
                        Open Service Catalogue Item
                      </a>
                    </dd>
                  </div>
                ) : null}

                {renderDetailList("Mission Capabilities", selectedDetailNode.details.missionCapabilities)}
                {renderDetailList("Business Services", selectedDetailNode.details.businessServices)}
                {renderDetailList("Dependent ICT Systems", selectedDetailNode.details.dependentSystems)}
                {renderDetailList("Connected Services", selectedDetailNode.details.connectedServices)}
                {renderDetailList(
                  "Connected Mission Capabilities",
                  selectedDetailNode.details.connectedMissionCapabilities
                )}

                {selectedDetailNode.details.atoNumber || selectedDetailNode.details.diisUrl || selectedDetailNode.details.grcUrl ? (
                  <div className="security-accreditation-pulse rounded-xl border border-yellow-300/90 bg-sky-400/16 p-3 shadow-[0_0_14px_rgba(253,224,71,0.32)]">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-sky-100/95">Security Accreditation</dt>
                    <dd className="mt-2">
                      <table className="min-w-full text-sm">
                        <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-sky-100/85">
                          <tr>
                            <th className="px-2 py-1.5">Authority to Operate (ATO)</th>
                            <th className="px-2 py-1.5">Links</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-sky-300/35 text-slate-100">
                            <td className="px-2 py-2 font-semibold text-sky-50">{selectedDetailNode.details.atoNumber ?? "-"}</td>
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap gap-3 text-sky-100">
                                {selectedDetailNode.details.diisUrl ? (
                                  <a
                                    href={selectedDetailNode.details.diisUrl}
                                    className="underline decoration-sky-300/70 underline-offset-2"
                                    target={isExternalLink(selectedDetailNode.details.diisUrl) ? "_blank" : undefined}
                                    rel={isExternalLink(selectedDetailNode.details.diisUrl) ? "noreferrer" : undefined}
                                  >
                                    View in DIIS
                                  </a>
                                ) : null}
                                {selectedDetailNode.details.grcUrl ? (
                                  <a
                                    href={selectedDetailNode.details.grcUrl}
                                    className="underline decoration-sky-300/70 underline-offset-2"
                                    target={isExternalLink(selectedDetailNode.details.grcUrl) ? "_blank" : undefined}
                                    rel={isExternalLink(selectedDetailNode.details.grcUrl) ? "noreferrer" : undefined}
                                  >
                                    View in Cyber GRC Portal
                                  </a>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </dd>
                  </div>
                ) : null}

                {selectedDetailNode.details.apmNumber || selectedDetailNode.details.apmUrl ? (
                  <div className="security-accreditation-pulse rounded-xl border border-lime-300/90 bg-sky-400/16 p-3 shadow-[0_0_14px_rgba(190,242,100,0.34)]">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-sky-100/95">Application Portfolio Management</dt>
                    <dd className="mt-2">
                      <table className="min-w-full text-sm">
                        <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-sky-100/85">
                          <tr>
                            <th className="px-2 py-1.5">APM Number</th>
                            <th className="px-2 py-1.5">Links</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-sky-300/35 text-slate-100">
                            <td className="px-2 py-2 font-semibold text-sky-50">{selectedDetailNode.details.apmNumber ?? "-"}</td>
                            <td className="px-2 py-2">
                              {selectedDetailNode.details.apmUrl ? (
                                <a
                                  href={selectedDetailNode.details.apmUrl}
                                  className="underline decoration-sky-300/70 underline-offset-2 text-sky-100"
                                  target={isExternalLink(selectedDetailNode.details.apmUrl) ? "_blank" : undefined}
                                  rel={isExternalLink(selectedDetailNode.details.apmUrl) ? "noreferrer" : undefined}
                                >
                                  View in APM
                                </a>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </dd>
                  </div>
                ) : null}

                {selectedDetailNode.details.diisId ? (
                  <div className="security-accreditation-pulse rounded-xl border border-fuchsia-300/90 bg-sky-400/16 p-3 shadow-[0_0_14px_rgba(232,121,249,0.34)]">
                    <dt className="text-[11px] uppercase tracking-[0.14em] text-sky-100/95">Defence ICT Inventory System</dt>
                    <dd className="mt-2">
                      <table className="min-w-full text-sm">
                        <thead className="text-left text-[11px] uppercase tracking-[0.12em] text-sky-100/85">
                          <tr>
                            <th className="px-2 py-1.5">DIIS ID</th>
                            <th className="px-2 py-1.5">Links</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-sky-300/35 text-slate-100">
                            <td className="px-2 py-2 font-semibold text-sky-50">{selectedDetailNode.details.diisId}</td>
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap gap-3 text-sky-100">
                                {selectedDetailNode.details.diisUrl ? (
                                  <a
                                    href={selectedDetailNode.details.diisUrl}
                                    className="underline decoration-sky-300/70 underline-offset-2"
                                    target={isExternalLink(selectedDetailNode.details.diisUrl) ? "_blank" : undefined}
                                    rel={isExternalLink(selectedDetailNode.details.diisUrl) ? "noreferrer" : undefined}
                                  >
                                    View in DIIS
                                  </a>
                                ) : null}
                                {selectedDetailNode.details.grcUrl ? (
                                  <a
                                    href={selectedDetailNode.details.grcUrl}
                                    className="underline decoration-sky-300/70 underline-offset-2"
                                    target={isExternalLink(selectedDetailNode.details.grcUrl) ? "_blank" : undefined}
                                    rel={isExternalLink(selectedDetailNode.details.grcUrl) ? "noreferrer" : undefined}
                                  >
                                    View in Cyber GRC Portal
                                  </a>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </aside>
        ) : null}
      </section>
    </div>
  );
}

