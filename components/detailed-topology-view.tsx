"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  IctSystemImpactAnalyser2Chart,
  type ImpactAnalyser2Row,
  type ImpactAnalyser2SelectedNode
} from "@/components/ict-system-impact-analyser-2";
import { ASSET_TYPES, assetTypeLabel } from "@/lib/asset-taxonomy";
import {
  buildCiAnalyserRowsFromScope,
  buildCiFlowAssetScope,
  type CiFlowRelationshipType
} from "@/lib/ci-flow-analyser";
import { isRealNetworkId } from "@/lib/network-scope";
import type { NetworkTopologyData, TopologyEntityType, TopologyNodeDetails } from "@/lib/network-topology";
import type { SpiDefinition } from "@/lib/spi-definitions";
import type { AssetType } from "@/lib/types";

type ComplianceMode = "cyber" | "discovery";
type TopologyLayoutMode = "hierarchical" | "partitioned" | "radial";
type CiAssetType = AssetType;
type CiEnvironmentLabel = "Production" | "Development" | "UAT" | "Test" | "Unassigned";
const DEFAULT_CAMERA_DISTANCE = 260;
const CI_ASSET_TYPES: CiAssetType[] = [...ASSET_TYPES];
const CI_FLOW_RELATIONSHIP_TYPES: CiFlowRelationshipType[] = ["Flow Dependency", "Logical Dependency"];
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
const CI_FLOW_VIEWPORT_PADDING = 320;
const CI_FLOW_3D_DEFAULT_YAW = 0.58;
const CI_FLOW_3D_DEFAULT_PITCH = -0.26;
const CI_FLOW_3D_DEFAULT_ZOOM = 1;
const CI_FLOW_3D_DEFAULT_PAN_X = 0;
const CI_FLOW_3D_DEFAULT_PAN_Y = 0;
const CI_FLOW_3D_CAMERA_DISTANCE = 6800;
const CI_FLOW_3D_FOCAL_LENGTH = 3600;
const DETAILED_MIN_CAMERA_DISTANCE = 120;
const DETAILED_MAX_CAMERA_DISTANCE = 28000;
const DETAILED_EDGE_CURVE_MIN = 44;
const DETAILED_EDGE_CURVE_FACTOR = 0.36;
const DETAILED_MODEL_OVERLAY_NODE_PREFIX = "detailed-model-overlay:";
const NETWORK_MODEL_OVERLAY_NODE_PREFIX = "network-model-overlay:";

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

type TopologyModelRelationKind = "related-model-flow" | "related-model-logical";
type TopologyRenderEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relationKind?: TopologyModelRelationKind;
};

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
  assetType?: CiAssetType;
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
  z: number;
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

type DetailedDisplayNode = DetailedTreeNode | CiFlowNodeLayout;
type DetailedDisplayEdge = DetailedTreeEdge | CiFlowEdgeLayout;

interface DetailedCanvasViewState {
  zoom: number;
  offsetX: number;
  offsetY: number;
  initialized: boolean;
  graphKey: string;
}

interface DetailedCanvasInteractionState {
  pointerId: number;
  mode: "pan" | "drag-node" | "flow-orbit" | "flow-pan";
  nodeId?: string;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  startNodeOffsetX: number;
  startNodeOffsetY: number;
  startYaw?: number;
  startPitch?: number;
  startFlowPanX?: number;
  startFlowPanY?: number;
  moved: boolean;
}

interface TopologyCanvasViewState {
  zoom: number;
  offsetX: number;
  offsetY: number;
  initialized: boolean;
  graphKey: string;
}

interface TopologyCanvasPanState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
  moved: boolean;
}

interface CiFlow3DViewState {
  yaw: number;
  pitch: number;
  panX: number;
  panY: number;
  zoom: number;
}

type CiFlowModelTileType = "ict-system-model" | "network-model";

