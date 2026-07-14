"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import {
  NetworkDetailRiskFindingRow,
  RiskFindingsDrillThrough
} from "@/components/network-detail-risk-charts";
import { ASSET_TYPES, assetTypeLabel, formatAssetTypeLabel, type CanonicalAssetType } from "@/lib/asset-taxonomy";
import { type SpiDefinition } from "@/lib/spi-definitions";
import { AssetType, FindingSeverity, HighRiskCveDetail, SecurityDomain } from "@/lib/types";

type ImpactAnalyser2EnvironmentOption = "Production" | "Development" | "UAT" | "Test" | "Unassigned";
type ImpactAnalyser2FindingCriticalityOption = FindingSeverity;
type ImpactAnalyser2DiagramMode = "risk" | "ci";
export type ImpactAnalyser2LoadState = "idle" | "loading" | "ready" | "error";

export interface ImpactAnalyser2Row {
  findingId: string | null;
  systemId: string | null;
  systemName: string;
  environmentType: ImpactAnalyser2EnvironmentOption | null;
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
  severity: FindingSeverity | null;
  spiId: number | null;
  spiLabel: string;
  hasOpenFinding: boolean;
  cmdbRecordUrl?: string | null;
  lifecycleEolStatus?: string;
  lifecycleWarrantyStatus?: string;
  operatingSystemSummary?: string | null;
  networkOsSummary?: string | null;
  patchStateSummary?: string | null;
  installedSoftwareCount?: number;
  vulnerabilityCount?: number;
  criticalVulnerabilityCount?: number;
  relatedAssetId?: string;
  relatedAssetName?: string;
  relatedAssetHostname?: string;
  relatedAssetType?: AssetType;
  relatedAssetIpAddress?: string;
  relatedAssetEnvironmentType?: ImpactAnalyser2EnvironmentOption | null;
  relatedAssetNetworkId?: string;
  relatedAssetNetworkName?: string;
  relatedAssetHasIctSystem?: boolean;
  relatedAssetSecurityDomain?: SecurityDomain;
  relatedAssetCmdbRecordUrl?: string | null;
  relatedAssetLifecycleEolStatus?: string;
  relatedAssetLifecycleWarrantyStatus?: string;
  relatedAssetOperatingSystemSummary?: string | null;
  relatedAssetNetworkOsSummary?: string | null;
  relatedAssetPatchStateSummary?: string | null;
  relatedAssetInstalledSoftwareCount?: number;
  relatedAssetVulnerabilityCount?: number;
  relatedAssetCriticalVulnerabilityCount?: number;
  relatedSystemId?: string | null;
  relatedSystemName?: string;
}

interface ImpactAnalyser2Axis {
  key: string;
  label: string;
  values: string[];
}

interface ImpactAnalyser2SearchOption {
  id: string;
  label: string;
  value: string;
  category: string;
  axisKey: string;
}

export interface ImpactAnalyser2SelectedSearchOption {
  axisKey: string;
  value: string;
  label: string;
  category: string;
}

export interface ImpactAnalyser2SelectedNode {
  axisKey: string;
  value: string;
}

