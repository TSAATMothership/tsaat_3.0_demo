"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { NetworkTopologyData, TopologyEntityType, TopologyNodeDetails } from "@/lib/network-topology";

type ComplianceMode = "cyber" | "discovery";
type TopologyLayoutMode = "hierarchical" | "partitioned" | "radial";
type CiAssetType = "network-device" | "workstation" | "server";
type CiEnvironmentLabel = "Production" | "Development" | "UAT" | "Test" | "Unassigned";
const DEFAULT_CAMERA_DISTANCE = 260;
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

interface CiFlow3DViewState {
  yaw: number;
  pitch: number;
  panX: number;
  panY: number;
  zoom: number;
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
  if (nodes.length <= 1) {
    const onlyNode = nodes[0];
    if (onlyNode) {
      onlyNode.x = centerX - onlyNode.width / 2;
      onlyNode.y = centerY - onlyNode.height / 2;
      onlyNode.z = 0;
    }
    return;
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeIds = nodes.map((node) => node.id);
  const centersById = new Map<string, { x: number; y: number; z: number }>();
  const velocitiesById = new Map<string, { x: number; y: number; z: number }>();
  const nonPinnedNodeIds = nodeIds.filter((nodeId) => nodeId !== pinnedNodeId);

  const spacingEstimate = Math.max(260, Math.min(520, CI_FLOW_NODE_MIN_WIDTH * 0.36));
  const idealSphereRadius = Math.sqrt(
    (Math.max(1, nonPinnedNodeIds.length) * spacingEstimate * spacingEstimate * 1.4) / (4 * Math.PI)
  );
  const sphereRadius = Math.max(CI_FLOW_BASE_RADIUS * 2.3, idealSphereRadius);
  const maxRadiusFromCenter = sphereRadius * 1.25;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  if (nodeById.has(pinnedNodeId)) {
    centersById.set(pinnedNodeId, { x: 0, y: 0, z: 0 });
    velocitiesById.set(pinnedNodeId, { x: 0, y: 0, z: 0 });
  }
  for (let index = 0; index < nonPinnedNodeIds.length; index += 1) {
    const nodeId = nonPinnedNodeIds[index];
    const count = Math.max(1, nonPinnedNodeIds.length);
    const ratio = (index + 0.5) / count;
    const yUnit = 1 - ratio * 2;
    const radialUnit = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
    const theta = goldenAngle * (index + 0.5);
    const xUnit = Math.cos(theta) * radialUnit;
    const zUnit = Math.sin(theta) * radialUnit;
    centersById.set(nodeId, {
      x: xUnit * sphereRadius,
      y: yUnit * sphereRadius * 0.9,
      z: zUnit * sphereRadius
    });
    velocitiesById.set(nodeId, { x: 0, y: 0, z: 0 });
  }

  const iterationCount = Math.max(260, Math.min(520, nodes.length * 6));
  const repulsionStrength = 1_360_000;
  const springStrength = 0.0032;
  const centeringStrength = 0.0016;
  const damping = 0.84;
  const maxStep = 84;

  for (let iteration = 0; iteration < iterationCount; iteration += 1) {
    const forcesById = new Map<string, { x: number; y: number; z: number }>();
    for (const nodeId of nodeIds) {
      forcesById.set(nodeId, { x: 0, y: 0, z: 0 });
    }

    for (let leftIndex = 0; leftIndex < nodeIds.length; leftIndex += 1) {
      const leftNodeId = nodeIds[leftIndex];
      const leftNode = nodeById.get(leftNodeId);
      const leftCenter = centersById.get(leftNodeId);
      if (!leftNode || !leftCenter) {
        continue;
      }

      for (let rightIndex = leftIndex + 1; rightIndex < nodeIds.length; rightIndex += 1) {
        const rightNodeId = nodeIds[rightIndex];
        const rightNode = nodeById.get(rightNodeId);
        const rightCenter = centersById.get(rightNodeId);
        if (!rightNode || !rightCenter) {
          continue;
        }

        let dx = rightCenter.x - leftCenter.x;
        let dy = rightCenter.y - leftCenter.y;
        let dz = rightCenter.z - leftCenter.z;
        let distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared < 1) {
          const deterministicAngle = (leftIndex + 1) * 1.73 + (rightIndex + 1) * 2.11;
          dx = Math.cos(deterministicAngle);
          dy = Math.sin(deterministicAngle);
          dz = Math.cos(deterministicAngle * 0.67);
          distanceSquared = dx * dx + dy * dy + dz * dz;
        }
        const distance = Math.sqrt(distanceSquared);
        const unitX = dx / distance;
        const unitY = dy / distance;
        const unitZ = dz / distance;

        const preferredDistance = Math.max(spacingEstimate, (leftNode.width + rightNode.width) / 2 + 110);
        const overlapFactor =
          distance < preferredDistance ? 1 + ((preferredDistance - distance) / preferredDistance) * 6.2 : 1;
        const repulsion = (repulsionStrength / distanceSquared) * overlapFactor;

        const leftForce = forcesById.get(leftNodeId);
        const rightForce = forcesById.get(rightNodeId);
        if (!leftForce || !rightForce) {
          continue;
        }

        leftForce.x -= unitX * repulsion;
        leftForce.y -= unitY * repulsion;
        leftForce.z -= unitZ * repulsion;
        rightForce.x += unitX * repulsion;
        rightForce.y += unitY * repulsion;
        rightForce.z += unitZ * repulsion;
      }
    }

    for (const edge of edges) {
      const fromNode = nodeById.get(edge.fromNodeId);
      const toNode = nodeById.get(edge.toNodeId);
      const fromCenter = centersById.get(edge.fromNodeId);
      const toCenter = centersById.get(edge.toNodeId);
      if (!fromNode || !toNode || !fromCenter || !toCenter) {
        continue;
      }

      let dx = toCenter.x - fromCenter.x;
      let dy = toCenter.y - fromCenter.y;
      let dz = toCenter.z - fromCenter.z;
      let distanceSquared = dx * dx + dy * dy + dz * dz;
      if (distanceSquared < 1) {
        const deterministicAngle = edge.fromNodeId.length * 0.61 + edge.toNodeId.length * 0.47;
        dx = Math.cos(deterministicAngle);
        dy = Math.sin(deterministicAngle);
        dz = Math.cos(deterministicAngle * 0.67);
        distanceSquared = dx * dx + dy * dy + dz * dz;
      }
      const distance = Math.sqrt(distanceSquared);
      const unitX = dx / distance;
      const unitY = dy / distance;
      const unitZ = dz / distance;
      const restDistance = Math.max(
        spacingEstimate * 0.95,
        Math.min(sphereRadius * 0.9, Math.max(fromNode.width, toNode.width) * 0.82 + 180)
      );
      const springForce = (distance - restDistance) * springStrength;

      const fromForce = forcesById.get(edge.fromNodeId);
      const toForce = forcesById.get(edge.toNodeId);
      if (!fromForce || !toForce) {
        continue;
      }

      fromForce.x += unitX * springForce;
      fromForce.y += unitY * springForce;
      fromForce.z += unitZ * springForce;
      toForce.x -= unitX * springForce;
      toForce.y -= unitY * springForce;
      toForce.z -= unitZ * springForce;
    }

    for (const nodeId of nodeIds) {
      const center = centersById.get(nodeId);
      const velocity = velocitiesById.get(nodeId);
      const force = forcesById.get(nodeId);
      if (!center || !velocity || !force) {
        continue;
      }

      if (nodeId === pinnedNodeId) {
        center.x = 0;
        center.y = 0;
        center.z = 0;
        velocity.x = 0;
        velocity.y = 0;
        velocity.z = 0;
        continue;
      }

      force.x += -center.x * centeringStrength;
      force.y += -center.y * centeringStrength;
      force.z += -center.z * centeringStrength;

      velocity.x = (velocity.x + force.x) * damping;
      velocity.y = (velocity.y + force.y) * damping;
      velocity.z = (velocity.z + force.z) * damping;

      const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
      if (speed > maxStep) {
        const scale = maxStep / speed;
        velocity.x *= scale;
        velocity.y *= scale;
        velocity.z *= scale;
      }

      center.x += velocity.x;
      center.y += velocity.y;
      center.z += velocity.z;

      const radialDistance = Math.hypot(center.x, center.y, center.z);
      if (radialDistance > maxRadiusFromCenter) {
        const clampScale = maxRadiusFromCenter / radialDistance;
        center.x *= clampScale;
        center.y *= clampScale;
        center.z *= clampScale;
      }
    }
  }

