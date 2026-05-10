"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  NetworkDetailRiskFindingRow,
  RiskFindingsDrillThrough
} from "@/components/network-detail-risk-charts";
import { SPI_DESCRIPTIONS, SPI_NAMES, SPI_SUCCESS_MEASURES } from "@/lib/spi-metadata";
import { FindingSeverity, HighRiskCveDetail, SecurityDomain } from "@/lib/types";

type ImpactAnalyser2EnvironmentOption = "Production" | "Development" | "UAT" | "Test" | "Unassigned";
type ImpactAnalyser2FindingCriticalityOption = FindingSeverity;

interface ImpactAnalyser2Row {
  findingId: string;
  systemId: string;
  systemName: string;
  environmentType: ImpactAnalyser2EnvironmentOption | null;
  serverId: string;
  serverName: string;
  serverHostname: string;
  securityDomain: SecurityDomain;
  severity: FindingSeverity;
  spiId: number;
  spiLabel: string;
}

interface ImpactAnalyser2Axis {
  key: string;
  label: string;
  values: string[];
}

interface ImpactAnalyser2SearchOption {
  id: string;
  label: string;
  category: string;
  axisKey: string;
}

interface ImpactAnalyser2SelectedSearchOption {
  axisKey: string;
  value: string;
  label: string;
  category: string;
}

interface ImpactAnalyser2SelectedNode {
  axisKey: string;
  value: string;
}

interface ImpactAnalyser2WorkerResult {
  axes: ImpactAnalyser2Axis[];
  filteredRowCount: number;
  totalRowCount: number;
  highlightedRowCount: number;
  virtualHeight: number;
  basePositions: Float32Array;
  baseColors: Float32Array;
  highlightPositions: Float32Array;
  highlightColors: Float32Array;
  spiCounts: Array<[number, number]>;
  searchOptions: ImpactAnalyser2SearchOption[];
}

interface ImpactAnalyser2FindingsResponse {
  snapshotDate: string;
  selectedSpiId: number;
  findings: NetworkDetailRiskFindingRow[];
  allFindings: NetworkDetailRiskFindingRow[];
  totalCount: number;
  assetHighRiskCvesByAssetId: Record<string, HighRiskCveDetail[]>;
}

const severityOrder: FindingSeverity[] = ["Critical Exposure", "High Risk", "Major", "Moderate", "Data Gap"];
const findingCriticalityFilterOptions: Exclude<FindingSeverity, "Data Gap">[] = [
  "Critical Exposure",
  "High Risk",
  "Major",
  "Moderate"
];
const chartLayout = {
  left: 78,
  right: 78,
  top: 60,
  bottom: 34,
  rowGap: 30,
  minHeight: 330
};

function chartSurfaceClass(embedded?: boolean): string {
  return embedded
    ? "flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-lg border border-sky-300/15 bg-slate-950/45 p-2"
    : "panel flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden p-4";
}

function severityStrokeColor(severity: FindingSeverity): string {
  if (severity === "Critical Exposure") {
    return "#ef4444";
  }
  if (severity === "High Risk") {
    return "#f97316";
  }
  if (severity === "Major") {
    return "#f59e0b";
  }
  if (severity === "Moderate") {
    return "#38bdf8";
  }
  return "#94a3b8";
}

function sortEnvironmentLabel(left: string, right: string): number {
  const order = ["Production", "Development", "UAT", "Test", "Unassigned"];
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);
  if (leftIndex !== rightIndex) {
    return (leftIndex === -1 ? order.length : leftIndex) - (rightIndex === -1 ? order.length : rightIndex);
  }
  return left.localeCompare(right);
}

function truncateAxisLabel(value: string): string {
  return value.length > 22 ? `${value.slice(0, 21)}...` : value;
}

function spiIdFromNodeValue(value: string): number | null {
  const parsed = Number(value.replace("SPI ", ""));
  return Number.isInteger(parsed) ? parsed : null;
}