interface ImpactAnalyser2WorkerResult {
  initRequestId: number;
  requestId: number;
  axes: ImpactAnalyser2Axis[];
  filteredRowCount: number;
  totalRowCount: number;
  filteredFindingRowCount: number;
  filteredAssetCount: number;
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

type ImpactAnalyser2ActionHit = "none" | "spi-findings" | "asset-focus" | "asset-details";
type ImpactAnalyser2PendingViewportAction =
  | { type: "reset" }
  | { type: "clamp" }
  | { type: "scroll-to-selected-node"; node: ImpactAnalyser2SelectedNode };

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

function sortAssetTypeLabel(left: string, right: string): number {
  const leftIndex = ASSET_TYPES.indexOf(left as CanonicalAssetType);
  const rightIndex = ASSET_TYPES.indexOf(right as CanonicalAssetType);
  if (leftIndex !== rightIndex) {
    return (leftIndex === -1 ? ASSET_TYPES.length : leftIndex) - (rightIndex === -1 ? ASSET_TYPES.length : rightIndex);
  }
  return left.localeCompare(right);
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

function assetShapeLabel(assetType: string): string {
  return formatAssetTypeLabel(assetType);
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

function joinMultiFilterParam(values: string[]): string {
  return values.join(",");
}

function multiFilterLabel<T extends string>(selectedValues: T[], formatOption: (value: T) => string): string {
  if (!selectedValues.length) {
    return "All";
  }
  if (selectedValues.length === 1) {
    return formatOption(selectedValues[0]);
  }
  return `${selectedValues.length} selected`;
}

function MultiSelectFilter<T extends string>({
  label,
  options,
  selectedValues,
  onChange,
  formatOption,
  widthClassName = "w-40"
}: {
  label: string;
  options: T[];
  selectedValues: T[];
  onChange: (values: T[]) => void;
  formatOption: (value: T) => string;
  widthClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const toggleValue = (value: T) => {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((item) => item !== value));
      return;
    }
    onChange([...selectedValues, value]);
  };

  return (
    <div
      className="relative flex h-8 shrink-0 items-center gap-2 whitespace-nowrap text-[11px] uppercase tracking-[0.12em] text-slate-300/80"
      onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
    >
      <span>{label}</span>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className={`${widthClassName} flex h-8 items-center justify-between gap-2 rounded-md border border-sky-300/25 bg-slate-900/90 px-2 text-left text-xs normal-case tracking-normal text-slate-100 hover:border-sky-300/50`}
      >
        <span className="truncate">{multiFilterLabel(selectedValues, formatOption)}</span>
        <span className="text-[10px] text-slate-400">{isOpen ? "Close" : "Select"}</span>
      </button>
      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.25rem)] z-40 max-h-64 min-w-full overflow-auto rounded-md border border-sky-400/35 bg-slate-950/95 p-1 shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange([])}
            className={`mb-1 flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs normal-case tracking-normal ${
              selectedValues.length === 0
                ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100"
                : "border-sky-400/15 bg-slate-900/70 text-slate-200 hover:border-sky-300/45 hover:bg-slate-800/85"
            }`}
          >
            <span>All</span>
            {selectedValues.length === 0 ? <span className="text-cyan-100">Selected</span> : null}
          </button>
          <div className="space-y-1">
            {options.map((option) => {
              const checked = selectedSet.has(option);
              return (
                <label
                  key={`impact-analyser-2-multi-filter-${label}-${option}`}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs normal-case tracking-normal ${
                    checked
                      ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100"
                      : "border-sky-400/15 bg-slate-900/70 text-slate-200 hover:border-sky-300/45 hover:bg-slate-800/85"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(option)}
                    className="h-3.5 w-3.5 rounded border-sky-300/45 bg-slate-950 text-cyan-300"
                  />
                  <span className="truncate">{formatOption(option)}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
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
  spiCounts: Map<number, number>,
  spiDefinitionById: Map<number, SpiDefinition>
): string {
  if (axisKey !== "spi") {
    return value;
  }
  const spiId = spiIdFromNodeValue(value);
  if (!spiId) {
    return value;
  }
  const definition = spiDefinitionById.get(spiId);
  const name = definition?.name ?? value;
  const description = definition?.description ?? "No SPI description available.";
  const successMeasure = definition?.successMeasure ?? "No SPI success measure available.";
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

function SelectedAssetPanel({
  title,
  text,
  placement,
  copyFeedback,
  onCopy
}: {
  title: string;
  text: string;
  placement: "bottom-left" | "top-right";
  copyFeedback: "idle" | "copied" | "failed";
  onCopy: () => void;
}) {
  const placementClass = placement === "bottom-left" ? "bottom-3 left-3" : "right-3 top-3";
  return (
    <section
      className={`pointer-events-auto absolute ${placementClass} z-20 w-[22rem] rounded-2xl border border-sky-300/35 bg-slate-950/92 p-3 text-slate-100 shadow-[0_12px_28px_rgba(0,0,0,0.45)]`}
    >
      <p className="text-[11px] uppercase tracking-[0.12em] text-sky-100">{title}</p>
      <pre className="mt-2 select-text whitespace-pre-wrap break-words rounded-md border border-slate-700/70 bg-slate-900/70 p-2 text-xs leading-5 text-slate-100">
        {text}
      </pre>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-cyan-300/45 bg-cyan-500/14 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/24"
        >
          Copy Text
        </button>
        {copyFeedback === "copied" ? (
          <span className="text-xs text-emerald-200">Copied</span>
        ) : copyFeedback === "failed" ? (
          <span className="text-xs text-red-200">Copy failed</span>
        ) : null}
      </div>
    </section>
  );
}

function formatAssetDetailValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "Not supplied";
  }
  return String(value);
}

interface AssetDetailsPanelModel {
  assetId: string;
  assetName: string;
  assetHostname: string;
  assetType: AssetType;
  assetIpAddress: string;
  networkId: string;
  networkName: string;
  hasIctSystem: boolean;
  systemName: string;
  environmentType: ImpactAnalyser2EnvironmentOption | null;
  securityDomain: SecurityDomain;
  cmdbRecordUrl?: string | null;
  lifecycleEolStatus?: string;
  lifecycleWarrantyStatus?: string;
  operatingSystemSummary?: string | null;
  networkOsSummary?: string | null;
  patchStateSummary?: string | null;
  installedSoftwareCount?: number;
  vulnerabilityCount?: number;
  criticalVulnerabilityCount?: number;
}

function rootAssetDetailsFromRow(row: ImpactAnalyser2Row): AssetDetailsPanelModel {
  return {
    assetId: row.assetId,
    assetName: row.assetName,
    assetHostname: row.assetHostname,
    assetType: row.assetType,
    assetIpAddress: row.assetIpAddress,
    networkId: row.networkId,
    networkName: row.networkName,
    hasIctSystem: row.hasIctSystem,
    systemName: row.systemName,
    environmentType: row.environmentType,
    securityDomain: row.securityDomain,
    cmdbRecordUrl: row.cmdbRecordUrl ?? null,
    lifecycleEolStatus: row.lifecycleEolStatus,
    lifecycleWarrantyStatus: row.lifecycleWarrantyStatus,
    operatingSystemSummary: row.operatingSystemSummary,
    networkOsSummary: row.networkOsSummary,
    patchStateSummary: row.patchStateSummary,
    installedSoftwareCount: row.installedSoftwareCount,
    vulnerabilityCount: row.vulnerabilityCount,
    criticalVulnerabilityCount: row.criticalVulnerabilityCount
  };
}

function relatedAssetDetailsFromRow(row: ImpactAnalyser2Row): AssetDetailsPanelModel | null {
  if (!row.relatedAssetId || !row.relatedAssetType) {
    return null;
  }
  return {
    assetId: row.relatedAssetId,
    assetName: row.relatedAssetName || row.relatedAssetHostname || row.relatedAssetId,
    assetHostname: row.relatedAssetHostname || row.relatedAssetName || row.relatedAssetId,
    assetType: row.relatedAssetType,
    assetIpAddress: row.relatedAssetIpAddress || "N/A",
    networkId: row.relatedAssetNetworkId ?? "Not supplied",
    networkName: row.relatedAssetNetworkName ?? row.relatedAssetNetworkId ?? "Not supplied",
    hasIctSystem: row.relatedAssetHasIctSystem === true,
    systemName: row.relatedSystemName ?? "Not linked to ICT system",
    environmentType: row.relatedAssetEnvironmentType ?? null,
    securityDomain: row.relatedAssetSecurityDomain ?? "Unclassified",
    cmdbRecordUrl: row.relatedAssetCmdbRecordUrl ?? null,
    lifecycleEolStatus: row.relatedAssetLifecycleEolStatus,
    lifecycleWarrantyStatus: row.relatedAssetLifecycleWarrantyStatus,
    operatingSystemSummary: row.relatedAssetOperatingSystemSummary,
    networkOsSummary: row.relatedAssetNetworkOsSummary,
    patchStateSummary: row.relatedAssetPatchStateSummary,
    installedSoftwareCount: row.relatedAssetInstalledSoftwareCount,
    vulnerabilityCount: row.relatedAssetVulnerabilityCount,
    criticalVulnerabilityCount: row.relatedAssetCriticalVulnerabilityCount
  };
}

function AssetDetailsPanel({
  asset,
  isOpen,
  onClose
}: {
  asset: AssetDetailsPanelModel;
  isOpen: boolean;
  onClose: () => void;
}) {
  const cmdbRecordUrl = asset.cmdbRecordUrl?.trim() ?? "";
  const detailRows: Array<[string, string | number | null | undefined]> = [
    ["Asset ID", asset.assetId],
    ["Name", asset.assetName],
    ["Hostname", asset.assetHostname],
    ["Asset Type", formatAssetTypeLabel(asset.assetType)],
    ["IP Address", asset.assetIpAddress],
    ["Network", asset.networkName || asset.networkId],
    ["ICT System", asset.hasIctSystem ? asset.systemName : "Not linked to ICT system"],
    ["Environment", asset.environmentType ?? "Unassigned"],
    ["Security Domain", asset.securityDomain],
    ["Lifecycle EOL", asset.lifecycleEolStatus],
    ["Warranty", asset.lifecycleWarrantyStatus],
    ["Operating System", asset.operatingSystemSummary],
    ["Network OS", asset.networkOsSummary],
    ["Patch Status", asset.patchStateSummary],
    ["Installed Software", asset.installedSoftwareCount],
    ["Vulnerabilities", asset.vulnerabilityCount],
    ["Critical Vulnerabilities", asset.criticalVulnerabilityCount]
  ];

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none cursor-default">
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 cursor-default select-none bg-slate-950/35 transition-opacity duration-200 ${
          isOpen ? "pointer-events-auto opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute left-0 top-0 flex h-full w-[min(29rem,94vw)] flex-col border-r border-sky-300/25 bg-slate-950/95 p-4 text-slate-100 shadow-[18px_0_40px_rgba(2,6,23,0.55)] transition-transform duration-200 ease-out pointer-events-auto cursor-default ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex cursor-default select-none items-start justify-between gap-3 border-b border-sky-300/20 pb-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-sky-200/80">Read Only</p>
            <h3 className="text-lg font-semibold text-sky-100">Asset Details</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600/80 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 cursor-text select-text overflow-y-auto py-3">
          <table className="w-full table-fixed border-separate border-spacing-y-1 text-left select-text">
            <tbody>
              {detailRows.map(([label, value], index) => (
                <tr key={label} className={index % 2 === 0 ? "bg-slate-900/35" : "bg-transparent"}>
                  <th
                    scope="row"
                    className="w-36 align-top rounded-l-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
                  >
                    {label}
                  </th>
                  <td className="rounded-r-md px-3 py-2 text-sm font-medium text-slate-100">
                    <span className="block break-words">{formatAssetDetailValue(value)}</span>
                  </td>
                </tr>
              ))}
              <tr className={detailRows.length % 2 === 0 ? "bg-slate-900/35" : "bg-transparent"}>
                <th
                  scope="row"
                  className="w-36 align-top rounded-l-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400"
                >
                  CMDB Record
                </th>
                <td className="rounded-r-md px-3 py-2 text-sm font-medium text-slate-100">
                  {cmdbRecordUrl ? (
                    <a
                      href={cmdbRecordUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="cursor-pointer break-words text-cyan-200 underline decoration-cyan-300/60 underline-offset-2 hover:text-cyan-100"
                    >
                      Open CMDB record
                    </a>
                  ) : (
                    "Not supplied"
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}

export function IctSystemImpactAnalyser2Chart({
  embedded = false,
  systemScopeIds,
  dataPath = "/api/cyber-cop/impact-analyser-2",
  findingsPath = "/api/cyber-cop/impact-analyser-2/findings",
  sourceRows: providedRows,
  diagramMode = "risk",
  title = "ICT System Impact Analyser Diagram",
  headingTooltip = "Scalable Canvas/WebGL analyser for open server findings across ICT system, environment, server, severity, and SPI.",
  assetAxisLabel = "Server",
  assetSearchCategory = "Server",
  includeNetworkAxis = false,
  showAssetTypeFilter = false,
  showSelectedTileText = false,
  spiDefinitions = [],
  onAssetFocus,
  assetFocusEligibleAssetIds,
  externalSelectedSearchOption,
  onSelectedNodeChange,
  onLoadStateChange,
  extraControls
}: {
  embedded?: boolean;
  systemScopeIds?: string[];
  dataPath?: string;
  findingsPath?: string;
  sourceRows?: ImpactAnalyser2Row[];
  diagramMode?: ImpactAnalyser2DiagramMode;
  title?: string;
  headingTooltip?: string;
  assetAxisLabel?: string;
  assetSearchCategory?: string;
  includeNetworkAxis?: boolean;
  showAssetTypeFilter?: boolean;
  showSelectedTileText?: boolean;
  spiDefinitions?: SpiDefinition[];
  onAssetFocus?: (assetId: string) => void;
  assetFocusEligibleAssetIds?: string[];
  externalSelectedSearchOption?: ImpactAnalyser2SelectedSearchOption | null;
  onSelectedNodeChange?: (node: ImpactAnalyser2SelectedNode | null) => void;
  onLoadStateChange?: (loadState: ImpactAnalyser2LoadState) => void;
  extraControls?: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const latestWorkerInitRequestIdRef = useRef(0);
  const acceptedWorkerResultRequestIdRef = useRef(0);
  const pendingViewportActionRef = useRef<ImpactAnalyser2PendingViewportAction | null>(null);
  const previousExternalSelectedSearchKeyRef = useRef<string | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const baseLineRef = useRef<THREE.LineSegments | null>(null);
  const overlayAnimationFrameRef = useRef<number | null>(null);
  const assetDetailsCloseTimerRef = useRef<number | null>(null);
  const selectedNodeRef = useRef<ImpactAnalyser2SelectedNode | null>(null);
  const workerResultRef = useRef<ImpactAnalyser2WorkerResult | null>(null);
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const scrollTopRef = useRef(0);

  const [loadState, setLoadState] = useState<ImpactAnalyser2LoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [acknowledgedWorkerInitRequestId, setAcknowledgedWorkerInitRequestId] = useState(0);
  const [sourceRows, setSourceRows] = useState<ImpactAnalyser2Row[]>([]);
  const [environmentOptions, setEnvironmentOptions] = useState<ImpactAnalyser2EnvironmentOption[]>([]);
  const [securityDomainOptions, setSecurityDomainOptions] = useState<SecurityDomain[]>([]);
  const [assetTypeOptions, setAssetTypeOptions] = useState<CanonicalAssetType[]>([]);
  const [selectedEnvironments, setSelectedEnvironments] = useState<ImpactAnalyser2EnvironmentOption[]>([]);
  const [selectedSecurityDomains, setSelectedSecurityDomains] = useState<SecurityDomain[]>([]);
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<CanonicalAssetType[]>([]);
  const [selectedFindingCriticalities, setSelectedFindingCriticalities] = useState<ImpactAnalyser2FindingCriticalityOption[]>([]);
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
  const [selectedTileCopyFeedback, setSelectedTileCopyFeedback] = useState<"idle" | "copied" | "failed">("idle");
  const [selectedAssetDetails, setSelectedAssetDetails] = useState<AssetDetailsPanelModel | null>(null);
  const [isAssetDetailsPanelOpen, setIsAssetDetailsPanelOpen] = useState(false);
  const hasSystemScope = Array.isArray(systemScopeIds);
  const systemScopeKey = hasSystemScope ? Array.from(new Set(systemScopeIds)).sort().join(",") : "";
  const normalizedSystemScopeIds = useMemo(
    () => (hasSystemScope ? (systemScopeKey ? systemScopeKey.split(",").filter(Boolean) : []) : null),
    [hasSystemScope, systemScopeKey]
  );
  const selectedEnvironmentKey = joinMultiFilterParam(selectedEnvironments);
  const selectedSecurityDomainKey = joinMultiFilterParam(selectedSecurityDomains);
  const selectedAssetTypeKey = joinMultiFilterParam(selectedAssetTypes);
  const selectedFindingCriticalityKey = joinMultiFilterParam(selectedFindingCriticalities);
  const isCiDiagramMode = diagramMode === "ci";
  const activeSelectedSearchOption = selectedSearchOption ?? externalSelectedSearchOption;
  const activeSelectedNode = useMemo<ImpactAnalyser2SelectedNode | null>(() => {
    if (selectedNode) {
      return selectedNode;
    }
    if (activeSelectedSearchOption) {
      return {
        axisKey: activeSelectedSearchOption.axisKey,
        value: activeSelectedSearchOption.value
      };
    }
    return null;
  }, [
    activeSelectedSearchOption,
    selectedNode
  ]);

  const spiCounts = useMemo(() => new Map(workerResult?.spiCounts ?? []), [workerResult?.spiCounts]);
  const spiDefinitionById = useMemo(
    () => new Map(spiDefinitions.map((definition) => [definition.spiId, definition])),
    [spiDefinitions]
  );
  const isDiagramInitialLoading = loadState === "idle" || loadState === "loading" || !workerReady || !workerResult;
  const reportedLoadState: ImpactAnalyser2LoadState =
    loadState === "error"
      ? "error"
      : loadState === "idle"
        ? "idle"
        : isDiagramInitialLoading
          ? "loading"
          : "ready";
  const displayedSeverities = useMemo(
    () =>
      isCiDiagramMode
        ? []
        : severityOrder.filter((severity) =>
            workerResult?.axes.some((axis) => axis.key === "severity" && axis.values.includes(severity))
          ),
    [isCiDiagramMode, workerResult?.axes]
  );
  const assetMetaById = useMemo(() => {
    const map = new Map<string, ImpactAnalyser2Row>();
    for (const row of sourceRows) {
      if (!map.has(row.assetId)) {
        map.set(row.assetId, row);
      }
    }
    return map;
  }, [sourceRows]);
  const relatedAssetMetaById = useMemo(() => {
    const map = new Map<string, ImpactAnalyser2Row>();
    for (const row of sourceRows) {
      if (row.relatedAssetId && !map.has(row.relatedAssetId)) {
        map.set(row.relatedAssetId, row);
      }
    }
    return map;
  }, [sourceRows]);
  const assetFocusEligibleAssetIdSet = useMemo(
    () => new Set(assetFocusEligibleAssetIds ?? []),
    [assetFocusEligibleAssetIds]
  );
  const isAssetFocusEligible = useCallback(
    (assetId: string) =>
      Boolean(onAssetFocus) &&
      (assetFocusEligibleAssetIds === undefined || assetFocusEligibleAssetIdSet.has(assetId)),
    [assetFocusEligibleAssetIdSet, assetFocusEligibleAssetIds, onAssetFocus]
  );
  const canOpenAssetDetails = useCallback(
    (axisKey: string, value: string) => {
      if (axisKey === "asset") {
        return assetMetaById.has(value);
      }
      if (isCiDiagramMode && axisKey === "relatedAsset") {
        return relatedAssetMetaById.has(value);
      }
      return false;
    },
    [assetMetaById, isCiDiagramMode, relatedAssetMetaById]
  );
  const selectedAssetMeta =
    activeSelectedNode?.axisKey === "asset" ? assetMetaById.get(activeSelectedNode.value) ?? null : null;
  const selectedAssetTileText = isCiDiagramMode && selectedAssetMeta
    ? [
        `Type: ${formatAssetTypeLabel(selectedAssetMeta.assetType)}`,
        `Name: ${selectedAssetMeta.assetName}`,
        `Hostname: ${selectedAssetMeta.assetHostname}`,
        `IP Address: ${selectedAssetMeta.assetIpAddress}`,
        `Environment: ${selectedAssetMeta.environmentType ?? "Unassigned"}`,
        `ICT System: ${selectedAssetMeta.hasIctSystem ? selectedAssetMeta.systemName : "Not linked to ICT system"}`,
        `Network: ${selectedAssetMeta.networkName || selectedAssetMeta.networkId}`
      ].join("\n")
    : null;
  const displayNodeLabel = useCallback(
    (axisKey: string, value: string) => {
      if (axisKey === "asset") {
        const asset = assetMetaById.get(value);
        return asset?.assetName || asset?.assetHostname || value;
      }
      if (axisKey === "relatedAsset") {
        const asset = relatedAssetMetaById.get(value);
        return asset?.relatedAssetName || asset?.relatedAssetHostname || value;
      }
      if (axisKey === "relatedSystem") {
        return value;
      }
      if (axisKey === "assetType") {
        return assetShapeLabel(value);
      }
      return value;
    },
    [assetMetaById, relatedAssetMetaById]
  );
  const assetShapeTypeForNode = useCallback(
    (axisKey: string, value: string): AssetType | null => {
      if (axisKey === "asset") {
        return assetMetaById.get(value)?.assetType ?? "other";
      }
      if (axisKey === "relatedAsset") {
        return relatedAssetMetaById.get(value)?.relatedAssetType ?? "other";
      }
      return null;
    },
    [assetMetaById, relatedAssetMetaById]
  );
  const reconcileDiagramViewport = useCallback((mode: "reset" | "clamp", virtualHeight?: number) => {
    const viewport = viewportRef.current;
    const currentVirtualHeight = virtualHeight ?? workerResultRef.current?.virtualHeight ?? chartLayout.minHeight;
    const viewportHeight = viewport?.clientHeight ?? viewportSizeRef.current.height;
    const maxScrollTop = Math.max(0, currentVirtualHeight - Math.max(1, viewportHeight));
    const nextScrollTop = mode === "reset" ? 0 : Math.min(scrollTopRef.current, maxScrollTop);
    if (viewport && Math.abs(viewport.scrollTop - nextScrollTop) > 1) {
      viewport.scrollTo({ top: nextScrollTop });
    }
    if (scrollTopRef.current !== nextScrollTop) {
      scrollTopRef.current = nextScrollTop;
      setScrollTop(nextScrollTop);
    }
  }, []);
  const scrollExactSearchNodeIntoView = useCallback(
    (node: ImpactAnalyser2SelectedNode, result: ImpactAnalyser2WorkerResult) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      const axis = result.axes.find((item) => item.key === node.axisKey);
      if (!axis) {
        return;
      }
      const valueIndex = axis.values.indexOf(node.value);
      if (valueIndex < 0) {
        reconcileDiagramViewport("clamp", result.virtualHeight);
        return;
      }
      const nodeY = valueVirtualY(axis, valueIndex, result.virtualHeight);
      const topBoundary = viewport.scrollTop + 72;
      const bottomBoundary = viewport.scrollTop + Math.max(96, viewport.clientHeight - 72);
      if (nodeY < topBoundary || nodeY > bottomBoundary) {
        const maxScrollTop = Math.max(0, result.virtualHeight - Math.max(1, viewport.clientHeight));
        const nextScrollTop = Math.min(maxScrollTop, Math.max(0, nodeY - viewport.clientHeight / 2));
        scrollTopRef.current = nextScrollTop;
        setScrollTop(nextScrollTop);
        viewport.scrollTo({ top: nextScrollTop, behavior: "smooth" });
      } else {
        reconcileDiagramViewport("clamp", result.virtualHeight);
      }
    },
    [reconcileDiagramViewport]
  );
  const queueDiagramFilterRefresh = useCallback((action: ImpactAnalyser2PendingViewportAction) => {
    pendingViewportActionRef.current = action;
    setDrillThroughData(null);
    setDrillThroughError(null);
  }, []);
  const clearRenderedDiagram = useCallback(() => {
    workerResultRef.current = null;
    const scene = sceneRef.current;
    if (baseLineRef.current) {
      scene?.remove(baseLineRef.current);
      disposeLine(baseLineRef.current);
      baseLineRef.current = null;
    }
    rendererRef.current?.clear();
    const overlayCanvas = overlayCanvasRef.current;
    const overlayContext = overlayCanvas?.getContext("2d");
    if (overlayCanvas && overlayContext) {
      overlayContext.setTransform(1, 0, 0, 1, 0, 0);
      overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
  }, []);
  const resetDiagramViewportForFilterChange = useCallback(() => {
    setSelectedSearchOption(null);
    setSelectedNode(null);
    setHoverInfo(null);
    queueDiagramFilterRefresh({ type: "reset" });
  }, [queueDiagramFilterRefresh]);
  useEffect(() => {
    const externalKey = externalSelectedSearchOption
      ? `${externalSelectedSearchOption.axisKey}:${externalSelectedSearchOption.value}`
      : null;
    if (!externalSelectedSearchOption) {
      if (previousExternalSelectedSearchKeyRef.current) {
        previousExternalSelectedSearchKeyRef.current = null;
        setDiagramSearch("");
        setSelectedSearchOption(null);
        setSelectedNode(null);
        setHoverInfo(null);
        queueDiagramFilterRefresh({ type: "reset" });
      }
      return;
    }
    if (previousExternalSelectedSearchKeyRef.current === externalKey) {
      return;
    }
    previousExternalSelectedSearchKeyRef.current = externalKey;
    const externalSelectedNode = {
      axisKey: externalSelectedSearchOption.axisKey,
      value: externalSelectedSearchOption.value
    };
    setDiagramSearch(externalSelectedSearchOption.label);
    setSelectedSearchOption(null);
    setSelectedNode(null);
    setIsDiagramSearchFocused(false);
    setHoverInfo(null);
    queueDiagramFilterRefresh({ type: "scroll-to-selected-node", node: externalSelectedNode });
  }, [
    externalSelectedSearchOption,
    externalSelectedSearchOption?.axisKey,
    externalSelectedSearchOption?.label,
    externalSelectedSearchOption?.value,
    queueDiagramFilterRefresh
  ]);
  const applyQueuedDiagramViewportAction = useCallback(
    (result: ImpactAnalyser2WorkerResult) => {
      const action: ImpactAnalyser2PendingViewportAction = pendingViewportActionRef.current ?? { type: "clamp" };
      pendingViewportActionRef.current = null;
      if (action.type === "reset") {
        reconcileDiagramViewport("reset", result.virtualHeight);
        return;
      }
      if (action.type === "scroll-to-selected-node") {
        scrollExactSearchNodeIntoView(action.node, result);
        return;
      }
      reconcileDiagramViewport("clamp", result.virtualHeight);
    },
    [reconcileDiagramViewport, scrollExactSearchNodeIntoView]
  );
  const copySelectedAssetTileText = useCallback(async () => {
    if (!selectedAssetTileText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedAssetTileText);
      setSelectedTileCopyFeedback("copied");
    } catch {
      setSelectedTileCopyFeedback("failed");
    }
  }, [selectedAssetTileText]);

  useEffect(() => {
    selectedNodeRef.current = activeSelectedNode;
    setSelectedTileCopyFeedback("idle");
  }, [activeSelectedNode]);

  useEffect(() => {
    onLoadStateChange?.(reportedLoadState);
  }, [onLoadStateChange, reportedLoadState]);

  useEffect(() => {
    return () => {
      if (assetDetailsCloseTimerRef.current !== null) {
        window.clearTimeout(assetDetailsCloseTimerRef.current);
        assetDetailsCloseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    onSelectedNodeChange?.(activeSelectedNode);
  }, [activeSelectedNode, onSelectedNodeChange]);

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
            initRequestId: number;
            totalRowCount: number;
            environmentOptions: ImpactAnalyser2EnvironmentOption[];
            assetTypeOptions: CanonicalAssetType[];
            securityDomainOptions: SecurityDomain[];
          }
        | ({ type: "filtered"; initRequestId: number; requestId: number } & ImpactAnalyser2WorkerResult)
      >
    ) => {
      if (event.data.type === "initialized") {
        if (event.data.initRequestId !== latestWorkerInitRequestIdRef.current) {
          return;
        }
        setEnvironmentOptions(event.data.environmentOptions.sort(sortEnvironmentLabel) as ImpactAnalyser2EnvironmentOption[]);
        setAssetTypeOptions(event.data.assetTypeOptions.sort(sortAssetTypeLabel) as CanonicalAssetType[]);
        setSecurityDomainOptions(event.data.securityDomainOptions);
        setAcknowledgedWorkerInitRequestId(event.data.initRequestId);
        setWorkerReady(true);
        setLoadState("ready");
        return;
      }
      if (event.data.initRequestId !== latestWorkerInitRequestIdRef.current) {
        return;
      }
      if (event.data.requestId !== latestRequestIdRef.current) {
        return;
      }
      acceptedWorkerResultRequestIdRef.current = event.data.requestId;
      setWorkerResult({
        initRequestId: event.data.initRequestId,
        requestId: event.data.requestId,
        axes: event.data.axes,
        filteredRowCount: event.data.filteredRowCount,
        totalRowCount: event.data.totalRowCount,
        filteredFindingRowCount: event.data.filteredFindingRowCount,
        filteredAssetCount: event.data.filteredAssetCount,
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
    const abortController = new AbortController();
    const initialiseRows = (rows: ImpactAnalyser2Row[]) => {
      const initRequestId = latestWorkerInitRequestIdRef.current + 1;
      latestWorkerInitRequestIdRef.current = initRequestId;
      acceptedWorkerResultRequestIdRef.current = 0;
      setSourceRows(rows);
      setWorkerReady(false);
      setAcknowledgedWorkerInitRequestId(0);
      clearRenderedDiagram();
      setWorkerResult(null);
      queueDiagramFilterRefresh({ type: "clamp" });
      workerRef.current?.postMessage({ type: "init", initRequestId, rows, diagramMode });
    };
    async function loadRows() {
      setLoadState("loading");
      setLoadError(null);
      try {
        if (providedRows) {
          if (isCancelled) {
            return;
          }
          initialiseRows(providedRows);
          return;
        }
        const response = await fetch(
          buildApiUrl(dataPath, {
            diagramSystemIds: systemScopeKey
          }),
          { cache: "no-store", signal: abortController.signal }
        );
        if (!response.ok) {
          throw new Error(`Request failed with ${response.status}`);
        }
        const payload = (await response.json()) as { rows: ImpactAnalyser2Row[] };
        if (isCancelled) {
          return;
        }
        initialiseRows(payload.rows);
      } catch (error) {
        if (isCancelled) {
          return;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setLoadState("error");
        setLoadError(error instanceof Error ? error.message : "Unable to load analyser data.");
      }
    }

    loadRows();
    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [clearRenderedDiagram, dataPath, diagramMode, providedRows, queueDiagramFilterRefresh, systemScopeKey]);

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
    if (!workerReady || !acknowledgedWorkerInitRequestId || !workerRef.current || !viewportSize.width) {
      return;
    }
    latestRequestIdRef.current += 1;
    workerRef.current.postMessage({
      type: "filter",
      initRequestId: acknowledgedWorkerInitRequestId,
      requestId: latestRequestIdRef.current,
      filters: {
        environment: selectedEnvironmentKey ? selectedEnvironmentKey.split(",") : [],
        securityDomain: selectedSecurityDomainKey ? selectedSecurityDomainKey.split(",") : [],
        findingCriticality: selectedFindingCriticalityKey ? selectedFindingCriticalityKey.split(",") : [],
        assetType: selectedAssetTypeKey ? selectedAssetTypeKey.split(",") : [],
        search: diagramSearch,
        selectedSearchOption: activeSelectedSearchOption,
        systemIds: normalizedSystemScopeIds
      },
      selectedNode: activeSelectedNode,
      layout: {
        assetAxisLabel,
        assetSearchCategory,
        includeNetworkAxis,
        diagramMode,
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
    activeSelectedSearchOption,
    selectedEnvironmentKey,
    selectedAssetTypeKey,
    selectedFindingCriticalityKey,
    normalizedSystemScopeIds,
    activeSelectedNode,
    selectedSecurityDomainKey,
    viewportSize.width,
    workerReady,
    assetAxisLabel,
    assetSearchCategory,
    includeNetworkAxis,
    diagramMode,
    acknowledgedWorkerInitRequestId
  ]);

  useEffect(() => {
    resetDiagramViewportForFilterChange();
  }, [
    selectedEnvironmentKey,
    selectedAssetTypeKey,
    selectedFindingCriticalityKey,
    selectedSecurityDomainKey,
    systemScopeKey,
    resetDiagramViewportForFilterChange
  ]);

  useEffect(() => {
    if (!workerResult) {
      return;
    }
    applyQueuedDiagramViewportAction(workerResult);
  }, [workerResult, applyQueuedDiagramViewportAction]);

  useEffect(() => {
    setSelectedEnvironments((current) => current.filter((environment) => environmentOptions.includes(environment)));
  }, [environmentOptions]);

  useEffect(() => {
    setSelectedSecurityDomains((current) => current.filter((domain) => securityDomainOptions.includes(domain)));
  }, [securityDomainOptions]);

  useEffect(() => {
    setSelectedAssetTypes((current) => current.filter((assetType) => assetTypeOptions.includes(assetType)));
  }, [assetTypeOptions]);

  useEffect(() => {
    const width = viewportSize.width;
    const height = viewportSize.height;
    const canvas = webglCanvasRef.current;
    const result = workerResult;
    if (!canvas || !result || width <= 0 || height <= 0) {
      return;
    }
    if (result.initRequestId !== acknowledgedWorkerInitRequestId) {
      return;
    }
    if (acceptedWorkerResultRequestIdRef.current !== result.requestId) {
      return;
    }

    let renderer = rendererRef.current;
    if (renderer && renderer.domElement !== canvas) {
      disposeLine(baseLineRef.current);
      baseLineRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      renderer = null;
    }
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
        opacity: selectedNodeRef.current ? 0.14 : 0.42,
        depthTest: false
      });
      const line = new THREE.LineSegments(geometry, material);
      baseLineRef.current = line;
      scene.add(line);
    }

    const maxRenderScrollTop = Math.max(0, result.virtualHeight - Math.max(1, height));
    const cameraScrollTop = Math.min(scrollTop, maxRenderScrollTop);
    if (cameraScrollTop !== scrollTop) {
      scrollTopRef.current = cameraScrollTop;
      setScrollTop(cameraScrollTop);
      viewportRef.current?.scrollTo({ top: cameraScrollTop });
    }
    const camera = new THREE.OrthographicCamera(0, width, cameraScrollTop, cameraScrollTop + height, -1, 1);
    renderer.clear();
    renderer.render(scene, camera);
  }, [acknowledgedWorkerInitRequestId, scrollTop, viewportSize.height, viewportSize.width, workerResult]);

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
    () => {
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
        context.save();
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = "#38bdf8";
        context.lineWidth = 2.4;
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

        context.textAlign = axisIndex === 0 ? "left" : axisIndex === result.axes.length - 1 ? "right" : "center";
        context.fillStyle = "rgba(241, 245, 249, 0.96)";
        context.fillText(`${axis.label} (${axis.values.length})`, axisIndex === 0 ? 8 : axisIndex === result.axes.length - 1 ? size.width - 8 : x, 24);

        if (!axis.values.length) {
          return;
        }

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
          const nodeRadius = isSelected ? 12 : 7;
          const assetType = assetShapeTypeForNode(axis.key, value);
          context.beginPath();
          if (assetType === "workstation") {
            context.moveTo(x, y - nodeRadius);
            context.lineTo(x + nodeRadius, y);
            context.lineTo(x, y + nodeRadius);
            context.lineTo(x - nodeRadius, y);
            context.closePath();
          } else if (assetType === "network-device") {
            context.moveTo(x, y - nodeRadius);
            context.lineTo(x + nodeRadius, y + nodeRadius * 0.85);
            context.lineTo(x - nodeRadius, y + nodeRadius * 0.85);
            context.closePath();
          } else if (assetType === "storage-device" || assetType === "other") {
            for (let side = 0; side < 6; side += 1) {
              const angle = -Math.PI / 2 + (side * Math.PI * 2) / 6;
              const pointX = x + Math.cos(angle) * nodeRadius;
              const pointY = y + Math.sin(angle) * nodeRadius;
              if (side === 0) {
                context.moveTo(pointX, pointY);
              } else {
                context.lineTo(pointX, pointY);
              }
            }
            context.closePath();
          } else if (assetType === "printer-device") {
            context.rect(x - nodeRadius, y - nodeRadius, nodeRadius * 2, nodeRadius * 2);
          } else {
            context.arc(x, y, nodeRadius, 0, Math.PI * 2);
          }
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
          context.fillText(truncateAxisLabel(displayNodeLabel(axis.key, value)), x, y + 22);

          if (!isCiDiagramMode && isSelected && axis.key === "spi") {
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
          if (!isCiDiagramMode && isSelected && axis.key === "asset" && isAssetFocusEligible(value)) {
            context.beginPath();
            context.arc(x + 13, y - 13, 7, 0, Math.PI * 2);
            context.fillStyle = "#0f172a";
            context.fill();
            context.strokeStyle = "#ecfeff";
            context.lineWidth = 1.4;
            context.stroke();
            context.fillStyle = "#ecfeff";
            context.font = "700 9px ui-sans-serif, system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText("F", x + 13, y - 12.5);
            context.textBaseline = "alphabetic";
          }
          if (isSelected && canOpenAssetDetails(axis.key, value)) {
            context.beginPath();
            context.arc(x + 13, y + 13, 7, 0, Math.PI * 2);
            context.fillStyle = "#0f172a";
            context.fill();
            context.strokeStyle = "#ecfeff";
            context.lineWidth = 1.4;
            context.stroke();
            context.fillStyle = "#ecfeff";
            context.font = "700 9px ui-sans-serif, system-ui, sans-serif";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText("D", x + 13, y + 13.5);
            context.textBaseline = "alphabetic";
          }
        }
      });

    },
    [assetShapeTypeForNode, canOpenAssetDetails, displayNodeLabel, isAssetFocusEligible, isCiDiagramMode]
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
  }, [activeSelectedNode, drawOverlay, scrollTop, viewportSize.height, viewportSize.width, workerResult]);

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
      let bestMatch: { node: ImpactAnalyser2SelectedNode; distance: number; action: ImpactAnalyser2ActionHit } | null = null;
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
          const topRightBadgeDistance = Math.hypot(x - (axisPixelX + 13), virtualY - (nodeY - 13));
          const bottomRightBadgeDistance = Math.hypot(x - (axisPixelX + 13), virtualY - (nodeY + 13));
          const isSelected = isSelectedNode(selectedNodeRef.current, axis.key, value);
          if (isSelected && canOpenAssetDetails(axis.key, value) && bottomRightBadgeDistance <= 11) {
            return {
              node: { axisKey: axis.key, value },
              action: "asset-details"
            };
          }
          const isSelectedActionBadge =
            ((!isCiDiagramMode && axis.key === "spi") || (axis.key === "asset" && isAssetFocusEligible(value))) &&
            isSelected &&
            topRightBadgeDistance <= 11;
          if (isSelectedActionBadge) {
            return {
              node: { axisKey: axis.key, value },
              action: axis.key === "asset" ? "asset-focus" : "spi-findings"
            };
          }
          if (distance <= 18 && (!bestMatch || distance < bestMatch.distance)) {
            bestMatch = { node: { axisKey: axis.key, value }, distance, action: "none" };
          }
        }
      }
      return bestMatch;
    },
    [canOpenAssetDetails, isAssetFocusEligible, isCiDiagramMode]
  );