  const relaxationPasses = 16;
  for (let pass = 0; pass < relaxationPasses; pass += 1) {
    let moved = false;
    for (let leftIndex = 0; leftIndex < nodeIds.length; leftIndex += 1) {
      const leftNodeId = nodeIds[leftIndex];
      const leftNode = nodeById.get(leftNodeId);
      const leftCenter = centersById.get(leftNodeId);
      if (!leftNode || !leftCenter) {
        continue;
      }
      for (let rightIndex = leftIndex + 1; rightIndex < nodeIds.length; rightIndex += 1) {
        const rightNodeId = nodeIds[rightIndex];
        const rightNode = nodeById.get(rightNodeId);
        const rightCenter = centersById.get(rightNodeId);
        if (!rightNode || !rightCenter) {
          continue;
        }
        let dx = rightCenter.x - leftCenter.x;
        let dy = rightCenter.y - leftCenter.y;
        let dz = rightCenter.z - leftCenter.z;
        let distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared < 1) {
          const deterministicAngle = (leftIndex + 3) * 0.91 + (rightIndex + 7) * 1.31;
          dx = Math.cos(deterministicAngle);
          dy = Math.sin(deterministicAngle);
          dz = Math.cos(deterministicAngle * 0.67);
          distanceSquared = dx * dx + dy * dy + dz * dz;
        }
        const distance = Math.sqrt(distanceSquared);
        const minimumDistance = Math.max(spacingEstimate * 0.96, (leftNode.width + rightNode.width) / 2 + 95);
        if (distance >= minimumDistance) {
          continue;
        }
        const overlap = minimumDistance - distance;
        const unitX = dx / distance;
        const unitY = dy / distance;
        const unitZ = dz / distance;
        const leftPinned = leftNodeId === pinnedNodeId;
        const rightPinned = rightNodeId === pinnedNodeId;
        if (leftPinned && rightPinned) {
          continue;
        }
        if (leftPinned) {
          rightCenter.x += unitX * overlap;
          rightCenter.y += unitY * overlap;
          rightCenter.z += unitZ * overlap;
          moved = true;
          continue;
        }
        if (rightPinned) {
          leftCenter.x -= unitX * overlap;
          leftCenter.y -= unitY * overlap;
          leftCenter.z -= unitZ * overlap;
          moved = true;
          continue;
        }
        const halfOverlap = overlap * 0.5;
        leftCenter.x -= unitX * halfOverlap;
        leftCenter.y -= unitY * halfOverlap;
        leftCenter.z -= unitZ * halfOverlap;
        rightCenter.x += unitX * halfOverlap;
        rightCenter.y += unitY * halfOverlap;
        rightCenter.z += unitZ * halfOverlap;
        moved = true;
      }
    }
    for (const nodeId of nonPinnedNodeIds) {
      const center = centersById.get(nodeId);
      if (!center) {
        continue;
      }
      const radialDistance = Math.hypot(center.x, center.y, center.z);
      if (radialDistance > maxRadiusFromCenter) {
        const clampScale = maxRadiusFromCenter / radialDistance;
        center.x *= clampScale;
        center.y *= clampScale;
        center.z *= clampScale;
      }
    }
    if (!moved) {
      break;
    }
  }

  for (const node of nodes) {
    const center = centersById.get(node.id);
    if (!center) {
      continue;
    }
    node.x = centerX + center.x - node.width / 2;
    node.y = centerY + center.y - node.height / 2;
    node.z = center.z;
  }
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
  const [draggingCiFlowNodeId, setDraggingCiFlowNodeId] = useState<string | null>(null);
  const [ciFlowNodeDragOffsets, setCiFlowNodeDragOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [ciFlowTweenProgress, setCiFlowTweenProgress] = useState(0);
  const [ciFlowViewportCenter, setCiFlowViewportCenter] = useState<{ x: number; y: number } | null>(null);
  const [ciFlowOriginCenter, setCiFlowOriginCenter] = useState<{ x: number; y: number } | null>(null);
  const [draggingDetailedNodeId, setDraggingDetailedNodeId] = useState<string | null>(null);
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
        y: notModelledCenterY - CI_FLOW_NOT_MODELLED_HEIGHT / 2,
        z: 0
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
      const dragOffset = ciFlowNodeDragOffsets[node.id];
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
  const ciFlowSelectedDirectEdgeIds = useMemo(() => {
    if (!ciFlowGraph || !selectedCiFlowNodeId) {
      return new Set<string>();
    }
    const selectedNodeById = new Map(ciFlowGraph.nodes.map((node) => [node.id, node]));
    const selectedNode = selectedNodeById.get(selectedCiFlowNodeId);
    if (!selectedNode) {
      return new Set<string>();
    }
    return new Set(
      ciFlowGraph.edges
        .filter((edge) => edge.fromNodeId === selectedCiFlowNodeId || edge.toNodeId === selectedCiFlowNodeId)
        .filter((edge) => {
          if (selectedNode.entityType !== "ci") {
            return true;
          }
          return edge.dependencyType === "Flow Dependency";
        })
        .map((edge) => edge.id)
    );
  }, [ciFlowGraph, selectedCiFlowNodeId]);
  const ciFlowHighlightedEdgeIds = useMemo(() => {
    return new Set<string>(ciFlowSelectedDirectEdgeIds);
  }, [ciFlowSelectedDirectEdgeIds]);
  const ciFlowRelationshipNodeIds = useMemo(() => {
    if (!ciFlowGraph) {
      return new Set<string>();
    }
    if (!selectedCiFlowNodeId) {
      return new Set(ciFlowGraph.nodes.map((node) => node.id));
    }
    const nodeById = new Map(ciFlowGraph.nodes.map((node) => [node.id, node]));
    const selectedNode = nodeById.get(selectedCiFlowNodeId);
    if (!selectedNode) {
      return new Set(ciFlowGraph.nodes.map((node) => node.id));
    }
    if (selectedNode.entityType !== "ci") {
      return new Set<string>([selectedCiFlowNodeId]);
    }

    const visibleNodeIds = new Set<string>([selectedCiFlowNodeId]);
    for (const edge of ciFlowGraph.edges) {
      if (!ciFlowHighlightedEdgeIds.has(edge.id)) {
        continue;
      }
      const relatedNodeId = edge.fromNodeId === selectedCiFlowNodeId ? edge.toNodeId : edge.fromNodeId;
      const relatedNode = nodeById.get(relatedNodeId);
      if (selectedNode.entityType !== "ci" || relatedNode?.entityType === "ci") {
        visibleNodeIds.add(relatedNodeId);
      }
    }
    return visibleNodeIds;
  }, [ciFlowGraph, ciFlowHighlightedEdgeIds, selectedCiFlowNodeId]);
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
      if (selectedCiFlowNodeId) {
        return ciFlowRelationshipNodeIds;
      }
      if (detailedSelectedTileFilterId === "__all__") {
        return new Set<string>(ciFlowGraph.nodes.map((node) => node.id));
      }
      return ciFlowNodeById.has(detailedSelectedTileFilterId)
        ? new Set<string>([detailedSelectedTileFilterId])
        : new Set<string>(ciFlowGraph.nodes.map((node) => node.id));
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
    ciFlowNodeById,
    ciFlowRelationshipNodeIds,
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
    ciFlowNodeDragOffsetsRef.current = ciFlowNodeDragOffsets;
  }, [ciFlowNodeDragOffsets]);

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
    setIsDetailedTopologyOpen(false);
    setDetailedRootNodeId(null);
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
    controls.minDistance = 0;
    controls.maxDistance = Number.POSITIVE_INFINITY;
    controls.target.copy(persistedCameraState?.target ?? initialTargetRef.current);
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.zoomSpeed = 1;
    controls.rotateSpeed = 0.9;
    controls.panSpeed = 1;
    controls.screenSpacePanning = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.listenToKeyEvents(window);
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
      controls.stopListenToKeyEvents();
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
    const graphWidth = Math.max(1, isFlowMode ? (ciFlowGraph?.width ?? 1) : (detailedTree?.width ?? 1));
    const graphHeight = Math.max(1, isFlowMode ? (ciFlowGraph?.height ?? 1) : (detailedTree?.height ?? 1));
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
        : (detailedTree?.nodes ?? [])
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
      const baseNodeById = new Map(baseNodes.map((node) => [node.id, node]));
      const rootNode = baseNodeById.get(detailedTree.rootNodeId) ?? baseNodes[0];
      if (!rootNode) {
        return baseNodes;
      }

      const environmentNodes = baseNodes
        .filter((node) => node.entityType === "environment")
        .sort((left, right) => left.y - right.y);
      const parentEnvironmentByCiId = new Map<string, string>();
      for (const edge of detailedTree.edges) {
        const fromNode = baseNodeById.get(edge.fromNodeId);
        const toNode = baseNodeById.get(edge.toNodeId);
        if (!fromNode || !toNode) {
          continue;
        }
        if (fromNode.entityType === "environment" && toNode.entityType === "ci") {
          parentEnvironmentByCiId.set(toNode.id, fromNode.id);
        }
      }
      const ciNodesByEnvironmentId = new Map<string, RenderNode[]>();
      const ungroupedCiNodes: RenderNode[] = [];
      for (const node of baseNodes) {
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
      const maxCiWidth = Math.max(DETAILED_CI_TILE_WIDTH, ...baseNodes.filter((node) => node.entityType === "ci").map((node) => node.width));
      const rootToEnvironmentGap = Math.max(86, DETAILED_COLUMN_GAP * 0.44);
      const environmentToCiGap = Math.max(84, DETAILED_COLUMN_GAP * 0.4);
      const compactSectionGap = Math.max(18, DETAILED_SECTION_GAP * 0.34);
      const compactCiGap = Math.max(10, DETAILED_CI_ROW_GAP * 0.72);

      const minBaseY = Math.min(...baseNodes.map((node) => node.y));
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
          let boundsMinX = Number.POSITIVE_INFINITY;
          let boundsMinY = Number.POSITIVE_INFINITY;
          let boundsMaxX = Number.NEGATIVE_INFINITY;
          let boundsMaxY = Number.NEGATIVE_INFINITY;
          for (const node of latestNodes) {
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
      if (isFlowMode && ciFlowGraph) {
        for (const node of latestNodes) {
          const isRootNode = node.id === detailedDisplayRootNodeId;
          const isSelected = node.id === detailedDisplaySelectedNodeId;
          const centerWorldX = node.x + node.width / 2;
          const centerWorldY = node.y + node.height / 2;
          const projection = projectFlowPoint(centerWorldX, centerWorldY, node.z, width, height);
          if (!projection) {
            continue;
          }
          const baseRadius = ciFlowSphereRadiusWorld(node);
          const selectedScale = isSelected ? 1.14 : isRootNode ? 1.06 : 1;
          const radius = baseRadius * projection.perspective * selectedScale;
          if (
            projection.x + radius < -40 ||
            projection.x - radius > width + 40 ||
            projection.y + radius < -40 ||
            projection.y - radius > height + 40
          ) {
            continue;
          }
          const projected = {
            node,
            centerX: projection.x,
            centerY: projection.y,
            radius,
            depth: projection.depth,
            perspective: projection.perspective,
            isRootNode,
            isSelected
          };
          latestFlowProjectedNodes.push(projected);
          flowProjectedNodeById.set(node.id, projected);
        }
      }

      if (isFlowMode && ciFlowGraph) {
        const hasFlowSelection = Boolean(selectedCiFlowNodeId);
        for (const edge of ciFlowGraph.edges) {
          if (!detailedFilteredNodeIds.has(edge.fromNodeId) || !detailedFilteredNodeIds.has(edge.toNodeId)) {
            continue;
          }
          if (hasFlowSelection && !ciFlowHighlightedEdgeIds.has(edge.id)) {
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
            (isHighlighted ? 0.95 : 0.72) *
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
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.bezierCurveTo(control1.x, control1.y, control2.x, control2.y, end.x, end.y);
          context.strokeStyle = isPathEdge ? "#9333ea" : isConnectedEdge ? "#eab308" : "#38bdf8";
          context.globalAlpha = isPathEdge || isConnectedEdge ? 0.94 : 0.58;
          context.lineWidth = isPathEdge ? 3.6 : isConnectedEdge ? 3 : 2;
          context.lineCap = "round";
          context.stroke();
        }
      }

      const nodesToRender = isFlowMode
        ? [...latestNodes].sort(
            (left, right) =>
              (flowProjectedNodeById.get(right.id)?.depth ?? 0) - (flowProjectedNodeById.get(left.id)?.depth ?? 0)
          )
        : latestNodes;
      for (const node of nodesToRender) {
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
          const isFilterRootCi = node.entityType === "ci" && projected.isSelected;
          const strokeColor = isFilterRootCi ? "#a855f7" : ciFlowNodeStrokeColor(node.entityType, node.isInModelScope);
          const depthOpacity = Math.max(0.3, Math.min(1, CI_FLOW_3D_CAMERA_DISTANCE / projected.depth));
          context.globalAlpha = Math.max(0.12, Math.min(1, node.opacity * depthOpacity));
          context.beginPath();
          context.arc(center.x, center.y, radius, 0, Math.PI * 2);
          const gradient = context.createRadialGradient(
            center.x - radius * 0.34,
            center.y - radius * 0.42,
            Math.max(2, radius * 0.12),
            center.x,
            center.y,
            Math.max(3, radius)
          );
          if (isFilterRootCi) {
            gradient.addColorStop(0, "#f5d0fe");
            gradient.addColorStop(0.5, "#c084fc");
            gradient.addColorStop(1, "#581c87");
          } else if (strokeColor === "#22c55e") {
            gradient.addColorStop(0, "#dcfce7");
            gradient.addColorStop(0.48, "#4ade80");
            gradient.addColorStop(1, "#166534");
          } else {
            gradient.addColorStop(0, "#fee2e2");
            gradient.addColorStop(0.48, "#f87171");
            gradient.addColorStop(1, "#7f1d1d");
          }
          context.fillStyle = gradient;
          context.fill();
          context.lineWidth = projected.isSelected ? 3.8 : projected.isRootNode ? 3.2 : 2.4;
          context.strokeStyle = strokeColor;
          context.stroke();
          if (isFilterRootCi) {
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
          } else if (projected.isSelected) {
            context.beginPath();
            context.arc(center.x, center.y, radius + 5, 0, Math.PI * 2);
            context.lineWidth = 2.2;
            context.strokeStyle = "rgba(248,250,252,0.92)";
            context.stroke();
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

        context.globalAlpha = Math.max(0.1, Math.min(1, node.opacity));
        roundedRectPath(context, topLeft.x, topLeft.y, nodeWidth, nodeHeight, node.entityType === "ci" ? 12 : 18);
        context.fillStyle = fillColor;
        context.fill();
        context.lineWidth = isRootNode || isSelected ? 3.2 : 2;
        context.strokeStyle = strokeColor;
        context.stroke();

        if (viewState.zoom >= 0.42) {
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
        isFlowMode && latestFlowProjectedNodes.some((projected) => projected.isSelected && projected.node.entityType === "ci");
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
        const shouldPan = event.button === 1 || event.button === 2 || event.shiftKey || event.altKey;
        detailedCanvasInteractionRef.current = {
          pointerId: event.pointerId,
          mode: shouldPan ? "flow-pan" : "flow-orbit",
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
      if (hitNode) {
        if (isFlowMode) {
          setSelectedCiFlowNodeId(hitNode.id);
        } else {
          setDetailedSelectedNodeId(hitNode.id);
        }
        if (isDetailedTileFilterActive) {
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
      if (!interaction || interaction.pointerId !== event.pointerId) {
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
        const startPanX = interaction.startFlowPanX ?? flow3D.panX;
        const startPanY = interaction.startFlowPanY ?? flow3D.panY;
        const worldUnitsPerPixel = CI_FLOW_3D_CAMERA_DISTANCE / Math.max(500, CI_FLOW_3D_FOCAL_LENGTH * flow3D.zoom);
        flow3D.panX = startPanX + deltaX * worldUnitsPerPixel * 1.2;
        flow3D.panY = startPanY - deltaY * worldUnitsPerPixel * 1.2;
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
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
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
    detailedFilteredNodeIds,
    detailedSelectedConnectedEdgeIds,
    detailedSelectedPathEdgeIds,
    detailedTree,
    isCiFlowFocusPanelOpen,
    isDetailedTileFilterActive,
    isDetailedTopologyOpen
  ]);


  const zoomBy = (factor: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) {
      return;
    }
    const targetToCamera = camera.position.clone().sub(controls.target);
    const currentDistance = targetToCamera.length();
    if (!Number.isFinite(currentDistance) || currentDistance <= 0.0001) {
      return;
    }
    const nextDistance = Math.max(0.0001, currentDistance * factor);
    camera.position.copy(controls.target).add(targetToCamera.normalize().multiplyScalar(nextDistance));
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
    setCiFlowOriginCenter({ x: node.x + node.width / 2, y: node.y + node.height / 2 });
    setCiFlowViewportCenter(null);
    setCiFlowTweenProgress(0);
    window.requestAnimationFrame(() => {
      animateCiFlowTween(0, 1, 520);
    });
  }, [animateCiFlowTween, detailedZoom]);

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
      detailedPersistedCameraStateRef.current = null;
      detailedPersistedNodePositionsRef.current = new Map();
      detailedManualNodePositionsRef.current = new Map();
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
    setIsDetailedTopologyOpen(false);
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
  const selectedCiFlowFocusNode =
    isCiFlowFocusPanelOpen && selectedCiFlowNodeId ? ciFlowNodeById.get(selectedCiFlowNodeId) ?? null : null;
  const selectedCiFlowFocusCompliance = selectedCiFlowFocusNode
    ? complianceMode === "cyber"
      ? selectedCiFlowFocusNode.cyberCompliance
      : selectedCiFlowFocusNode.discoveryCompliance
    : null;
  const selectedCiFlowFocusPercentages = selectedCiFlowFocusCompliance
    ? compliancePercentages(selectedCiFlowFocusCompliance)
    : null;

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
            Orbit + Pan
          </button>
          <button
            type="button"
            onClick={resetView}
            className="rounded-md border border-slate-400/45 bg-slate-800/70 px-2.5 py-1.5 font-semibold text-slate-100"
          >
            Reset View
          </button>
          <span className="rounded-md border border-sky-400/25 bg-slate-900/75 px-2 py-1 text-[11px] text-slate-200">
            Left drag: rotate | Right drag: move | Wheel: zoom
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
                const scrollContainer = scrollContainerRef.current;
                if (!scrollContainer) {
                  return;
                }
                const primaryDelta =
                  Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
                scrollContainer.scrollTop += primaryDelta;
                event.preventDefault();
                event.stopPropagation();
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
                      title="Detailed Topology View"
                      aria-label={`Open Detailed Topology View for ${node.name}`}
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

              <div ref={detailedViewportRef} className="relative min-h-0 flex-1 overflow-hidden bg-slate-950/75">
                <canvas ref={detailedCanvasRef} className="absolute inset-0 h-full w-full" />
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
                    Orbit + Pan
                  </button>
                  <button
                    type="button"
                    onClick={resetDetailedTopologyView}
                    className="rounded-md border border-slate-400/45 bg-slate-800/70 px-2.5 py-1.5 font-semibold text-slate-100"
                  >
                    Reset View
                  </button>
                  <span className="rounded-md border border-sky-400/25 bg-slate-900/75 px-2 py-1 text-[11px] text-slate-200">
                    Left drag: rotate | Middle/right drag: move | Wheel: zoom
                  </span>
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

                <div ref={detailedViewportRef} className="relative min-h-0 flex-1 overflow-hidden bg-slate-950/75">
                  <canvas ref={detailedCanvasRef} className="absolute inset-0 h-full w-full" />
                  {rendererInitError ? (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-6 text-center">
                      <p className="max-w-xl rounded-lg border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        {rendererInitError}
                      </p>
                    </div>
                  ) : null}
                  {selectedCiFlowFocusNode && selectedCiFlowFocusPercentages ? (
                    <article
                      className="pointer-events-auto absolute right-4 top-4 z-30 w-[22rem] rounded-3xl border-2 px-4 py-3 text-slate-900 shadow-[0_14px_34px_rgba(0,0,0,0.48)]"
                      style={{
                        borderColor:
                          selectedCiFlowFocusNode.entityType === "ci" && selectedCiFlowNodeId === selectedCiFlowFocusNode.id
                            ? "#a855f7"
                            : ciFlowNodeStrokeColor(
                                selectedCiFlowFocusNode.entityType,
                                selectedCiFlowFocusNode.isInModelScope
                              ),
                        backgroundColor: detailedTileColor(selectedCiFlowFocusNode.entityType)
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCiFlowNodeId(null);
                          setDetailedSelectedTileFilterId("__all__");
                          setDetailedTileFilterSearchText("");
                          setIsDetailedTileSearchFocused(false);
                        }}
                        className="absolute right-3 top-3 rounded-md border border-slate-500/45 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-100"
                      >
                        Close
                      </button>
                      <div className="space-y-0.5 pr-12">
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
                  ) : null}
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