function buildApiUrl(path: string, extraParams: Record<string, string | number | null | undefined> = {}): string {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  for (const [key, value] of Object.entries(extraParams)) {
    if (value === null || value === undefined || value === "" || value === "all") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function axisX(axisIndex: number, axisCount: number, width: number): number {
  const innerWidth = Math.max(1, width - chartLayout.left - chartLayout.right);
  return chartLayout.left + (axisIndex * innerWidth) / Math.max(1, axisCount - 1);
}

function valueVirtualY(axis: ImpactAnalyser2Axis, valueIndex: number, virtualHeight: number): number {
  const innerHeight = Math.max(1, virtualHeight - chartLayout.top - chartLayout.bottom);
  if (axis.values.length <= 1) {
    return chartLayout.top + innerHeight / 2;
  }
  return chartLayout.top + (valueIndex * innerHeight) / (axis.values.length - 1);
}

function selectedNodeEquals(left: ImpactAnalyser2SelectedNode | null, right: ImpactAnalyser2SelectedNode): boolean {
  return Boolean(left && left.axisKey === right.axisKey && left.value === right.value);
}

function isSelectedNode(selectedNode: ImpactAnalyser2SelectedNode | null, axisKey: string, value: string): boolean {
  return Boolean(selectedNode && selectedNode.axisKey === axisKey && selectedNode.value === value);
}

function nodeHoverTitle(
  axisKey: string,
  value: string,
  spiCounts: Map<number, number>
): string {
  if (axisKey !== "spi") {
    return value;
  }
  const spiId = spiIdFromNodeValue(value);
  if (!spiId) {
    return value;
  }
  const name = SPI_NAMES[spiId as keyof typeof SPI_NAMES] ?? value;
  const description = SPI_DESCRIPTIONS[spiId as keyof typeof SPI_DESCRIPTIONS] ?? "No SPI description available.";
  const successMeasure =
    SPI_SUCCESS_MEASURES[spiId as keyof typeof SPI_SUCCESS_MEASURES] ?? "No SPI success measure available.";
  return `${value}: ${name}\n${description}\nSuccess Measure: ${successMeasure}\nTotal Findings: ${spiCounts.get(spiId) ?? 0}`;
}

function disposeLine(line: THREE.LineSegments | null) {
  if (!line) {
    return;
  }
  line.geometry.dispose();
  const material = line.material;
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
  } else {
    material.dispose();
  }
}

function ImpactAnalyserLoadingOverlay({
  title,
  message
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="absolute inset-0 z-40 flex cursor-wait items-center justify-center bg-slate-950/60 px-4">
      <div className="w-[min(360px,92%)] rounded-xl border border-sky-300/35 bg-slate-900 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.6)]">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-200">Loading</p>
          <p className="mt-1 text-base font-semibold text-sky-100">{title}</p>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-sky-300" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-slate-200">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-cyan-100" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}

export function IctSystemImpactAnalyser2Chart({
  embedded = false,
  systemScopeIds
}: {
  embedded?: boolean;
  systemScopeIds?: string[];
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const baseLineRef = useRef<THREE.LineSegments | null>(null);
  const overlayAnimationFrameRef = useRef<number | null>(null);
  const selectedNodeRef = useRef<ImpactAnalyser2SelectedNode | null>(null);
  const workerResultRef = useRef<ImpactAnalyser2WorkerResult | null>(null);
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const scrollTopRef = useRef(0);

  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [environmentOptions, setEnvironmentOptions] = useState<ImpactAnalyser2EnvironmentOption[]>([]);
  const [securityDomainOptions, setSecurityDomainOptions] = useState<SecurityDomain[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<ImpactAnalyser2EnvironmentOption | "all">("all");
  const [selectedSecurityDomain, setSelectedSecurityDomain] = useState<SecurityDomain | "all">("all");
  const [selectedFindingCriticality, setSelectedFindingCriticality] = useState<ImpactAnalyser2FindingCriticalityOption | "all">("all");
  const [diagramSearch, setDiagramSearch] = useState("");
  const [selectedSearchOption, setSelectedSearchOption] = useState<ImpactAnalyser2SelectedSearchOption | null>(null);
  const [isDiagramSearchFocused, setIsDiagramSearchFocused] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ImpactAnalyser2SelectedNode | null>(null);
  const [workerResult, setWorkerResult] = useState<ImpactAnalyser2WorkerResult | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string; placement?: "left" | "default" } | null>(null);
  const [drillThroughData, setDrillThroughData] = useState<ImpactAnalyser2FindingsResponse | null>(null);
  const [drillThroughError, setDrillThroughError] = useState<string | null>(null);
  const [isDrillThroughLoading, setIsDrillThroughLoading] = useState(false);
  const hasSystemScope = Array.isArray(systemScopeIds);
  const systemScopeKey = hasSystemScope ? Array.from(new Set(systemScopeIds)).sort().join(",") : "";
  const normalizedSystemScopeIds = useMemo(
    () => (hasSystemScope ? (systemScopeKey ? systemScopeKey.split(",").filter(Boolean) : []) : null),
    [hasSystemScope, systemScopeKey]
  );

  const spiCounts = useMemo(() => new Map(workerResult?.spiCounts ?? []), [workerResult?.spiCounts]);
  const hasActiveHighlight = Boolean(selectedNode);
  const isDiagramInitialLoading = loadState === "idle" || loadState === "loading" || !workerReady || !workerResult;
  const displayedSeverities = useMemo(
    () =>
      severityOrder.filter((severity) =>
        workerResult?.axes.some((axis) => axis.key === "severity" && axis.values.includes(severity))
      ),
    [workerResult?.axes]
  );

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    workerResultRef.current = workerResult;
  }, [workerResult]);

  useEffect(() => {
    viewportSizeRef.current = viewportSize;
  }, [viewportSize]);

  useEffect(() => {
    scrollTopRef.current = scrollTop;
  }, [scrollTop]);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      setLoadState("error");
      setLoadError("Web Worker support is unavailable in this browser/session.");
      return;
    }

    const worker = new Worker(new URL("./ict-system-impact-analyser-2-worker.ts", import.meta.url), {
      type: "module"
    });
    workerRef.current = worker;
    worker.onmessage = (
      event: MessageEvent<
        | {
            type: "initialized";
            totalRowCount: number;
            environmentOptions: ImpactAnalyser2EnvironmentOption[];
            securityDomainOptions: SecurityDomain[];
          }
        | ({ type: "filtered"; requestId: number } & ImpactAnalyser2WorkerResult)
      >
    ) => {
      if (event.data.type === "initialized") {
        setEnvironmentOptions(event.data.environmentOptions.sort(sortEnvironmentLabel) as ImpactAnalyser2EnvironmentOption[]);
        setSecurityDomainOptions(event.data.securityDomainOptions);
        setWorkerReady(true);
        return;
      }
      if (event.data.requestId !== latestRequestIdRef.current) {
        return;
      }
      setWorkerResult({
        axes: event.data.axes,
        filteredRowCount: event.data.filteredRowCount,
        totalRowCount: event.data.totalRowCount,
        highlightedRowCount: event.data.highlightedRowCount,
        virtualHeight: event.data.virtualHeight,
        basePositions: event.data.basePositions,
        baseColors: event.data.baseColors,
        highlightPositions: event.data.highlightPositions,
        highlightColors: event.data.highlightColors,
        spiCounts: event.data.spiCounts,
        searchOptions: event.data.searchOptions
      });
    };
    worker.onerror = () => {
      setLoadState("error");
      setLoadError("The ICT System Impact Analyser worker failed to initialise.");
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    async function loadRows() {
      setLoadState("loading");
      setLoadError(null);
      try {
        const response = await fetch(buildApiUrl("/api/cyber-cop/impact-analyser-2"), { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }
        const payload = (await response.json()) as { rows: ImpactAnalyser2Row[] };
        if (isCancelled) {
          return;
        }
        workerRef.current?.postMessage({ type: "init", rows: payload.rows });
        setLoadState("ready");
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setLoadState("error");
        setLoadError(error instanceof Error ? error.message : "Unable to load analyser data.");
      }
    }

    loadRows();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const updateSize = () => {
      const nextSize = {
        width: Math.max(1, Math.floor(viewport.clientWidth)),
        height: Math.max(1, Math.floor(viewport.clientHeight))
      };
      setViewportSize(nextSize);
      setScrollTop(viewport.scrollTop);
    };
    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!workerReady || !workerRef.current || !viewportSize.width) {
      return;
    }
    latestRequestIdRef.current += 1;
    workerRef.current.postMessage({
      type: "filter",
      requestId: latestRequestIdRef.current,
      filters: {
        environment: selectedEnvironment,
        securityDomain: selectedSecurityDomain,
        findingCriticality: selectedFindingCriticality,
        search: diagramSearch,
        selectedSearchOption,
        systemIds: normalizedSystemScopeIds
      },
      selectedNode,
      layout: {
        width: viewportSize.width,
        left: chartLayout.left,
        right: chartLayout.right,
        top: chartLayout.top,
        bottom: chartLayout.bottom,
        rowGap: chartLayout.rowGap,
        minHeight: chartLayout.minHeight
      },
      searchOptionLimit: 60
    });
  }, [
    diagramSearch,
    selectedSearchOption,
    selectedEnvironment,
    selectedFindingCriticality,
    normalizedSystemScopeIds,
    selectedNode,
    selectedSecurityDomain,
    viewportSize.width,
    workerReady
  ]);

  useEffect(() => {
    setSelectedNode(
      selectedSearchOption ? { axisKey: selectedSearchOption.axisKey, value: selectedSearchOption.value } : null
    );
    setDrillThroughData(null);
    setDrillThroughError(null);
  }, [selectedEnvironment, selectedFindingCriticality, selectedSearchOption, selectedSecurityDomain]);

  useEffect(() => {
    setSelectedNode(null);
    setDrillThroughData(null);
    setDrillThroughError(null);
  }, [systemScopeKey]);

  useEffect(() => {
    if (!selectedNode || !workerResult || !viewportRef.current) {
      return;
    }
    const axis = workerResult.axes.find((item) => item.key === selectedNode.axisKey);
    if (!axis) {
      return;
    }
    const valueIndex = axis.values.indexOf(selectedNode.value);
    if (valueIndex < 0) {
      return;
    }
    const nodeY = valueVirtualY(axis, valueIndex, workerResult.virtualHeight);
    const viewport = viewportRef.current;
    const topBoundary = viewport.scrollTop + 72;
    const bottomBoundary = viewport.scrollTop + Math.max(96, viewport.clientHeight - 72);
    if (nodeY < topBoundary || nodeY > bottomBoundary) {
      viewport.scrollTo({
        top: Math.max(0, nodeY - viewport.clientHeight / 2),
        behavior: "smooth"
      });
    }
  }, [selectedNode, workerResult]);

  useEffect(() => {
    if (selectedEnvironment !== "all" && !environmentOptions.includes(selectedEnvironment)) {
      setSelectedEnvironment("all");
    }
  }, [environmentOptions, selectedEnvironment]);

  useEffect(() => {
    if (selectedSecurityDomain !== "all" && !securityDomainOptions.includes(selectedSecurityDomain)) {
      setSelectedSecurityDomain("all");
    }
  }, [securityDomainOptions, selectedSecurityDomain]);

  useEffect(() => {
    const width = viewportSize.width;
    const height = viewportSize.height;
    const canvas = webglCanvasRef.current;
    const result = workerResult;
    if (!canvas || !result || width <= 0 || height <= 0) {
      return;
    }

    let renderer = rendererRef.current;
    if (!renderer) {
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
      } catch {
        setLoadError("WebGL is unavailable in this browser/session. The V2 line renderer cannot start.");
        return;
      }
      rendererRef.current = renderer;
      sceneRef.current = new THREE.Scene();
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);

    const scene = sceneRef.current ?? new THREE.Scene();
    sceneRef.current = scene;
    if (baseLineRef.current) {
      scene.remove(baseLineRef.current);
      disposeLine(baseLineRef.current);
      baseLineRef.current = null;
    }

    if (result.basePositions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(result.basePositions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(result.baseColors, 3));
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: hasActiveHighlight ? 0.14 : 0.42,
        depthTest: false
      });
      const line = new THREE.LineSegments(geometry, material);
      baseLineRef.current = line;
      scene.add(line);
    }

    const camera = new THREE.OrthographicCamera(0, width, scrollTop, scrollTop + height, -1, 1);
    renderer.clear();
    renderer.render(scene, camera);
  }, [hasActiveHighlight, scrollTop, viewportSize.height, viewportSize.width, workerResult]);

  useEffect(() => {
    return () => {
      if (overlayAnimationFrameRef.current) {
        window.cancelAnimationFrame(overlayAnimationFrameRef.current);
      }
      disposeLine(baseLineRef.current);
      baseLineRef.current = null;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  const drawOverlay = useCallback(
    (timestamp: number) => {
      const canvas = overlayCanvasRef.current;
      const result = workerResultRef.current;
      const size = viewportSizeRef.current;
      if (!canvas || !result || size.width <= 0 || size.height <= 0) {
        return;
      }

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.max(1, Math.floor(size.width * pixelRatio));
      const targetHeight = Math.max(1, Math.floor(size.height * pixelRatio));
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        canvas.style.width = `${size.width}px`;
        canvas.style.height = `${size.height}px`;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, size.width, size.height);
      const selected = selectedNodeRef.current;
      const currentScrollTop = scrollTopRef.current;

      if (result.highlightPositions.length) {
        const pulse = 0.65 + Math.sin(timestamp / 180) * 0.25;
        context.save();
        context.shadowBlur = 12;
        context.shadowColor = "rgba(103, 232, 249, 0.85)";
        context.lineCap = "round";
        context.lineJoin = "round";
        context.globalAlpha = 0.75 + pulse * 0.25;
        context.strokeStyle = "rgba(103, 232, 249, 0.9)";
        context.lineWidth = 2.2 + pulse * 2.2;
        for (let index = 0; index < result.highlightPositions.length; index += 6) {
          context.beginPath();
          context.moveTo(result.highlightPositions[index], result.highlightPositions[index + 1] - currentScrollTop);
          context.lineTo(result.highlightPositions[index + 3], result.highlightPositions[index + 4] - currentScrollTop);
          context.stroke();
        }
        context.restore();
      }

      context.font = "600 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
      result.axes.forEach((axis, axisIndex) => {
        const x = axisX(axisIndex, result.axes.length, size.width);
        context.strokeStyle = "rgba(125, 211, 252, 0.34)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, chartLayout.top - currentScrollTop);
        context.lineTo(x, result.virtualHeight - chartLayout.bottom - currentScrollTop);
        context.stroke();

        context.textAlign = axisIndex === 0 ? "left" : axisIndex === result.axes.length - 1 ? "right" : "center";
        context.fillStyle = "rgba(241, 245, 249, 0.96)";
        context.fillText(`${axis.label} (${axis.values.length})`, axisIndex === 0 ? 8 : axisIndex === result.axes.length - 1 ? size.width - 8 : x, 24);

        const innerHeight = Math.max(1, result.virtualHeight - chartLayout.top - chartLayout.bottom);
        const startRatio = Math.max(0, (currentScrollTop - chartLayout.top - 48) / innerHeight);
        const endRatio = Math.min(1, (currentScrollTop + size.height - chartLayout.top + 48) / innerHeight);
        const startIndex = axis.values.length <= 1 ? 0 : Math.max(0, Math.floor(startRatio * (axis.values.length - 1)) - 1);
        const endIndex =
          axis.values.length <= 1
            ? 0
            : Math.min(axis.values.length - 1, Math.ceil(endRatio * (axis.values.length - 1)) + 1);

        for (let valueIndex = startIndex; valueIndex <= endIndex; valueIndex += 1) {
          const value = axis.values[valueIndex];
          const y = valueVirtualY(axis, valueIndex, result.virtualHeight) - currentScrollTop;
          if (y < -28 || y > size.height + 28) {
            continue;
          }
          const isSelected = isSelectedNode(selected, axis.key, value);
          context.beginPath();
          context.arc(x, y, isSelected ? 12 : 7, 0, Math.PI * 2);
          context.fillStyle = isSelected ? "#67e8f9" : "rgba(14, 165, 233, 0.72)";
          context.fill();
          if (isSelected) {
            context.strokeStyle = "#ecfeff";
            context.lineWidth = 1.8;
            context.stroke();
          }

          context.textAlign = "center";
          context.fillStyle = isSelected ? "#cffafe" : "rgba(203, 213, 225, 0.92)";
          context.font = `${isSelected ? "600" : "500"} 10px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
          context.fillText(truncateAxisLabel(value), x, y + 22);

          if (isSelected && axis.key === "spi") {
            context.beginPath();
            context.arc(x + 13, y - 13, 7, 0, Math.PI * 2);
            context.fillStyle = "#0f172a";
            context.fill();
            context.strokeStyle = "#ecfeff";
            context.lineWidth = 1.4;
            context.stroke();
            context.strokeStyle = "#ecfeff";
            context.lineWidth = 1.6;
            context.lineCap = "round";
            context.beginPath();
            context.moveTo(x + 9.5, y - 13);
            context.lineTo(x + 16.5, y - 13);
            context.moveTo(x + 13, y - 16.5);
            context.lineTo(x + 13, y - 9.5);
            context.stroke();
          }
        }
      });

      if (result.highlightPositions.length) {
        overlayAnimationFrameRef.current = window.requestAnimationFrame(drawOverlay);
      }
    },
    []
  );

  useEffect(() => {
    if (overlayAnimationFrameRef.current) {
      window.cancelAnimationFrame(overlayAnimationFrameRef.current);
      overlayAnimationFrameRef.current = null;
    }
    overlayAnimationFrameRef.current = window.requestAnimationFrame(drawOverlay);
    return () => {
      if (overlayAnimationFrameRef.current) {
        window.cancelAnimationFrame(overlayAnimationFrameRef.current);
        overlayAnimationFrameRef.current = null;
      }
    };
  }, [drawOverlay, scrollTop, selectedNode, viewportSize.height, viewportSize.width, workerResult]);

  const findNodeAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = overlayCanvasRef.current;
      const result = workerResultRef.current;
      const size = viewportSizeRef.current;
      if (!canvas || !result) {
        return null;
      }
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const virtualY = y + scrollTopRef.current;
      let bestMatch: { node: ImpactAnalyser2SelectedNode; distance: number; plusAction: boolean } | null = null;
      for (let axisIndex = 0; axisIndex < result.axes.length; axisIndex += 1) {
        const axis = result.axes[axisIndex];
        const axisPixelX = axisX(axisIndex, result.axes.length, size.width);
        if (Math.abs(x - axisPixelX) > 34 && Math.abs(x - (axisPixelX + 13)) > 12) {
          continue;
        }
        if (!axis.values.length) {
          continue;
        }
        const innerHeight = Math.max(1, result.virtualHeight - chartLayout.top - chartLayout.bottom);
        const approximateIndex =
          axis.values.length <= 1
            ? 0
            : Math.round(((virtualY - chartLayout.top) / innerHeight) * (axis.values.length - 1));
        const candidates = [approximateIndex - 1, approximateIndex, approximateIndex + 1].filter(
          (index) => index >= 0 && index < axis.values.length
        );
        for (const valueIndex of candidates) {
          const nodeY = valueVirtualY(axis, valueIndex, result.virtualHeight);
          const value = axis.values[valueIndex];
          const distance = Math.hypot(x - axisPixelX, virtualY - nodeY);
          const plusDistance = Math.hypot(x - (axisPixelX + 13), virtualY - (nodeY - 13));
          const isSelectedSpiPlus =
            axis.key === "spi" &&
            isSelectedNode(selectedNodeRef.current, axis.key, value) &&
            plusDistance <= 11;
          if (isSelectedSpiPlus) {
            return { node: { axisKey: axis.key, value }, plusAction: true };
          }
          if (distance <= 18 && (!bestMatch || distance < bestMatch.distance)) {
            bestMatch = { node: { axisKey: axis.key, value }, distance, plusAction: false };
          }
        }
      }
      return bestMatch ? { node: bestMatch.node, plusAction: false } : null;
    },
    []
  );

  const openSpiDrillThrough = useCallback(
    async (spiId: number) => {
      setIsDrillThroughLoading(true);
      setDrillThroughError(null);
      try {
        const response = await fetch(
          buildApiUrl("/api/cyber-cop/impact-analyser-2/findings", {
            spiId,
            diagramEnvironment: selectedEnvironment,
            diagramSecurityDomain: selectedSecurityDomain,
            diagramFindingCriticality: selectedFindingCriticality,
            diagramSearch,
            diagramSearchAxis: selectedSearchOption?.axisKey,
            diagramSearchValue: selectedSearchOption?.value,
            diagramSystemIds: systemScopeKey
          }),
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }
        const payload = (await response.json()) as ImpactAnalyser2FindingsResponse;
        setDrillThroughData(payload);
      } catch (error) {
        setDrillThroughError(error instanceof Error ? error.message : "Unable to load SPI findings.");
      } finally {
        setIsDrillThroughLoading(false);
      }
    },
    [diagramSearch, selectedEnvironment, selectedFindingCriticality, selectedSearchOption, selectedSecurityDomain, systemScopeKey]
  );

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const hit = findNodeAtPoint(event.clientX, event.clientY);
      if (!hit) {
        setSelectedNode(null);
        return;
      }
      if (hit.plusAction) {
        const spiId = spiIdFromNodeValue(hit.node.value);
        if (spiId) {
          void openSpiDrillThrough(spiId);
        }
        return;
      }
      setSelectedNode((current) => (selectedNodeEquals(current, hit.node) ? null : hit.node));
    },
    [findNodeAtPoint, openSpiDrillThrough]
  );

  const handleOverlayPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const hit = findNodeAtPoint(event.clientX, event.clientY);
      if (!hit) {
        setHoverInfo(null);
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      setHoverInfo({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        text: hit.plusAction ? `Open findings for ${hit.node.value}` : nodeHoverTitle(hit.node.axisKey, hit.node.value, spiCounts),
        placement: hit.plusAction ? "left" : "default"
      });
    },
    [findNodeAtPoint, spiCounts]
  );

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const nextScrollTop = event.currentTarget.scrollTop;
    scrollTopRef.current = nextScrollTop;
    if (scrollFrameRef.current) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      setScrollTop(nextScrollTop);
      scrollFrameRef.current = null;
    });
  }, []);

  const clearDiagramSearch = () => {
    setDiagramSearch("");
    setSelectedSearchOption(null);
    setSelectedNode(null);
    setIsDiagramSearchFocused(false);
  };
  const isLeftPlacedTooltip = hoverInfo?.placement === "left";
  const tooltipMaxWidth = isLeftPlacedTooltip ? 180 : Math.min(320, Math.max(180, viewportSize.width - 16));
  const tooltipEstimatedHeight = hoverInfo?.text.includes("\n") ? 220 : 84;
  const tooltipLeft = hoverInfo
    ? isLeftPlacedTooltip
      ? Math.max(8, Math.min(hoverInfo.x - tooltipMaxWidth - 8, viewportSize.width - tooltipMaxWidth - 8))
      : Math.max(8, Math.min(hoverInfo.x + 12, viewportSize.width - tooltipMaxWidth - 8))
    : 8;
  const tooltipTop = hoverInfo
    ? Math.max(8, Math.min(hoverInfo.y + (isLeftPlacedTooltip ? -12 : 12), viewportSize.height - tooltipEstimatedHeight - 8))
    : 8;

  if (loadState === "error") {
    return (
      <section className={chartSurfaceClass(embedded)}>
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">ICT System Impact Analyser Diagram</h3>
        <p className="mt-3 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {loadError ?? "Unable to load ICT System Impact Analyser."}
        </p>
      </section>
    );
  }

  return (
    <>
      <section className={chartSurfaceClass(embedded)}>
        <div className="flex min-w-0 shrink-0 flex-col gap-2">
          <div className="min-w-0">
            <h3
              className="inline-block whitespace-nowrap text-sm uppercase tracking-[0.14em] text-slate-100"
              title="Scalable Canvas/WebGL analyser for open server findings across ICT system, environment, server, severity, and SPI."
            >
              ICT System Impact Analyser Diagram
            </h3>
          </div>
          <div className="flex w-full min-w-0 flex-nowrap items-start justify-start gap-2 overflow-visible">
            <div className="relative flex h-8 shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
              <label htmlFor="impact-analyser-2-search" className="whitespace-nowrap">
                Text Search
              </label>
              <div className="relative w-52 shrink-0">
                <input
                  id="impact-analyser-2-search"
                  type="search"
                  value={diagramSearch}
                  onChange={(event) => {
                    setDiagramSearch(event.target.value);
                    setSelectedSearchOption(null);
                    setSelectedNode(null);
                    setIsDiagramSearchFocused(true);
                  }}
                  onFocus={() => setIsDiagramSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setIsDiagramSearchFocused(false), 120)}
                  placeholder="Search diagram"
                  className="h-8 w-full rounded-md border border-sky-300/25 bg-slate-900/90 px-2 pr-14 text-xs normal-case tracking-normal text-slate-100 placeholder:text-slate-400/70"
                />
                {diagramSearch ? (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={clearDiagramSearch}
                    className="absolute right-1 top-1/2 h-6 -translate-y-1/2 rounded border border-slate-500/45 bg-slate-950/90 px-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200 transition hover:border-sky-200/50 hover:text-sky-100"
                  >
                    Clear
                  </button>
                ) : null}
                {diagramSearch.trim() && isDiagramSearchFocused ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-40 max-h-56 overflow-auto rounded-md border border-sky-400/35 bg-slate-950/95 p-1 shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
                    {workerResult?.searchOptions.length ? (
                      <ul className="space-y-1">
                        {workerResult.searchOptions.map((option) => (
                          <li key={`impact-analyser-2-search-${option.id}`}>
                            <button
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                const exactSearchOption = {
                                  axisKey: option.axisKey,
                                  value: option.label,
                                  label: option.label,
                                  category: option.category
                                };
                                setDiagramSearch(option.label);
                                setSelectedSearchOption(exactSearchOption);
                                setSelectedNode({ axisKey: exactSearchOption.axisKey, value: exactSearchOption.value });
                                setIsDiagramSearchFocused(false);
                              }}
                              className="w-full rounded-md border border-sky-400/20 bg-slate-900/70 px-2 py-1.5 text-left text-xs normal-case tracking-normal text-slate-100 hover:border-sky-300/45 hover:bg-slate-800/85"
                            >
                              <span className="block truncate">{option.label}</span>
                              <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-slate-400/80">
                                {option.category}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-xs normal-case tracking-normal text-slate-300">
                        No matching diagram values
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <label className="flex h-8 shrink-0 items-center gap-2 whitespace-nowrap text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
              <span>Environment</span>
              <select
                value={selectedEnvironment}
                onChange={(event) => setSelectedEnvironment(event.target.value as ImpactAnalyser2EnvironmentOption | "all")}
                className="h-8 w-32 rounded-md border border-sky-300/25 bg-slate-900/90 px-2 text-xs normal-case tracking-normal text-slate-100"
              >
                <option value="all">All</option>
                {environmentOptions.map((environment) => (
                  <option key={`impact-analyser-2-environment-${environment}`} value={environment}>
                    {environment}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-8 shrink-0 items-center gap-2 whitespace-nowrap text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
              <span>Findings Criticality</span>
              <select
                value={selectedFindingCriticality}
                onChange={(event) => setSelectedFindingCriticality(event.target.value as ImpactAnalyser2FindingCriticalityOption | "all")}
                className="h-8 w-36 rounded-md border border-sky-300/25 bg-slate-900/90 px-2 text-xs normal-case tracking-normal text-slate-100"
              >
                <option value="all">All</option>
                {findingCriticalityFilterOptions.map((severity) => (
                  <option key={`impact-analyser-2-finding-criticality-${severity}`} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-8 shrink-0 items-center gap-2 whitespace-nowrap text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
              <span>Security Domain</span>
              <select
                value={selectedSecurityDomain}
                onChange={(event) => setSelectedSecurityDomain(event.target.value as SecurityDomain | "all")}
                className="h-8 w-44 rounded-md border border-sky-300/25 bg-slate-900/90 px-2 text-xs normal-case tracking-normal text-slate-100"
              >
                <option value="all">All</option>
                {securityDomainOptions.map((domain) => (
                  <option key={`impact-analyser-2-security-domain-${domain}`} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-sky-300/15 bg-slate-950/45 p-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-300/75">
              {loadState === "loading" || !workerResult
                ? "Loading analyser data..."
                : `${workerResult.filteredRowCount} of ${workerResult.totalRowCount} open server findings${
                    selectedNode ? ` | ${workerResult.highlightedRowCount} highlighted via ${selectedNode.value}` : ""
                  }`}
            </p>
            <div className="flex flex-wrap justify-end gap-2 text-[11px] text-slate-300/80">
              {displayedSeverities.map((severity) => (
                <span key={`impact-analyser-2-legend-${severity}`} className="inline-flex items-center gap-1">
                  <span className="h-2 w-4 rounded-full" style={{ backgroundColor: severityStrokeColor(severity) }} />
                  {severity}
                </span>
              ))}
            </div>
          </div>
          <div
            ref={viewportRef}
            onScroll={handleScroll}
            className="relative mt-1.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-md border border-sky-300/10 bg-slate-950/35"
          >
            {workerResult && workerResult.filteredRowCount === 0 ? (
              <p className="m-3 rounded-md border border-sky-300/15 bg-slate-900/55 px-3 py-2 text-xs text-slate-300/80">
                No ICT System Impact Analyser findings match the selected filters.
              </p>
            ) : (
              <div style={{ height: workerResult?.virtualHeight ?? chartLayout.minHeight }}>
                <div className="sticky top-0 relative" style={{ height: viewportSize.height || "100%" }}>
                  <canvas
                    ref={webglCanvasRef}
                    className="absolute inset-0 h-full w-full"
                    aria-hidden="true"
                  />
                  <canvas
                    ref={overlayCanvasRef}
                    role="img"
                    aria-label="ICT System Impact Analyser Canvas WebGL parallel coordinates"
                    className="absolute inset-0 h-full w-full cursor-pointer"
                    onClick={handleOverlayClick}
                    onPointerMove={handleOverlayPointerMove}
                    onPointerLeave={() => setHoverInfo(null)}
                  />
                  {hoverInfo ? (
                    <div
                      className="pointer-events-none absolute z-30 whitespace-pre-line rounded-md border border-sky-300/35 bg-slate-950/95 px-3 py-2 text-xs text-slate-100 shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
                      style={{
                        left: tooltipLeft,
                        top: tooltipTop,
                        maxWidth: tooltipMaxWidth,
                        maxHeight: Math.max(80, viewportSize.height - 16),
                        overflow: "hidden"
                      }}
                    >
                      {hoverInfo.text}
                    </div>
                  ) : null}
                  {isDiagramInitialLoading ? (
                    <ImpactAnalyserLoadingOverlay
                      title="Loading Diagram"
                      message="Building the ICT System Impact Analyser paths and node index."
                    />
                  ) : null}
                  {isDrillThroughLoading ? (
                    <ImpactAnalyserLoadingOverlay
                      title="Loading Risk Detail"
                      message="Preparing selected SPI findings for the Risk Detail slide-out."
                    />
                  ) : null}
                  {drillThroughError ? (
                    <div className="absolute right-3 top-3 max-w-sm rounded-md border border-rose-400/35 bg-rose-950/90 px-3 py-2 text-xs text-rose-100 shadow-lg">
                      {drillThroughError}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {drillThroughData ? (
        <RiskFindingsDrillThrough
          selection={{
            id: `ict-system-impact-analyser-spi-${drillThroughData.selectedSpiId}`,
            label: `SPI ${drillThroughData.selectedSpiId}`,
            findings: drillThroughData.findings,
            totalCount: drillThroughData.totalCount,
            lockedSpiId: drillThroughData.selectedSpiId,
            emptyMessage: "No open findings were generated for the selected ICT System Impact Analyser SPI.",
            exportSlug: `ict-system-impact-analyser-spi-${drillThroughData.selectedSpiId}`
          }}
          allFindings={drillThroughData.allFindings}
          assetHighRiskCvesByAssetId={drillThroughData.assetHighRiskCvesByAssetId}
          asOfDate={drillThroughData.snapshotDate}
          onClose={() => setDrillThroughData(null)}
        />
      ) : null}
    </>
  );
}