  const openSpiDrillThrough = useCallback(
    async (spiId: number) => {
      setIsDrillThroughLoading(true);
      setDrillThroughError(null);
      try {
        const response = await fetch(
          buildApiUrl(findingsPath, {
            spiId,
            diagramEnvironment: selectedEnvironmentKey,
            diagramSecurityDomain: selectedSecurityDomainKey,
            diagramFindingCriticality: selectedFindingCriticalityKey,
            diagramAssetType: selectedAssetTypeKey,
            diagramSearch,
            diagramSearchAxis: activeSelectedSearchOption?.axisKey,
            diagramSearchValue: activeSelectedSearchOption?.value,
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
    [
      diagramSearch,
      findingsPath,
      selectedAssetTypeKey,
      selectedEnvironmentKey,
      selectedFindingCriticalityKey,
      activeSelectedSearchOption,
      selectedSecurityDomainKey,
      systemScopeKey
    ]
  );

  const openAssetDetails = useCallback(
    (node: ImpactAnalyser2SelectedNode) => {
      const asset =
        node.axisKey === "asset"
          ? assetMetaById.get(node.value)
          : isCiDiagramMode && node.axisKey === "relatedAsset"
            ? relatedAssetMetaById.get(node.value)
            : null;
      const assetDetails =
        node.axisKey === "asset" && asset
          ? rootAssetDetailsFromRow(asset)
          : node.axisKey === "relatedAsset" && asset
            ? relatedAssetDetailsFromRow(asset)
            : null;
      if (!assetDetails) {
        return;
      }
      if (assetDetailsCloseTimerRef.current !== null) {
        window.clearTimeout(assetDetailsCloseTimerRef.current);
        assetDetailsCloseTimerRef.current = null;
      }
      setSelectedAssetDetails(assetDetails);
      window.requestAnimationFrame(() => setIsAssetDetailsPanelOpen(true));
    },
    [assetMetaById, isCiDiagramMode, relatedAssetMetaById]
  );

  const closeAssetDetails = useCallback(() => {
    setIsAssetDetailsPanelOpen(false);
    if (assetDetailsCloseTimerRef.current !== null) {
      window.clearTimeout(assetDetailsCloseTimerRef.current);
    }
    assetDetailsCloseTimerRef.current = window.setTimeout(() => {
      setSelectedAssetDetails(null);
      assetDetailsCloseTimerRef.current = null;
    }, 220);
  }, []);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const hit = findNodeAtPoint(event.clientX, event.clientY);
      if (!hit) {
        if (selectedSearchOption || selectedNode || !externalSelectedSearchOption) {
          setSelectedSearchOption(null);
          setSelectedNode(null);
        }
        return;
      }
      if (!isCiDiagramMode && hit.action === "spi-findings") {
        const spiId = spiIdFromNodeValue(hit.node.value);
        if (spiId) {
          void openSpiDrillThrough(spiId);
        }
        return;
      }
      if (hit.action === "asset-focus") {
        onAssetFocus?.(hit.node.value);
        return;
      }
      if (hit.action === "asset-details") {
        openAssetDetails(hit.node);
        return;
      }
      setSelectedNode((current) => (selectedNodeEquals(current, hit.node) ? null : hit.node));
    },
    [
      externalSelectedSearchOption,
      findNodeAtPoint,
      isCiDiagramMode,
      onAssetFocus,
      openAssetDetails,
      openSpiDrillThrough,
      selectedNode,
      selectedSearchOption
    ]
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
        text:
          hit.action === "spi-findings"
            ? `Open findings for ${displayNodeLabel(hit.node.axisKey, hit.node.value)}`
            : hit.action === "asset-details"
              ? `Open Asset Details for ${displayNodeLabel(hit.node.axisKey, hit.node.value)}`
            : hit.action === "asset-focus"
              ? `Open CI Analyser for ${displayNodeLabel(hit.node.axisKey, hit.node.value)}`
              : isCiDiagramMode
                ? displayNodeLabel(hit.node.axisKey, hit.node.value)
                : nodeHoverTitle(
                    hit.node.axisKey,
                    displayNodeLabel(hit.node.axisKey, hit.node.value),
                    spiCounts,
                    spiDefinitionById
                  ),
        placement: hit.action !== "none" ? "left" : "default"
      });
    },
    [displayNodeLabel, findNodeAtPoint, isCiDiagramMode, spiCounts, spiDefinitionById]
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

  const handleDiagramSearchChange = useCallback(
    (value: string) => {
      setDiagramSearch(value);
      resetDiagramViewportForFilterChange();
      setIsDiagramSearchFocused(true);
    },
    [resetDiagramViewportForFilterChange]
  );

  const selectDiagramSearchOption = useCallback(
    (option: ImpactAnalyser2SearchOption) => {
      const exactSearchOption = {
        axisKey: option.axisKey,
        value: option.value,
        label: option.label,
        category: option.category
      };
      const exactSelectedNode = { axisKey: exactSearchOption.axisKey, value: option.value };
      setDiagramSearch(option.label);
      setSelectedSearchOption(exactSearchOption);
      setSelectedNode(exactSelectedNode);
      setIsDiagramSearchFocused(false);
      queueDiagramFilterRefresh({ type: "scroll-to-selected-node", node: exactSelectedNode });
    },
    [queueDiagramFilterRefresh]
  );

  const clearDiagramSearch = useCallback(() => {
    setDiagramSearch("");
    setIsDiagramSearchFocused(false);
    resetDiagramViewportForFilterChange();
  }, [resetDiagramViewportForFilterChange]);
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
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">{title}</h3>
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
              title={headingTooltip}
            >
              {title}
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
                  onChange={(event) => handleDiagramSearchChange(event.target.value)}
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
                                selectDiagramSearchOption(option);
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
            <MultiSelectFilter
              label="Environment"
              options={environmentOptions}
              selectedValues={selectedEnvironments}
              onChange={(values) => {
                setSelectedEnvironments(values);
                resetDiagramViewportForFilterChange();
              }}
              formatOption={(environment) => environment}
              widthClassName="w-36"
            />
            {showAssetTypeFilter ? (
              <MultiSelectFilter
                label="Asset Type"
                options={assetTypeOptions}
                selectedValues={selectedAssetTypes}
                onChange={(values) => {
                  setSelectedAssetTypes(values);
                  resetDiagramViewportForFilterChange();
                }}
                formatOption={assetTypeLabel}
                widthClassName="w-40"
              />
            ) : null}
            {!isCiDiagramMode ? (
              <>
                <MultiSelectFilter
                  label="Findings Severity"
                  options={findingCriticalityFilterOptions}
                  selectedValues={selectedFindingCriticalities}
                  onChange={(values) => {
                    setSelectedFindingCriticalities(values);
                    resetDiagramViewportForFilterChange();
                  }}
                  formatOption={(severity) => severity}
                  widthClassName="w-36"
                />
                <MultiSelectFilter
                  label="Security Domain"
                  options={securityDomainOptions}
                  selectedValues={selectedSecurityDomains}
                  onChange={(values) => {
                    setSelectedSecurityDomains(values);
                    resetDiagramViewportForFilterChange();
                  }}
                  formatOption={(domain) => domain}
                  widthClassName="w-44"
                />
              </>
            ) : null}
            {extraControls}
          </div>
        </div>

        <div className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-sky-300/15 bg-slate-950/45 p-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-300/75">
              {loadState === "loading" || !workerResult
                ? "Loading analyser data..."
                : isCiDiagramMode
                  ? `${workerResult.filteredRowCount} CI relationship path${
                      workerResult.filteredRowCount === 1 ? "" : "s"
                    } from selected asset${
                      activeSelectedNode
                        ? ` | ${workerResult.highlightedRowCount} highlighted via ${displayNodeLabel(activeSelectedNode.axisKey, activeSelectedNode.value)}`
                        : ""
                    }`
                : showAssetTypeFilter
                  ? `${workerResult.filteredFindingRowCount} finding paths across ${workerResult.filteredAssetCount} assets${
                      activeSelectedNode
                        ? ` | ${workerResult.highlightedRowCount} highlighted via ${displayNodeLabel(activeSelectedNode.axisKey, activeSelectedNode.value)}`
                        : ""
                    }`
                  : `${workerResult.filteredFindingRowCount} of ${workerResult.totalRowCount} open server findings${
                    activeSelectedNode
                      ? ` | ${workerResult.highlightedRowCount} highlighted via ${displayNodeLabel(activeSelectedNode.axisKey, activeSelectedNode.value)}`
                      : ""
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
                {workerResult && workerResult.filteredRowCount === 0 ? (
                  <p className="pointer-events-none absolute left-3 top-3 z-20 max-w-sm rounded-md border border-sky-300/15 bg-slate-900/80 px-3 py-2 text-xs text-slate-300/80 shadow-lg">
                    {isCiDiagramMode
                      ? "No CI relationship paths match the selected filters."
                      : "No ICT System Impact Analyser findings match the selected filters."}
                  </p>
                ) : null}
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
                {isCiDiagramMode && showSelectedTileText && selectedAssetTileText ? (
                  <SelectedAssetPanel
                    title="Selected Asset"
                    text={selectedAssetTileText}
                    placement="bottom-left"
                    copyFeedback={selectedTileCopyFeedback}
                    onCopy={copySelectedAssetTileText}
                  />
                ) : null}
                {isDiagramInitialLoading ? (
                  <ImpactAnalyserLoadingOverlay
                    title="Loading Diagram"
                    message="Building the ICT System Impact Analyser paths and node index."
                  />
                ) : null}
                {!isCiDiagramMode && isDrillThroughLoading ? (
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
          </div>
        </div>
      </section>

      {!isCiDiagramMode && drillThroughData ? (
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
      {selectedAssetDetails ? (
        <AssetDetailsPanel asset={selectedAssetDetails} isOpen={isAssetDetailsPanelOpen} onClose={closeAssetDetails} />
      ) : null}
    </>
  );
}