interface DetailedModelOverlayTile {
  id: string;
  modelId: string;
  modelType: CiFlowModelTileType;
  entityType: DetailedTileEntityType;
  typeLabel: string;
  name: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sharedCount: number;
  relatedCount: number;
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

interface DetailedModelOverlayLink {
  ciNodeId: string;
  tileId: string;
  kind: "shared-resource" | "related-model";
}

function isDetailedModelOverlayNodeId(nodeId: string): boolean {
  return nodeId.startsWith(DETAILED_MODEL_OVERLAY_NODE_PREFIX);
}

function isNetworkModelOverlayNodeId(nodeId: string): boolean {
  return nodeId.startsWith(NETWORK_MODEL_OVERLAY_NODE_PREFIX);
}

function createDefaultCiFlow3DViewState(): CiFlow3DViewState {
  return {
    yaw: CI_FLOW_3D_DEFAULT_YAW,
    pitch: CI_FLOW_3D_DEFAULT_PITCH,
    panX: CI_FLOW_3D_DEFAULT_PAN_X,
    panY: CI_FLOW_3D_DEFAULT_PAN_Y,
    zoom: CI_FLOW_3D_DEFAULT_ZOOM
  };
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

function ciFlowNodeStrokeColor(entityType: DetailedTileEntityType, isInModelScope?: boolean): string {
  if (entityType === "not-modelled") {
    return "#ef4444";
  }
  return isInModelScope ? "#22c55e" : "#ef4444";
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const boundedRadius = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
  context.beginPath();
  context.moveTo(x + boundedRadius, y);
  context.lineTo(x + width - boundedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + boundedRadius);
  context.lineTo(x + width, y + height - boundedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - boundedRadius, y + height);
  context.lineTo(x + boundedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - boundedRadius);
  context.lineTo(x, y + boundedRadius);
  context.quadraticCurveTo(x, y, x + boundedRadius, y);
  context.closePath();
}

function pointInRect(x: number, y: number, width: number, height: number, pointX: number, pointY: number) {
  return pointX >= x && pointX <= x + width && pointY >= y && pointY <= y + height;
}

function pointInCircle(centerX: number, centerY: number, radius: number, pointX: number, pointY: number) {
  const deltaX = pointX - centerX;
  const deltaY = pointY - centerY;
  return deltaX * deltaX + deltaY * deltaY <= radius * radius;
}

function detailedEdgeCurvePoints(
  fromNode: Pick<DetailedTreeNode, "x" | "y" | "width" | "height">,
  toNode: Pick<DetailedTreeNode, "x" | "y" | "width" | "height">
) {
  const startX = fromNode.x + fromNode.width;
  const startY = fromNode.y + fromNode.height / 2;
  const endX = toNode.x;
  const endY = toNode.y + toNode.height / 2;
  const horizontalDelta = Math.max(45, (endX - startX) * 0.5);
  return {
    startX,
    startY,
    control1X: startX + horizontalDelta,
    control1Y: startY,
    control2X: endX - horizontalDelta,
    control2Y: endY,
    endX,
    endY
  };
}

function ciFlowEdgeCurvePoints(
  fromNode: Pick<CiFlowNodeLayout, "x" | "y" | "width" | "height">,
  toNode: Pick<CiFlowNodeLayout, "x" | "y" | "width" | "height">
) {
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
  return {
    startX,
    startY,
    control1X,
    control1Y,
    control2X,
    control2Y,
    endX,
    endY
  };
}

function applyForceDirectedCiFlowLayout(
  nodes: CiFlowNodeLayout[],
  edges: CiFlowEdgeLayout[],
  centerX: number,
  centerY: number,
  pinnedNodeId: string
) {
  void edges;
  if (!nodes.length) {
    return;
  }
  const rootNode = nodes.find((node) => node.id === pinnedNodeId) ?? nodes[0];
  if (!rootNode) {
    return;
  }

  rootNode.x = centerX - rootNode.width / 2;
  rootNode.y = centerY - rootNode.height / 2;
  rootNode.z = 0;

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const computeShellRadius = (nodeCount: number, minimumRadius: number, targetSpacing: number) => {
    if (nodeCount <= 0) {
      return 0;
    }
    const densityRadius = Math.sqrt((nodeCount * targetSpacing * targetSpacing) / (4 * Math.PI));
    return Math.max(minimumRadius, densityRadius);
  };
  const placeNodesOnShell = (shellNodes: CiFlowNodeLayout[], radius: number, seedOffset: number) => {
    if (!shellNodes.length || radius <= 0) {
      return;
    }
    for (let index = 0; index < shellNodes.length; index += 1) {
      const node = shellNodes[index];
      const ratio = (index + 0.5) / shellNodes.length;
      const yUnit = 1 - ratio * 2;
      const radialUnit = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
      const theta = goldenAngle * (index + 1 + seedOffset);
      const xUnit = Math.cos(theta) * radialUnit;
      const zUnit = Math.sin(theta) * radialUnit;
      node.x = centerX + xUnit * radius - node.width / 2;
      node.y = centerY + yUnit * radius - node.height / 2;
      node.z = zUnit * radius;
    }
  };

  const shellNodes = nodes.filter((node) => node.id !== rootNode.id);
  const modelledNodes = shellNodes.filter((node) => node.entityType === "ci" && node.isInModelScope);
  const nonModelledNodes = shellNodes.filter((node) => !(node.entityType === "ci" && node.isInModelScope));

  const innerShellRadius = computeShellRadius(
    modelledNodes.length,
    Math.max(CI_FLOW_BASE_RADIUS * 1.55, 620),
    260
  );
  const outerShellMinimumRadius = Math.max(innerShellRadius + 280, CI_FLOW_BASE_RADIUS * 2.45);
  const outerShellRadius = computeShellRadius(nonModelledNodes.length, outerShellMinimumRadius, 280);

  placeNodesOnShell(modelledNodes, innerShellRadius, 0);
  placeNodesOnShell(nonModelledNodes, outerShellRadius, 97);
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

function ciSearchKey(nodeId: string, assetType: CiAssetType): string {
  return `${nodeId}:${assetType}`;
}

function ciEnvironmentSearchKey(nodeId: string, environment: CiEnvironmentLabel): string {
  return `${nodeId}:environment:${environment}`;
}

function ciAssetTypeSingularLabel(assetType: CiAssetType): string {
  return assetTypeLabel(assetType);
}

function ciFlowNodeIdForAsset(assetId: string): string {
  return `ci-flow:ci:${assetId}`;
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

function csvCell(value: string | number | boolean | null | undefined): string {
  const normalized = value === null || typeof value === "undefined" ? "" : String(value);
  const escaped = normalized.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeCsvFilenameSegment(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "ci-flow";
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

export function DetailedTopologyView({
  isOpen,
  onClose,
  data,
  spiDefinitions = []
}: {
  isOpen: boolean;
  onClose: () => void;
  data: NetworkTopologyData;
  spiDefinitions?: SpiDefinition[];
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
  const [isDetailedTopologyOpen, setIsDetailedTopologyOpen] = useState(true);
  const [detailedRootNodeId, setDetailedRootNodeId] = useState<string | null>(null);
  const [detailedSelectedNodeId, setDetailedSelectedNodeId] = useState<string | null>(null);
  const [detailedSelectedTileFilterId, setDetailedSelectedTileFilterId] = useState("__all__");
  const [detailedTileFilterSearchText, setDetailedTileFilterSearchText] = useState("");
  const [isDetailedTileSearchFocused, setIsDetailedTileSearchFocused] = useState(false);
  const [detailedZoom, setDetailedZoom] = useState(1);
  const [focusedCiFlowRootAssetId, setFocusedCiFlowRootAssetId] = useState<string | null>(null);
  const [selectedCiFlowNodeId, setSelectedCiFlowNodeId] = useState<string | null>(null);
  const [ciFlowIncludedDependencyTypes, setCiFlowIncludedDependencyTypes] = useState<Set<CiFlowRelationshipType>>(
    () => new Set<CiFlowRelationshipType>(CI_FLOW_RELATIONSHIP_TYPES)
  );
  const [networkShowRelatedModels, setNetworkShowRelatedModels] = useState(true);
  const [networkShowLogicalRelatedModels, setNetworkShowLogicalRelatedModels] = useState(true);
  const [detailedShowSharedResources, setDetailedShowSharedResources] = useState(false);
  const [detailedShowRelatedModels, setDetailedShowRelatedModels] = useState(false);
  const [draggingCiFlowNodeId, setDraggingCiFlowNodeId] = useState<string | null>(null);
  const [ciFlowNodeDragOffsets, setCiFlowNodeDragOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [ciFlowTweenProgress, setCiFlowTweenProgress] = useState(0);
  const [ciFlowViewportCenter, setCiFlowViewportCenter] = useState<{ x: number; y: number } | null>(null);
  const [ciFlowOriginCenter, setCiFlowOriginCenter] = useState<{ x: number; y: number } | null>(null);
  const [draggingDetailedNodeId, setDraggingDetailedNodeId] = useState<string | null>(null);
  const [detailedTileCopyFeedback, setDetailedTileCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");
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
  const topologyRootScope = data.rootScope ?? { type: "network" as const, id: data.networkId, name: data.networkName };
  const isSystemImpactAnalyser = topologyRootScope.type === "ict-system";
  const impactAnalyserRootId = encodeURIComponent(topologyRootScope.id);
  const impactAnalyserDataPath = isSystemImpactAnalyser
    ? `/api/systems/${impactAnalyserRootId}/impact-analyser`
    : `/api/networks/${impactAnalyserRootId}/impact-analyser`;
  const impactAnalyserFindingsPath = isSystemImpactAnalyser
    ? `/api/systems/${impactAnalyserRootId}/impact-analyser/findings`
    : `/api/networks/${impactAnalyserRootId}/impact-analyser/findings`;
  const impactAnalyserTitle = isSystemImpactAnalyser ? "ICT System Impact Analyser" : "Network Impact Analyser";
  const impactAnalyserHeadingTooltip = isSystemImpactAnalyser
    ? "ICT system-scoped analyser for modelled assets across ICT system, environment, assets, severity, and SPI."
    : "Network-scoped analyser for modelled assets across network, ICT system, environment, assets, severity, and SPI.";
  const detailedViewportRef = useRef<HTMLDivElement | null>(null);
  const detailedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detailedCanvasFrameRef = useRef<number | null>(null);
  const detailedCanvasViewStateRef = useRef<DetailedCanvasViewState>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    initialized: false,
    graphKey: ""
  });
  const detailedCanvasNodeOffsetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const detailedCanvasInteractionRef = useRef<DetailedCanvasInteractionState | null>(null);
  const detailedCanvasRenderRequestedRef = useRef(false);
  const detailedCanvasRequestDrawRef = useRef<(() => void) | null>(null);
  const topologyCanvasViewStateRef = useRef<TopologyCanvasViewState>({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    initialized: false,
    graphKey: ""
  });
  const topologyCanvasPanStateRef = useRef<TopologyCanvasPanState | null>(null);
  const topologyCanvasNeedsFitRef = useRef(true);
  const ciFlow3DViewStateRef = useRef<CiFlow3DViewState>(createDefaultCiFlow3DViewState());
  const detailedFilterClusterProgressRef = useRef(0);
  const detailedFilterClusterLastTimestampRef = useRef<number | null>(null);
  const detailedFilterAutoFocusKeyRef = useRef("");
  const detailedFilterWasActiveRef = useRef(false);
  const detailedFilterRestorePendingRef = useRef(false);
  const detailedTileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tileRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const runtimeNodesRef = useRef<Map<string, RuntimeNodeState>>(new Map());
  const nodePositionsDirtyRef = useRef(false);
  const detailedRuntimeNodesRef = useRef<Map<string, RuntimeNodeState>>(new Map());
  const detailedNodePositionsDirtyRef = useRef(false);
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
  const ciFlowNodeDragOffsetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const ciFlowTweenProgressRef = useRef(0);
  const ciFlowOuterShellSpinAngleRef = useRef(0);
  const ciFlowInnerShellSpinAngleRef = useRef(0);
  const ciFlowOuterShellSpinLastTimestampRef = useRef<number | null>(null);
  const ciFlowPinnedRootScreenPositionRef = useRef<{ x: number; y: number } | null>(null);
  const ciFlowNodeDragStateRef = useRef<{
    nodeId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    moved: boolean;
  } | null>(null);
  const persistedCameraStateRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const persistedNodePositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const manualNodePositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const detailedCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const detailedControlsRef = useRef<OrbitControls | null>(null);
  const detailedPersistedCameraStateRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const detailedPersistedNodePositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const detailedManualNodePositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const detailedDragStateRef = useRef<{
    nodeId: string;
    pointerId: number;
    lastClientX: number;
    lastClientY: number;
  } | null>(null);
  const initialCameraPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 120, 2050));
  const initialTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const detailedInitialCameraPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 2400));
  const detailedInitialTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

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
      const systemAssets = CI_ASSET_TYPES.flatMap((assetType) => topology.assetsByType[assetType] ?? []);
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
  const networkNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (data.networkId && data.networkName) {
      map.set(data.networkId, data.networkName);
    }
    for (const node of data.nodes) {
      if (node.entityType === "network") {
        map.set(node.entityId, node.name);
      }
    }
    return map;
  }, [data.networkId, data.networkName, data.nodes]);
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
  const networkModelRelationAnchorNode = useMemo(() => {
    return coreNode;
  }, [coreNode]);
  const networkTopologyModelOverlay = useMemo(() => {
    const anchorNode = networkModelRelationAnchorNode;
    if (!anchorNode) {
      return { nodes: [] as LayoutNode[], edges: [] as TopologyRenderEdge[] };
    }

    if (!networkShowRelatedModels && !networkShowLogicalRelatedModels) {
      return { nodes: [] as LayoutNode[], edges: [] as TopologyRenderEdge[] };
    }

    const anchorCiItems = ciItemsByNodeId.get(anchorNode.id) ?? allScopedCiItems;
    const inScopeAssetIds = new Set(anchorCiItems.map((item) => item.id));
    if (!inScopeAssetIds.size) {
      return { nodes: [] as LayoutNode[], edges: [] as TopologyRenderEdge[] };
    }
    const excludedSystemId = anchorNode.entityType === "ict-system" ? anchorNode.entityId : null;
    const excludedNetworkId = anchorNode.entityType === "network" ? anchorNode.entityId : null;

    type RelationAccumulator = {
      modelId: string;
      entityType: Extract<TopologyEntityType, "ict-system" | "network">;
      name: string;
      sourceAssetIds: Set<string>;
      relationKinds: Set<TopologyModelRelationKind>;
      cyberSummaries: Array<{ compliant: number; nonCompliant: number; other: number }>;
      discoverySummaries: Array<{ compliant: number; nonCompliant: number; other: number }>;
    };
    const relationByModelKey = new Map<string, RelationAccumulator>();

    const addRelation = (
      sourceCi: NonNullable<ReturnType<typeof flowCiNodeByAssetId.get>>,
      relatedCi: NonNullable<ReturnType<typeof flowCiNodeByAssetId.get>>,
      relationKind: TopologyModelRelationKind
    ) => {
      const pushModel = (
        modelEntityType: Extract<TopologyEntityType, "ict-system" | "network">,
        modelId: string,
        modelName: string
      ) => {
        const modelKey = `${modelEntityType}:${modelId}`;
        const current =
          relationByModelKey.get(modelKey) ??
          ({
            modelId,
            entityType: modelEntityType,
            name: modelName,
            sourceAssetIds: new Set<string>(),
            relationKinds: new Set<TopologyModelRelationKind>(),
            cyberSummaries: [],
            discoverySummaries: []
          } as RelationAccumulator);
        if (!relationByModelKey.has(modelKey)) {
          relationByModelKey.set(modelKey, current);
        }
        current.relationKinds.add(relationKind);
        if (!current.sourceAssetIds.has(sourceCi.id)) {
          current.sourceAssetIds.add(sourceCi.id);
          const sourceItem = scopedCiItemByAssetId.get(sourceCi.id);
          if (sourceItem) {
            current.cyberSummaries.push(sourceItem.cyberCompliance);
            current.discoverySummaries.push(sourceItem.discoveryCompliance);
          }
        }
      };

      if (
        relatedCi.systemId &&
        relatedCi.systemId !== sourceCi.systemId &&
        (!excludedSystemId || relatedCi.systemId !== excludedSystemId)
      ) {
        pushModel("ict-system", relatedCi.systemId, relatedCi.systemName ?? relatedCi.systemId);
      }
      if (
        isRealNetworkId(relatedCi.networkId) &&
        relatedCi.networkId !== sourceCi.networkId &&
        (!excludedNetworkId || relatedCi.networkId !== excludedNetworkId)
      ) {
        pushModel("network", relatedCi.networkId, networkNameById.get(relatedCi.networkId) ?? relatedCi.networkId);
      }
    };

    for (const dependency of data.ciDependencies) {
      if (dependency.sourceAssetId === dependency.targetAssetId) {
        continue;
      }
      const relationKind: TopologyModelRelationKind | null =
        dependency.dependencyType === "Flow Dependency"
          ? "related-model-flow"
          : dependency.dependencyType === "Logical Dependency"
            ? "related-model-logical"
            : null;
      if (!relationKind) {
        continue;
      }
      if (relationKind === "related-model-flow" && !networkShowRelatedModels) {
        continue;
      }
      if (relationKind === "related-model-logical" && !networkShowLogicalRelatedModels) {
        continue;
      }
      const sourceCi = flowCiNodeByAssetId.get(dependency.sourceAssetId);
      const targetCi = flowCiNodeByAssetId.get(dependency.targetAssetId);
      if (!sourceCi || !targetCi) {
        continue;
      }
      if (inScopeAssetIds.has(sourceCi.id)) {
        addRelation(sourceCi, targetCi, relationKind);
      }
      if (inScopeAssetIds.has(targetCi.id)) {
        addRelation(targetCi, sourceCi, relationKind);
      }
    }

    const orderedRelations = Array.from(relationByModelKey.values()).sort((left, right) => {
      const leftHasFlow = left.relationKinds.has("related-model-flow");
      const rightHasFlow = right.relationKinds.has("related-model-flow");
      if (leftHasFlow !== rightHasFlow) {
        return leftHasFlow ? -1 : 1;
      }
      if (left.entityType !== right.entityType) {
        return left.entityType.localeCompare(right.entityType);
      }
      return left.name.localeCompare(right.name);
    });
    if (!orderedRelations.length) {
      return { nodes: [] as LayoutNode[], edges: [] as TopologyRenderEdge[] };
    }

    const overlayColumnX = 640;
    const overlayGapY = 212;
    const columnStartY = -((orderedRelations.length - 1) * overlayGapY) / 2;

    const nodes: LayoutNode[] = [];
    const edges: TopologyRenderEdge[] = [];
    for (let index = 0; index < orderedRelations.length; index += 1) {
      const relation = orderedRelations[index];
      const tileId = `${NETWORK_MODEL_OVERLAY_NODE_PREFIX}${relation.entityType}:${relation.modelId}`;
      const hasFlowRelation = relation.relationKinds.has("related-model-flow");
      const hasLogicalRelation = relation.relationKinds.has("related-model-logical");
      const relationLabel = hasFlowRelation && hasLogicalRelation
        ? "Related Model + Logical Related Model"
        : hasFlowRelation
          ? "Related Model"
          : "Logical Related Model";
      const tileX = overlayColumnX;
      const tileY = columnStartY + index * overlayGapY;

      nodes.push({
        id: tileId,
        entityId: relation.modelId,
        entityType: relation.entityType,
        name: relation.name,
        cyberCompliance: combineComplianceSummaries(relation.cyberSummaries),
        discoveryCompliance: combineComplianceSummaries(relation.discoverySummaries),
        details: {
          description: `${relationLabel} linked to ${anchorNode.name} from CI dependency relationships.`
        },
        position: new THREE.Vector3(tileX, tileY, 0)
      });

      if (hasFlowRelation) {
        edges.push({
          id: `${anchorNode.id}->${tileId}:related-model-flow`,
          fromNodeId: anchorNode.id,
          toNodeId: tileId,
          relationKind: "related-model-flow"
        });
      }
      if (hasLogicalRelation) {
        edges.push({
          id: `${anchorNode.id}->${tileId}:related-model-logical`,
          fromNodeId: anchorNode.id,
          toNodeId: tileId,
          relationKind: "related-model-logical"
        });
      }
    }

    return { nodes, edges };
  }, [
    allScopedCiItems,
    ciItemsByNodeId,
    data.ciDependencies,
    flowCiNodeByAssetId,
    networkModelRelationAnchorNode,
    networkNameById,
    networkShowLogicalRelatedModels,
    networkShowRelatedModels,
    scopedCiItemByAssetId
  ]);
  const networkViewportRootNode = useMemo(() => {
    if (!networkModelRelationAnchorNode) {
      return null;
    }
    return {
      ...networkModelRelationAnchorNode,
      position: new THREE.Vector3(0, 0, 0)
    } satisfies LayoutNode;
  }, [networkModelRelationAnchorNode]);
  const topologyRenderNodes = useMemo(() => {
    if (!networkViewportRootNode) {
      return [];
    }
    return [networkViewportRootNode, ...networkTopologyModelOverlay.nodes];
  }, [networkTopologyModelOverlay.nodes, networkViewportRootNode]);
  const topologyRenderEdges = useMemo<TopologyRenderEdge[]>(() => {
    return [...networkTopologyModelOverlay.edges];
  }, [networkTopologyModelOverlay.edges]);
  const topologyRenderNodeById = useMemo(() => {
    return new Map(topologyRenderNodes.map((node) => [node.id, node]));
  }, [topologyRenderNodes]);
  const ciAssetsByNodeId = useMemo(() => {
    const groupedByNodeId = new Map<
      string,
      Array<{
        assetType: CiAssetType;
        items: ScopedCiItem[];
      }>
    >();

    for (const node of topologyRenderNodes) {
      const nodeItems =
        ciItemsByNodeId.get(node.id) ??
        (node.entityType === "network"
          ? (ciItemsByNetworkId.get(node.entityId) ?? [])
          : node.entityType === "ict-system"
            ? (ciItemsBySystemId.get(node.entityId) ?? [])
            : []);
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
  }, [ciItemsByNetworkId, ciItemsByNodeId, ciItemsBySystemId, topologyRenderNodes]);
  const ciEnvironmentGroupsByNodeId = useMemo(() => {
    const byNodeId = new Map<
      string,
      Array<{
        environment: CiEnvironmentLabel;
        items: ScopedCiItem[];
      }>
    >();

    for (const node of topologyRenderNodes) {
      const byEnvironment = new Map<CiEnvironmentLabel, ScopedCiItem[]>();
      const nodeItems =
        ciItemsByNodeId.get(node.id) ??
        (node.entityType === "network"
          ? (ciItemsByNetworkId.get(node.entityId) ?? [])
          : node.entityType === "ict-system"
            ? (ciItemsBySystemId.get(node.entityId) ?? [])
            : []);
      for (const item of nodeItems) {
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
  }, [ciItemsByNetworkId, ciItemsByNodeId, ciItemsBySystemId, complianceMode, topologyRenderNodes]);
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
  const detailedModelOverlay = useMemo<{
    tiles: DetailedModelOverlayTile[];
    links: DetailedModelOverlayLink[];
    width: number;
    height: number;
  }>(() => {
    const baseWidth = detailedTree?.width ?? 1;
    const baseHeight = detailedTree?.height ?? 1;
    if (
      !detailedTree ||
      !detailedRootNode ||
      Boolean(focusedCiFlowRootAssetId) ||
      (!detailedShowSharedResources && !detailedShowRelatedModels)
    ) {
      return { tiles: [], links: [], width: baseWidth, height: baseHeight };
    }

    const detailedCiNodes = detailedTree.nodes.filter(
      (node): node is DetailedTreeNode & { entityType: "ci"; ciAssetId: string } =>
        node.entityType === "ci" && Boolean(node.ciAssetId)
    );
    if (!detailedCiNodes.length) {
      return { tiles: [], links: [], width: baseWidth, height: baseHeight };
    }

    const excludedSystemId = detailedRootNode.entityType === "ict-system" ? detailedRootNode.entityId : null;
    const excludedNetworkId = detailedRootNode.entityType === "network" ? detailedRootNode.entityId : null;
    const ciNodeById = new Map(detailedTree.nodes.map((node) => [node.id, node]));
    const flowNeighboursByAssetId = new Map<string, Set<string>>();
    if (detailedShowRelatedModels) {
      for (const dependency of data.ciDependencies) {
        if (dependency.dependencyType !== "Flow Dependency") {
          continue;
        }
        const left = flowNeighboursByAssetId.get(dependency.sourceAssetId) ?? new Set<string>();
        left.add(dependency.targetAssetId);
        flowNeighboursByAssetId.set(dependency.sourceAssetId, left);
        const right = flowNeighboursByAssetId.get(dependency.targetAssetId) ?? new Set<string>();
        right.add(dependency.sourceAssetId);
        flowNeighboursByAssetId.set(dependency.targetAssetId, right);
      }
    }

    type ModelAccumulator = {
      modelId: string;
      modelType: CiFlowModelTileType;
      typeLabel: string;
      name: string;
      sharedCiNodeIds: Set<string>;
      relatedCiNodeIds: Set<string>;
      summaryCiNodeIds: Set<string>;
      cyberSummaries: Array<{ compliant: number; nonCompliant: number; other: number }>;
      discoverySummaries: Array<{ compliant: number; nonCompliant: number; other: number }>;
    };
    const modelAccumulatorByKey = new Map<string, ModelAccumulator>();
    const links: DetailedModelOverlayLink[] = [];
    const linkKeySet = new Set<string>();
    const modelLinkKindsByKey = new Map<string, Set<DetailedModelOverlayLink["kind"]>>();

    const addModelLink = (
      sourceCiNodeId: string,
      modelType: CiFlowModelTileType,
      modelId: string,
      modelName: string,
      kind: DetailedModelOverlayLink["kind"]
    ) => {
      if (!modelId) {
        return;
      }
      if (modelType === "ict-system-model" && excludedSystemId && modelId === excludedSystemId) {
        return;
      }
      if (modelType === "network-model" && excludedNetworkId && modelId === excludedNetworkId) {
        return;
      }
      const modelKey = `${modelType}:${modelId}`;
      const currentKinds = modelLinkKindsByKey.get(modelKey) ?? new Set<DetailedModelOverlayLink["kind"]>();
      currentKinds.add(kind);
      modelLinkKindsByKey.set(modelKey, currentKinds);
      const existing = modelAccumulatorByKey.get(modelKey);
      const accumulator =
        existing ??
        ({
          modelId,
          modelType,
          typeLabel: modelType === "ict-system-model" ? "ICT System Model" : "Network Model",
          name: modelName,
          sharedCiNodeIds: new Set<string>(),
          relatedCiNodeIds: new Set<string>(),
          summaryCiNodeIds: new Set<string>(),
          cyberSummaries: [],
          discoverySummaries: []
        } as ModelAccumulator);
      if (!existing) {
        modelAccumulatorByKey.set(modelKey, accumulator);
      }
      if (!accumulator.summaryCiNodeIds.has(sourceCiNodeId)) {
        const sourceCiNode = ciNodeById.get(sourceCiNodeId);
        if (sourceCiNode) {
          accumulator.summaryCiNodeIds.add(sourceCiNodeId);
          accumulator.cyberSummaries.push(sourceCiNode.cyberCompliance);
          accumulator.discoverySummaries.push(sourceCiNode.discoveryCompliance);
        }
      }
      if (kind === "shared-resource") {
        accumulator.sharedCiNodeIds.add(sourceCiNodeId);
      } else {
        accumulator.relatedCiNodeIds.add(sourceCiNodeId);
      }
      const linkKey = `${sourceCiNodeId}:${modelKey}:${kind}`;
      if (linkKeySet.has(linkKey)) {
        return;
      }
      linkKeySet.add(linkKey);
      links.push({
        ciNodeId: sourceCiNodeId,
        tileId: `${DETAILED_MODEL_OVERLAY_NODE_PREFIX}${modelKey}`,
        kind
      });
    };

    for (const ciNode of detailedCiNodes) {
      const sourceCi = flowCiNodeByAssetId.get(ciNode.ciAssetId);
      if (!sourceCi) {
        continue;
      }
      if (detailedShowSharedResources) {
        if (sourceCi.systemId) {
          addModelLink(
            ciNode.id,
            "ict-system-model",
            sourceCi.systemId,
            sourceCi.systemName ?? sourceCi.systemId,
            "shared-resource"
          );
        }
        if (isRealNetworkId(sourceCi.networkId)) {
          addModelLink(
            ciNode.id,
            "network-model",
            sourceCi.networkId,
            networkNameById.get(sourceCi.networkId) ?? sourceCi.networkId,
            "shared-resource"
          );
        }
      }
      if (!detailedShowRelatedModels) {
        continue;
      }
      for (const relatedAssetId of flowNeighboursByAssetId.get(ciNode.ciAssetId) ?? []) {
        const relatedCi = flowCiNodeByAssetId.get(relatedAssetId);
        if (!relatedCi) {
          continue;
        }
        if (relatedCi.systemId && relatedCi.systemId !== sourceCi.systemId) {
          addModelLink(
            ciNode.id,
            "ict-system-model",
            relatedCi.systemId,
            relatedCi.systemName ?? relatedCi.systemId,
            "related-model"
          );
        }
        if (isRealNetworkId(relatedCi.networkId) && relatedCi.networkId !== sourceCi.networkId) {
          addModelLink(
            ciNode.id,
            "network-model",
            relatedCi.networkId,
            networkNameById.get(relatedCi.networkId) ?? relatedCi.networkId,
            "related-model"
          );
        }
      }
    }

    const orderedModels = Array.from(modelAccumulatorByKey.values()).sort((left, right) => {
      if (left.modelType !== right.modelType) {
        return left.modelType.localeCompare(right.modelType);
      }
      return left.name.localeCompare(right.name);
    });
    if (!orderedModels.length) {
      return { tiles: [], links: [], width: baseWidth, height: baseHeight };
    }

    const maxCiX = Math.max(...detailedCiNodes.map((node) => node.x + node.width));
    const minCiY = Math.min(...detailedCiNodes.map((node) => node.y));
    const tileWidth = DETAILED_TILE_WIDTH;
    const tileHeight = DETAILED_TILE_HEIGHT;
    const tileGap = 14;
    const tileColumnX = maxCiX + 270;
    let tileCursorY = minCiY;
    const tiles: DetailedModelOverlayTile[] = [];
    for (const model of orderedModels) {
      const tileId = `${DETAILED_MODEL_OVERLAY_NODE_PREFIX}${model.modelType}:${model.modelId}`;
      const linkedKinds = modelLinkKindsByKey.get(`${model.modelType}:${model.modelId}`) ?? new Set<
        DetailedModelOverlayLink["kind"]
      >();
      const relationshipLabel =
        linkedKinds.size === 2
          ? "Shared Resources + Related Models"
          : linkedKinds.has("related-model")
            ? "Related Models"
            : "Shared Resources";
      const modelKindLabel = model.modelType === "ict-system-model" ? "ICT System" : "Network";
      tiles.push({
        id: tileId,
        modelId: model.modelId,
        modelType: model.modelType,
        entityType: model.modelType === "ict-system-model" ? "ict-system" : "network",
        typeLabel: relationshipLabel,
        name: model.name,
        subtitle: modelKindLabel,
        x: tileColumnX,
        y: tileCursorY,
        width: tileWidth,
        height: tileHeight,
        sharedCount: model.sharedCiNodeIds.size,
        relatedCount: model.relatedCiNodeIds.size,
        cyberCompliance: combineComplianceSummaries(model.cyberSummaries),
        discoveryCompliance: combineComplianceSummaries(model.discoverySummaries)
      });
      tileCursorY += tileHeight + tileGap;
    }

    const overlayHeight = Math.max(baseHeight, tileCursorY + DETAILED_CANVAS_PADDING_Y);
    const overlayWidth = Math.max(baseWidth, tileColumnX + tileWidth + DETAILED_CANVAS_PADDING_X);
    return {
      tiles,
      links: links.filter(
        (link) =>
          ciNodeById.has(link.ciNodeId) && tiles.some((tile) => tile.id === link.tileId)
      ),
      width: overlayWidth,
      height: overlayHeight
    };
  }, [
    data.ciDependencies,
    detailedRootNode,
    detailedShowRelatedModels,
    detailedShowSharedResources,
    detailedTree,
    flowCiNodeByAssetId,
    focusedCiFlowRootAssetId,
    networkNameById
  ]);
  const ciFlowAssetScope = useMemo(() => {
    if (!focusedCiFlowRootAssetId) {
      return null;
    }
    return buildCiFlowAssetScope({
      rootAssetId: focusedCiFlowRootAssetId,
      ciNodes: data.ciNodes,
      ciDependencies: data.ciDependencies,
      includedAssetTypes: CI_ASSET_TYPES,
      includedDependencyTypes: ciFlowIncludedDependencyTypes,
      maxRelatedNodes: CI_FLOW_MAX_RELATED_NODES
    });
  }, [
    ciFlowIncludedDependencyTypes,
    data.ciDependencies,
    data.ciNodes,
    focusedCiFlowRootAssetId
  ]);
  const ciFlowGraph = useMemo<CiFlowGraphData | null>(() => {
    if (!focusedCiFlowRootAssetId || !ciFlowAssetScope) {
      return null;
    }
    const rootFlowNode = flowCiNodeByAssetId.get(focusedCiFlowRootAssetId);
    if (!rootFlowNode) {
      return null;
    }

    const visibleAssetIds = new Set(ciFlowAssetScope.visibleAssetIds);
    const includedDependencies = ciFlowAssetScope.visibleDependencies;
    const depthByAssetId = ciFlowAssetScope.depthByAssetId;

    const rootScopedCi = scopedCiItemByAssetId.get(focusedCiFlowRootAssetId);
    const rootFirstLine = `Type: CI | Name: ${rootFlowNode.hostname}`;
    const rootWidth = estimateCiFlowTileWidth(rootFirstLine);
    const defaultCenterX =
      DETAILED_CANVAS_PADDING_X +
      rootWidth / 2 +
      Math.max(CI_FLOW_BASE_RADIUS * 0.72, 240);
    const defaultCenterY =
      DETAILED_CANVAS_PADDING_Y +
      CI_FLOW_NODE_HEIGHT / 2 +
      Math.max(CI_FLOW_BASE_RADIUS * 0.55, 180);
    const initialCenterX = ciFlowViewportCenter?.x ?? defaultCenterX;
    const initialCenterY = ciFlowViewportCenter?.y ?? defaultCenterY;

    const ciNodes: CiFlowNodeLayout[] = [];
    const groupedByDepth = new Map<number, string[]>();
    for (const assetId of visibleAssetIds) {
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
      assetType: rootFlowNode.type,
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
      y: initialCenterY - CI_FLOW_NODE_HEIGHT / 2,
      z: 0
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
        const isModelled = modelAssetIdSet.has(assetId) || flowNode.systemModelled;
        const modelLabel = isModelled
          ? modelAssetIdSet.has(assetId)
            ? "Model Scope: In Scope"
            : flowNode.systemName
              ? `Modelled: ${flowNode.systemName}`
              : "Modelled"
          : "Not Modelled";
        const firstLine = `Type: CI | Name: ${flowNode.hostname}`;
        const nodeWidth = estimateCiFlowTileWidth(firstLine);
        const angle = groupedAssetIds.length === 1 ? -Math.PI / 2 : (index / groupedAssetIds.length) * Math.PI * 2 - Math.PI / 2;
        const centerX = initialCenterX + Math.cos(angle) * radius;
        const centerY = initialCenterY + Math.sin(angle) * radius;
        ciNodes.push({
          id: ciFlowNodeIdForAsset(assetId),
          assetId,
          assetType: flowNode.type,
          entityType: "ci",
          name: flowNode.hostname,
          subtitle: `${ciAssetTypeSingularLabel(flowNode.type)} | ${normalizeCiEnvironmentLabel(flowNode.environmentType)}`,
          typeLabel: "Configuration Item",
          modelLabel,
          cyberCompliance: scopedCi?.cyberCompliance ?? emptyComplianceSummary(),
          discoveryCompliance: scopedCi?.discoveryCompliance ?? emptyComplianceSummary(),
          isInModelScope: isModelled,
          width: nodeWidth,
          height: CI_FLOW_NODE_HEIGHT,
          x: centerX - nodeWidth / 2,
          y: centerY - CI_FLOW_NODE_HEIGHT / 2,
          z: 0
        });
      }
    }

    const ciFlowEdges: CiFlowEdgeLayout[] = includedDependencies.map((dependency) => ({
      id: `ci-flow-edge:${dependency.id}:${dependency.sourceAssetId}->${dependency.targetAssetId}`,
      fromNodeId: ciFlowNodeIdForAsset(dependency.sourceAssetId),
      toNodeId: ciFlowNodeIdForAsset(dependency.targetAssetId),
      dependencyType: dependency.dependencyType
    }));

    const ciFlowRootLayoutNodeId = ciFlowNodeIdForAsset(focusedCiFlowRootAssetId);
    applyForceDirectedCiFlowLayout(
      ciNodes,
      ciFlowEdges,
      initialCenterX,
      initialCenterY,
      ciFlowRootLayoutNodeId
    );

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
    ciFlowAssetScope,
    ciFlowViewportCenter?.x,
    ciFlowViewportCenter?.y,
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
  const ciAnalyserRows = useMemo<ImpactAnalyser2Row[]>(() => {
    if (!focusedCiFlowRootAssetId || !ciFlowAssetScope) {
      return [];
    }
    return buildCiAnalyserRowsFromScope({
      rootAssetId: focusedCiFlowRootAssetId,
      ciNodes: data.ciNodes,
      scope: ciFlowAssetScope,
      networkNameById
    });
  }, [ciFlowAssetScope, data.ciNodes, focusedCiFlowRootAssetId, networkNameById]);
  const ciFlowRenderedNodes = useMemo(() => {
    if (!ciFlowGraph) {
      return [];
    }
    return ciFlowGraph.nodes.map((node) => {
      const isRootNode = node.id === ciFlowRootNodeId;
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
      const baseX = animatedCenterX - node.width / 2;
      const baseY = animatedCenterY - node.height / 2;
      const dragOffset = isRootNode ? undefined : ciFlowNodeDragOffsets[node.id];
      const renderX = baseX + (dragOffset?.x ?? 0);
      const renderY = baseY + (dragOffset?.y ?? 0);
      const renderZ = node.z;
      const renderOpacity = isRootNode ? 1 : Math.max(0, Math.min(1, ciFlowTweenProgress));
      return {
        ...node,
        renderX,
        renderY,
        renderZ,
        renderOpacity
      };
    });
  }, [ciFlowGraph, ciFlowNodeDragOffsets, ciFlowOriginCenter, ciFlowRootNodeId, ciFlowTweenProgress]);
  const ciFlowRenderedNodeById = useMemo(() => {
    return new Map(ciFlowRenderedNodes.map((node) => [node.id, node]));
  }, [ciFlowRenderedNodes]);
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
  const detailedCiSelectionFocus = useMemo<{
    linkedNodeIds: Set<string>;
    linkedTreeEdgeIds: Set<string>;
    linkedOverlayTileIds: Set<string>;
    linkedOverlayLinkKeys: Set<string>;
  } | null>(() => {
    if (!detailedTree || !detailedSelectedNodeId || isCiFlowFocusPanelOpen) {
      return null;
    }
    const isOverlaySelection = isDetailedModelOverlayNodeId(detailedSelectedNodeId);
    const selectedTreeNode = detailedNodeById.get(detailedSelectedNodeId);
    if (!selectedTreeNode && !isOverlaySelection) {
      return null;
    }

    const childEdgesByNodeId = new Map<string, DetailedTreeEdge[]>();
    for (const edge of detailedTree.edges) {
      const currentChildren = childEdgesByNodeId.get(edge.fromNodeId) ?? [];
      currentChildren.push(edge);
      childEdgesByNodeId.set(edge.fromNodeId, currentChildren);
    }
    const previousByNodeId = new Map<string, { nodeId: string; edgeId: string }>();
    const visitedFromRoot = new Set<string>([detailedTree.rootNodeId]);
    const traversalQueue = [detailedTree.rootNodeId];
    while (traversalQueue.length) {
      const currentNodeId = traversalQueue.shift();
      if (!currentNodeId) {
        continue;
      }
      for (const edge of childEdgesByNodeId.get(currentNodeId) ?? []) {
        if (visitedFromRoot.has(edge.toNodeId)) {
          continue;
        }
        visitedFromRoot.add(edge.toNodeId);
        previousByNodeId.set(edge.toNodeId, { nodeId: currentNodeId, edgeId: edge.id });
        traversalQueue.push(edge.toNodeId);
      }
    }

    const linkedTreeEdgeIds = new Set<string>();
    const linkedNodeIds = new Set<string>([detailedSelectedNodeId]);
    const linkedOverlayTileIds = new Set<string>();
    const linkedOverlayLinkKeys = new Set<string>();

    const includePathFromRoot = (targetNodeId: string) => {
      linkedNodeIds.add(targetNodeId);
      if (targetNodeId === detailedTree.rootNodeId) {
        linkedNodeIds.add(detailedTree.rootNodeId);
        return;
      }
      let cursorNodeId = targetNodeId;
      const guardNodeIds = new Set<string>();
      while (cursorNodeId !== detailedTree.rootNodeId) {
        if (guardNodeIds.has(cursorNodeId)) {
          break;
        }
        guardNodeIds.add(cursorNodeId);
        const previous = previousByNodeId.get(cursorNodeId);
        if (!previous) {
          break;
        }
        linkedTreeEdgeIds.add(previous.edgeId);
        linkedNodeIds.add(previous.nodeId);
        linkedNodeIds.add(cursorNodeId);
        cursorNodeId = previous.nodeId;
      }
    };

    if (isOverlaySelection) {
      linkedOverlayTileIds.add(detailedSelectedNodeId);
      for (const link of detailedModelOverlay.links) {
        if (link.tileId !== detailedSelectedNodeId) {
          continue;
        }
        linkedOverlayLinkKeys.add(`${link.ciNodeId}|${link.tileId}|${link.kind}`);
        linkedNodeIds.add(link.ciNodeId);
        includePathFromRoot(link.ciNodeId);
      }
    } else if (selectedTreeNode) {
      includePathFromRoot(detailedSelectedNodeId);
      const descendantNodeIdsQueue = [detailedSelectedNodeId];
      const visitedDescendantNodeIds = new Set<string>([detailedSelectedNodeId]);
      while (descendantNodeIdsQueue.length) {
        const currentNodeId = descendantNodeIdsQueue.shift();
        if (!currentNodeId) {
          continue;
        }
        for (const edge of childEdgesByNodeId.get(currentNodeId) ?? []) {
          linkedTreeEdgeIds.add(edge.id);
          linkedNodeIds.add(edge.fromNodeId);
          linkedNodeIds.add(edge.toNodeId);
          if (visitedDescendantNodeIds.has(edge.toNodeId)) {
            continue;
          }
          visitedDescendantNodeIds.add(edge.toNodeId);
          descendantNodeIdsQueue.push(edge.toNodeId);
        }
      }
      for (const link of detailedModelOverlay.links) {
        if (!linkedNodeIds.has(link.ciNodeId)) {
          continue;
        }
        linkedOverlayTileIds.add(link.tileId);
        linkedNodeIds.add(link.tileId);
        linkedOverlayLinkKeys.add(`${link.ciNodeId}|${link.tileId}|${link.kind}`);
      }
    }

    return {
      linkedNodeIds,
      linkedTreeEdgeIds,
      linkedOverlayTileIds,
      linkedOverlayLinkKeys
    };
  }, [
    detailedModelOverlay.links,
    detailedNodeById,
    detailedSelectedNodeId,
    detailedTree,
    isCiFlowFocusPanelOpen
  ]);
  const ciFlowActiveSelectionNodeId = selectedCiFlowNodeId ?? ciFlowRootNodeId ?? null;
  const ciFlowRootDirectEdgeIds = useMemo(() => {
    if (!ciFlowGraph || !ciFlowRootNodeId) {
      return new Set<string>();
    }
    return new Set(
      ciFlowGraph.edges
        .filter(
          (edge) =>
            (edge.fromNodeId === ciFlowRootNodeId || edge.toNodeId === ciFlowRootNodeId)
        )
        .map((edge) => edge.id)
    );
  }, [ciFlowGraph, ciFlowRootNodeId]);
  const ciFlowRootScopeNodeIds = useMemo(() => {
    if (!ciFlowGraph || !ciFlowRootNodeId) {
      return new Set<string>();
    }
    const nodeIds = new Set<string>([ciFlowRootNodeId]);
    for (const edge of ciFlowGraph.edges) {
      if (!ciFlowRootDirectEdgeIds.has(edge.id)) {
        continue;
      }
      nodeIds.add(edge.fromNodeId);
      nodeIds.add(edge.toNodeId);
    }
    return nodeIds;
  }, [ciFlowGraph, ciFlowRootDirectEdgeIds, ciFlowRootNodeId]);
  const ciFlowSelectedDirectEdgeIds = useMemo(() => {
    if (!ciFlowGraph || !ciFlowActiveSelectionNodeId) {
      return new Set<string>();
    }
    if (!ciFlowGraph.nodes.some((node) => node.id === ciFlowActiveSelectionNodeId)) {
      return new Set<string>();
    }
    const rootScopeNodeIds = ciFlowRootScopeNodeIds.size
      ? ciFlowRootScopeNodeIds
      : new Set(ciFlowGraph.nodes.map((node) => node.id));
    return new Set(
      ciFlowGraph.edges
        .filter(
          (edge) =>
            (edge.fromNodeId === ciFlowActiveSelectionNodeId || edge.toNodeId === ciFlowActiveSelectionNodeId) &&
            rootScopeNodeIds.has(edge.fromNodeId) &&
            rootScopeNodeIds.has(edge.toNodeId)
        )
        .map((edge) => edge.id)
    );
  }, [ciFlowActiveSelectionNodeId, ciFlowGraph, ciFlowRootScopeNodeIds]);
  const ciFlowHighlightedEdgeIds = useMemo(() => {
    return new Set<string>(ciFlowSelectedDirectEdgeIds);
  }, [ciFlowSelectedDirectEdgeIds]);
  const ciFlowRelationshipNodeIds = useMemo(() => {
    if (!ciFlowGraph) {
      return new Set<string>();
    }
    const rootScopeNodeIds = ciFlowRootScopeNodeIds.size
      ? ciFlowRootScopeNodeIds
      : new Set(ciFlowGraph.nodes.map((node) => node.id));
    if (!ciFlowActiveSelectionNodeId || ciFlowActiveSelectionNodeId === ciFlowRootNodeId) {
      return rootScopeNodeIds;
    }
    const selectedNode = ciFlowNodeById.get(ciFlowActiveSelectionNodeId);
    if (!selectedNode || selectedNode.entityType !== "ci") {
      return rootScopeNodeIds;
    }
    const visibleNodeIds = new Set<string>();
    if (ciFlowRootNodeId && rootScopeNodeIds.has(ciFlowRootNodeId)) {
      visibleNodeIds.add(ciFlowRootNodeId);
    }
    if (rootScopeNodeIds.has(ciFlowActiveSelectionNodeId)) {
      visibleNodeIds.add(ciFlowActiveSelectionNodeId);
    }
    return visibleNodeIds;
  }, [
    ciFlowActiveSelectionNodeId,
    ciFlowGraph,
    ciFlowNodeById,
    ciFlowRootNodeId,
    ciFlowRootScopeNodeIds
  ]);
  const detailedTileDropdownOptions = useMemo<
    Array<{ id: string; entityType: DetailedTileEntityType; name: string; subtitle: string; level: number }>
  >(() => {
    if (isCiFlowFocusPanelOpen && ciFlowGraph) {
      return [...ciFlowGraph.nodes]
        .filter((node) => (ciFlowRootScopeNodeIds.size ? ciFlowRootScopeNodeIds.has(node.id) : true))
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
  }, [ciFlowGraph, ciFlowRootNodeId, ciFlowRootScopeNodeIds, detailedTree, isCiFlowFocusPanelOpen]);
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
  const detailedSearchScopedNodeIds = useMemo<Set<string> | null>(() => {
    if (isCiFlowFocusPanelOpen || !detailedTree) {
      return null;
    }
    const normalizedSearch = detailedTileFilterSearchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return null;
    }

    const nodeById = new Map(detailedTree.nodes.map((node) => [node.id, node]));
    const childNodeIdsByNodeId = new Map<string, string[]>();
    const parentNodeIdByNodeId = new Map<string, string>();
    for (const edge of detailedTree.edges) {
      const childNodeIds = childNodeIdsByNodeId.get(edge.fromNodeId) ?? [];
      childNodeIds.push(edge.toNodeId);
      childNodeIdsByNodeId.set(edge.fromNodeId, childNodeIds);
      parentNodeIdByNodeId.set(edge.toNodeId, edge.fromNodeId);
    }

    const matchedNodeIds = new Set<string>();
    for (const node of detailedTree.nodes) {
      const type = detailedEntityTypeLabel(node.entityType).toLowerCase();
      const searchableText = `${type} ${node.name} ${node.subtitle}`.toLowerCase();
      if (!searchableText.includes(normalizedSearch)) {
        continue;
      }
      matchedNodeIds.add(node.id);
    }

    if (!matchedNodeIds.size) {
      return new Set<string>([detailedTree.rootNodeId]);
    }

    const visibleNodeIds = new Set<string>();
    const includeUpstreamNodes = (startNodeId: string) => {
      let cursorNodeId: string | undefined = startNodeId;
      const guardNodeIds = new Set<string>();
      while (cursorNodeId && !guardNodeIds.has(cursorNodeId)) {
        guardNodeIds.add(cursorNodeId);
        visibleNodeIds.add(cursorNodeId);
        cursorNodeId = parentNodeIdByNodeId.get(cursorNodeId);
      }
    };
    const includeDownstreamNodes = (startNodeId: string) => {
      const queue = [startNodeId];
      const visitedNodeIds = new Set<string>([startNodeId]);
      while (queue.length) {
        const currentNodeId = queue.shift();
        if (!currentNodeId) {
          continue;
        }
        visibleNodeIds.add(currentNodeId);
        for (const childNodeId of childNodeIdsByNodeId.get(currentNodeId) ?? []) {
          if (visitedNodeIds.has(childNodeId)) {
            continue;
          }
          visitedNodeIds.add(childNodeId);
          queue.push(childNodeId);
        }
      }
    };
    for (const matchedNodeId of matchedNodeIds) {
      includeUpstreamNodes(matchedNodeId);
      includeDownstreamNodes(matchedNodeId);
    }
    return visibleNodeIds;
  }, [detailedTileFilterSearchText, detailedTree, isCiFlowFocusPanelOpen]);
  const detailedFilteredNodeIds = useMemo(() => {
    if (isCiFlowFocusPanelOpen && ciFlowGraph) {
      const baseNodeIds = ciFlowRelationshipNodeIds.size
        ? ciFlowRelationshipNodeIds
        : ciFlowRootScopeNodeIds.size
          ? ciFlowRootScopeNodeIds
          : new Set<string>(ciFlowGraph.nodes.map((node) => node.id));
      return baseNodeIds;
    }
    if (!detailedTree) {
      return new Set<string>();
    }
    if (detailedSelectedTileFilterId === "__all__") {
      if (detailedSearchScopedNodeIds) {
        return detailedSearchScopedNodeIds;
      }
      return new Set(detailedTree.nodes.map((node) => node.id));
    }
    if (detailedSearchScopedNodeIds) {
      return detailedSearchScopedNodeIds;
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
    ciFlowRelationshipNodeIds,
    ciFlowRootScopeNodeIds,
    detailedSearchScopedNodeIds,
    detailedHighlightedEdgeIds,
    detailedSelectedNodeId,
    detailedSelectedTileFilterId,
    detailedTree,
    isCiFlowFocusPanelOpen
  ]);
  const isDetailedTileFilterActive =
    detailedSelectedTileFilterId !== "__all__" ||
    (!isCiFlowFocusPanelOpen && detailedTileFilterSearchText.trim().length > 0);
  const hasDetailedTileSearchTerm = detailedTileFilterSearchText.trim().length > 0;
  const detailedPresentEntityTypes = useMemo(() => {
    if (isCiFlowFocusPanelOpen && ciFlowGraph) {
      return new Set(ciFlowGraph.nodes.map((node) => node.entityType));
    }
    return new Set((detailedTree?.nodes ?? []).map((node) => node.entityType));
  }, [ciFlowGraph, detailedTree?.nodes, isCiFlowFocusPanelOpen]);
  const detailedDisplayNodes = useMemo<DetailedDisplayNode[]>(() => {
    if (isCiFlowFocusPanelOpen && ciFlowGraph) {
      return ciFlowGraph.nodes;
    }
    return detailedTree?.nodes ?? [];
  }, [ciFlowGraph, detailedTree?.nodes, isCiFlowFocusPanelOpen]);
  const detailedDisplayEdges = useMemo<DetailedDisplayEdge[]>(() => {
    if (isCiFlowFocusPanelOpen && ciFlowGraph) {
      return ciFlowGraph.edges;
    }
    return detailedTree?.edges ?? [];
  }, [ciFlowGraph, detailedTree?.edges, isCiFlowFocusPanelOpen]);
  const detailedDisplayWidth = isCiFlowFocusPanelOpen ? (ciFlowGraph?.width ?? 1) : (detailedTree?.width ?? 1);
  const detailedDisplayHeight = isCiFlowFocusPanelOpen ? (ciFlowGraph?.height ?? 1) : (detailedTree?.height ?? 1);
  const detailedDisplayRootNodeId = isCiFlowFocusPanelOpen ? ciFlowRootNodeId : (detailedTree?.rootNodeId ?? null);
  const detailedDisplaySelectedNodeId = isCiFlowFocusPanelOpen ? selectedCiFlowNodeId : detailedSelectedNodeId;
  const detailedDisplayNodeById = useMemo(() => {
    return new Map(detailedDisplayNodes.map((node) => [node.id, node]));
  }, [detailedDisplayNodes]);
  const selectedPathEdgeIds = useMemo(() => {
    if (!coreNode?.id || !selectedNodeId || selectedNodeId === coreNode.id) {
      return new Set<string>();
    }
    const visibleNodeIds = new Set(topologyRenderNodes.map((node) => node.id));
    if (!visibleNodeIds.has(coreNode.id) || !visibleNodeIds.has(selectedNodeId)) {
      return new Set<string>();
    }
    const adjacency = new Map<string, Array<{ toNodeId: string; edgeId: string }>>();
    for (const edge of topologyRenderEdges) {
      const fromCurrent = adjacency.get(edge.fromNodeId) ?? [];
      fromCurrent.push({ toNodeId: edge.toNodeId, edgeId: edge.id });
      adjacency.set(edge.fromNodeId, fromCurrent);
      const toCurrent = adjacency.get(edge.toNodeId) ?? [];
      toCurrent.push({ toNodeId: edge.fromNodeId, edgeId: edge.id });
      adjacency.set(edge.toNodeId, toCurrent);
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
  }, [coreNode?.id, selectedNodeId, topologyRenderEdges, topologyRenderNodes]);
  const selectedConnectedEdgeIds = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }
    return new Set(
      topologyRenderEdges
        .filter((edge) => edge.fromNodeId === selectedNodeId || edge.toNodeId === selectedNodeId)
        .map((edge) => edge.id)
    );
  }, [selectedNodeId, topologyRenderEdges]);
  const highlightedEdgeIds = useMemo(() => {
    return new Set<string>([...selectedPathEdgeIds, ...selectedConnectedEdgeIds]);
  }, [selectedConnectedEdgeIds, selectedPathEdgeIds]);
  const tileDropdownOptions = useMemo(() => {
    return [...topologyRenderNodes].sort((left, right) => {
      const typeDelta = baseLevelForEntity(left.entityType) - baseLevelForEntity(right.entityType);
      if (typeDelta !== 0) {
        return typeDelta;
      }
      return left.name.localeCompare(right.name);
    });
  }, [topologyRenderNodes]);
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
      return new Set(topologyRenderNodes.map((node) => node.id));
    }
    const visibleNodeIds = new Set<string>();
    for (const edge of topologyRenderEdges) {
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
  }, [coreNode?.id, highlightedEdgeIds, selectedNodeId, selectedTileFilterId, topologyRenderEdges, topologyRenderNodes]);
  const visibleTopologyTileNodeIds = useMemo(() => {
    if (selectedTileFilterId === "__all__") {
      return new Set(topologyRenderNodes.map((node) => node.id));
    }
    return new Set(filteredTileNodeIds);
  }, [filteredTileNodeIds, selectedTileFilterId, topologyRenderNodes]);
  const isTileFilterActive = selectedTileFilterId !== "__all__";
  const hasTileSearchTerm = tileFilterSearchText.trim().length > 0;
  const presentEntityTypes = useMemo(
    () => new Set(topologyRenderNodes.map((node) => node.entityType)),
    [topologyRenderNodes]
  );

  useEffect(() => {
    ciFlowNodeDragOffsetsRef.current = ciFlowNodeDragOffsets;
  }, [ciFlowNodeDragOffsets]);

  useEffect(() => {
    if (!ciFlowRootNodeId) {
      return;
    }
    setCiFlowNodeDragOffsets((current) => {
      if (!(ciFlowRootNodeId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[ciFlowRootNodeId];
      return next;
    });
  }, [ciFlowRootNodeId]);

  useEffect(() => {
    if (!isCiFlowFocusPanelOpen) {
      ciFlowPinnedRootScreenPositionRef.current = null;
      return;
    }
    ciFlowPinnedRootScreenPositionRef.current = null;
  }, [ciFlowRootNodeId, isCiFlowFocusPanelOpen]);

  useEffect(() => {
    ciFlowTweenProgressRef.current = ciFlowTweenProgress;
  }, [ciFlowTweenProgress]);

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
    const viewState = topologyCanvasViewStateRef.current;
    viewState.initialized = false;
    topologyCanvasNeedsFitRef.current = true;
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
    if (!isDetailedTopologyOpen || !detailedDisplayNodes.length) {
      return;
    }
    if (isCiFlowFocusPanelOpen) {
      setDetailedZoom(ciFlow3DViewStateRef.current.zoom);
      return;
    }
    const longestSpan = Math.max(detailedDisplayWidth, detailedDisplayHeight, 920);
    const defaultDistance = Math.max(1300, Math.min(DETAILED_MAX_CAMERA_DISTANCE * 0.84, longestSpan * 1.36));
    const elevatedY = Math.max(80, longestSpan * 0.04);
    detailedInitialTargetRef.current.set(0, 0, 0);
    detailedInitialCameraPositionRef.current.set(0, elevatedY, defaultDistance);
    detailedPersistedCameraStateRef.current = null;
    detailedPersistedNodePositionsRef.current = new Map();
    detailedManualNodePositionsRef.current = new Map();
    setDetailedZoom(1);
  }, [
    detailedDisplayHeight,
    detailedDisplayNodes.length,
    detailedDisplayRootNodeId,
    detailedDisplayWidth,
    isCiFlowFocusPanelOpen,
    isDetailedTopologyOpen
  ]);

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
      ciFlow3DViewStateRef.current = createDefaultCiFlow3DViewState();
      setFocusedCiFlowRootAssetId(null);
      setSelectedCiFlowNodeId(null);
      setDraggingCiFlowNodeId(null);
      setDraggingDetailedNodeId(null);
      setCiFlowNodeDragOffsets({});
      setCiFlowOriginCenter(null);
      setCiFlowViewportCenter(null);
      setCiFlowTweenProgress(0);
      ciFlow3DViewStateRef.current = createDefaultCiFlow3DViewState();
      ciFlowAutoFitPendingRef.current = false;
      detailedZoomBeforeCiFlowRef.current = null;
      ciFlowNodeDragStateRef.current = null;
      ciFlowNodeDragOffsetsRef.current = {};
      setSelectedTileFilterId("__all__");
      setTileFilterSearchText("");
      setIsTileSearchFocused(false);
      setDraggingNodeId(null);
      tileDragStateRef.current = null;
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
      if (detailedControlsRef.current) {
        detailedControlsRef.current.enabled = true;
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
      topologyCanvasPanStateRef.current = null;
      topologyCanvasNeedsFitRef.current = true;
      topologyCanvasViewStateRef.current = {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
        initialized: false,
        graphKey: ""
      };
      detailedDragStateRef.current = null;
      detailedPersistedCameraStateRef.current = null;
      detailedPersistedNodePositionsRef.current = new Map();
      detailedManualNodePositionsRef.current = new Map();
      detailedRuntimeNodesRef.current = new Map();
      detailedNodePositionsDirtyRef.current = false;
      tileRefs.current = {};
      detailedTileRefs.current = {};
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
    setIsDetailedTopologyOpen(true);
    setDetailedRootNodeId(coreNode?.id ?? null);
    setDetailedSelectedNodeId(null);
    setDetailedSelectedTileFilterId("__all__");
    setDetailedTileFilterSearchText("");
    setIsDetailedTileSearchFocused(false);
    setDetailedZoom(1);
    ciFlow3DViewStateRef.current = createDefaultCiFlow3DViewState();
    detailedPersistedCameraStateRef.current = null;
    detailedPersistedNodePositionsRef.current = new Map();
    detailedManualNodePositionsRef.current = new Map();
    setFocusedCiFlowRootAssetId(null);
    setSelectedCiFlowNodeId(null);
    setDraggingCiFlowNodeId(null);
    setDraggingDetailedNodeId(null);
    setCiFlowNodeDragOffsets({});
    setCiFlowOriginCenter(null);
    setCiFlowViewportCenter(null);
    setCiFlowTweenProgress(0);
    ciFlowAutoFitPendingRef.current = false;
    detailedZoomBeforeCiFlowRef.current = null;
    ciFlowNodeDragStateRef.current = null;
    ciFlowNodeDragOffsetsRef.current = {};
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
      ciFlowNodeDragStateRef.current = null;
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
    const selectedExists = topologyRenderNodes.some((node) => node.id === selectedTileFilterId);
    if (!selectedExists) {
      setSelectedTileFilterId("__all__");
    }
  }, [selectedTileFilterId, topologyRenderNodes]);

  useEffect(() => {
    if (!isDetailedTopologyOpen || !detailedTree || isCiFlowFocusPanelOpen) {
      return;
    }
    setDetailedSelectedNodeId(detailedTree.rootNodeId);
  }, [detailedTree, isCiFlowFocusPanelOpen, isDetailedTopologyOpen]);

  useEffect(() => {
    if (!isDetailedTopologyOpen || isCiFlowFocusPanelOpen || !detailedTree || !detailedSelectedNodeId) {
      return;
    }

    let isSelectedVisible = detailedFilteredNodeIds.has(detailedSelectedNodeId);
    if (!isSelectedVisible && detailedModelOverlay.tiles.length) {
      const visibleOverlayTileIds = new Set<string>();
      for (const link of detailedModelOverlay.links) {
        if (detailedFilteredNodeIds.has(link.ciNodeId)) {
          visibleOverlayTileIds.add(link.tileId);
        }
      }
      isSelectedVisible = visibleOverlayTileIds.has(detailedSelectedNodeId);
    }

    if (isSelectedVisible) {
      return;
    }

    setDetailedSelectedNodeId(detailedTree.rootNodeId);
    if (detailedSelectedTileFilterId !== "__all__") {
      setDetailedSelectedTileFilterId("__all__");
    }
  }, [
    detailedFilteredNodeIds,
    detailedModelOverlay.links,
    detailedModelOverlay.tiles,
    detailedSelectedNodeId,
    detailedSelectedTileFilterId,
    detailedTree,
    isCiFlowFocusPanelOpen,
    isDetailedTopologyOpen
  ]);

  useEffect(() => {
    if (!isDetailedTopologyOpen || !isCiFlowFocusPanelOpen || !ciFlowRootNodeId || !selectedCiFlowNodeId) {
      return;
    }
    if (detailedFilteredNodeIds.has(selectedCiFlowNodeId)) {
      return;
    }
    setSelectedCiFlowNodeId(null);
    if (detailedSelectedTileFilterId !== "__all__") {
      setDetailedSelectedTileFilterId("__all__");
    }
  }, [
    ciFlowRootNodeId,
    detailedFilteredNodeIds,
    detailedSelectedTileFilterId,
    isCiFlowFocusPanelOpen,
    isDetailedTopologyOpen,
    selectedCiFlowNodeId
  ]);

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
    setDetailedTileCopyFeedback("idle");
  }, [detailedSelectedNodeId, isCiFlowFocusPanelOpen]);

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
          setDraggingCiFlowNodeId(null);
          setDraggingDetailedNodeId(null);
          setCiFlowNodeDragOffsets({});
          setCiFlowOriginCenter(null);
          setCiFlowViewportCenter(null);
          setCiFlowTweenProgress(0);
          ciFlowAutoFitPendingRef.current = false;
          ciFlowNodeDragStateRef.current = null;
          ciFlowNodeDragOffsetsRef.current = {};
          if (detailedZoomBeforeCiFlowRef.current !== null) {
            setDetailedZoom(detailedZoomBeforeCiFlowRef.current);
            detailedZoomBeforeCiFlowRef.current = null;
          }
          return;
        }
        if (isDetailedTopologyOpen) {
          setDraggingDetailedNodeId(null);
          onClose();
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
    const context = canvas.getContext("2d");
    if (!context) {
      setRendererInitError("Canvas 2D renderer is unavailable in this browser/session.");
      return;
    }
    setRendererInitError(null);
    controlsRef.current = null;
    cameraRef.current = null;

    const viewState = topologyCanvasViewStateRef.current;
    const graphKey = `${topologyRenderNodes.map((node) => node.id).join("|")}::${topologyRenderEdges
      .map((edge) => edge.id)
      .join("|")}`;
    if (viewState.graphKey !== graphKey) {
      viewState.graphKey = graphKey;
      viewState.initialized = false;
      topologyCanvasNeedsFitRef.current = true;
    }

    const tileWorldWidth = 352;
    const tileWorldHeight = 160;
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const colorToCss = (value: number) => `#${value.toString(16).padStart(6, "0")}`;

    const resolveNodePosition = (nodeId: string): THREE.Vector3 | null => {
      const layoutNode = topologyRenderNodeById.get(nodeId);
      if (!layoutNode) {
        return null;
      }
      if (nodeId === coreNode?.id || isNetworkModelOverlayNodeId(nodeId)) {
        return layoutNode.position.clone();
      }
      const manual = manualNodePositionsRef.current.get(nodeId);
      if (manual) {
        return manual;
      }
      const persisted = persistedNodePositionsRef.current.get(nodeId);
      if (persisted) {
        return persisted;
      }
      return layoutNode.position.clone();
    };

    const worldToScreen = (worldX: number, worldY: number) => ({
      x: worldX * viewState.zoom + viewState.offsetX,
      y: worldY * viewState.zoom + viewState.offsetY
    });

    const resizeCanvas = () => {
      const width = Math.max(1, Math.floor(viewport.clientWidth));
      const height = Math.max(1, Math.floor(viewport.clientHeight));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.max(1, Math.floor(width * pixelRatio));
      const targetHeight = Math.max(1, Math.floor(height * pixelRatio));
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      return { width, height, pixelRatio };
    };

    const fitView = (width: number, height: number) => {
      if (!topologyRenderNodes.length) {
        viewState.zoom = 1;
        viewState.offsetX = width / 2;
        viewState.offsetY = height / 2;
        viewState.initialized = true;
        topologyCanvasNeedsFitRef.current = false;
        return;
      }
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const node of topologyRenderNodes) {
        const position = resolveNodePosition(node.id);
        if (!position) {
          continue;
        }
        minX = Math.min(minX, position.x - tileWorldWidth / 2);
        maxX = Math.max(maxX, position.x + tileWorldWidth / 2);
        minY = Math.min(minY, position.y - tileWorldHeight / 2);
        maxY = Math.max(maxY, position.y + tileWorldHeight / 2);
      }
      if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
        viewState.zoom = 1;
        viewState.offsetX = width / 2;
        viewState.offsetY = height / 2;
        viewState.initialized = true;
        topologyCanvasNeedsFitRef.current = false;
        return;
      }
      const worldWidth = Math.max(1, maxX - minX);
      const worldHeight = Math.max(1, maxY - minY);
      const padding = 34;
      const fitByWidth = (width - padding * 2) / worldWidth;
      const fitByHeight = (height - padding * 2) / worldHeight;
      viewState.zoom = Number(clamp(Math.min(fitByWidth, fitByHeight), 0.2, 1.65).toFixed(4));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      viewState.offsetX = width / 2 - centerX * viewState.zoom;
      viewState.offsetY = height / 2 - centerY * viewState.zoom;
      viewState.initialized = true;
      topologyCanvasNeedsFitRef.current = false;
    };

    const positionTiles = (viewportWidth: number, viewportHeight: number) => {
      const tileScale = clamp(viewState.zoom, 0.22, 1.7);
      const axisLockedScreenByNodeId = new Map<string, { x: number; y: number }>();
      const rootNodeId = coreNode?.id ?? null;
      const rootPosition = rootNodeId ? resolveNodePosition(rootNodeId) : null;
      const rootScreen = rootPosition ? worldToScreen(rootPosition.x, rootPosition.y) : null;
      if (rootNodeId && rootScreen) {
        axisLockedScreenByNodeId.set(rootNodeId, rootScreen);
      }

      const axisLockedModelNodes = topologyRenderNodes
        .filter((node) => isNetworkModelOverlayNodeId(node.id))
        .sort((left, right) => {
          if (left.position.y !== right.position.y) {
            return left.position.y - right.position.y;
          }
          return left.name.localeCompare(right.name);
        });
      if (axisLockedModelNodes.length) {
        const scaledTileHeight = tileWorldHeight * tileScale;
        const fixedVerticalGapPx = 34;
        const modelStackHeight =
          axisLockedModelNodes.length * scaledTileHeight +
          Math.max(0, axisLockedModelNodes.length - 1) * fixedVerticalGapPx;
        const stackCenterY = rootScreen?.y ?? viewportHeight / 2;
        const firstModelCenterY = stackCenterY - modelStackHeight / 2 + scaledTileHeight / 2;
        axisLockedModelNodes.forEach((node, index) => {
          const nodePosition = resolveNodePosition(node.id);
          if (!nodePosition) {
            return;
          }
          const nodeX = worldToScreen(nodePosition.x, nodePosition.y).x;
          const nodeY = firstModelCenterY + index * (scaledTileHeight + fixedVerticalGapPx);
          axisLockedScreenByNodeId.set(node.id, { x: nodeX, y: nodeY });
        });
      }

      for (const node of topologyRenderNodes) {
        const element = tileRefs.current[node.id];
        if (!element) {
          continue;
        }
        const position = resolveNodePosition(node.id);
        if (!position) {
          element.style.display = "none";
          continue;
        }
        const isVisibleByFilter = visibleTopologyTileNodeIds.has(node.id);
        const screen = axisLockedScreenByNodeId.get(node.id) ?? worldToScreen(position.x, position.y);
        const halfScreenWidth = (tileWorldWidth * tileScale) / 2;
        const halfScreenHeight = (tileWorldHeight * tileScale) / 2;
        const isVisibleInViewport =
          screen.x + halfScreenWidth >= -180 &&
          screen.x - halfScreenWidth <= viewportWidth + 180 &&
          screen.y + halfScreenHeight >= -180 &&
          screen.y - halfScreenHeight <= viewportHeight + 180;
        const isVisible = isVisibleByFilter && isVisibleInViewport;
        element.style.display = isVisible ? "block" : "none";
        if (!isVisible) {
          continue;
        }
        element.style.left = `${screen.x}px`;
        element.style.top = `${screen.y}px`;
        element.style.transform = `translate(-50%, -50%) scale(${tileScale})`;
      }
    };

    const drawEdges = (viewportWidth: number, viewportHeight: number, pixelRatio: number) => {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, viewportWidth, viewportHeight);

      const viewportRect = viewport.getBoundingClientRect();
      const screenRectByNodeId = new Map<
        string,
        { x: number; y: number; width: number; height: number; centerX: number; centerY: number }
      >();
      for (const node of topologyRenderNodes) {
        if (!visibleTopologyTileNodeIds.has(node.id)) {
          continue;
        }
        const element = tileRefs.current[node.id];
        if (!element || element.style.display === "none") {
          continue;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) {
          continue;
        }
        const x = rect.left - viewportRect.left;
        const y = rect.top - viewportRect.top;
        screenRectByNodeId.set(node.id, {
          x,
          y,
          width: rect.width,
          height: rect.height,
          centerX: x + rect.width / 2,
          centerY: y + rect.height / 2
        });
      }
      const relationEdges = topologyRenderEdges.filter(
        (edge) =>
          Boolean(edge.relationKind) &&
          screenRectByNodeId.has(edge.fromNodeId) &&
          screenRectByNodeId.has(edge.toNodeId)
      );

      for (const edge of relationEdges) {
        const fromRect = screenRectByNodeId.get(edge.fromNodeId);
        const toRect = screenRectByNodeId.get(edge.toNodeId);
        if (!fromRect || !toRect) {
          continue;
        }

        const curve = detailedEdgeCurvePoints(
          { x: fromRect.x, y: fromRect.y, width: fromRect.width, height: fromRect.height },
          { x: toRect.x, y: toRect.y, width: toRect.width, height: toRect.height }
        );
        const isPathEdge = selectedPathEdgeIds.has(edge.id);
        const isConnectedEdge = selectedConnectedEdgeIds.has(edge.id);
        const baseColor = edge.relationKind === "related-model-flow" ? "#f97316" : "#38bdf8";

        context.beginPath();
        context.moveTo(curve.startX, curve.startY);
        context.bezierCurveTo(curve.control1X, curve.control1Y, curve.control2X, curve.control2Y, curve.endX, curve.endY);
        context.strokeStyle = isPathEdge ? "#9333ea" : isConnectedEdge ? "#eab308" : baseColor;
        context.globalAlpha = isPathEdge || isConnectedEdge ? 0.94 : 0.86;
        context.lineWidth = isPathEdge ? 3.6 : isConnectedEdge ? 3 : 2.4;
        context.lineCap = "round";
        context.stroke();
      }
    };

    const zoomAtPoint = (factor: number, clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const worldX = (localX - viewState.offsetX) / Math.max(viewState.zoom, 0.0001);
      const worldY = (localY - viewState.offsetY) / Math.max(viewState.zoom, 0.0001);
      viewState.zoom = Number(clamp(viewState.zoom * factor, 0.2, 2.6).toFixed(4));
      viewState.offsetX = localX - worldX * viewState.zoom;
      viewState.offsetY = localY - worldY * viewState.zoom;
      viewState.initialized = true;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 1 && event.button !== 2 && event.pointerType !== "touch") {
        return;
      }
      topologyCanvasPanStateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: viewState.offsetX,
        startOffsetY: viewState.offsetY,
        moved: false
      };
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      const panState = topologyCanvasPanStateRef.current;
      if (!panState || panState.pointerId !== event.pointerId) {
        return;
      }
      const deltaX = event.clientX - panState.startClientX;
      const deltaY = event.clientY - panState.startClientY;
      if (!panState.moved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        panState.moved = true;
      }
      viewState.offsetX = panState.startOffsetX + deltaX;
      viewState.offsetY = panState.startOffsetY + deltaY;
      viewState.initialized = true;
      event.preventDefault();
    };

    const onPointerEnd = (event: PointerEvent) => {
      const panState = topologyCanvasPanStateRef.current;
      if (!panState || panState.pointerId !== event.pointerId) {
        return;
      }
      topologyCanvasPanStateRef.current = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      event.preventDefault();
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.08 : 0.92;
      zoomAtPoint(factor, event.clientX, event.clientY);
    };

    const onContextMenu = (event: Event) => {
      event.preventDefault();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);

    const resizeObserver = new ResizeObserver(() => {
      topologyCanvasNeedsFitRef.current = !viewState.initialized;
    });
    resizeObserver.observe(viewport);

    let isDisposed = false;
    let animationFrame = 0;
    const renderFrame = () => {
      if (isDisposed) {
        return;
      }
      const { width, height, pixelRatio } = resizeCanvas();
      if (!viewState.initialized || topologyCanvasNeedsFitRef.current) {
        fitView(width, height);
      }
      positionTiles(width, height);
      drawEdges(width, height, pixelRatio);

      if (!suppressPersistedPositionsOnCleanupRef.current) {
        const persistedPositions = new Map<string, THREE.Vector3>();
        for (const node of topologyRenderNodes) {
          const position = resolveNodePosition(node.id);
          if (position) {
            persistedPositions.set(node.id, position.clone());
          }
        }
        persistedNodePositionsRef.current = persistedPositions;
      }
      nodePositionsDirtyRef.current = false;
      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    renderFrame();

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerEnd);
      canvas.removeEventListener("pointercancel", onPointerEnd);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      topologyCanvasPanStateRef.current = null;
      if (suppressPersistedPositionsOnCleanupRef.current) {
        persistedNodePositionsRef.current = new Map();
      }
      suppressPersistedPositionsOnCleanupRef.current = false;
      runtimeNodesRef.current = new Map();
      nodePositionsDirtyRef.current = false;
      controlsRef.current = null;
      cameraRef.current = null;
    };
  }, [
    coreNode?.id,
    highlightedEdgeIds,
    isOpen,
    isTileFilterActive,
    selectedConnectedEdgeIds,
    selectedPathEdgeIds,
    topologyRenderEdges,
    topologyRenderNodeById,
    topologyRenderNodes,
    visibleTopologyTileNodeIds
  ]);

  useEffect(() => {
    if (!isDetailedTopologyOpen || !detailedCanvasRef.current || !detailedViewportRef.current) {
      detailedCanvasRequestDrawRef.current = null;
      return;
    }

    const canvas = detailedCanvasRef.current;
    const viewport = detailedViewportRef.current;
    const context = canvas.getContext("2d");
    if (!context) {
      detailedCanvasRequestDrawRef.current = null;
      setRendererInitError("Canvas 2D renderer is unavailable in this browser/session.");
      return;
    }
    setRendererInitError(null);

    const isFlowMode = isCiFlowFocusPanelOpen && Boolean(ciFlowGraph);
    const graphWidth = Math.max(
      1,
      isFlowMode ? (ciFlowGraph?.width ?? 1) : (detailedModelOverlay.width || detailedTree?.width || 1)
    );
    const graphHeight = Math.max(
      1,
      isFlowMode ? (ciFlowGraph?.height ?? 1) : (detailedModelOverlay.height || detailedTree?.height || 1)
    );
    const graphKey = isFlowMode ? `flow:${ciFlowGraph?.rootAssetId ?? ""}` : `detailed:${detailedTree?.rootNodeId ?? ""}`;
    const viewState = detailedCanvasViewStateRef.current;
    if (viewState.graphKey !== graphKey) {
      viewState.graphKey = graphKey;
      viewState.initialized = false;
      detailedCanvasNodeOffsetsRef.current = {};
      detailedFilterClusterProgressRef.current = isDetailedTileFilterActive ? 1 : 0;
      detailedFilterClusterLastTimestampRef.current = null;
      detailedFilterAutoFocusKeyRef.current = "";
      detailedFilterWasActiveRef.current = isDetailedTileFilterActive;
      detailedFilterRestorePendingRef.current = false;
    }
    if (isDetailedTileFilterActive) {
      detailedFilterWasActiveRef.current = true;
      detailedFilterRestorePendingRef.current = false;
    } else if (detailedFilterWasActiveRef.current) {
      detailedFilterWasActiveRef.current = false;
      detailedFilterRestorePendingRef.current = true;
      detailedFilterAutoFocusKeyRef.current = "";
    }

    const resizeCanvas = () => {
      const width = Math.max(1, Math.floor(viewport.clientWidth));
      const height = Math.max(1, Math.floor(viewport.clientHeight));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.max(1, Math.floor(width * pixelRatio));
      const targetHeight = Math.max(1, Math.floor(height * pixelRatio));
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      return { width, height, pixelRatio };
    };

    const fitView = (width: number, height: number) => {
      const padding = 30;
      const fitByWidth = (width - padding * 2) / graphWidth;
      const fitByHeight = (height - padding * 2) / graphHeight;
      const nextZoom = Math.max(0.22, Math.min(1.6, Math.min(fitByWidth, fitByHeight)));
      viewState.zoom = Number(nextZoom.toFixed(4));
      viewState.offsetX = (width - graphWidth * viewState.zoom) / 2;
      viewState.offsetY = (height - graphHeight * viewState.zoom) / 2;
      viewState.initialized = true;
      setDetailedZoom(viewState.zoom);
    };

    type RenderNode = {
      id: string;
      entityType: DetailedTileEntityType;
      name: string;
      subtitle: string;
      modelLabel?: string;
      assetType?: CiAssetType;
      cyberCompliance: { score: number; compliant: number; nonCompliant: number; other: number };
      discoveryCompliance: { score: number; compliant: number; nonCompliant: number; other: number };
      isInModelScope?: boolean;
      x: number;
      y: number;
      z: number;
      width: number;
      height: number;
      opacity: number;
    };

    const worldToScreen = (x: number, y: number) => ({
      x: x * viewState.zoom + viewState.offsetX,
      y: y * viewState.zoom + viewState.offsetY
    });

    const projectFlowPoint = (worldX: number, worldY: number, worldZ: number, viewportWidth: number, viewportHeight: number) => {
      if (!ciFlowGraph) {
        return null;
      }
      const flow3D = ciFlow3DViewStateRef.current;
      const centeredX = worldX - ciFlowGraph.viewCenterX;
      const centeredY = worldY - ciFlowGraph.viewCenterY;
      const centeredZ = worldZ;

      const yawCos = Math.cos(flow3D.yaw);
      const yawSin = Math.sin(flow3D.yaw);
      const pitchCos = Math.cos(flow3D.pitch);
      const pitchSin = Math.sin(flow3D.pitch);

      const xYaw = centeredX * yawCos - centeredZ * yawSin;
      const zYaw = centeredX * yawSin + centeredZ * yawCos;
      const yPitch = centeredY * pitchCos - zYaw * pitchSin;
      const zPitch = centeredY * pitchSin + zYaw * pitchCos;

      const xCamera = xYaw + flow3D.panX;
      const yCamera = yPitch + flow3D.panY;
      const depth = CI_FLOW_3D_CAMERA_DISTANCE - zPitch;
      if (!Number.isFinite(depth) || depth <= 80) {
        return null;
      }
      const perspective = (CI_FLOW_3D_FOCAL_LENGTH * flow3D.zoom) / depth;
      if (!Number.isFinite(perspective) || perspective <= 0.0001) {
        return null;
      }
      return {
        x: viewportWidth / 2 + xCamera * perspective,
        y: viewportHeight / 2 - yCamera * perspective,
        depth,
        perspective
      };
    };

    const drawText = (
      text: string,
      x: number,
      y: number,
      width: number,
      font: string,
      color: string,
      align: CanvasTextAlign = "left"
    ) => {
      context.font = font;
      context.fillStyle = color;
      context.textAlign = align;
      context.textBaseline = "alphabetic";
      const maxChars = Math.max(6, Math.floor(width / 7));
      context.fillText(truncateLabel(text, maxChars), x, y, width);
    };

    const buildRenderNodes = () => {
      const baseNodes: RenderNode[] = isFlowMode
        ? ciFlowRenderedNodes
            .filter((node) => detailedFilteredNodeIds.has(node.id))
            .map<RenderNode>((node) => ({
              id: node.id,
              entityType: node.entityType,
              name: node.name,
              subtitle: node.subtitle,
              modelLabel: node.modelLabel,
              assetType: node.assetType,
              cyberCompliance: node.cyberCompliance,
              discoveryCompliance: node.discoveryCompliance,
              isInModelScope: node.isInModelScope,
              x: node.renderX,
              y: node.renderY,
              z: node.renderZ,
              width: node.width,
              height: node.height,
              opacity: node.renderOpacity
            }))
        : (() => {
            const baseDetailedNodes = (detailedTree?.nodes ?? [])
              .filter((node) => !isDetailedTileFilterActive || detailedFilteredNodeIds.has(node.id))
              .map<RenderNode>((node) => {
                const offset = detailedCanvasNodeOffsetsRef.current[node.id] ?? { x: 0, y: 0 };
                return {
                  id: node.id,
                  entityType: node.entityType,
                  name: node.name,
                  subtitle: node.subtitle,
                  cyberCompliance: node.cyberCompliance,
                  discoveryCompliance: node.discoveryCompliance,
                  x: node.x + offset.x,
                  y: node.y + offset.y,
                  z: 0,
                  width: node.width,
                  height: node.height,
                  opacity: 1
                };
              });
            if (!detailedModelOverlay.tiles.length) {
              return baseDetailedNodes;
            }
            const visibleOverlayTileIds = new Set<string>();
            for (const link of detailedModelOverlay.links) {
              if (detailedFilteredNodeIds.has(link.ciNodeId)) {
                visibleOverlayTileIds.add(link.tileId);
              }
            }
            const overlayNodes = detailedModelOverlay.tiles
              .filter((tile) => visibleOverlayTileIds.has(tile.id))
              .map<RenderNode>((tile) => {
                const offset = detailedCanvasNodeOffsetsRef.current[tile.id] ?? { x: 0, y: 0 };
                return {
                  id: tile.id,
                  entityType: tile.entityType,
                  name: tile.name,
                  subtitle: tile.subtitle,
                  modelLabel: tile.typeLabel,
                  cyberCompliance: tile.cyberCompliance,
                  discoveryCompliance: tile.discoveryCompliance,
                  x: tile.x + offset.x,
                  y: tile.y + offset.y,
                  z: 0,
                  width: tile.width,
                  height: tile.height,
                  opacity: 1
                };
              });
            return [...baseDetailedNodes, ...overlayNodes];
          })();

      const clusterProgress = detailedFilterClusterProgressRef.current;
      if (clusterProgress <= 0.0001 || baseNodes.length <= 1) {
        return baseNodes;
      }

      if (isFlowMode) {
        let centerX = 0;
        let centerY = 0;
        let centerZ = 0;
        for (const node of baseNodes) {
          centerX += node.x + node.width / 2;
          centerY += node.y + node.height / 2;
          centerZ += node.z;
        }
        centerX /= baseNodes.length;
        centerY /= baseNodes.length;
        centerZ /= baseNodes.length;
        const scaleX = 1 - (1 - 0.66) * clusterProgress;
        const scaleY = 1 - (1 - 0.66) * clusterProgress;
        const scaleZ = 1 - (1 - 0.66) * clusterProgress;
        return baseNodes.map((node) => {
          const nodeCenterX = node.x + node.width / 2;
          const nodeCenterY = node.y + node.height / 2;
          const compactCenterX = centerX + (nodeCenterX - centerX) * scaleX;
          const compactCenterY = centerY + (nodeCenterY - centerY) * scaleY;
          const compactZ = centerZ + (node.z - centerZ) * scaleZ;
          return {
            ...node,
            x: compactCenterX - node.width / 2,
            y: compactCenterY - node.height / 2,
            z: compactZ
          };
        });
      }

      if (!detailedTree) {
        return baseNodes;
      }
      const topologyNodes = baseNodes.filter((node) => !isDetailedModelOverlayNodeId(node.id));
      if (!topologyNodes.length) {
        return baseNodes;
      }
      const topologyNodeById = new Map(topologyNodes.map((node) => [node.id, node]));
      const rootNode = topologyNodeById.get(detailedTree.rootNodeId) ?? topologyNodes[0];
      if (!rootNode) {
        return baseNodes;
      }

      const environmentNodes = topologyNodes
        .filter((node) => node.entityType === "environment")
        .sort((left, right) => left.y - right.y);
      const parentEnvironmentByCiId = new Map<string, string>();
      for (const edge of detailedTree.edges) {
        const fromNode = topologyNodeById.get(edge.fromNodeId);
        const toNode = topologyNodeById.get(edge.toNodeId);
        if (!fromNode || !toNode) {
          continue;
        }
        if (fromNode.entityType === "environment" && toNode.entityType === "ci") {
          parentEnvironmentByCiId.set(toNode.id, fromNode.id);
        }
      }
      const ciNodesByEnvironmentId = new Map<string, RenderNode[]>();
      const ungroupedCiNodes: RenderNode[] = [];
      for (const node of topologyNodes) {
        if (node.entityType !== "ci") {
          continue;
        }
        const parentEnvironmentId = parentEnvironmentByCiId.get(node.id);
        if (!parentEnvironmentId) {
          ungroupedCiNodes.push(node);
          continue;
        }
        const current = ciNodesByEnvironmentId.get(parentEnvironmentId) ?? [];
        current.push(node);
        ciNodesByEnvironmentId.set(parentEnvironmentId, current);
      }
      for (const nodes of ciNodesByEnvironmentId.values()) {
        nodes.sort((left, right) => left.y - right.y);
      }
      ungroupedCiNodes.sort((left, right) => left.y - right.y);

      const maxEnvironmentWidth = Math.max(DETAILED_TILE_WIDTH, ...environmentNodes.map((node) => node.width));
      const maxCiWidth = Math.max(
        DETAILED_CI_TILE_WIDTH,
        ...topologyNodes.filter((node) => node.entityType === "ci").map((node) => node.width)
      );
      const rootToEnvironmentGap = Math.max(86, DETAILED_COLUMN_GAP * 0.44);
      const environmentToCiGap = Math.max(84, DETAILED_COLUMN_GAP * 0.4);
      const compactSectionGap = Math.max(18, DETAILED_SECTION_GAP * 0.34);
      const compactCiGap = Math.max(10, DETAILED_CI_ROW_GAP * 0.72);

      const minBaseY = Math.min(...topologyNodes.map((node) => node.y));
      const rootX = rootNode.x;
      const environmentX = rootX + rootNode.width + rootToEnvironmentGap;
      const ciX = environmentX + maxEnvironmentWidth + environmentToCiGap;
      let cursorY = minBaseY;
      const targetByNodeId = new Map<string, { x: number; y: number }>();
      for (const environmentNode of environmentNodes) {
        const ciNodes = ciNodesByEnvironmentId.get(environmentNode.id) ?? [];
        const ciStackHeight = ciNodes.length
          ? ciNodes.reduce((sum, node) => sum + node.height, 0) + compactCiGap * (ciNodes.length - 1)
          : 0;
        const sectionHeight = Math.max(environmentNode.height, ciStackHeight);
        const sectionTop = cursorY;
        targetByNodeId.set(environmentNode.id, {
          x: environmentX,
          y: sectionTop + (sectionHeight - environmentNode.height) / 2
        });
        if (ciNodes.length) {
          let ciCursorY = sectionTop + (sectionHeight - ciStackHeight) / 2;
          for (const ciNode of ciNodes) {
            targetByNodeId.set(ciNode.id, {
              x: ciX,
              y: ciCursorY
            });
            ciCursorY += ciNode.height + compactCiGap;
          }
        }
        cursorY += sectionHeight + compactSectionGap;
      }
      if (ungroupedCiNodes.length) {
        let ciCursorY = cursorY;
        for (const ciNode of ungroupedCiNodes) {
          targetByNodeId.set(ciNode.id, {
            x: ciX,
            y: ciCursorY
          });
          ciCursorY += ciNode.height + compactCiGap;
        }
        cursorY = ciCursorY;
      } else if (environmentNodes.length) {
        cursorY -= compactSectionGap;
      }
      const compactBodyHeight = Math.max(rootNode.height, cursorY - minBaseY);
      targetByNodeId.set(rootNode.id, {
        x: rootX,
        y: minBaseY + (compactBodyHeight - rootNode.height) / 2
      });

      const horizontalProgress = clusterProgress;
      const verticalProgress = isDetailedTileFilterActive ? 1 : clusterProgress;
      return baseNodes.map((node) => {
        const targetPosition = targetByNodeId.get(node.id);
        if (!targetPosition) {
          return node;
        }
        return {
          ...node,
          x: node.x + (targetPosition.x - node.x) * horizontalProgress,
          y: node.y + (targetPosition.y - node.y) * verticalProgress
        };
      });
    };

    const ciFlowSphereRadiusWorld = (node: RenderNode) => {
      return node.entityType === "not-modelled" ? 72 : 58;
    };

    let latestNodes: RenderNode[] = [];
    let latestFlowProjectedNodes: Array<{
      node: RenderNode;
      centerX: number;
      centerY: number;
      radius: number;
      depth: number;
      perspective: number;
      isRootNode: boolean;
      isSelected: boolean;
    }> = [];

    const drawScene = () => {
      detailedCanvasRenderRequestedRef.current = false;
      const { width, height, pixelRatio } = resizeCanvas();
      if (isFlowMode) {
        const now = performance.now();
        const previous = ciFlowOuterShellSpinLastTimestampRef.current ?? now;
        const deltaSeconds = Math.max(0, Math.min(0.05, (now - previous) / 1000));
        ciFlowOuterShellSpinLastTimestampRef.current = now;
        const spinSpeedRadiansPerSecond = 0.16;
        ciFlowOuterShellSpinAngleRef.current =
          (ciFlowOuterShellSpinAngleRef.current + deltaSeconds * spinSpeedRadiansPerSecond) % (Math.PI * 2);
        ciFlowInnerShellSpinAngleRef.current =
          (ciFlowInnerShellSpinAngleRef.current - deltaSeconds * spinSpeedRadiansPerSecond) % (Math.PI * 2);
      } else {
        ciFlowOuterShellSpinLastTimestampRef.current = null;
      }
      if (isFlowMode) {
        if (!viewState.initialized) {
          viewState.initialized = true;
          setDetailedZoom(ciFlow3DViewStateRef.current.zoom);
        }
      } else if (!viewState.initialized || !Number.isFinite(viewState.zoom) || viewState.zoom <= 0) {
        fitView(width, height);
      }

      const targetClusterProgress = isDetailedTileFilterActive ? 1 : 0;
      const clusterProgress = detailedFilterClusterProgressRef.current;
      let shouldContinueAnimation = false;
      if (Math.abs(clusterProgress - targetClusterProgress) > 0.0005) {
        const now = performance.now();
        const lastTimestamp = detailedFilterClusterLastTimestampRef.current ?? now;
        const deltaSeconds = Math.max(0.001, Math.min(0.05, (now - lastTimestamp) / 1000));
        detailedFilterClusterLastTimestampRef.current = now;
        const animationRate = 7.5;
        const nextProgress = clusterProgress + (targetClusterProgress - clusterProgress) * Math.min(1, deltaSeconds * animationRate);
        detailedFilterClusterProgressRef.current = nextProgress;
        shouldContinueAnimation = Math.abs(nextProgress - targetClusterProgress) > 0.0005;
      } else {
        detailedFilterClusterProgressRef.current = targetClusterProgress;
        detailedFilterClusterLastTimestampRef.current = null;
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#020617";
      context.fillRect(0, 0, width, height);

      latestNodes = buildRenderNodes();
      const nodeById = new Map(latestNodes.map((node) => [node.id, node]));

      if (!isFlowMode && latestNodes.length && !detailedCanvasInteractionRef.current) {
        const fitNodesToViewport = () => {
          const fitNodes = latestNodes.filter((node) => !isDetailedModelOverlayNodeId(node.id));
          const nodesForBounds = fitNodes.length ? fitNodes : latestNodes;
          let boundsMinX = Number.POSITIVE_INFINITY;
          let boundsMinY = Number.POSITIVE_INFINITY;
          let boundsMaxX = Number.NEGATIVE_INFINITY;
          let boundsMaxY = Number.NEGATIVE_INFINITY;
          for (const node of nodesForBounds) {
            boundsMinX = Math.min(boundsMinX, node.x);
            boundsMinY = Math.min(boundsMinY, node.y);
            boundsMaxX = Math.max(boundsMaxX, node.x + node.width);
            boundsMaxY = Math.max(boundsMaxY, node.y + node.height);
          }
          if (!Number.isFinite(boundsMinX) || !Number.isFinite(boundsMinY) || !Number.isFinite(boundsMaxX) || !Number.isFinite(boundsMaxY)) {
            return;
          }
          const viewportPadding = 34;
          const fitWidth = Math.max(1, boundsMaxX - boundsMinX);
          const fitHeight = Math.max(1, boundsMaxY - boundsMinY);
          const fitByWidth = (width - viewportPadding * 2) / fitWidth;
          const fitByHeight = (height - viewportPadding * 2) / fitHeight;
          const fitZoom = Number(Math.max(0.22, Math.min(3.8, Math.min(fitByWidth, fitByHeight))).toFixed(4));
          const centerX = (boundsMinX + boundsMaxX) / 2;
          const centerY = (boundsMinY + boundsMaxY) / 2;
          viewState.zoom = fitZoom;
          viewState.offsetX = width / 2 - centerX * fitZoom;
          viewState.offsetY = height / 2 - centerY * fitZoom;
          viewState.initialized = true;
          setDetailedZoom(fitZoom);
        };

        if (isDetailedTileFilterActive) {
          const visibleKey = [...detailedFilteredNodeIds].sort().join("|");
          const focusKey = `filter:${graphKey}:${visibleKey}`;
          const shouldAutoFocus = detailedFilterAutoFocusKeyRef.current !== focusKey || shouldContinueAnimation;
          if (shouldAutoFocus) {
            fitNodesToViewport();
            detailedFilterAutoFocusKeyRef.current = focusKey;
          }
        } else if (detailedFilterRestorePendingRef.current) {
          const restoreKey = `restore:${graphKey}`;
          const shouldAutoFocus = detailedFilterAutoFocusKeyRef.current !== restoreKey || shouldContinueAnimation;
          if (shouldAutoFocus) {
            fitNodesToViewport();
            detailedFilterAutoFocusKeyRef.current = restoreKey;
          }
          if (!shouldContinueAnimation && detailedFilterClusterProgressRef.current <= 0.0005) {
            detailedFilterRestorePendingRef.current = false;
            detailedFilterAutoFocusKeyRef.current = `default:${graphKey}`;
          }
        }
      }

      latestFlowProjectedNodes = [];
      const flowProjectedNodeById = new Map<
        string,
        {
          node: RenderNode;
          centerX: number;
          centerY: number;
          radius: number;
          depth: number;
          perspective: number;
          isRootNode: boolean;
          isSelected: boolean;
        }
      >();
      let ciFlowProjectionPinDeltaX = 0;
      let ciFlowProjectionPinDeltaY = 0;
      if (isFlowMode && ciFlowGraph) {
        const rootRenderNode = latestNodes.find((node) => node.id === ciFlowRootNodeId) ?? null;
        if (rootRenderNode) {
          const rootProjection = projectFlowPoint(
            rootRenderNode.x + rootRenderNode.width / 2,
            rootRenderNode.y + rootRenderNode.height / 2,
            rootRenderNode.z,
            width,
            height
          );
          if (rootProjection) {
            const pinnedRootScreenPosition = { x: width / 2, y: height / 2 };
            ciFlowPinnedRootScreenPositionRef.current = pinnedRootScreenPosition;
            if (pinnedRootScreenPosition) {
              ciFlowProjectionPinDeltaX = pinnedRootScreenPosition.x - rootProjection.x;
              ciFlowProjectionPinDeltaY = pinnedRootScreenPosition.y - rootProjection.y;
            }
          }
        }
        const spinPivotX = rootRenderNode ? rootRenderNode.x + rootRenderNode.width / 2 : ciFlowGraph.viewCenterX;
        const spinPivotY = rootRenderNode ? rootRenderNode.y + rootRenderNode.height / 2 : ciFlowGraph.viewCenterY;
        const spinPivotZ = rootRenderNode?.z ?? 0;
        const outerSpinAngle = ciFlowOuterShellSpinAngleRef.current;
        const innerSpinAngle = ciFlowInnerShellSpinAngleRef.current;
        const outerSpinCos = Math.cos(outerSpinAngle);
        const outerSpinSin = Math.sin(outerSpinAngle);
        const innerSpinCos = Math.cos(innerSpinAngle);
        const innerSpinSin = Math.sin(innerSpinAngle);
        for (const node of latestNodes) {
          const isRootNode = node.id === detailedDisplayRootNodeId;
          const isSelected = node.id === detailedDisplaySelectedNodeId;
          let centerWorldX = node.x + node.width / 2;
          const centerWorldY = node.y + node.height / 2;
          let centerWorldZ = node.z;
          const isOuterShellCi =
            node.entityType === "ci" && node.id !== ciFlowRootNodeId && !node.isInModelScope;
          const isInnerShellCi =
            node.entityType === "ci" && node.id !== ciFlowRootNodeId && Boolean(node.isInModelScope);
          if (isOuterShellCi) {
            const relativeX = centerWorldX - spinPivotX;
            const relativeZ = centerWorldZ - spinPivotZ;
            centerWorldX = spinPivotX + relativeX * outerSpinCos - relativeZ * outerSpinSin;
            centerWorldZ = spinPivotZ + relativeX * outerSpinSin + relativeZ * outerSpinCos;
          } else if (isInnerShellCi) {
            const relativeX = centerWorldX - spinPivotX;
            const relativeZ = centerWorldZ - spinPivotZ;
            centerWorldX = spinPivotX + relativeX * innerSpinCos - relativeZ * innerSpinSin;
            centerWorldZ = spinPivotZ + relativeX * innerSpinSin + relativeZ * innerSpinCos;
          }
          const projection = projectFlowPoint(centerWorldX, centerWorldY, centerWorldZ, width, height);
          if (!projection) {
            continue;
          }
          const projectedCenterX = projection.x + ciFlowProjectionPinDeltaX;
          const projectedCenterY = projection.y + ciFlowProjectionPinDeltaY;
          const baseRadius = ciFlowSphereRadiusWorld(node);
          const selectedScale = isSelected ? 1.14 : isRootNode ? 1.06 : 1;
          const radius = baseRadius * projection.perspective * selectedScale;
          if (
            projectedCenterX + radius < -40 ||
            projectedCenterX - radius > width + 40 ||
            projectedCenterY + radius < -40 ||
            projectedCenterY - radius > height + 40
          ) {
            continue;
          }
          const projected = {
            node,
            centerX: projectedCenterX,
            centerY: projectedCenterY,
            radius,
            depth: projection.depth,
            perspective: projection.perspective,
            isRootNode,
            isSelected
          };
          latestFlowProjectedNodes.push(projected);
          flowProjectedNodeById.set(node.id, projected);
        }
        if (ciFlowAutoFitPendingRef.current && latestFlowProjectedNodes.length) {
          let boundsMinX = Number.POSITIVE_INFINITY;
          let boundsMinY = Number.POSITIVE_INFINITY;
          let boundsMaxX = Number.NEGATIVE_INFINITY;
          let boundsMaxY = Number.NEGATIVE_INFINITY;
          const includeCircleBounds = (centerX: number, centerY: number, radius: number) => {
            boundsMinX = Math.min(boundsMinX, centerX - radius);
            boundsMinY = Math.min(boundsMinY, centerY - radius);
            boundsMaxX = Math.max(boundsMaxX, centerX + radius);
            boundsMaxY = Math.max(boundsMaxY, centerY + radius);
          };
          for (const projected of latestFlowProjectedNodes) {
            includeCircleBounds(projected.centerX, projected.centerY, projected.radius);
          }
          if (rootRenderNode) {
            const rootCenterWorldX = rootRenderNode.x + rootRenderNode.width / 2;
            const rootCenterWorldY = rootRenderNode.y + rootRenderNode.height / 2;
            const rootProjection = projectFlowPoint(rootCenterWorldX, rootCenterWorldY, rootRenderNode.z, width, height);
            if (rootProjection) {
              rootProjection.x += ciFlowProjectionPinDeltaX;
              rootProjection.y += ciFlowProjectionPinDeltaY;
              const shellRadiusWorldForNodes = (nodes: RenderNode[]) => {
                if (!nodes.length) {
                  return null;
                }
                let maxDistance = 0;
                for (const node of nodes) {
                  const nodeCenterWorldX = node.x + node.width / 2;
                  const nodeCenterWorldY = node.y + node.height / 2;
                  const distance = Math.hypot(
                    nodeCenterWorldX - rootCenterWorldX,
                    nodeCenterWorldY - rootCenterWorldY,
                    node.z - rootRenderNode.z
                  );
                  maxDistance = Math.max(maxDistance, distance + ciFlowSphereRadiusWorld(node) * 0.95);
                }
                return maxDistance + 76;
              };
              const innerShellRadiusWorld = shellRadiusWorldForNodes(
                latestNodes.filter(
                  (node) =>
                    node.entityType === "ci" &&
                    node.id !== rootRenderNode.id &&
                    node.isInModelScope
                )
              );
              const outerShellRadiusWorld = shellRadiusWorldForNodes(
                latestNodes.filter(
                  (node) =>
                    node.entityType === "ci" &&
                    node.id !== rootRenderNode.id &&
                    !node.isInModelScope
                )
              );
              if (innerShellRadiusWorld) {
                includeCircleBounds(
                  rootProjection.x,
                  rootProjection.y,
                  innerShellRadiusWorld * rootProjection.perspective
                );
              }
              if (outerShellRadiusWorld) {
                includeCircleBounds(
                  rootProjection.x,
                  rootProjection.y,
                  outerShellRadiusWorld * rootProjection.perspective
                );
              }
            }
          }
          if (
            Number.isFinite(boundsMinX) &&
            Number.isFinite(boundsMinY) &&
            Number.isFinite(boundsMaxX) &&
            Number.isFinite(boundsMaxY)
          ) {
            const viewportPadding = 34;
            const spanWidth = Math.max(1, boundsMaxX - boundsMinX);
            const spanHeight = Math.max(1, boundsMaxY - boundsMinY);
            const fitByWidth = (width - viewportPadding * 2) / spanWidth;
            const fitByHeight = (height - viewportPadding * 2) / spanHeight;
            const flow3D = ciFlow3DViewStateRef.current;
            const fitScale = Math.min(fitByWidth, fitByHeight);
            if (Number.isFinite(fitScale) && fitScale > 0) {
              const nextZoom = Number(Math.max(0.3, Math.min(3.4, flow3D.zoom * fitScale * 0.985)).toFixed(4));
              ciFlowAutoFitPendingRef.current = false;
              if (Math.abs(nextZoom - flow3D.zoom) > 0.0005) {
                flow3D.zoom = nextZoom;
                setDetailedZoom(nextZoom);
                requestDraw();
                return;
              }
            } else {
              ciFlowAutoFitPendingRef.current = false;
            }
          } else {
            ciFlowAutoFitPendingRef.current = false;
          }
        }
      }

      if (isFlowMode && ciFlowGraph) {
        const rootNode = detailedDisplayRootNodeId
          ? latestNodes.find((node) => node.id === detailedDisplayRootNodeId) ?? null
          : null;
        if (rootNode) {
          const rootCenterWorldX = rootNode.x + rootNode.width / 2;
          const rootCenterWorldY = rootNode.y + rootNode.height / 2;
          const rootProjection = projectFlowPoint(rootCenterWorldX, rootCenterWorldY, rootNode.z, width, height);
          if (rootProjection) {
            rootProjection.x += ciFlowProjectionPinDeltaX;
            rootProjection.y += ciFlowProjectionPinDeltaY;
            const shellRadiusWorldForNodes = (nodes: RenderNode[]) => {
              if (!nodes.length) {
                return null;
              }
              let maxDistance = 0;
              for (const node of nodes) {
                const nodeCenterWorldX = node.x + node.width / 2;
                const nodeCenterWorldY = node.y + node.height / 2;
                const distance = Math.hypot(
                  nodeCenterWorldX - rootCenterWorldX,
                  nodeCenterWorldY - rootCenterWorldY,
                  node.z - rootNode.z
                );
                maxDistance = Math.max(maxDistance, distance + ciFlowSphereRadiusWorld(node) * 0.95);
              }
              return maxDistance + 76;
            };
            const innerShellRadiusWorld = shellRadiusWorldForNodes(
              latestNodes.filter(
                (node) =>
                  node.entityType === "ci" &&
                  node.id !== rootNode.id &&
                  node.isInModelScope
              )
            );
            const outerShellRadiusWorld = shellRadiusWorldForNodes(
              latestNodes.filter(
                (node) =>
                  node.entityType === "ci" &&
                  node.id !== rootNode.id &&
                  !node.isInModelScope
              )
            );
            const drawFlowShell = (
              radiusWorld: number | null,
              fillColor: string,
              strokeColor: string,
              fillAlpha: number,
              strokeAlpha: number,
              spinArcAngle?: number,
              spinArcColor = "#fda4af",
              spinArcShadowColor = "#f87171",
              spinArcDirection: 1 | -1 = 1
            ) => {
              if (!radiusWorld) {
                return;
              }
              const radiusScreen = radiusWorld * rootProjection.perspective;
              if (!Number.isFinite(radiusScreen) || radiusScreen <= 2) {
                return;
              }
              context.save();
              context.beginPath();
              context.arc(rootProjection.x, rootProjection.y, radiusScreen, 0, Math.PI * 2);
              context.globalAlpha = fillAlpha;
              context.fillStyle = fillColor;
              context.fill();
              context.beginPath();
              context.arc(rootProjection.x, rootProjection.y, radiusScreen, 0, Math.PI * 2);
              context.globalAlpha = strokeAlpha;
              context.strokeStyle = strokeColor;
              context.lineWidth = Math.max(1, radiusScreen * 0.0013);
              context.stroke();
              if (typeof spinArcAngle === "number") {
                const arcLength = Math.PI * 0.42;
                context.beginPath();
                context.arc(
                  rootProjection.x,
                  rootProjection.y,
                  radiusScreen,
                  spinArcAngle,
                  spinArcAngle + arcLength * spinArcDirection
                );
                context.globalAlpha = Math.min(1, strokeAlpha * 2);
                context.strokeStyle = spinArcColor;
                context.lineWidth = Math.max(1.8, radiusScreen * 0.0022);
                context.shadowColor = spinArcShadowColor;
                context.shadowBlur = Math.max(8, radiusScreen * 0.032);
                context.stroke();
              }
              context.restore();
            };
            drawFlowShell(
              outerShellRadiusWorld,
              "#ef4444",
              "#fca5a5",
              0.045,
              0.11,
              ciFlowOuterShellSpinAngleRef.current
            );
            drawFlowShell(
              innerShellRadiusWorld,
              "#22c55e",
              "#86efac",
              0.055,
              0.13,
              ciFlowInnerShellSpinAngleRef.current,
              "#86efac",
              "#22c55e",
              -1
            );
          }
        }

        const hasFlowSelection = Boolean(ciFlowActiveSelectionNodeId);
        for (const edge of ciFlowGraph.edges) {
          if (!detailedFilteredNodeIds.has(edge.fromNodeId) || !detailedFilteredNodeIds.has(edge.toNodeId)) {
            continue;
          }
          const fromProjection = flowProjectedNodeById.get(edge.fromNodeId);
          const toProjection = flowProjectedNodeById.get(edge.toNodeId);
          if (!fromProjection || !toProjection) {
            continue;
          }
          const isHighlighted = ciFlowHighlightedEdgeIds.has(edge.id);
          const color = ciFlowDependencyColor(edge.dependencyType);
          const averageDepth = (fromProjection.depth + toProjection.depth) / 2;
          const depthOpacity = Math.max(0.24, Math.min(1, CI_FLOW_3D_CAMERA_DISTANCE / averageDepth));
          context.beginPath();
          context.moveTo(fromProjection.centerX, fromProjection.centerY);
          context.lineTo(toProjection.centerX, toProjection.centerY);
          context.strokeStyle = color;
          context.globalAlpha =
            (isHighlighted ? 0.95 : hasFlowSelection ? 0.28 : 0.72) *
            Math.max(0, Math.min(1, ciFlowTweenProgressRef.current)) *
            depthOpacity;
          context.lineWidth = edge.dependencyType === "Unmodelled Attachment" ? 2.1 : isHighlighted ? 3.6 : 2.6;
          context.lineCap = "round";
          context.stroke();
        }
      } else if (detailedTree) {
        for (const edge of detailedTree.edges) {
          const fromNode = nodeById.get(edge.fromNodeId);
          const toNode = nodeById.get(edge.toNodeId);
          if (!fromNode || !toNode) {
            continue;
          }
          const curve = detailedEdgeCurvePoints(fromNode, toNode);
          const start = worldToScreen(curve.startX, curve.startY);
          const control1 = worldToScreen(curve.control1X, curve.control1Y);
          const control2 = worldToScreen(curve.control2X, curve.control2Y);
          const end = worldToScreen(curve.endX, curve.endY);
          const isPathEdge = detailedSelectedPathEdgeIds.has(edge.id);
          const isConnectedEdge = detailedSelectedConnectedEdgeIds.has(edge.id);
          const isFocusedTreeEdge = detailedCiSelectionFocus?.linkedTreeEdgeIds.has(edge.id) ?? false;
          const edgeOpacity = isPathEdge || isConnectedEdge ? 0.94 : 0.58;
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y);
          context.strokeStyle = isPathEdge ? "#9333ea" : isConnectedEdge ? "#eab308" : "#38bdf8";
          context.globalAlpha =
            detailedCiSelectionFocus && !isFocusedTreeEdge ? edgeOpacity * 0.2 : edgeOpacity;
          context.lineWidth = isPathEdge ? 3.6 : isConnectedEdge ? 3 : 2;
          context.lineCap = "round";
          context.stroke();
        }
        if (detailedModelOverlay.tiles.length) {
          const visibleTileIds = new Set<string>();
          for (const link of detailedModelOverlay.links) {
            if (!detailedFilteredNodeIds.has(link.ciNodeId)) {
              continue;
            }
            const sourceNode = nodeById.get(link.ciNodeId);
            const targetNode = nodeById.get(link.tileId);
            if (!sourceNode || !targetNode) {
              continue;
            }
            visibleTileIds.add(link.tileId);
            const sourcePoint = worldToScreen(sourceNode.x + sourceNode.width, sourceNode.y + sourceNode.height / 2);
            const targetPoint = worldToScreen(targetNode.x, targetNode.y + targetNode.height / 2);
            const controlOffset = Math.max(44, (targetPoint.x - sourcePoint.x) * 0.28);
            context.beginPath();
            context.moveTo(sourcePoint.x, sourcePoint.y);
            context.bezierCurveTo(
              sourcePoint.x + controlOffset,
              sourcePoint.y,
              targetPoint.x - controlOffset,
              targetPoint.y,
              targetPoint.x,
              targetPoint.y
            );
            context.strokeStyle = link.kind === "shared-resource" ? "#ef4444" : "#f97316";
            const overlayLinkKey = `${link.ciNodeId}|${link.tileId}|${link.kind}`;
            const isFocusedOverlayLink = detailedCiSelectionFocus?.linkedOverlayLinkKeys.has(overlayLinkKey) ?? false;
            context.globalAlpha = detailedCiSelectionFocus && !isFocusedOverlayLink ? 0.172 : 0.86;
            context.lineWidth = 2.2;
            context.lineCap = "round";
            context.stroke();
          }
          for (const tile of detailedModelOverlay.tiles) {
            if (!visibleTileIds.has(tile.id)) {
              continue;
            }
            const runtimeTileNode = nodeById.get(tile.id);
            if (!runtimeTileNode) {
              continue;
            }
            const topLeft = worldToScreen(runtimeTileNode.x, runtimeTileNode.y);
            const tileWidth = runtimeTileNode.width * viewState.zoom;
            const tileHeight = runtimeTileNode.height * viewState.zoom;
            if (
              topLeft.x + tileWidth < -20 ||
              topLeft.x > width + 20 ||
              topLeft.y + tileHeight < -20 ||
              topLeft.y > height + 20
            ) {
              continue;
            }
            const fillColor = detailedTileColor(tile.entityType);
            const strokeColor = detailedTileStrokeColor(tile.entityType);
            const compliance = complianceMode === "cyber" ? tile.cyberCompliance : tile.discoveryCompliance;
            const percentages = compliancePercentages(compliance);
            const isFocusedOverlayTile = detailedCiSelectionFocus?.linkedOverlayTileIds.has(tile.id) ?? false;
            context.globalAlpha = detailedCiSelectionFocus && !isFocusedOverlayTile ? 0.196 : 0.98;
            roundedRectPath(context, topLeft.x, topLeft.y, tileWidth, tileHeight, 18);
            context.fillStyle = fillColor;
            context.fill();
            context.lineWidth = 2.2;
            context.strokeStyle = strokeColor;
            context.stroke();
            if (viewState.zoom >= 0.42) {
              const textScale = Math.max(0.78, Math.min(1.2, viewState.zoom));
              drawText(
                `Type: ${tile.typeLabel}`,
                topLeft.x + 12 * textScale,
                topLeft.y + 22 * textScale,
                tileWidth - 20 * textScale,
                `${Math.round(12 * textScale)}px sans-serif`,
                "#0f172a"
              );
              drawText(
                `Name: ${tile.name}`,
                topLeft.x + 12 * textScale,
                topLeft.y + 40 * textScale,
                tileWidth - 20 * textScale,
                `${Math.round(12 * textScale)}px sans-serif`,
                "#0f172a"
              );
              drawText(
                tile.subtitle,
                topLeft.x + 12 * textScale,
                topLeft.y + 58 * textScale,
                tileWidth - 20 * textScale,
                `${Math.round(10 * textScale)}px sans-serif`,
                "#334155"
              );
              const progressY = topLeft.y + tileHeight - 18 * textScale;
              const progressWidth = Math.max(80, tileWidth - 26 * textScale);
              roundedRectPath(context, topLeft.x + 13 * textScale, progressY, progressWidth, 9 * textScale, 3);
              context.fillStyle = "#cbd5e1";
              context.fill();
              context.fillStyle = "#16a34a";
              context.fillRect(
                topLeft.x + 13 * textScale,
                progressY,
                (progressWidth * percentages.compliant) / 100,
                9 * textScale
              );
              context.fillStyle = "#ef4444";
              context.fillRect(
                topLeft.x + 13 * textScale + (progressWidth * percentages.compliant) / 100,
                progressY,
                (progressWidth * percentages.nonCompliant) / 100,
                9 * textScale
              );
              context.fillStyle = "#94a3b8";
              context.fillRect(
                topLeft.x + 13 * textScale + (progressWidth * (percentages.compliant + percentages.nonCompliant)) / 100,
                progressY,
                (progressWidth * percentages.other) / 100,
                9 * textScale
              );
            }
          }
        }
      }

      const nodesToRender = isFlowMode
        ? [...latestNodes].sort(
            (left, right) =>
              (flowProjectedNodeById.get(right.id)?.depth ?? 0) - (flowProjectedNodeById.get(left.id)?.depth ?? 0)
          )
        : latestNodes;
      for (const node of nodesToRender) {
        if (!isFlowMode && isDetailedModelOverlayNodeId(node.id)) {
          continue;
        }
        const compliance = complianceMode === "cyber" ? node.cyberCompliance : node.discoveryCompliance;
        const percentages = compliancePercentages(compliance);
        const isRootNode = node.id === detailedDisplayRootNodeId;
        const isSelected = node.id === detailedDisplaySelectedNodeId;
        if (isFlowMode) {
          const projected = flowProjectedNodeById.get(node.id);
          if (!projected) {
            continue;
          }
          const center = { x: projected.centerX, y: projected.centerY };
          const radius = projected.radius;
          const isRootCi = node.entityType === "ci" && node.id === ciFlowRootNodeId;
          const isSelectedCi = node.entityType === "ci" && projected.isSelected;
          const strokeColor = isRootCi ? "#a855f7" : ciFlowNodeStrokeColor(node.entityType, node.isInModelScope);
          const flowAssetType = node.assetType ?? "server";
          const depthOpacity = Math.max(0.3, Math.min(1, CI_FLOW_3D_CAMERA_DISTANCE / projected.depth));
          context.globalAlpha = Math.max(0.12, Math.min(1, node.opacity * depthOpacity));
          const gradientStops = isRootCi
            ? ["#f5d0fe", "#c084fc", "#581c87"]
            : strokeColor === "#22c55e"
              ? ["#dcfce7", "#4ade80", "#166534"]
              : ["#fee2e2", "#f87171", "#7f1d1d"];
          let gradient: CanvasGradient;
          if (flowAssetType === "server") {
            context.beginPath();
            context.arc(center.x, center.y, radius, 0, Math.PI * 2);
            gradient = context.createRadialGradient(
              center.x - radius * 0.34,
              center.y - radius * 0.42,
              Math.max(2, radius * 0.12),
              center.x,
              center.y,
              Math.max(3, radius)
            );
          } else if (flowAssetType === "workstation") {
            const size = radius * 1.8;
            const halfSize = size / 2;
            context.beginPath();
            context.rect(center.x - halfSize, center.y - halfSize, size, size);
            gradient = context.createLinearGradient(
              center.x - halfSize,
              center.y - halfSize,
              center.x + halfSize,
              center.y + halfSize
            );
          } else {
            context.beginPath();
            if (flowAssetType === "network-device") {
              const height = radius * 1.95;
              const halfBase = radius * 0.98;
              const topY = center.y - height * 0.55;
              const bottomY = center.y + height * 0.45;
              context.moveTo(center.x, topY);
              context.lineTo(center.x - halfBase, bottomY);
              context.lineTo(center.x + halfBase, bottomY);
              context.closePath();
              gradient = context.createLinearGradient(center.x, topY, center.x, bottomY);
            } else if (flowAssetType === "storage-device") {
              const halfWidth = radius * 1.05;
              const halfHeight = radius * 0.9;
              context.moveTo(center.x, center.y - halfHeight);
              context.lineTo(center.x + halfWidth, center.y);
              context.lineTo(center.x, center.y + halfHeight);
              context.lineTo(center.x - halfWidth, center.y);
              context.closePath();
              gradient = context.createLinearGradient(
                center.x - halfWidth,
                center.y - halfHeight,
                center.x + halfWidth,
                center.y + halfHeight
              );
            } else if (flowAssetType === "printer-device") {
              const halfWidth = radius * 1.05;
              const topY = center.y - radius * 0.85;
              const midY = center.y - radius * 0.05;
              const bottomY = center.y + radius * 0.9;
              context.moveTo(center.x - halfWidth, midY);
              context.lineTo(center.x - halfWidth * 0.7, topY);
              context.lineTo(center.x + halfWidth * 0.7, topY);
              context.lineTo(center.x + halfWidth, midY);
              context.lineTo(center.x + halfWidth * 0.72, bottomY);
              context.lineTo(center.x - halfWidth * 0.72, bottomY);
              context.closePath();
              gradient = context.createLinearGradient(center.x, topY, center.x, bottomY);
            } else {
              const halfWidth = radius * 1.08;
              const topY = center.y - radius * 0.95;
              const lowY = center.y + radius * 0.85;
              context.moveTo(center.x, topY);
              context.lineTo(center.x + halfWidth, center.y - radius * 0.2);
              context.lineTo(center.x + halfWidth * 0.62, lowY);
              context.lineTo(center.x - halfWidth * 0.62, lowY);
              context.lineTo(center.x - halfWidth, center.y - radius * 0.2);
              context.closePath();
              gradient = context.createLinearGradient(center.x, topY, center.x, lowY);
            }
          }
          gradient.addColorStop(0, gradientStops[0]);
          gradient.addColorStop(0.5, gradientStops[1]);
          gradient.addColorStop(1, gradientStops[2]);
          context.fillStyle = gradient;
          context.fill();
          context.lineWidth = projected.isSelected ? 3.8 : projected.isRootNode ? 3.2 : 2.4;
          context.strokeStyle = strokeColor;
          context.stroke();
          if (isRootCi) {
            const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.009);
            const neonRadius = radius + 7 + pulse * 7;
            context.save();
            context.globalAlpha = 0.52 + pulse * 0.42;
            context.shadowColor = "#c084fc";
            context.shadowBlur = 14 + pulse * 24;
            context.beginPath();
            context.arc(center.x, center.y, neonRadius, 0, Math.PI * 2);
            context.lineWidth = 2.2 + pulse * 1.8;
            context.strokeStyle = "#c084fc";
            context.stroke();
            context.restore();
          } else if (isSelectedCi) {
            const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.0105 + 1.4);
            const neonRadius = radius + 6 + pulse * 5;
            context.save();
            context.globalAlpha = 0.48 + pulse * 0.36;
            context.shadowColor = "#fb923c";
            context.shadowBlur = 12 + pulse * 18;
            context.beginPath();
            context.arc(center.x, center.y, neonRadius, 0, Math.PI * 2);
            context.lineWidth = 2 + pulse * 1.5;
            context.strokeStyle = "#fb923c";
            context.stroke();
            context.restore();
          }
          const flowZoom = ciFlow3DViewStateRef.current.zoom;
          if (flowZoom >= 0.34) {
            const textScale = Math.max(0.72, Math.min(1.18, flowZoom));
            const labelWidth = Math.max(120, Math.min(300, radius * 3.6));
            drawText(node.name, center.x, center.y + radius + 14 * textScale, labelWidth, `${Math.round(12 * textScale)}px sans-serif`, "#e2e8f0", "center");
            drawText(
              node.modelLabel ?? node.subtitle,
              center.x,
              center.y + radius + 30 * textScale,
              labelWidth,
              `${Math.round(10 * textScale)}px sans-serif`,
              "#cbd5e1",
              "center"
            );
            if (flowZoom >= 0.56) {
              const complianceText = `${percentages.compliant}% C | ${percentages.nonCompliant}% NC | ${percentages.other}% O`;
              drawText(
                complianceText,
                center.x,
                center.y + radius + 45 * textScale,
                Math.max(labelWidth, 186),
                `${Math.round(10 * textScale)}px sans-serif`,
                "#e2e8f0",
                "center"
              );
            }
          }
          continue;
        }

        const topLeft = worldToScreen(node.x, node.y);
        const nodeWidth = node.width * viewState.zoom;
        const nodeHeight = node.height * viewState.zoom;
        if (topLeft.x + nodeWidth < -20 || topLeft.x > width + 20 || topLeft.y + nodeHeight < -20 || topLeft.y > height + 20) {
          continue;
        }
        const strokeColor = isRootNode
          ? "#ef4444"
          : isSelected
            ? "#a855f7"
            : detailedTileStrokeColor(node.entityType);
        const fillColor = detailedTileColor(node.entityType);
        const isFocusedNode = detailedCiSelectionFocus?.linkedNodeIds.has(node.id) ?? false;
        const nodeBaseOpacity = Math.max(0.1, Math.min(1, node.opacity));
        const nodeOpacity = detailedCiSelectionFocus && !isFocusedNode ? nodeBaseOpacity * 0.2 : nodeBaseOpacity;

        context.globalAlpha = nodeOpacity;
        roundedRectPath(context, topLeft.x, topLeft.y, nodeWidth, nodeHeight, node.entityType === "ci" ? 12 : 18);
        context.fillStyle = fillColor;
        context.fill();
        context.lineWidth = isRootNode || isSelected ? 3.2 : 2;
        context.strokeStyle = strokeColor;
        context.stroke();

        const tileContentZoomThreshold = node.entityType === "ci" ? 0.8 : 0.42;
        if (viewState.zoom >= tileContentZoomThreshold) {
          const textScale = Math.max(0.75, Math.min(1.25, viewState.zoom));
          drawText(`Type: ${detailedEntityTypeLabel(node.entityType)}`, topLeft.x + 14 * textScale, topLeft.y + 22 * textScale, nodeWidth - 24 * textScale, `${Math.round(12 * textScale)}px sans-serif`, "#0f172a");
          drawText(`Name: ${node.name}`, topLeft.x + 14 * textScale, topLeft.y + 40 * textScale, nodeWidth - 24 * textScale, `${Math.round(12 * textScale)}px sans-serif`, "#0f172a");
          drawText(node.modelLabel ?? node.subtitle, topLeft.x + 14 * textScale, topLeft.y + 58 * textScale, nodeWidth - 24 * textScale, `${Math.round(10 * textScale)}px sans-serif`, "#334155");
          const progressY = topLeft.y + nodeHeight - 18 * textScale;
          const progressWidth = Math.max(80, nodeWidth - 26 * textScale);
          roundedRectPath(context, topLeft.x + 13 * textScale, progressY, progressWidth, 9 * textScale, 3);
          context.fillStyle = "#cbd5e1";
          context.fill();
          context.fillStyle = "#16a34a";
          context.fillRect(topLeft.x + 13 * textScale, progressY, (progressWidth * percentages.compliant) / 100, 9 * textScale);
          context.fillStyle = "#ef4444";
          context.fillRect(topLeft.x + 13 * textScale + (progressWidth * percentages.compliant) / 100, progressY, (progressWidth * percentages.nonCompliant) / 100, 9 * textScale);
          context.fillStyle = "#94a3b8";
          context.fillRect(topLeft.x + 13 * textScale + (progressWidth * (percentages.compliant + percentages.nonCompliant)) / 100, progressY, (progressWidth * percentages.other) / 100, 9 * textScale);
        }

        if (node.entityType === "ci") {
          const badgeCenter = worldToScreen(node.x + node.width - 16, node.y + 16);
          const badgeRadius = Math.max(7, 10 * viewState.zoom);
          context.beginPath();
          context.arc(badgeCenter.x, badgeCenter.y, badgeRadius, 0, Math.PI * 2);
          context.fillStyle = "#020617";
          context.fill();
          context.lineWidth = Math.max(1, 1.8 * viewState.zoom);
          context.strokeStyle = "#0c4a6e";
          context.stroke();
          context.fillStyle = "#e0f2fe";
          context.font = `${Math.max(10, Math.round(10 * viewState.zoom))}px sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText("F", badgeCenter.x, badgeCenter.y + 0.5);
        }
      }
      context.globalAlpha = 1;

      const shouldAnimateFlowPulse =
        isFlowMode &&
        latestFlowProjectedNodes.some(
          (projected) =>
            projected.node.entityType === "ci" && (projected.isRootNode || projected.isSelected)
        );
      if (shouldContinueAnimation || shouldAnimateFlowPulse) {
        requestDraw();
      }
    };

    const requestDraw = () => {
      if (detailedCanvasRenderRequestedRef.current) {
        return;
      }
      detailedCanvasRenderRequestedRef.current = true;
      detailedCanvasFrameRef.current = window.requestAnimationFrame(drawScene);
    };
    detailedCanvasRequestDrawRef.current = requestDraw;

    const clientToLocal = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const clientToWorld = (clientX: number, clientY: number) => {
      const local = clientToLocal(clientX, clientY);
      return {
        x: (local.x - viewState.offsetX) / viewState.zoom,
        y: (local.y - viewState.offsetY) / viewState.zoom
      };
    };

    const hitTestFlowNode = (localX: number, localY: number) => {
      let best: (typeof latestFlowProjectedNodes)[number] | null = null;
      for (const projected of latestFlowProjectedNodes) {
        if (!pointInCircle(projected.centerX, projected.centerY, projected.radius, localX, localY)) {
          continue;
        }
        if (!best || projected.depth < best.depth) {
          best = projected;
        }
      }
      return best?.node ?? null;
    };

    const hitTestNode = (worldX: number, worldY: number) => {
      for (let index = latestNodes.length - 1; index >= 0; index -= 1) {
        const node = latestNodes[index];
        if (pointInRect(node.x, node.y, node.width, node.height, worldX, worldY)) {
          return node;
        }
      }
      return null;
    };

    const updateCiFlowFocusBadgeTooltip = (clientX: number, clientY: number) => {
      if (isFlowMode) {
        if (canvas.title) {
          canvas.title = "";
        }
        return;
      }
      const world = clientToWorld(clientX, clientY);
      const hitNode = hitTestNode(world.x, world.y);
      let isOverCiFlowFocusBadge = false;
      if (hitNode && hitNode.entityType === "ci") {
        isOverCiFlowFocusBadge = pointInCircle(hitNode.x + hitNode.width - 16, hitNode.y + 16, 10, world.x, world.y);
      }
      const nextTitle = isOverCiFlowFocusBadge ? "Detailed Topology View - CI Flow Focus" : "";
      if (canvas.title !== nextTitle) {
        canvas.title = nextTitle;
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 1 && event.button !== 2 && event.pointerType !== "touch") {
        return;
      }
      if (isFlowMode) {
        const local = clientToLocal(event.clientX, event.clientY);
        const hitNode = hitTestFlowNode(local.x, local.y);
        if (hitNode) {
          setSelectedCiFlowNodeId(hitNode.id);
          if (isDetailedTileFilterActive) {
            setDetailedSelectedTileFilterId(hitNode.id);
          }
        }

        const flow3D = ciFlow3DViewStateRef.current;
        // Keep the focus/root CI fixed in place on screen for all flow interactions.
        // Flow focus supports rotate + zoom only, no pan translation.
        detailedCanvasInteractionRef.current = {
          pointerId: event.pointerId,
          mode: "flow-orbit",
          startClientX: event.clientX,
          startClientY: event.clientY,
          startOffsetX: viewState.offsetX,
          startOffsetY: viewState.offsetY,
          startNodeOffsetX: 0,
          startNodeOffsetY: 0,
          startYaw: flow3D.yaw,
          startPitch: flow3D.pitch,
          startFlowPanX: flow3D.panX,
          startFlowPanY: flow3D.panY,
          moved: false
        };
        setDraggingDetailedNodeId(hitNode?.id ?? null);
        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (event.button !== 0 && event.pointerType !== "touch") {
        return;
      }

      const world = clientToWorld(event.clientX, event.clientY);
      const hitNode = hitTestNode(world.x, world.y);
      if (hitNode && !isFlowMode && hitNode.entityType === "ci") {
        const badgeCenterX = hitNode.x + hitNode.width - 16;
        const badgeCenterY = hitNode.y + 16;
        if (pointInCircle(badgeCenterX, badgeCenterY, 10, world.x, world.y)) {
          const detailedNode = detailedNodeById.get(hitNode.id);
          if (detailedNode) {
            openCiFlowFocusForNode(detailedNode);
          }
          event.preventDefault();
          return;
        }
      }
      const preserveCiViewState =
        hitNode && !isFlowMode && hitNode.entityType === "ci"
          ? {
              graphKey: viewState.graphKey,
              zoom: viewState.zoom,
              offsetX: viewState.offsetX,
              offsetY: viewState.offsetY
            }
          : null;
      const isOverlayHitNode = Boolean(hitNode && !isFlowMode && isDetailedModelOverlayNodeId(hitNode.id));
      if (hitNode) {
        if (isFlowMode) {
          setSelectedCiFlowNodeId(hitNode.id);
        } else {
          setDetailedSelectedNodeId(hitNode.id);
        }
        if (isDetailedTileFilterActive && !isOverlayHitNode) {
          setDetailedSelectedTileFilterId(hitNode.id);
        }
      }
      detailedCanvasInteractionRef.current = {
        pointerId: event.pointerId,
        mode: hitNode ? "drag-node" : "pan",
        nodeId: hitNode?.id,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: viewState.offsetX,
        startOffsetY: viewState.offsetY,
        startNodeOffsetX: hitNode
          ? isFlowMode
            ? (ciFlowNodeDragOffsetsRef.current[hitNode.id]?.x ?? 0)
            : (detailedCanvasNodeOffsetsRef.current[hitNode.id]?.x ?? 0)
          : 0,
        startNodeOffsetY: hitNode
          ? isFlowMode
            ? (ciFlowNodeDragOffsetsRef.current[hitNode.id]?.y ?? 0)
            : (detailedCanvasNodeOffsetsRef.current[hitNode.id]?.y ?? 0)
          : 0,
        moved: false
      };
      if (preserveCiViewState) {
        window.requestAnimationFrame(() => {
          const currentView = detailedCanvasViewStateRef.current;
          if (currentView.graphKey !== preserveCiViewState.graphKey) {
            return;
          }
          currentView.zoom = preserveCiViewState.zoom;
          currentView.offsetX = preserveCiViewState.offsetX;
          currentView.offsetY = preserveCiViewState.offsetY;
          currentView.initialized = true;
          setDetailedZoom(preserveCiViewState.zoom);
          detailedCanvasRequestDrawRef.current?.();
        });
      }
      setDraggingDetailedNodeId(hitNode?.id ?? null);
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    const onPointerMove = (event: PointerEvent) => {
      const interaction = detailedCanvasInteractionRef.current;
      updateCiFlowFocusBadgeTooltip(event.clientX, event.clientY);
      if (isFlowMode) {
        if (!interaction || interaction.pointerId !== event.pointerId) {
          return;
        }
      } else if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }
      const deltaX = event.clientX - interaction.startClientX;
      const deltaY = event.clientY - interaction.startClientY;
      if (!interaction.moved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
        interaction.moved = true;
      }
      if (interaction.mode === "flow-orbit") {
        const flow3D = ciFlow3DViewStateRef.current;
        const startYaw = interaction.startYaw ?? flow3D.yaw;
        const startPitch = interaction.startPitch ?? flow3D.pitch;
        flow3D.yaw = startYaw + deltaX * 0.0048;
        flow3D.pitch = Math.max(-1.24, Math.min(1.24, startPitch + deltaY * 0.0038));
      } else if (interaction.mode === "flow-pan") {
        const flow3D = ciFlow3DViewStateRef.current;
        flow3D.panX = 0;
        flow3D.panY = 0;
      } else if (interaction.mode === "pan") {
        viewState.offsetX = interaction.startOffsetX + deltaX;
        viewState.offsetY = interaction.startOffsetY + deltaY;
      } else if (interaction.nodeId) {
        const worldDeltaX = deltaX / Math.max(viewState.zoom, 0.0001);
        const worldDeltaY = deltaY / Math.max(viewState.zoom, 0.0001);
        detailedCanvasNodeOffsetsRef.current = {
          ...detailedCanvasNodeOffsetsRef.current,
          [interaction.nodeId as string]: {
            x: interaction.startNodeOffsetX + worldDeltaX,
            y: interaction.startNodeOffsetY + worldDeltaY
          }
        };
      }
      requestDraw();
      event.preventDefault();
    };

    const onPointerEnd = (event: PointerEvent) => {
      const interaction = detailedCanvasInteractionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) {
        return;
      }
      detailedCanvasInteractionRef.current = null;
      setDraggingDetailedNodeId(null);
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      requestDraw();
      event.preventDefault();
    };

    const onPointerLeave = () => {
      if (canvas.title) {
        canvas.title = "";
      }
      if (!isFlowMode) {
        return;
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (isFlowMode) {
        const flow3D = ciFlow3DViewStateRef.current;
        const factor = event.deltaY < 0 ? 1.08 : 0.92;
        flow3D.zoom = Number(Math.max(0.3, Math.min(3.4, flow3D.zoom * factor)).toFixed(4));
        setDetailedZoom(flow3D.zoom);
        requestDraw();
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const worldX = (localX - viewState.offsetX) / viewState.zoom;
      const worldY = (localY - viewState.offsetY) / viewState.zoom;
      const factor = event.deltaY < 0 ? 1.08 : 0.92;
      viewState.zoom = Number(Math.max(0.22, Math.min(3.8, viewState.zoom * factor)).toFixed(4));
      viewState.offsetX = localX - worldX * viewState.zoom;
      viewState.offsetY = localY - worldY * viewState.zoom;
      setDetailedZoom(viewState.zoom);
      requestDraw();
    };

    const onContextMenu = (event: Event) => {
      if (isFlowMode) {
        event.preventDefault();
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);

    let lastViewportWidth = Math.max(1, Math.floor(viewport.clientWidth));
    let lastViewportHeight = Math.max(1, Math.floor(viewport.clientHeight));
    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = Math.max(1, Math.floor(viewport.clientWidth));
      const nextHeight = Math.max(1, Math.floor(viewport.clientHeight));
      if (nextWidth === lastViewportWidth && nextHeight === lastViewportHeight) {
        return;
      }
      lastViewportWidth = nextWidth;
      lastViewportHeight = nextHeight;
      viewState.initialized = false;
      requestDraw();
    });
    resizeObserver.observe(viewport);
    requestDraw();

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerEnd);
      canvas.removeEventListener("pointercancel", onPointerEnd);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      if (canvas.title) {
        canvas.title = "";
      }
      resizeObserver.disconnect();
      detailedCanvasRequestDrawRef.current = null;
      detailedCanvasInteractionRef.current = null;
      detailedCanvasRenderRequestedRef.current = false;
      if (detailedCanvasFrameRef.current !== null) {
        window.cancelAnimationFrame(detailedCanvasFrameRef.current);
        detailedCanvasFrameRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ciFlowGraph,
    ciFlowHighlightedEdgeIds,
    ciFlowRenderedNodes,
    complianceMode,
    detailedNodeById,
    detailedDisplayRootNodeId,
    detailedDisplaySelectedNodeId,
    detailedCiSelectionFocus,
    detailedFilteredNodeIds,
    detailedModelOverlay,
    detailedSelectedConnectedEdgeIds,
    detailedSelectedPathEdgeIds,
    detailedTree,
    isCiFlowFocusPanelOpen,
    isDetailedTileFilterActive,
    isDetailedTopologyOpen
  ]);


  const zoomBy = (factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const viewState = topologyCanvasViewStateRef.current;
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const worldX = (centerX - viewState.offsetX) / Math.max(viewState.zoom, 0.0001);
    const worldY = (centerY - viewState.offsetY) / Math.max(viewState.zoom, 0.0001);
    viewState.zoom = Number(Math.min(2.6, Math.max(0.2, viewState.zoom * factor)).toFixed(4));
    viewState.offsetX = centerX - worldX * viewState.zoom;
    viewState.offsetY = centerY - worldY * viewState.zoom;
    viewState.initialized = true;
  };

  const resetView = () => {
    manualNodePositionsRef.current = new Map();
    persistedNodePositionsRef.current = new Map();
    nodePositionsDirtyRef.current = true;
    centerViewportScroll();
  };

  const registerTileRef =
    (nodeId: string) =>
    (element: HTMLDivElement | null): void => {
      tileRefs.current[nodeId] = element;
    };

  const registerDetailedTileRef =
    (nodeId: string) =>
    (element: HTMLDivElement | null): void => {
      detailedTileRefs.current[nodeId] = element;
    };

  const dragDetailedRuntimeNodeByScreenDelta = (nodeId: string, deltaX: number, deltaY: number) => {
    const camera = detailedCameraRef.current;
    const viewport = detailedViewportRef.current;
    const runtimeNode = detailedRuntimeNodesRef.current.get(nodeId);
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
    detailedManualNodePositionsRef.current.set(nodeId, runtimeNode.currentPosition.clone());
    detailedPersistedNodePositionsRef.current.set(nodeId, runtimeNode.currentPosition.clone());
    detailedNodePositionsDirtyRef.current = true;
  };

  const selectDetailedGraphNode = (nodeId: string) => {
    if (!detailedDisplayNodeById.has(nodeId)) {
      return;
    }
    if (isCiFlowFocusPanelOpen) {
      setSelectedCiFlowNodeId(nodeId);
    } else {
      setDetailedSelectedNodeId(nodeId);
    }
    if (isDetailedTileFilterActive) {
      setDetailedSelectedTileFilterId(nodeId);
    }
  };

  const beginDetailedNodeDrag =
    (nodeId: string) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType !== "touch") {
        return;
      }
      if (isCiFlowFocusPanelOpen && ciFlowTweenProgressRef.current < 0.98) {
        return;
      }
      selectDetailedGraphNode(nodeId);
      detailedDragStateRef.current = {
        nodeId,
        pointerId: event.pointerId,
        lastClientX: event.clientX,
        lastClientY: event.clientY
      };
      setDraggingDetailedNodeId(nodeId);
      if (detailedControlsRef.current) {
        detailedControlsRef.current.enabled = false;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    };

  const moveDetailedNodeDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = detailedDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - dragState.lastClientX;
    const deltaY = event.clientY - dragState.lastClientY;
    dragDetailedRuntimeNodeByScreenDelta(dragState.nodeId, deltaX, deltaY);
    dragState.lastClientX = event.clientX;
    dragState.lastClientY = event.clientY;
    suppressDetailedNodeClickRef.current = true;
    event.preventDefault();
    event.stopPropagation();
  };

  const endDetailedNodeDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = detailedDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    detailedDragStateRef.current = null;
    setDraggingDetailedNodeId(null);
    if (detailedControlsRef.current) {
      detailedControlsRef.current.enabled = true;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (detailedNodeClickSuppressTimerRef.current !== null) {
      window.clearTimeout(detailedNodeClickSuppressTimerRef.current);
    }
    detailedNodeClickSuppressTimerRef.current = window.setTimeout(() => {
      suppressDetailedNodeClickRef.current = false;
      detailedNodeClickSuppressTimerRef.current = null;
    }, 0);
    event.preventDefault();
    event.stopPropagation();
  };

  const dragRuntimeNodeByScreenDelta = (nodeId: string, deltaX: number, deltaY: number) => {
    const viewState = topologyCanvasViewStateRef.current;
    const layoutNode = topologyRenderNodeById.get(nodeId);
    if (!layoutNode || !viewState.zoom) {
      return;
    }

    const worldDeltaX = deltaX / Math.max(viewState.zoom, 0.0001);
    const worldDeltaY = deltaY / Math.max(viewState.zoom, 0.0001);
    const current =
      manualNodePositionsRef.current.get(nodeId)?.clone() ??
      persistedNodePositionsRef.current.get(nodeId)?.clone() ??
      layoutNode.position.clone();
    current.x += worldDeltaX;
    current.y += worldDeltaY;
    manualNodePositionsRef.current.set(nodeId, current.clone());
    persistedNodePositionsRef.current.set(nodeId, current.clone());
    nodePositionsDirtyRef.current = true;
  };

  const beginTileDrag =
    (nodeId: string) =>
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      const targetElement = event.target instanceof Element ? event.target : null;
      if (
        targetElement?.closest(
          "button,input,select,textarea,a,label,[role='button'],[data-no-drag='true']"
        )
      ) {
        return;
      }
      const isAxisLockedNode = nodeId === coreNode?.id || isNetworkModelOverlayNodeId(nodeId);
      if (isAxisLockedNode) {
        if (isTileFilterActive) {
          setSelectedTileFilterId(nodeId);
        }
        setSelectedNodeId(nodeId);
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

  const stopCiFlowTween = useCallback(() => {
    if (ciFlowTweenFrameRef.current !== null) {
      window.cancelAnimationFrame(ciFlowTweenFrameRef.current);
      ciFlowTweenFrameRef.current = null;
    }
  }, []);

  const animateCiFlowTween = useCallback((
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
  }, [stopCiFlowTween]);

  const openCiFlowFocusForNode = useCallback((node: DetailedTreeNode) => {
    if (node.entityType !== "ci" || !node.ciAssetId) {
      return;
    }

    ciFlow3DViewStateRef.current = createDefaultCiFlow3DViewState();
    setFocusedCiFlowRootAssetId(node.ciAssetId);
    setSelectedCiFlowNodeId(ciFlowNodeIdForAsset(node.ciAssetId));
    setDraggingCiFlowNodeId(null);
    setDraggingDetailedNodeId(null);
    setCiFlowNodeDragOffsets({});
    setDetailedSelectedTileFilterId("__all__");
    setDetailedTileFilterSearchText("");
    detailedPersistedCameraStateRef.current = null;
    detailedPersistedNodePositionsRef.current = new Map();
    detailedManualNodePositionsRef.current = new Map();
    detailedZoomBeforeCiFlowRef.current = detailedZoom;
    setDetailedZoom(CI_FLOW_3D_DEFAULT_ZOOM);
    ciFlowAutoFitPendingRef.current = true;
    ciFlowNodeDragStateRef.current = null;
    ciFlowNodeDragOffsetsRef.current = {};
    ciFlowPinnedRootScreenPositionRef.current = null;
    setCiFlowOriginCenter({ x: node.x + node.width / 2, y: node.y + node.height / 2 });
    setCiFlowViewportCenter(null);
    setCiFlowTweenProgress(0);
    window.requestAnimationFrame(() => {
      animateCiFlowTween(0, 1, 520);
    });
  }, [animateCiFlowTween, detailedZoom]);
  const openCiFlowFocusForAssetId = useCallback(
    (assetId: string) => {
      const node = detailedTree?.nodes.find((item) => item.entityType === "ci" && item.ciAssetId === assetId);
      if (node) {
        openCiFlowFocusForNode(node);
      }
    },
    [detailedTree?.nodes, openCiFlowFocusForNode]
  );

  const closeCiFlowFocus = () => {
    if (!focusedCiFlowRootAssetId) {
      return;
    }
    const from = ciFlowTweenProgress;
    animateCiFlowTween(from, 0, 320, () => {
      setFocusedCiFlowRootAssetId(null);
      setSelectedCiFlowNodeId(null);
      setDraggingCiFlowNodeId(null);
      setDraggingDetailedNodeId(null);
      setCiFlowNodeDragOffsets({});
      setCiFlowOriginCenter(null);
      setCiFlowViewportCenter(null);
      setCiFlowTweenProgress(0);
      ciFlowAutoFitPendingRef.current = false;
      ciFlowNodeDragStateRef.current = null;
      ciFlowNodeDragOffsetsRef.current = {};
      ciFlowPinnedRootScreenPositionRef.current = null;
      detailedPersistedCameraStateRef.current = null;
      detailedPersistedNodePositionsRef.current = new Map();
      detailedManualNodePositionsRef.current = new Map();
      if (detailedZoomBeforeCiFlowRef.current !== null) {
        setDetailedZoom(detailedZoomBeforeCiFlowRef.current);
        detailedZoomBeforeCiFlowRef.current = null;
      }
    });
  };

  const resolveBaseTopologyNodeId = (nodeId: string) => {
    if (nodeById.has(nodeId)) {
      return nodeId;
    }
    const renderNode = topologyRenderNodeById.get(nodeId);
    if (!renderNode) {
      return null;
    }
    const mappedNode = layout.nodes.find(
      (node) => node.entityType === renderNode.entityType && node.entityId === renderNode.entityId
    );
    return mappedNode?.id ?? null;
  };

  const openDetailsPanelForNode = (nodeId: string) => {
    const resolvedNodeId = resolveBaseTopologyNodeId(nodeId);
    if (!resolvedNodeId) {
      return;
    }
    setSelectedDetailNodeId(resolvedNodeId);
    setSelectedSystemId(null);
  };

  const openDetailedTopologyForNode = (nodeId: string) => {
    const resolvedNodeId = resolveBaseTopologyNodeId(nodeId);
    if (!resolvedNodeId) {
      return;
    }
    const node = nodeById.get(resolvedNodeId);
    if (!node) {
      return;
    }
    setDetailedRootNodeId(node.id);
    setDetailedSelectedTileFilterId("__all__");
    setDetailedTileFilterSearchText("");
    setIsDetailedTileSearchFocused(false);
    setDetailedZoom(1);
    ciFlow3DViewStateRef.current = createDefaultCiFlow3DViewState();
    setFocusedCiFlowRootAssetId(null);
    setSelectedCiFlowNodeId(null);
    setDraggingCiFlowNodeId(null);
    setDraggingDetailedNodeId(null);
    setCiFlowNodeDragOffsets({});
    setCiFlowOriginCenter(null);
    setCiFlowViewportCenter(null);
    setCiFlowTweenProgress(0);
    ciFlowAutoFitPendingRef.current = false;
    detailedZoomBeforeCiFlowRef.current = null;
    ciFlowNodeDragStateRef.current = null;
    ciFlowNodeDragOffsetsRef.current = {};
    ciFlowPinnedRootScreenPositionRef.current = null;
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
    detailedDragStateRef.current = null;
    suppressDetailedNodeClickRef.current = false;
    if (detailedControlsRef.current) {
      detailedControlsRef.current.enabled = true;
    }
    detailedPersistedCameraStateRef.current = null;
    detailedPersistedNodePositionsRef.current = new Map();
    detailedManualNodePositionsRef.current = new Map();
    setIsDetailedTopologyOpen(true);
    setDetailedSelectedTileFilterId("__all__");
    setDetailedTileFilterSearchText("");
    setIsDetailedTileSearchFocused(false);
    setDetailedZoom(1);
    ciFlow3DViewStateRef.current = createDefaultCiFlow3DViewState();
    setFocusedCiFlowRootAssetId(null);
    setSelectedCiFlowNodeId(null);
    setDraggingCiFlowNodeId(null);
    setDraggingDetailedNodeId(null);
    setCiFlowNodeDragOffsets({});
    setCiFlowOriginCenter(null);
    setCiFlowViewportCenter(null);
    setCiFlowTweenProgress(0);
    ciFlowAutoFitPendingRef.current = false;
    detailedZoomBeforeCiFlowRef.current = null;
    ciFlowNodeDragStateRef.current = null;
    ciFlowNodeDragOffsetsRef.current = {};
    ciFlowPinnedRootScreenPositionRef.current = null;
    onClose();
  };

  const selectDetailedTileFilter = (nextId: string) => {
    setDetailedSelectedTileFilterId(nextId);
    if (nextId !== "__all__") {
      if (isCiFlowFocusPanelOpen && ciFlowGraph) {
        setSelectedCiFlowNodeId(nextId);
      } else {
        setDetailedSelectedNodeId(nextId);
      }
    } else {
      setDetailedTileFilterSearchText("");
    }
    setIsDetailedTileSearchFocused(false);
  };

  const toggleCiFlowIncludedDependencyType = (dependencyType: CiFlowRelationshipType) => {
    setCiFlowIncludedDependencyTypes((current) => {
      const next = new Set(current);
      if (next.has(dependencyType)) {
        next.delete(dependencyType);
      } else {
        next.add(dependencyType);
      }
      return next;
    });
    setDetailedSelectedTileFilterId("__all__");
  };

  const handleCiAnalyserSelectedNodeChange = useCallback(
    (node: ImpactAnalyser2SelectedNode | null) => {
      if (!isCiFlowFocusPanelOpen) {
        return;
      }
      if (!node) {
        setSelectedCiFlowNodeId(null);
        return;
      }
      if (node.axisKey !== "asset" && node.axisKey !== "relatedAsset") {
        return;
      }
      const nextNodeId = ciFlowNodeIdForAsset(node.value);
      if (ciFlowNodeById.has(nextNodeId)) {
        setSelectedCiFlowNodeId(nextNodeId);
        return;
      }
      if (node.axisKey === "asset" && ciFlowRootNodeId) {
        setSelectedCiFlowNodeId(ciFlowRootNodeId);
        return;
      }
      setSelectedCiFlowNodeId(null);
    },
    [ciFlowNodeById, ciFlowRootNodeId, isCiFlowFocusPanelOpen]
  );

  const clearDetailedTileSearchSelection = () => {
    setDetailedSelectedTileFilterId("__all__");
    setDetailedTileFilterSearchText("");
    setIsDetailedTileSearchFocused(false);
    if (isCiFlowFocusPanelOpen) {
      return;
    }
    if (detailedTree?.rootNodeId) {
      setDetailedSelectedNodeId(detailedTree.rootNodeId);
    }
  };

  const zoomDetailedBy = (factor: number) => {
    if (isCiFlowFocusPanelOpen) {
      const flow3D = ciFlow3DViewStateRef.current;
      flow3D.zoom = Number(Math.max(0.3, Math.min(3.4, flow3D.zoom * factor)).toFixed(4));
      setDetailedZoom(flow3D.zoom);
      detailedCanvasRequestDrawRef.current?.();
      return;
    }
    const viewport = detailedViewportRef.current;
    if (!viewport) {
      return;
    }
    const viewState = detailedCanvasViewStateRef.current;
    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const worldX = (centerX - viewState.offsetX) / Math.max(viewState.zoom, 0.0001);
    const worldY = (centerY - viewState.offsetY) / Math.max(viewState.zoom, 0.0001);
    const nextZoom = Number(Math.max(0.22, Math.min(3.8, viewState.zoom * factor)).toFixed(4));
    viewState.zoom = nextZoom;
    viewState.offsetX = centerX - worldX * nextZoom;
    viewState.offsetY = centerY - worldY * nextZoom;
    setDetailedZoom(nextZoom);
    detailedCanvasRequestDrawRef.current?.();
  };

  const resetDetailedTopologyView = () => {
    const viewState = detailedCanvasViewStateRef.current;
    viewState.initialized = false;
    detailedCanvasNodeOffsetsRef.current = {};
    if (isCiFlowFocusPanelOpen) {
      setCiFlowNodeDragOffsets({});
      ciFlow3DViewStateRef.current = createDefaultCiFlow3DViewState();
      setDetailedZoom(CI_FLOW_3D_DEFAULT_ZOOM);
    } else {
      setDetailedZoom(1);
    }
    if (isCiFlowFocusPanelOpen && ciFlowRootNodeId) {
      setDetailedSelectedTileFilterId("__all__");
      setSelectedCiFlowNodeId(ciFlowRootNodeId);
    } else if (detailedTree?.rootNodeId) {
      setDetailedSelectedNodeId(detailedTree.rootNodeId);
    }
    detailedCanvasRequestDrawRef.current?.();
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

  const beginCiFlowNodeDrag =
    (nodeId: string) =>
    (event: ReactPointerEvent<SVGGElement>) => {
      if (event.button !== 0 && event.pointerType !== "touch") {
        return;
      }
      if (!isCiFlowFocusPanelOpen || ciFlowTweenProgress < 0.98) {
        return;
      }
      if (nodeId === ciFlowRootNodeId) {
        return;
      }
      const currentOffset = ciFlowNodeDragOffsetsRef.current[nodeId] ?? { x: 0, y: 0 };
      ciFlowNodeDragStateRef.current = {
        nodeId,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startOffsetX: currentOffset.x,
        startOffsetY: currentOffset.y,
        moved: false
      };
      setDraggingCiFlowNodeId(nodeId);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.stopPropagation();
      event.preventDefault();
    };

  const moveCiFlowNodeDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const dragState = ciFlowNodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    if (dragState.nodeId === ciFlowRootNodeId) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;
    if (!dragState.moved && (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2)) {
      dragState.moved = true;
      suppressDetailedNodeClickRef.current = true;
    }
    const nextOffset = {
      x: dragState.startOffsetX + deltaX / Math.max(detailedZoom, 0.0001),
      y: dragState.startOffsetY + deltaY / Math.max(detailedZoom, 0.0001)
    };
    setCiFlowNodeDragOffsets((current) => ({
      ...current,
      [dragState.nodeId]: nextOffset
    }));
    event.stopPropagation();
    event.preventDefault();
  };

  const endCiFlowNodeDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const dragState = ciFlowNodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    ciFlowNodeDragStateRef.current = null;
    setDraggingCiFlowNodeId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragState.moved) {
      suppressDetailedNodeClickRef.current = true;
      if (detailedNodeClickSuppressTimerRef.current !== null) {
        window.clearTimeout(detailedNodeClickSuppressTimerRef.current);
      }
      detailedNodeClickSuppressTimerRef.current = window.setTimeout(() => {
        suppressDetailedNodeClickRef.current = false;
        detailedNodeClickSuppressTimerRef.current = null;
      }, 0);
    }
    event.stopPropagation();
    event.preventDefault();
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

  const detailedZoomPercent = Math.round(detailedZoom * 100);
  const ciFlowRootTile = ciFlowRootNodeId ? ciFlowNodeById.get(ciFlowRootNodeId) ?? null : null;
  const rootCiFlowFocusNode = isCiFlowFocusPanelOpen ? ciFlowRootTile : null;
  const rootCiFlowFocusCompliance = rootCiFlowFocusNode
    ? complianceMode === "cyber"
      ? rootCiFlowFocusNode.cyberCompliance
      : rootCiFlowFocusNode.discoveryCompliance
    : null;
  const rootCiFlowFocusPercentages = rootCiFlowFocusCompliance
    ? compliancePercentages(rootCiFlowFocusCompliance)
    : null;
  const selectedCiFlowFocusNode =
    isCiFlowFocusPanelOpen && selectedCiFlowNodeId
      ? ciFlowNodeById.get(selectedCiFlowNodeId) ?? null
      : null;
  const selectedCiFlowFocusCompliance = selectedCiFlowFocusNode
    ? complianceMode === "cyber"
      ? selectedCiFlowFocusNode.cyberCompliance
      : selectedCiFlowFocusNode.discoveryCompliance
    : null;
  const selectedCiFlowFocusPercentages = selectedCiFlowFocusCompliance
    ? compliancePercentages(selectedCiFlowFocusCompliance)
    : null;
  const rootCiFlowModelContextTile = useMemo<{
    id: string;
    entityType: DetailedTileEntityType;
    typeLabel: string;
    name: string;
    subtitle: string;
    borderColor: string;
    percentages: { compliant: number; nonCompliant: number; other: number };
  } | null>(() => {
    if (!isCiFlowFocusPanelOpen || !detailedRootNode) {
      return null;
    }
    if (detailedRootNode.entityType !== "ict-system" && detailedRootNode.entityType !== "network") {
      return null;
    }
    const isIctModel = detailedRootNode.entityType === "ict-system";
    const compliance =
      complianceMode === "cyber" ? detailedRootNode.cyberCompliance : detailedRootNode.discoveryCompliance;
    return {
      id: isIctModel
        ? `ci-flow-model:ict:${detailedRootNode.entityId}`
        : `ci-flow-model:network:${detailedRootNode.entityId}`,
      entityType: detailedRootNode.entityType,
      typeLabel: isIctModel ? "ICT System Model" : "Network Model",
      name: detailedRootNode.name,
      subtitle: "Root Model Context",
      borderColor: isIctModel ? "#fb923c" : "#facc15",
      percentages: compliancePercentages(compliance)
    };
  }, [complianceMode, detailedRootNode, isCiFlowFocusPanelOpen]);
  const selectedDetailedCanvasTileText = useMemo<{
    typeLine: string;
    nameLine: string;
    detailLine: string;
    scoreLine: string;
    fullText: string;
  } | null>(() => {
    if (isCiFlowFocusPanelOpen || !detailedSelectedNodeId) {
      return null;
    }
    const selectedTreeNode = detailedNodeById.get(detailedSelectedNodeId);
    if (selectedTreeNode) {
      const compliance = complianceMode === "cyber" ? selectedTreeNode.cyberCompliance : selectedTreeNode.discoveryCompliance;
      const percentages = compliancePercentages(compliance);
      const typeLine = `Type: ${detailedEntityTypeLabel(selectedTreeNode.entityType)}`;
      const nameLine = `Name: ${selectedTreeNode.name}`;
      const detailLine = selectedTreeNode.subtitle;
      const scoreLine = `${percentages.compliant}% C | ${percentages.nonCompliant}% NC | ${percentages.other}% O`;
      return {
        typeLine,
        nameLine,
        detailLine,
        scoreLine,
        fullText: [typeLine, nameLine, detailLine, scoreLine].join("\n")
      };
    }
    const overlayTile = detailedModelOverlay.tiles.find((tile) => tile.id === detailedSelectedNodeId);
    if (!overlayTile) {
      return null;
    }
    const compliance = complianceMode === "cyber" ? overlayTile.cyberCompliance : overlayTile.discoveryCompliance;
    const percentages = compliancePercentages(compliance);
    const typeLine = `Type: ${overlayTile.typeLabel}`;
    const nameLine = `Name: ${overlayTile.name}`;
    const detailLine = overlayTile.subtitle;
    const scoreLine = `${percentages.compliant}% C | ${percentages.nonCompliant}% NC | ${percentages.other}% O`;
    return {
      typeLine,
      nameLine,
      detailLine,
      scoreLine,
      fullText: [typeLine, nameLine, detailLine, scoreLine].join("\n")
    };
  }, [
    complianceMode,
    detailedModelOverlay.tiles,
    detailedNodeById,
    detailedSelectedNodeId,
    isCiFlowFocusPanelOpen
  ]);
  const copySelectedDetailedTileText = useCallback(async () => {
    if (!selectedDetailedCanvasTileText) {
      return;
    }
    const copyWithFallback = (value: string) => {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      } finally {
        textarea.remove();
      }
      return copied;
    };
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selectedDetailedCanvasTileText.fullText);
      } else if (!copyWithFallback(selectedDetailedCanvasTileText.fullText)) {
        throw new Error("Clipboard write failed");
      }
      setDetailedTileCopyFeedback("copied");
    } catch {
      const copied = copyWithFallback(selectedDetailedCanvasTileText.fullText);
      setDetailedTileCopyFeedback(copied ? "copied" : "failed");
    }
  }, [selectedDetailedCanvasTileText]);
  const presentedDetailedNodes = useMemo<DetailedDisplayNode[]>(() => {
    if (isCiFlowFocusPanelOpen) {
      return detailedDisplayNodes.filter((node) => detailedFilteredNodeIds.has(node.id));
    }
    if (!isDetailedTileFilterActive) {
      return detailedDisplayNodes;
    }
    return detailedDisplayNodes.filter((node) => detailedFilteredNodeIds.has(node.id));
  }, [detailedDisplayNodes, detailedFilteredNodeIds, isCiFlowFocusPanelOpen, isDetailedTileFilterActive]);
  const presentedDetailedNodeIdSet = useMemo(() => {
    return new Set(presentedDetailedNodes.map((node) => node.id));
  }, [presentedDetailedNodes]);
  const presentedDetailedEdges = useMemo<DetailedDisplayEdge[]>(() => {
    if (isCiFlowFocusPanelOpen) {
      return detailedDisplayEdges.filter(
        (edge) =>
          presentedDetailedNodeIdSet.has(edge.fromNodeId) &&
          presentedDetailedNodeIdSet.has(edge.toNodeId)
      );
    }
    return detailedDisplayEdges.filter(
      (edge) => presentedDetailedNodeIdSet.has(edge.fromNodeId) && presentedDetailedNodeIdSet.has(edge.toNodeId)
    );
  }, [
    detailedDisplayEdges,
    isCiFlowFocusPanelOpen,
    presentedDetailedNodeIdSet
  ]);
  const exportDetailedTopologyCsv = useCallback(() => {
    if (!presentedDetailedNodes.length) {
      return;
    }
    const headers = [
      "Record Type",
      "ID",
      "Entity Type",
      "Type Label",
      "Name",
      "Subtitle",
      "Model Label",
      "From Node ID",
      "To Node ID",
      "Dependency Type",
      "X",
      "Y",
      "Z",
      "Width",
      "Height"
    ];
    const nodeRows = presentedDetailedNodes.map((node) => {
      const typeLabel = "typeLabel" in node ? node.typeLabel : detailedEntityTypeLabel(node.entityType);
      const modelLabel = "modelLabel" in node ? node.modelLabel : "";
      const z = "z" in node ? node.z : 0;
      return [
        "Node",
        node.id,
        node.entityType,
        typeLabel,
        node.name,
        node.subtitle,
        modelLabel,
        "",
        "",
        "",
        node.x,
        node.y,
        z,
        node.width,
        node.height
      ];
    });
    const edgeRows = presentedDetailedEdges.map((edge) => {
      const dependencyType = "dependencyType" in edge ? edge.dependencyType : "Topology Link";
      return [
        "Edge",
        edge.id,
        "",
        "",
        "",
        "",
        "",
        edge.fromNodeId,
        edge.toNodeId,
        dependencyType,
        "",
        "",
        "",
        "",
        ""
      ];
    });
    const csv = [headers, ...nodeRows, ...edgeRows]
      .map((row) => row.map((value) => csvCell(value)).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const scopeName = isCiFlowFocusPanelOpen
      ? (ciFlowRootTile?.name ?? "ci-flow-focus")
      : (detailedRootNode?.name ?? "detailed-topology");
    const filePrefix = isCiFlowFocusPanelOpen ? "ci-flow-focus" : "detailed-topology";
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filePrefix}-${safeCsvFilenameSegment(scopeName)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }, [ciFlowRootTile?.name, detailedRootNode?.name, isCiFlowFocusPanelOpen, presentedDetailedEdges, presentedDetailedNodes]);
  const exportDetailedTopologySvg = useCallback(() => {
    if (!presentedDetailedNodes.length) {
      return;
    }
    const presentedNodeIdSet = new Set(presentedDetailedNodes.map((node) => node.id));
    const overlayExportLinks =
      !isCiFlowFocusPanelOpen && detailedModelOverlay.tiles.length
        ? detailedModelOverlay.links.filter((link) => presentedNodeIdSet.has(link.ciNodeId))
        : [];
    const overlayExportTileIdSet = new Set(overlayExportLinks.map((link) => link.tileId));
    const overlayExportTiles =
      !isCiFlowFocusPanelOpen && detailedModelOverlay.tiles.length
        ? detailedModelOverlay.tiles.filter((tile) => overlayExportTileIdSet.has(tile.id))
        : [];

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const node of presentedDetailedNodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }
    for (const tile of overlayExportTiles) {
      minX = Math.min(minX, tile.x);
      minY = Math.min(minY, tile.y);
      maxX = Math.max(maxX, tile.x + tile.width);
      maxY = Math.max(maxY, tile.y + tile.height);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return;
    }
    const pad = isCiFlowFocusPanelOpen ? 260 : 100;
    const offsetX = pad - minX;
    const offsetY = pad - minY;
    const svgWidth = Math.max(1, Math.ceil(maxX - minX + pad * 2));
    const svgHeight = Math.max(1, Math.ceil(maxY - minY + pad * 2));
    const n = (value: number) => Number(value.toFixed(2));
    const focusedNodeIds = detailedCiSelectionFocus?.linkedNodeIds;
    const focusedTreeEdgeIds = detailedCiSelectionFocus?.linkedTreeEdgeIds;
    const focusedOverlayTileIds = detailedCiSelectionFocus?.linkedOverlayTileIds;
    const focusedOverlayLinkKeys = detailedCiSelectionFocus?.linkedOverlayLinkKeys;
    const nodeBoundsById = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const node of presentedDetailedNodes) {
      nodeBoundsById.set(node.id, {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height
      });
    }
    for (const tile of overlayExportTiles) {
      nodeBoundsById.set(tile.id, {
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height
      });
    }

    const edgeElements = presentedDetailedEdges
      .map((edge) => {
        const fromNode = nodeBoundsById.get(edge.fromNodeId);
        const toNode = nodeBoundsById.get(edge.toNodeId);
        if (!fromNode || !toNode) {
          return null;
        }
        if (isCiFlowFocusPanelOpen) {
          const x1 = n(fromNode.x + fromNode.width / 2 + offsetX);
          const y1 = n(fromNode.y + fromNode.height / 2 + offsetY);
          const x2 = n(toNode.x + toNode.width / 2 + offsetX);
          const y2 = n(toNode.y + toNode.height / 2 + offsetY);
          const stroke = "dependencyType" in edge ? ciFlowDependencyColor(edge.dependencyType) : "#38bdf8";
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-opacity="0.82" stroke-width="2.6" stroke-linecap="round" />`;
        }
        const curve = detailedEdgeCurvePoints(fromNode, toNode);
        const isPathEdge = detailedSelectedPathEdgeIds.has(edge.id);
        const isConnectedEdge = detailedSelectedConnectedEdgeIds.has(edge.id);
        const stroke = isPathEdge ? "#9333ea" : isConnectedEdge ? "#eab308" : "#38bdf8";
        const strokeWidth = isPathEdge ? 3.6 : isConnectedEdge ? 3 : 2;
        const edgeBaseOpacity = isPathEdge || isConnectedEdge ? 0.94 : 0.58;
        const isFocusedTreeEdge = focusedTreeEdgeIds?.has(edge.id) ?? false;
        const edgeOpacity = detailedCiSelectionFocus && !isFocusedTreeEdge ? edgeBaseOpacity * 0.2 : edgeBaseOpacity;
        const d = [
          `M ${n(curve.startX + offsetX)} ${n(curve.startY + offsetY)}`,
          `C ${n(curve.control1X + offsetX)} ${n(curve.control1Y + offsetY)},`,
          `${n(curve.control2X + offsetX)} ${n(curve.control2Y + offsetY)},`,
          `${n(curve.endX + offsetX)} ${n(curve.endY + offsetY)}`
        ].join(" ");
        return `<path d="${d}" fill="none" stroke="${stroke}" stroke-opacity="${n(edgeOpacity)}" stroke-width="${strokeWidth}" stroke-linecap="round" />`;
      })
      .filter((element): element is string => Boolean(element))
      .join("\n");
    const overlayEdgeElements = overlayExportLinks
      .map((link) => {
        const fromNode = nodeBoundsById.get(link.ciNodeId);
        const toNode = nodeBoundsById.get(link.tileId);
        if (!fromNode || !toNode) {
          return null;
        }
        const startX = fromNode.x + fromNode.width + offsetX;
        const startY = fromNode.y + fromNode.height / 2 + offsetY;
        const endX = toNode.x + offsetX;
        const endY = toNode.y + toNode.height / 2 + offsetY;
        const controlOffset = Math.max(44, (endX - startX) * 0.28);
        const d = [
          `M ${n(startX)} ${n(startY)}`,
          `C ${n(startX + controlOffset)} ${n(startY)},`,
          `${n(endX - controlOffset)} ${n(endY)},`,
          `${n(endX)} ${n(endY)}`
        ].join(" ");
        const stroke = link.kind === "shared-resource" ? "#ef4444" : "#f97316";
        const linkKey = `${link.ciNodeId}|${link.tileId}|${link.kind}`;
        const isFocusedOverlayLink = focusedOverlayLinkKeys?.has(linkKey) ?? false;
        const linkOpacity = detailedCiSelectionFocus && !isFocusedOverlayLink ? 0.172 : 0.86;
        return `<path d="${d}" fill="none" stroke="${stroke}" stroke-opacity="${n(linkOpacity)}" stroke-width="2.2" stroke-linecap="round" />`;
      })
      .filter((element): element is string => Boolean(element))
      .join("\n");

    const nodeElements = presentedDetailedNodes
      .map((node) => {
        const isRootNode = node.id === detailedDisplayRootNodeId;
        const isSelectedNode = node.id === detailedDisplaySelectedNodeId;
        const x = n(node.x + offsetX);
        const y = n(node.y + offsetY);
        const width = n(node.width);
        const height = n(node.height);
        const compliance = complianceMode === "cyber" ? node.cyberCompliance : node.discoveryCompliance;
        const percentages = compliancePercentages(compliance);
        if (isCiFlowFocusPanelOpen) {
          const cx = n(node.x + node.width / 2 + offsetX);
          const cy = n(node.y + node.height / 2 + offsetY);
          const baseRadius = 32;
          const isRootCi = node.entityType === "ci" && node.id === ciFlowRootNodeId;
          const isInModelScope = "isInModelScope" in node ? node.isInModelScope : false;
          const stroke = isRootCi ? "#a855f7" : ciFlowNodeStrokeColor(node.entityType, isInModelScope);
          const fill = isRootCi ? "#c084fc" : isInModelScope ? "#4ade80" : "#f87171";
          const assetType = "assetType" in node ? (node.assetType ?? "server") : "server";
          const typeLabel = xmlEscape("typeLabel" in node ? node.typeLabel : detailedEntityTypeLabel(node.entityType));
          const nameLabel = xmlEscape(truncateLabel(node.name, 34));
          const detailLine = xmlEscape(
            truncateLabel(("modelLabel" in node ? node.modelLabel : node.subtitle) || "", 38)
          );
          const cardWidth = 198;
          const cardHeight = 88;
          let cardX = cx + baseRadius + 12;
          if (cardX + cardWidth + 8 > svgWidth) {
            cardX = cx - baseRadius - 12 - cardWidth;
          }
          const cardY = cy - cardHeight / 2;
          const barX = n(cardX + 10);
          const barY = n(cardY + 60);
          const barWidth = 178;
          const barHeight = 8;
          let shape = "";
          if (assetType === "workstation") {
            const size = baseRadius * 1.9;
            const half = size / 2;
            shape = `<rect x="${n(cx - half)}" y="${n(cy - half)}" width="${n(size)}" height="${n(size)}" fill="${fill}" fill-opacity="0.92" stroke="${stroke}" stroke-width="2.6" rx="6" />`;
          } else if (assetType === "network-device") {
            const h = baseRadius * 2;
            const halfBase = baseRadius;
            const p1 = `${n(cx)} ${n(cy - h * 0.55)}`;
            const p2 = `${n(cx - halfBase)} ${n(cy + h * 0.45)}`;
            const p3 = `${n(cx + halfBase)} ${n(cy + h * 0.45)}`;
            shape = `<polygon points="${p1} ${p2} ${p3}" fill="${fill}" fill-opacity="0.92" stroke="${stroke}" stroke-width="2.6" />`;
          } else if (assetType === "storage-device") {
            const halfWidth = baseRadius * 1.05;
            const halfHeight = baseRadius * 0.9;
            const points = [
              `${n(cx)} ${n(cy - halfHeight)}`,
              `${n(cx + halfWidth)} ${n(cy)}`,
              `${n(cx)} ${n(cy + halfHeight)}`,
              `${n(cx - halfWidth)} ${n(cy)}`
            ];
            shape = `<polygon points="${points.join(" ")}" fill="${fill}" fill-opacity="0.92" stroke="${stroke}" stroke-width="2.6" />`;
          } else if (assetType === "printer-device") {
            const halfWidth = baseRadius * 1.05;
            const points = [
              `${n(cx - halfWidth)} ${n(cy - baseRadius * 0.05)}`,
              `${n(cx - halfWidth * 0.7)} ${n(cy - baseRadius * 0.85)}`,
              `${n(cx + halfWidth * 0.7)} ${n(cy - baseRadius * 0.85)}`,
              `${n(cx + halfWidth)} ${n(cy - baseRadius * 0.05)}`,
              `${n(cx + halfWidth * 0.72)} ${n(cy + baseRadius * 0.9)}`,
              `${n(cx - halfWidth * 0.72)} ${n(cy + baseRadius * 0.9)}`
            ];
            shape = `<polygon points="${points.join(" ")}" fill="${fill}" fill-opacity="0.92" stroke="${stroke}" stroke-width="2.6" />`;
          } else if (assetType === "other") {
            const halfWidth = baseRadius * 1.08;
            const points = [
              `${n(cx)} ${n(cy - baseRadius * 0.95)}`,
              `${n(cx + halfWidth)} ${n(cy - baseRadius * 0.2)}`,
              `${n(cx + halfWidth * 0.62)} ${n(cy + baseRadius * 0.85)}`,
              `${n(cx - halfWidth * 0.62)} ${n(cy + baseRadius * 0.85)}`,
              `${n(cx - halfWidth)} ${n(cy - baseRadius * 0.2)}`
            ];
            shape = `<polygon points="${points.join(" ")}" fill="${fill}" fill-opacity="0.92" stroke="${stroke}" stroke-width="2.6" />`;
          } else {
            shape = `<circle cx="${cx}" cy="${cy}" r="${baseRadius}" fill="${fill}" fill-opacity="0.92" stroke="${stroke}" stroke-width="2.6" />`;
          }
          return [
            `<g>`,
            shape,
            `<rect x="${n(cardX)}" y="${n(cardY)}" width="${cardWidth}" height="${cardHeight}" rx="10" fill="#0f172a" fill-opacity="0.9" stroke="${stroke}" stroke-width="${isRootCi ? 2.1 : 1.6}" />`,
            `<text x="${n(cardX + 10)}" y="${n(cardY + 20)}" font-size="11" fill="#dbeafe" font-family="sans-serif">Type: ${typeLabel}</text>`,
            `<text x="${n(cardX + 10)}" y="${n(cardY + 36)}" font-size="11" fill="#e2e8f0" font-family="sans-serif">Name: ${nameLabel}</text>`,
            `<text x="${n(cardX + 10)}" y="${n(cardY + 52)}" font-size="10" fill="#94a3b8" font-family="sans-serif">${detailLine}</text>`,
            `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="3" fill="#cbd5e1" fill-opacity="0.8" />`,
            `<rect x="${barX}" y="${barY}" width="${n((barWidth * percentages.compliant) / 100)}" height="${barHeight}" fill="#16a34a" />`,
            `<rect x="${n(barX + (barWidth * percentages.compliant) / 100)}" y="${barY}" width="${n((barWidth * percentages.nonCompliant) / 100)}" height="${barHeight}" fill="#ef4444" />`,
            `<rect x="${n(barX + (barWidth * (percentages.compliant + percentages.nonCompliant)) / 100)}" y="${barY}" width="${n((barWidth * percentages.other) / 100)}" height="${barHeight}" fill="#94a3b8" />`,
            `<text x="${n(cardX + cardWidth / 2)}" y="${n(cardY + 82)}" text-anchor="middle" font-size="9" fill="#cbd5e1" font-family="sans-serif">${percentages.compliant}% C | ${percentages.nonCompliant}% NC | ${percentages.other}% O</text>`,
            `</g>`
          ].join("\n");
        }
        const stroke = isRootNode ? "#ef4444" : isSelectedNode ? "#a855f7" : detailedTileStrokeColor(node.entityType);
        const fill = detailedTileColor(node.entityType);
        const typeLabel = xmlEscape(detailedEntityTypeLabel(node.entityType));
        const nameLabel = xmlEscape(truncateLabel(node.name, 54));
        const detailLine = xmlEscape(
          truncateLabel(("modelLabel" in node && node.modelLabel ? node.modelLabel : node.subtitle) || "", 58)
        );
        const barX = n(x + 14);
        const barY = n(y + height - 16);
        const barWidth = n(Math.max(80, width - 28));
        const barHeight = 8;
        const isFocusedNode = focusedNodeIds?.has(node.id) ?? false;
        const nodeOpacity = detailedCiSelectionFocus && !isFocusedNode ? 0.2 : 1;
        return [
          `<g opacity="${n(nodeOpacity)}">`,
          `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${node.entityType === "ci" ? 12 : 18}" fill="${fill}" stroke="${stroke}" stroke-width="${isRootNode || isSelectedNode ? 3.2 : 2}" />`,
          `<text x="${n(x + 14)}" y="${n(y + 23)}" font-size="12" fill="#0f172a" font-family="sans-serif">Type: ${typeLabel}</text>`,
          `<text x="${n(x + 14)}" y="${n(y + 42)}" font-size="12" fill="#0f172a" font-family="sans-serif">Name: ${nameLabel}</text>`,
          `<text x="${n(x + 14)}" y="${n(y + 60)}" font-size="10" fill="#334155" font-family="sans-serif">${detailLine}</text>`,
          `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="3" fill="#cbd5e1" fill-opacity="0.8" />`,
          `<rect x="${barX}" y="${barY}" width="${n((barWidth * percentages.compliant) / 100)}" height="${barHeight}" fill="#16a34a" />`,
          `<rect x="${n(barX + (barWidth * percentages.compliant) / 100)}" y="${barY}" width="${n((barWidth * percentages.nonCompliant) / 100)}" height="${barHeight}" fill="#ef4444" />`,
          `<rect x="${n(barX + (barWidth * (percentages.compliant + percentages.nonCompliant)) / 100)}" y="${barY}" width="${n((barWidth * percentages.other) / 100)}" height="${barHeight}" fill="#94a3b8" />`,
          `</g>`
        ].join("\n");
      })
      .join("\n");
    const overlayNodeElements = overlayExportTiles
      .map((tile) => {
        const x = n(tile.x + offsetX);
        const y = n(tile.y + offsetY);
        const width = n(tile.width);
        const height = n(tile.height);
        const compliance = complianceMode === "cyber" ? tile.cyberCompliance : tile.discoveryCompliance;
        const percentages = compliancePercentages(compliance);
        const fill = detailedTileColor(tile.entityType);
        const stroke = detailedTileStrokeColor(tile.entityType);
        const typeLabel = xmlEscape(truncateLabel(tile.typeLabel, 54));
        const nameLabel = xmlEscape(truncateLabel(tile.name, 54));
        const detailLine = xmlEscape(truncateLabel(tile.subtitle, 58));
        const barX = n(x + 14);
        const barY = n(y + height - 16);
        const barWidth = n(Math.max(80, width - 28));
        const barHeight = 8;
        const isFocusedOverlayTile = focusedOverlayTileIds?.has(tile.id) ?? false;
        const tileOpacity = detailedCiSelectionFocus && !isFocusedOverlayTile ? 0.2 : 1;
        return [
          `<g opacity="${n(tileOpacity)}">`,
          `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="2.2" />`,
          `<text x="${n(x + 14)}" y="${n(y + 23)}" font-size="12" fill="#0f172a" font-family="sans-serif">Type: ${typeLabel}</text>`,
          `<text x="${n(x + 14)}" y="${n(y + 42)}" font-size="12" fill="#0f172a" font-family="sans-serif">Name: ${nameLabel}</text>`,
          `<text x="${n(x + 14)}" y="${n(y + 60)}" font-size="10" fill="#334155" font-family="sans-serif">${detailLine}</text>`,
          `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="3" fill="#cbd5e1" fill-opacity="0.8" />`,
          `<rect x="${barX}" y="${barY}" width="${n((barWidth * percentages.compliant) / 100)}" height="${barHeight}" fill="#16a34a" />`,
          `<rect x="${n(barX + (barWidth * percentages.compliant) / 100)}" y="${barY}" width="${n((barWidth * percentages.nonCompliant) / 100)}" height="${barHeight}" fill="#ef4444" />`,
          `<rect x="${n(barX + (barWidth * (percentages.compliant + percentages.nonCompliant)) / 100)}" y="${barY}" width="${n((barWidth * percentages.other) / 100)}" height="${barHeight}" fill="#94a3b8" />`,
          `</g>`
        ].join("\n");
      })
      .join("\n");

    const svg = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`,
      `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#020617" />`,
      `<g>`,
      edgeElements,
      `</g>`,
      `<g>`,
      overlayEdgeElements,
      `</g>`,
      `<g>`,
      nodeElements,
      `</g>`,
      `<g>`,
      overlayNodeElements,
      `</g>`,
      `</svg>`
    ].join("\n");

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const scopeName = isCiFlowFocusPanelOpen
      ? (ciFlowRootTile?.name ?? "ci-flow-focus")
      : (detailedRootNode?.name ?? "detailed-topology");
    const filePrefix = isCiFlowFocusPanelOpen ? "ci-flow-focus" : "detailed-topology";
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filePrefix}-${safeCsvFilenameSegment(scopeName)}.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }, [
    ciFlowRootNodeId,
    ciFlowRootTile?.name,
    detailedDisplayRootNodeId,
    detailedDisplaySelectedNodeId,
    detailedCiSelectionFocus,
    detailedRootNode?.name,
    detailedSelectedConnectedEdgeIds,
    detailedSelectedPathEdgeIds,
    complianceMode,
    detailedModelOverlay.links,
    detailedModelOverlay.tiles,
    isCiFlowFocusPanelOpen,
    presentedDetailedEdges,
    presentedDetailedNodes
  ]);
  return (
    <div
      className={`fixed inset-0 z-[1200] transition-transform duration-300 ease-out ${
        isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
      }`}
      aria-hidden={!isOpen}
    >
      <div className="absolute inset-0 bg-slate-950/70" />
      <section className="absolute inset-2 flex flex-col overflow-hidden rounded-2xl border border-sky-300/30 bg-slate-950/95 shadow-[0_26px_90px_rgba(0,0,0,0.65)]">

          {isDetailedTopologyOpen && detailedTree && !isCiFlowFocusPanelOpen ? (
            <aside className="absolute inset-0 z-50 bg-slate-950">
              <div className="flex h-full flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-400/20 px-4 py-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">
                      Detailed Topology View
                    </p>
                    <h3 className="text-base font-semibold text-sky-100">
                      {detailedRootNode?.name ?? "Topology Root"}
                    </h3>
                  </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportDetailedTopologyCsv}
                    disabled={!presentedDetailedNodes.length}
                    className="hidden rounded-md border border-cyan-300/45 bg-cyan-500/14 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 hover:bg-cyan-500/24 disabled:cursor-not-allowed disabled:border-slate-500/45 disabled:bg-slate-900/75 disabled:text-slate-400"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={exportDetailedTopologySvg}
                    disabled={!presentedDetailedNodes.length}
                    className="hidden rounded-md border border-cyan-300/45 bg-cyan-500/14 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 hover:bg-cyan-500/24 disabled:cursor-not-allowed disabled:border-slate-500/45 disabled:bg-slate-900/75 disabled:text-slate-400"
                  >
                    Export SVG
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

              <div className="min-h-0 flex-1 p-2">
                <IctSystemImpactAnalyser2Chart
                  embedded
                  dataPath={impactAnalyserDataPath}
                  findingsPath={impactAnalyserFindingsPath}
                  title={impactAnalyserTitle}
                  headingTooltip={impactAnalyserHeadingTooltip}
                  assetAxisLabel="Assets"
                  assetSearchCategory="Assets"
                  {...(!isSystemImpactAnalyser ? { includeNetworkAxis: true } : {})}
                  showAssetTypeFilter
                  showSelectedTileText
                  spiDefinitions={spiDefinitions}
                  onAssetFocus={openCiFlowFocusForAssetId}
                />
              </div>

              <div className="hidden">
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
                    {isDetailedTileFilterActive ? (
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
                <span className="mx-1 h-5 w-px bg-sky-400/20" />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetailedShowSharedResources((current) => !current)}
                    className={`rounded-md border px-2 py-1 font-semibold ${
                      detailedShowSharedResources
                        ? "border-red-200/80 bg-red-500/20 text-red-100"
                        : "border-slate-500/45 bg-slate-900/65 text-slate-300 hover:border-slate-300/55 hover:text-slate-100"
                    }`}
                  >
                    Shared Resources
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailedShowRelatedModels((current) => !current)}
                    className={`rounded-md border px-2 py-1 font-semibold ${
                      detailedShowRelatedModels
                        ? "border-orange-200/80 bg-orange-500/20 text-orange-100"
                        : "border-slate-500/45 bg-slate-900/65 text-slate-300 hover:border-slate-300/55 hover:text-slate-100"
                    }`}
                  >
                    Related Models
                  </button>
                </div>

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

              <div ref={detailedViewportRef} className="hidden">
                <canvas ref={detailedCanvasRef} className="absolute inset-0 h-full w-full" />
                {!isCiFlowFocusPanelOpen && selectedDetailedCanvasTileText ? (
                  <section
                    className="pointer-events-auto absolute right-4 top-4 z-30 w-[22rem] rounded-2xl border border-sky-300/35 bg-slate-950/92 p-3 text-slate-100 shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
                    data-no-pan="true"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <p className="text-[11px] uppercase tracking-[0.12em] text-sky-100">Selected Tile Text</p>
                    <pre className="mt-2 select-text whitespace-pre-wrap break-words rounded-md border border-slate-700/70 bg-slate-900/70 p-2 text-xs leading-5 text-slate-100">
                      {selectedDetailedCanvasTileText.fullText}
                    </pre>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={copySelectedDetailedTileText}
                        className="rounded-md border border-cyan-300/45 bg-cyan-500/14 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/24"
                      >
                        Copy Text
                      </button>
                      {detailedTileCopyFeedback === "copied" ? (
                        <span className="text-xs text-emerald-200">Copied</span>
                      ) : detailedTileCopyFeedback === "failed" ? (
                        <span className="text-xs text-red-200">Copy failed</span>
                      ) : null}
                    </div>
                  </section>
                ) : null}
                {rendererInitError ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-6 text-center">
                    <p className="max-w-xl rounded-lg border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      {rendererInitError}
                    </p>
                  </div>
                ) : null}
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
                      Detailed Topology View - CI Flow Focus
                    </p>
                    <h3 className="text-base font-semibold text-sky-100">
                      {ciFlowRootTile?.name ?? "Topology Root"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={exportDetailedTopologyCsv}
                      disabled={!presentedDetailedNodes.length}
                      className="rounded-md border border-cyan-300/45 bg-cyan-500/14 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 hover:bg-cyan-500/24 disabled:cursor-not-allowed disabled:border-slate-500/45 disabled:bg-slate-900/75 disabled:text-slate-400"
                    >
                      Export CSV
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

                <div className="grid min-h-0 flex-1 grid-cols-[minmax(15rem,0.55fr)_minmax(0,1.8fr)]">
                  <section className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto border-r border-sky-400/20 bg-slate-950/55 p-3">
                    <div className="flex shrink-0 items-center justify-between gap-2 text-xs">
                      <label className="text-slate-300/85" htmlFor="ci-focus-compliance-mode">
                        Compliance
                      </label>
                      <select
                        id="ci-focus-compliance-mode"
                        value={complianceMode}
                        onChange={(event) => setComplianceMode(event.target.value as ComplianceMode)}
                        className="min-w-0 rounded-md border border-sky-400/35 bg-slate-900/85 px-2.5 py-1.5 text-slate-100"
                      >
                        <option value="cyber">Cyber Security Compliance</option>
                        <option value="discovery">Discovery Compliance</option>
                      </select>
                    </div>
                    <div className="flex shrink-0 flex-col gap-3">
                      {rootCiFlowModelContextTile ? (
                        <article
                          className="select-none rounded-2xl border-2 px-3 py-2.5 text-slate-900 shadow-[0_10px_20px_rgba(0,0,0,0.36)]"
                          style={{
                            borderColor: rootCiFlowModelContextTile.borderColor,
                            backgroundColor: detailedTileColor(rootCiFlowModelContextTile.entityType)
                          }}
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-800">
                              {rootCiFlowModelContextTile.typeLabel}
                            </p>
                            <p className="text-sm font-semibold leading-snug text-slate-900">
                              {rootCiFlowModelContextTile.name}
                            </p>
                            <p className="text-xs font-medium leading-snug text-slate-800">
                              {rootCiFlowModelContextTile.subtitle}
                            </p>
                          </div>
                          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-sm bg-slate-300/95">
                            <div className="flex h-full w-full">
                              <div
                                className="h-full bg-emerald-600"
                                style={{ width: `${rootCiFlowModelContextTile.percentages.compliant}%` }}
                              />
                              <div
                                className="h-full bg-red-500"
                                style={{ width: `${rootCiFlowModelContextTile.percentages.nonCompliant}%` }}
                              />
                              <div
                                className="h-full bg-slate-400"
                                style={{ width: `${rootCiFlowModelContextTile.percentages.other}%` }}
                              />
                            </div>
                          </div>
                          <p className="mt-1.5 text-center text-xs font-medium text-slate-900">
                            {rootCiFlowModelContextTile.percentages.compliant}% C |{" "}
                            {rootCiFlowModelContextTile.percentages.nonCompliant}% NC |{" "}
                            {rootCiFlowModelContextTile.percentages.other}% O
                          </p>
                        </article>
                      ) : null}
                      {rootCiFlowFocusNode && rootCiFlowFocusPercentages ? (
                        <article
                          className="select-none rounded-3xl border-2 px-4 py-3 text-slate-900 shadow-[0_14px_34px_rgba(0,0,0,0.48)]"
                          style={{
                            borderColor: "#a855f7",
                            backgroundColor: detailedTileColor(rootCiFlowFocusNode.entityType)
                          }}
                        >
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold leading-snug text-slate-900">
                              Type: <span className="font-medium">{rootCiFlowFocusNode.typeLabel}</span>
                            </p>
                            <p className="text-sm font-semibold leading-snug text-slate-900">
                              Name: <span className="font-medium">{rootCiFlowFocusNode.name}</span>
                            </p>
                            <p className="text-xs font-medium leading-snug text-slate-800">
                              {rootCiFlowFocusNode.modelLabel}
                            </p>
                          </div>
                          <div className="mt-3 h-3 w-full overflow-hidden rounded-sm bg-slate-300/95">
                            <div className="flex h-full w-full">
                              <div className="h-full bg-emerald-600" style={{ width: `${rootCiFlowFocusPercentages.compliant}%` }} />
                              <div
                                className="h-full bg-red-500"
                                style={{ width: `${rootCiFlowFocusPercentages.nonCompliant}%` }}
                              />
                              <div className="h-full bg-slate-400" style={{ width: `${rootCiFlowFocusPercentages.other}%` }} />
                            </div>
                          </div>
                          <p className="mt-2 text-center text-base font-medium text-slate-900">
                            {rootCiFlowFocusPercentages.compliant}% C | {rootCiFlowFocusPercentages.nonCompliant}% NC |{" "}
                            {rootCiFlowFocusPercentages.other}% O
                          </p>
                        </article>
                      ) : null}
                    </div>
                    {selectedCiFlowFocusNode && selectedCiFlowFocusPercentages ? (
                      <div className="mt-auto shrink-0">
                        <article
                          className="select-none rounded-3xl border-2 px-4 py-3 text-slate-900 shadow-[0_14px_34px_rgba(0,0,0,0.48)]"
                          style={{
                            borderColor:
                              selectedCiFlowFocusNode.entityType === "ci"
                                ? "#fb923c"
                                : ciFlowNodeStrokeColor(selectedCiFlowFocusNode.entityType, selectedCiFlowFocusNode.isInModelScope),
                            backgroundColor: detailedTileColor(selectedCiFlowFocusNode.entityType)
                          }}
                        >
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold leading-snug text-slate-900">
                              Type: <span className="font-medium">{selectedCiFlowFocusNode.typeLabel}</span>
                            </p>
                            <p className="text-sm font-semibold leading-snug text-slate-900">
                              Name: <span className="font-medium">{selectedCiFlowFocusNode.name}</span>
                            </p>
                            <p className="text-xs font-medium leading-snug text-slate-800">
                              {selectedCiFlowFocusNode.modelLabel}
                            </p>
                          </div>
                          <div className="mt-3 h-3 w-full overflow-hidden rounded-sm bg-slate-300/95">
                            <div className="flex h-full w-full">
                              <div className="h-full bg-emerald-600" style={{ width: `${selectedCiFlowFocusPercentages.compliant}%` }} />
                              <div
                                className="h-full bg-red-500"
                                style={{ width: `${selectedCiFlowFocusPercentages.nonCompliant}%` }}
                              />
                              <div className="h-full bg-slate-400" style={{ width: `${selectedCiFlowFocusPercentages.other}%` }} />
                            </div>
                          </div>
                          <p className="mt-2 text-center text-base font-medium text-slate-900">
                            {selectedCiFlowFocusPercentages.compliant}% C | {selectedCiFlowFocusPercentages.nonCompliant}% NC |{" "}
                            {selectedCiFlowFocusPercentages.other}% O
                          </p>
                        </article>
                      </div>
                    ) : null}
                  </section>
                  <section className="min-h-0 min-w-0 p-2">
                    <IctSystemImpactAnalyser2Chart
                      embedded
                      sourceRows={ciAnalyserRows}
                      diagramMode="ci"
                      title="CI Analyser"
                      headingTooltip="CI relationship analyser for assets related to the selected configuration item."
                      assetAxisLabel="Asset"
                      assetSearchCategory="Asset"
                      includeNetworkAxis={!isSystemImpactAnalyser}
                      onSelectedNodeChange={handleCiAnalyserSelectedNodeChange}
                      extraControls={
                        <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-sky-400/20 bg-slate-900/55 px-2 text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
                          <span>Relationships</span>
                          {CI_FLOW_RELATIONSHIP_TYPES.map((dependencyType) => (
                            <label
                              key={`ci-focus-analyser-relationship-filter-${dependencyType}`}
                              className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-slate-100 hover:bg-slate-800/70"
                            >
                              <input
                                type="checkbox"
                                checked={ciFlowIncludedDependencyTypes.has(dependencyType)}
                                onChange={() => toggleCiFlowIncludedDependencyType(dependencyType)}
                                className="h-3.5 w-3.5 accent-cyan-400"
                              />
                              <span className="text-xs font-semibold">{dependencyType.replace(" Dependency", "")}</span>
                            </label>
                          ))}
                        </div>
                      }
                    />
                  </section>
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
