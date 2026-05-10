"use client";

import { ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from "recharts";
import { MeasuresSpiHeatmapSection } from "@/components/measures-spi-heatmap-section";
import {
  NetworkDetailRiskCharts,
  NetworkDetailRiskFindingRow,
  RiskFindingsDrillThrough
} from "@/components/network-detail-risk-charts";
import { ScoreCard as OverviewScoreCardTile, type OverviewScoreCard } from "@/components/overview-compliance-score-strip";
import { type PerformanceReportModel } from "@/lib/performance-report-model";
import { SPI_DESCRIPTIONS, SPI_NAMES, SPI_SUCCESS_MEASURES } from "@/lib/spi-metadata";
import { AssetType, Criticality, EnvironmentType, FindingSeverity, HighRiskCveDetail, SecurityDomain, type SpiId } from "@/lib/types";

export interface CyberCopImpactItem {
  id: string;
  name: string;
  criticality: Criticality;
  findings: number;
  highPriority: number;
  criticalExposureCount: number;
  highRiskCount: number;
  impactedAssets: number;
}

export interface CyberCopSeveritySummary {
  severity: FindingSeverity;
  count: number;
}

export interface CyberCopWeeklyRiskPoint {
  weekLabel: string;
  highRiskCount: number | null;
  criticalExposureCount: number | null;
}

export interface CyberCopDailyTrendPoint {
  date: string;
  label: string;
  count: number | null;
}

export interface CyberCopImpactSpiDriver {
  spiId: number;
  label: string;
  description: string;
  criticalExposureCount: number;
  highRiskCount: number;
  otherCount: number;
  count: number;
}

export interface CyberCopImpactEnvironmentSplitRow {
  environment: string;
  criticalExposureCount: number;
  highRiskCount: number;
  otherCount: number;
  total: number;
}

export interface CyberCopImpactEntityTrendPoint {
  weekLabel: string;
  count: number;
}

export interface CyberCopImpactEntityTrend {
  id: string;
  name: string;
  criticality: Criticality;
  riskCount: number;
  weeklyTrend: CyberCopImpactEntityTrendPoint[];
}

export interface CyberCopActionOldestFindingRow {
  findingId: string;
  title: string;
  severity: FindingSeverity;
  spiLabel: string;
  systemName: string;
  openedDate: string;
  ageDays: number;
  recommendedAction: string;
}

export interface CyberCopActionQuickWinRow {
  actionText: string;
  criticalExposureCount: number;
  highRiskCount: number;
  otherCount: number;
  total: number;
  systemCount: number;
}

export interface CyberCopImpactLinks {
  businessToSystems: Record<string, string[]>;
  missionToSystems: Record<string, string[]>;
}

export interface CyberCopAssetTypeHeatmapAsset {
  id: string;
  name: string;
  hostname: string;
  assetType: AssetType;
  systemId: string;
  systemName: string;
  environmentType: EnvironmentType | null;
  securityDomain: SecurityDomain;
  criticalExposureCount: number;
  highRiskCount: number;
  severeFindingCount: number;
  riskScore: number;
}

export interface CyberCopNetworkDiagramRow {
  findingId: string;
  systemId: string;
  systemName: string;
  environmentType: EnvironmentType | null;
  serverId: string;
  serverName: string;
  serverHostname: string;
  securityDomain: SecurityDomain;
  severity: FindingSeverity;
  spiId: number;
  spiLabel: string;
}

type ServerHeatmapEnvironmentOption = EnvironmentType | "Unassigned";
type ServerHeatmapSecurityDomainOption = SecurityDomain;
type NetworkDiagramSelectedNode = { axisKey: string; value: string } | null;
type NetworkDiagramFindingCriticalityOption = FindingSeverity;
const networkDiagramSearchCategoryOrder = [
  "ICT System",
  "Environment",
  "Server",
  "Finding Severity",
  "SPI",
  "Security Domain"
] as const;
type NetworkDiagramSearchCategory = (typeof networkDiagramSearchCategoryOrder)[number];
type NetworkDiagramSearchOption = {
  id: string;
  label: string;
  category: NetworkDiagramSearchCategory;
};

export interface CyberCopDashboardProps {
  snapshotDate: string;
  filtersSlot?: ReactNode;
  networkSpiHeatmapFilterSlot?: ReactNode;
  systemSpiHeatmapFilterSlot?: ReactNode;
  networkSpiHeatmapModel: PerformanceReportModel;
  systemSpiHeatmapModel: PerformanceReportModel;
  selectedSpiId?: SpiId;
  initialMeasureSearch: string;
  complianceScoreCards: OverviewScoreCard[];
  riskProfile: {
    openFindings: number;
    p1p2Count: number;
    highRiskOpenCount: number;
    criticalExposureOpenCount: number;
    severitySummary: CyberCopSeveritySummary[];
    weeklyTrend: CyberCopWeeklyRiskPoint[];
  };
  riskFindings: NetworkDetailRiskFindingRow[];
  assetHighRiskCvesByAssetId?: Record<string, HighRiskCveDetail[]>;
  asOfDate?: string;
  impact: {
    business: CyberCopImpactItem[];
    mission: CyberCopImpactItem[];
    systems: CyberCopImpactItem[];
  };
  impactLinks: CyberCopImpactLinks;
  impactAssetTypeHeatmapBySystemId: Record<string, CyberCopAssetTypeHeatmapAsset[]>;
  impactNetworkDiagramRows: CyberCopNetworkDiagramRow[];
  impactSpiDrivers: CyberCopImpactSpiDriver[];
  impactSpiDriversBySystemId: Record<string, CyberCopImpactSpiDriver[]>;
  impactEnvironmentSplit: CyberCopImpactEnvironmentSplitRow[];
  impactEnvironmentSplitBySystemId: Record<string, CyberCopImpactEnvironmentSplitRow[]>;
  impactEntityTrends: CyberCopImpactEntityTrend[];
  actionPlan: {
    immediateAction: number;
    nonCompliantOs: number;
    nonCompliantOsTotal: number;
    assetsOutOfWarrantyEol: number;
    scopedAssetsTotal: number;
    serversWithCriticalFindings: number;
    scopedServersTotal: number;
    networksWithoutDiscoveryEnabled: number;
    scopedNetworksTotal: number;
    networksDiscoveryNonCompliant: number;
    networksWithNoTargetState: number;
    diisIctSystemsDefined: number;
    ictSystemsNotModelled: number;
    ictSystemsModelled: number;
    ictSystemsModelledDiscoveryNonCompliant: number;
  };
  actionOldestOpenFindings: CyberCopActionOldestFindingRow[];
  actionQuickWins: CyberCopActionQuickWinRow[];
  dailyHighRisk: CyberCopDailyTrendPoint[];
  dailyCriticalExposure: CyberCopDailyTrendPoint[];
}

type CyberCopTabId = "overview" | "impact" | "action" | "networks-spi-heatmap" | "systems-spi-heatmap";
type ImpactChartTabId = "spi" | "blast-radius" | "network-diagram" | "environment" | "mission-business";

const cyberCopTabs: Array<{ id: CyberCopTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "impact", label: "Impact" },
  { id: "action", label: "Action" },
  { id: "networks-spi-heatmap", label: "Networks - SPI Heatmap" },
  { id: "systems-spi-heatmap", label: "ICT System - SPI Heatmap" }
];

const impactChartTabs: Array<{ id: ImpactChartTabId; label: string }> = [
  { id: "spi", label: "SPI Driver" },
  { id: "blast-radius", label: "Server Risk Heatmap" },
  { id: "network-diagram", label: "ICT System Impact Analyser" },
  { id: "environment", label: "Environment Split" },
  { id: "mission-business", label: "Critical Findings Blast Radius" }
];

const impactEnvironmentOrder = ["Production", "Development", "UAT", "Test", "Unassigned"] as const;
const impactSeverityOrder: FindingSeverity[] = ["Critical Exposure", "High Risk", "Major", "Moderate", "Data Gap"];
const securityDomainOrder: SecurityDomain[] = ["Secret", "Protected", "Unclassified"];

function chartSurfaceClass(embedded?: boolean): string {
  return embedded
    ? "flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-lg border border-sky-300/15 bg-slate-950/45 p-2"
    : "panel flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden p-4";
}

function interpolateColor(
  start: [number, number, number],
  end: [number, number, number],
  ratio: number
): string {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const [red, green, blue] = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * clampedRatio)
  );
  return `rgb(${red}, ${green}, ${blue})`;
}

function assetHeatmapColor(score: number, maxScore: number): string {
  if (score <= 0 || maxScore <= 0) {
    return "rgb(34, 197, 94)";
  }

  const ratio = Math.min(1, score / maxScore);
  if (ratio <= 0.5) {
    return interpolateColor([34, 197, 94], [250, 204, 21], ratio / 0.5);
  }
  return interpolateColor([250, 204, 21], [239, 68, 68], (ratio - 0.5) / 0.5);
}

function severityStrokeColor(severity: FindingSeverity): string {
  if (severity === "Critical Exposure") {
    return "#ef4444";
  }
  if (severity === "High Risk") {
    return "#f97316";
  }
  if (severity === "Major") {
    return "#facc15";
  }
  if (severity === "Moderate") {
    return "#38bdf8";
  }
  return "#a78bfa";
}

function sortEnvironmentLabel(left: ServerHeatmapEnvironmentOption, right: ServerHeatmapEnvironmentOption): number {
  if (left === "Production") {
    return -1;
  }
  if (right === "Production") {
    return 1;
  }
  if (left === "Unassigned") {
    return 1;
  }
  if (right === "Unassigned") {
    return -1;
  }
  return left.localeCompare(right);
}

function formatDateKey(
  dateKey: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  const parsed = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }
  return parsed.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

function criticalityClass(criticality: Criticality): string {
  if (criticality === "Critical") {
    return "border-red-400/40 text-red-100";
  }
  return "border-sky-300/35 text-sky-100";
}

function ImpactLeaderboard({
  title,
  subtitle,
  items,
  selectedItemId,
  selectedText,
  onSelectItem,
  onFilterScopeChange,
  showClearSelectionButton,
  clearSelectionDisabled,
  onClearSelection
}: {
  title: string;
  subtitle: string;
  items: CyberCopImpactItem[];
  selectedItemId?: string | null;
  selectedText?: string | null;
  onSelectItem?: (item: CyberCopImpactItem) => void;
  onFilterScopeChange?: (scope: { active: boolean; itemIds: string[] }) => void;
  showClearSelectionButton?: boolean;
  clearSelectionDisabled?: boolean;
  onClearSelection?: () => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const riskScopedItems = useMemo(
    () => items.filter((item) => item.criticalExposureCount > 0 || item.highRiskCount > 0),
    [items]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return riskScopedItems;
    }

    const exactMatch = riskScopedItems.find((item) => item.name.toLowerCase() === normalizedQuery);
    if (exactMatch) {
      return [exactMatch];
    }

    return riskScopedItems.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [riskScopedItems, normalizedQuery]);

  const selectedItem = useMemo(
    () => riskScopedItems.find((item) => item.id === selectedItemId),
    [riskScopedItems, selectedItemId]
  );

  const selectable = Boolean(onSelectItem);
  const selectedLabel = selectedText ?? selectedItem?.name ?? null;

  useEffect(() => {
    if (!onFilterScopeChange) {
      return;
    }
    onFilterScopeChange({
      active: normalizedQuery.length > 0,
      itemIds: filteredItems.map((item) => item.id)
    });
  }, [filteredItems, normalizedQuery, onFilterScopeChange]);

  return (
    <section className="panel flex h-full min-h-0 flex-col p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">{title}</h3>
        <p className="min-h-[1rem] text-[11px] text-right text-cyan-100/90">
          {selectedLabel ? `Selected: ${selectedLabel}` : "Selected: none"}
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-300/80">{subtitle}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          list={listId}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${title.toLowerCase()}`}
          className="min-w-[13rem] flex-1 rounded-md border border-sky-300/25 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
        />
        <button
          type="button"
          onClick={() => setQuery("")}
          className="whitespace-nowrap rounded-md border border-sky-300/25 bg-slate-900/80 px-3 py-2 text-xs uppercase tracking-[0.12em] text-slate-200 hover:bg-slate-800/90"
        >
          Clear
        </button>
        {showClearSelectionButton && onClearSelection ? (
          <button
            type="button"
            onClick={onClearSelection}
            disabled={clearSelectionDisabled}
            className="whitespace-nowrap rounded-md border border-cyan-300/35 bg-slate-900/80 px-3 py-2 text-xs uppercase tracking-[0.12em] text-cyan-100 hover:bg-slate-800/90 disabled:cursor-not-allowed disabled:border-slate-500/30 disabled:text-slate-400/70 disabled:hover:bg-slate-900/80"
          >
            Clear Selection
          </button>
        ) : null}
        <datalist id={listId}>
          {riskScopedItems.map((item) => (
            <option key={item.id} value={item.name} />
          ))}
        </datalist>
      </div>
      {riskScopedItems.length ? (
        <div className="mt-2.5 min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
          <table className="w-full table-fixed text-xs xl:text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="w-[42%] px-2 py-2 text-left">Name</th>
                <th className="w-[20%] px-2 py-2 text-left">Criticality</th>
                <th className="w-[14%] px-2 py-2 text-right">Crit Exp</th>
                <th className="w-[12%] px-2 py-2 text-right">High</th>
                <th className="w-[12%] px-2 py-2 text-right">Assets</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t border-sky-300/10 ${
                    selectedItemId === item.id ? "bg-cyan-500/10" : ""
                  }`}
                >
                  <td className="px-2 py-2 text-slate-100">
                    {selectable ? (
                      <button
                        type="button"
                        onClick={() => onSelectItem?.(item)}
                        title={item.name}
                        className="block w-full truncate text-left text-slate-100 hover:text-cyan-100"
                      >
                        {item.name}
                      </button>
                    ) : (
                      <span title={item.name} className="block truncate">
                        {item.name}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span className={`inline-block max-w-full truncate rounded-full border px-1.5 py-0.5 text-[10px] xl:px-2 xl:text-[11px] ${criticalityClass(item.criticality)}`}>
                      {item.criticality}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-red-100">{item.criticalExposureCount}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-orange-100">{item.highRiskCount}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-200">{item.impactedAssets}</td>
                </tr>
              ))}
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-300/80">
                    No matching rows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-sky-300/15 bg-slate-950/45 p-3 text-sm text-slate-300/80">
          No critical exposure or high risk impact in current scope.
        </p>
      )}
    </section>
  );
}

function actionSegmentWidth(value: number, total: number): string {
  if (!total || value <= 0) {
    return "0%";
  }
  return `${Math.max(2, (value / total) * 100)}%`;
}

type ActionPlanMatrixTone = "critical" | "warning" | "watch";

type ActionPlanMatrixRow = {
  action: string;
  detail: string;
  count: number;
  scope: string;
  total?: number;
  actionLabel?: string;
  clearLabel?: string;
  statusLabel: string;
  tone: ActionPlanMatrixTone;
  emphasized?: boolean;
};

function actionMatrixToneClasses(tone: ActionPlanMatrixTone) {
  if (tone === "critical") {
    return {
      count: "text-red-100",
      segment: "bg-red-400/95",
      badge: "border-red-300/30 bg-red-500/10 text-red-100",
      row: "bg-red-500/[0.06]"
    };
  }
  if (tone === "warning") {
    return {
      count: "text-amber-100",
      segment: "bg-amber-300/95",
      badge: "border-amber-300/30 bg-amber-500/10 text-amber-100",
      row: "bg-amber-500/[0.045]"
    };
  }
  return {
    count: "text-sky-100",
    segment: "bg-sky-300/95",
    badge: "border-sky-300/30 bg-sky-500/10 text-sky-100",
    row: "bg-sky-500/[0.045]"
  };
}

function actionRateLabel(count: number, total?: number): string {
  if (typeof total !== "number") {
    return "Baseline";
  }
  if (total <= 0) {
    return "0%";
  }
  return `${Number(((Math.max(0, count) / total) * 100).toFixed(1))}%`;
}

function ActionPlanMatrix({ title, rows }: { title: string; rows: ActionPlanMatrixRow[] }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-sky-300/15 bg-slate-950/35">
      <div className="border-b border-sky-300/10 px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-100">{title}</h3>
      </div>
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[11%]" />
            <col className="w-[18%]" />
            <col className="w-[11%]" />
            <col className="w-[22%]" />
          </colgroup>
          <thead className="bg-slate-900/70 text-[10px] uppercase tracking-[0.13em] text-slate-300/70">
            <tr>
              <th className="px-2 py-2 text-left">Action</th>
              <th className="px-2 py-2 text-right">Count</th>
              <th className="px-2 py-2 text-left">Scope</th>
              <th className="px-2 py-2 text-right">Rate</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const toneClasses = actionMatrixToneClasses(row.tone);
              const safeTotal = typeof row.total === "number" ? Math.max(0, row.total) : undefined;
              const boundedCount = safeTotal === undefined ? Math.max(0, row.count) : Math.min(Math.max(0, row.count), safeTotal);
              const clearCount = safeTotal === undefined ? 0 : Math.max(0, safeTotal - boundedCount);
              const statusTitle =
                safeTotal === undefined
                  ? row.statusLabel
                  : `${clearCount} ${row.clearLabel?.toLowerCase() ?? "clear"}, ${boundedCount} ${
                      row.actionLabel?.toLowerCase() ?? "requiring action"
                    }`;

              return (
                <tr
                  key={`${title}-${row.action}`}
                  className={`border-t border-sky-300/10 ${row.emphasized ? toneClasses.row : ""}`}
                >
                  <td className="px-2 py-2">
                    <p className={row.emphasized ? "font-semibold text-slate-100" : "font-medium text-slate-200"}>{row.action}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{row.detail}</p>
                  </td>
                  <td className={`px-2 py-2 text-right text-base font-semibold tabular-nums ${toneClasses.count}`}>
                    {row.count}
                  </td>
                  <td className="break-words px-2 py-2 text-xs text-slate-300">{row.scope}</td>
                  <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums text-slate-100">
                    {actionRateLabel(row.count, row.total)}
                  </td>
                  <td className="px-2 py-2">
                    {safeTotal === undefined ? (
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] ${toneClasses.badge}`}>
                        {row.statusLabel}
                      </span>
                    ) : (
                      <div className="w-full" title={statusTitle}>
                        <div
                          className="flex h-2.5 overflow-hidden rounded-full border border-sky-300/20 bg-slate-800/80"
                          aria-label={`${row.action}: ${row.count}`}
                        >
                          <div
                            className="h-full bg-emerald-400/90"
                            style={{ width: actionSegmentWidth(clearCount, safeTotal) }}
                          />
                          <div
                            className={`h-full ${toneClasses.segment}`}
                            style={{ width: actionSegmentWidth(boundedCount, safeTotal) }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                          <span>{row.clearLabel}</span>
                          <span className={toneClasses.count}>{row.actionLabel}</span>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DailyTrendPanel({
  title,
  subtitle,
  color,
  data,
  compact = false
}: {
  title: string;
  subtitle: string;
  color: string;
  data: CyberCopDailyTrendPoint[];
  compact?: boolean;
}) {
  if (!data.length) {
    return (
      <section className={`panel ${compact ? "p-3" : "p-4"}`}>
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">{title}</h3>
        <p className="mt-1 text-xs text-slate-300/80">{subtitle}</p>
        <p className="mt-3 text-sm text-slate-300/80">No daily trend data available.</p>
      </section>
    );
  }

  return (
    <section className={`panel ${compact ? "flex h-full min-h-0 flex-col p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">{title}</h3>
          <p className="mt-1 text-xs text-slate-300/80">{subtitle}</p>
        </div>
        {compact ? null : (
          <p className="rounded-full border border-sky-300/30 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200">
            Latest: {data[data.length - 1]?.count ?? "-"} on{" "}
            {formatDateKey(data[data.length - 1]?.date ?? "", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>
      <div className={compact ? "mt-2 min-h-0 flex-1" : "mt-2.5 h-48"}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={compact ? { top: 4, right: 10, left: 0, bottom: 0 } : { top: 8, right: 14, left: 6, bottom: 8 }}>
            <CartesianGrid stroke="rgba(120,180,210,0.14)" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => formatDateKey(String(value))}
              minTickGap={compact ? 54 : 42}
              tick={{ fill: "#a8c6d8", fontSize: 11 }}
            />
            <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
              formatter={(value) => [value ?? "-", "Open Findings"]}
              labelFormatter={(label) =>
                formatDateKey(String(label), {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })
              }
            />
            <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2.2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function AssetTypeHeatmapChart({
  items,
  assetsBySystemId,
  embedded = false
}: {
  items: CyberCopImpactItem[];
  assetsBySystemId: Record<string, CyberCopAssetTypeHeatmapAsset[]>;
  embedded?: boolean;
}) {
  const allServerAssets = useMemo(() => {
    const seenAssetIds = new Set<string>();
    return items
      .flatMap((item) => assetsBySystemId[item.id] ?? [])
      .filter((asset) => asset.assetType === "server")
      .filter((asset) => {
        if (seenAssetIds.has(asset.id)) {
          return false;
        }
        seenAssetIds.add(asset.id);
        return true;
      })
      .sort((a, b) => {
        if (b.riskScore !== a.riskScore) {
          return b.riskScore - a.riskScore;
        }
        if (b.criticalExposureCount !== a.criticalExposureCount) {
          return b.criticalExposureCount - a.criticalExposureCount;
        }
        if (b.highRiskCount !== a.highRiskCount) {
          return b.highRiskCount - a.highRiskCount;
        }
        return a.name.localeCompare(b.name);
      });
  }, [assetsBySystemId, items]);

  const environmentOptions = useMemo<ServerHeatmapEnvironmentOption[]>(
    () =>
      Array.from(new Set(allServerAssets.map((asset) => asset.environmentType ?? "Unassigned"))).sort(sortEnvironmentLabel),
    [allServerAssets]
  );
  const securityDomainOptions = useMemo<ServerHeatmapSecurityDomainOption[]>(
    () =>
      Array.from(new Set(allServerAssets.map((asset) => asset.securityDomain))).sort(
        (left, right) => securityDomainOrder.indexOf(left) - securityDomainOrder.indexOf(right)
      ),
    [allServerAssets]
  );
  const [selectedEnvironment, setSelectedEnvironment] = useState<ServerHeatmapEnvironmentOption | "all">("all");
  const [selectedSecurityDomain, setSelectedSecurityDomain] = useState<ServerHeatmapSecurityDomainOption | "all">("all");

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

  const serverAssets = useMemo(() => {
    return allServerAssets.filter((asset) => {
      if (selectedEnvironment !== "all" && (asset.environmentType ?? "Unassigned") !== selectedEnvironment) {
        return false;
      }
      if (selectedSecurityDomain !== "all" && asset.securityDomain !== selectedSecurityDomain) {
        return false;
      }
      return true;
    });
  }, [allServerAssets, selectedEnvironment, selectedSecurityDomain]);

  const maxRiskScore = serverAssets.reduce((maxScore, asset) => Math.max(maxScore, asset.riskScore), 0);
  const serverCriticalExposureCount = serverAssets.reduce(
    (total, asset) => total + asset.criticalExposureCount,
    0
  );
  const serverHighRiskCount = serverAssets.reduce((total, asset) => total + asset.highRiskCount, 0);

  if (!allServerAssets.length) {
    return (
      <section className={chartSurfaceClass(embedded)}>
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Server Risk Heatmap</h3>
        <p className="mt-1 text-xs text-slate-300/80">
          Servers coloured by open critical and high finding volume.
        </p>
        <p className="mt-3 text-sm text-slate-300/80">No server heatmap data in current scope.</p>
      </section>
    );
  }

  return (
    <section className={chartSurfaceClass(embedded)}>
      <div className="flex min-w-0 shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-sm uppercase tracking-[0.14em] text-slate-100">Server Risk Heatmap</h3>
          <p className="mt-1 text-xs text-slate-300/80">
            Servers coloured by open critical and high finding volume.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
            <span>Environment</span>
            <select
              value={selectedEnvironment}
              onChange={(event) =>
                setSelectedEnvironment(event.target.value as ServerHeatmapEnvironmentOption | "all")
              }
              className="h-8 rounded-md border border-sky-300/25 bg-slate-900/90 px-2 text-xs normal-case tracking-normal text-slate-100"
            >
              <option value="all">All</option>
              {environmentOptions.map((environment) => (
                <option key={`server-heatmap-environment-${environment}`} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
            <span>Security Domain</span>
            <select
              value={selectedSecurityDomain}
              onChange={(event) =>
                setSelectedSecurityDomain(event.target.value as ServerHeatmapSecurityDomainOption | "all")
              }
              className="h-8 rounded-md border border-sky-300/25 bg-slate-900/90 px-2 text-xs normal-case tracking-normal text-slate-100"
            >
              <option value="all">All</option>
              {securityDomainOptions.map((domain) => (
                <option key={`server-heatmap-security-domain-${domain}`} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
            <span>Low</span>
            <span className="h-2 w-24 max-w-[36vw] rounded-full bg-[linear-gradient(90deg,#22c55e,#facc15,#ef4444)]" />
            <span>High</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-sky-300/15 bg-slate-950/45 p-2">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="break-words text-xs font-semibold uppercase tracking-[0.14em] text-slate-100">Servers</h4>
            <p className="mt-0.5 text-[11px] text-slate-300/75">
              {serverAssets.length} of {allServerAssets.length} servers
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 text-[11px] tabular-nums">
            <span className="rounded border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-red-100">
              {serverCriticalExposureCount} critical
            </span>
            <span className="rounded border border-orange-300/20 bg-orange-400/10 px-2 py-0.5 text-orange-100">
              {serverHighRiskCount} high
            </span>
          </div>
        </div>
        <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
          {serverAssets.length ? (
            <div className="flex w-full flex-wrap content-start gap-1">
              {serverAssets.map((asset) => (
                <span
                  key={`asset-heatmap-cell-${asset.id}`}
                  aria-label={`${asset.name}, Server, ${asset.criticalExposureCount} critical, ${asset.highRiskCount} high`}
                  className="h-4 w-4 shrink-0 rounded-[4px] border border-white/15 shadow-[0_0_10px_rgba(15,23,42,0.35)]"
                  role="img"
                  style={{ backgroundColor: assetHeatmapColor(asset.riskScore, maxRiskScore) }}
                  title={`${asset.name}\n${asset.systemName}\n${asset.environmentType ?? "Unassigned"}\n${asset.securityDomain}\nServer\nCritical Exposure: ${asset.criticalExposureCount}\nHigh Risk: ${asset.highRiskCount}`}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-sky-300/15 bg-slate-900/55 px-3 py-2 text-xs text-slate-300/80">
              No servers match the selected filters.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function NetworkDiagramChart({
  rows,
  riskFindings,
  assetHighRiskCvesByAssetId = {},
  asOfDate,
  embedded = false
}: {
  rows: CyberCopNetworkDiagramRow[];
  riskFindings: NetworkDetailRiskFindingRow[];
  assetHighRiskCvesByAssetId?: Record<string, HighRiskCveDetail[]>;
  asOfDate?: string;
  embedded?: boolean;
}) {
  const environmentOptions = useMemo<ServerHeatmapEnvironmentOption[]>(
    () => Array.from(new Set(rows.map((row) => row.environmentType ?? "Unassigned"))).sort(sortEnvironmentLabel),
    [rows]
  );
  const securityDomainOptions = useMemo<SecurityDomain[]>(
    () =>
      Array.from(new Set(rows.map((row) => row.securityDomain))).sort(
        (left, right) => securityDomainOrder.indexOf(left) - securityDomainOrder.indexOf(right)
      ),
    [rows]
  );
  const [selectedEnvironment, setSelectedEnvironment] = useState<ServerHeatmapEnvironmentOption | "all">("all");
  const [selectedSecurityDomain, setSelectedSecurityDomain] = useState<SecurityDomain | "all">("all");
  const [selectedFindingCriticality, setSelectedFindingCriticality] = useState<NetworkDiagramFindingCriticalityOption | "all">("all");
  const [networkDiagramSearch, setNetworkDiagramSearch] = useState("");
  const [isNetworkDiagramSearchFocused, setIsNetworkDiagramSearchFocused] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NetworkDiagramSelectedNode>(null);
  const [selectedSpiDrillThroughId, setSelectedSpiDrillThroughId] = useState<number | null>(null);
  const networkDiagramSearchBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const networkDiagramSearchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (networkDiagramSearchBlurTimerRef.current) {
        clearTimeout(networkDiagramSearchBlurTimerRef.current);
        networkDiagramSearchBlurTimerRef.current = null;
      }
    };
  }, []);

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
    if (selectedFindingCriticality !== "all" && !impactSeverityOrder.includes(selectedFindingCriticality)) {
      setSelectedFindingCriticality("all");
    }
  }, [selectedFindingCriticality]);

  const networkDiagramSearchOptions = useMemo<NetworkDiagramSearchOption[]>(() => {
    const options = new Map<string, NetworkDiagramSearchOption>();
    const addOption = (category: NetworkDiagramSearchCategory, label: string) => {
      const normalizedLabel = label.trim();
      if (!normalizedLabel) {
        return;
      }
      const id = `${category}:${normalizedLabel.toLowerCase()}`;
      if (!options.has(id)) {
        options.set(id, { id, label: normalizedLabel, category });
      }
    };

    rows.forEach((row) => {
      addOption("ICT System", row.systemName);
      addOption("Environment", row.environmentType ?? "Unassigned");
      addOption("Server", row.serverName);
      addOption("Finding Severity", row.severity);
      addOption("SPI", row.spiLabel);
      addOption("Security Domain", row.securityDomain);
    });

    return Array.from(options.values()).sort((left, right) => {
      const categoryDelta =
        networkDiagramSearchCategoryOrder.indexOf(left.category) -
        networkDiagramSearchCategoryOrder.indexOf(right.category);
      return categoryDelta || left.label.localeCompare(right.label);
    });
  }, [rows]);

  const filteredNetworkDiagramSearchOptions = useMemo(() => {
    const normalizedSearch = networkDiagramSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return networkDiagramSearchOptions;
    }
    return networkDiagramSearchOptions.filter((option) =>
      `${option.category} ${option.label}`.toLowerCase().includes(normalizedSearch)
    );
  }, [networkDiagramSearch, networkDiagramSearchOptions]);

  const selectNetworkDiagramSearchOption = (option: NetworkDiagramSearchOption) => {
    setNetworkDiagramSearch(option.label);
    setIsNetworkDiagramSearchFocused(false);
  };

  const clearNetworkDiagramSearch = () => {
    setNetworkDiagramSearch("");
    setIsNetworkDiagramSearchFocused(false);
  };

  const filteredRows = useMemo(
    () => {
      const normalizedSearch = networkDiagramSearch.trim().toLowerCase();
      return rows.filter((row) => {
        if (selectedEnvironment !== "all" && (row.environmentType ?? "Unassigned") !== selectedEnvironment) {
          return false;
        }
        if (selectedSecurityDomain !== "all" && row.securityDomain !== selectedSecurityDomain) {
          return false;
        }
        if (selectedFindingCriticality !== "all" && row.severity !== selectedFindingCriticality) {
          return false;
        }
        if (normalizedSearch) {
          const haystack = [
            row.systemName,
            row.environmentType ?? "Unassigned",
            row.serverName,
            row.severity,
            row.spiLabel,
            row.securityDomain
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(normalizedSearch)) {
            return false;
          }
        }
        return true;
      });
    },
    [networkDiagramSearch, rows, selectedEnvironment, selectedFindingCriticality, selectedSecurityDomain]
  );

  const filteredRowCountBySpiId = useMemo(() => {
    const counts = new Map<number, number>();
    for (const row of filteredRows) {
      counts.set(row.spiId, (counts.get(row.spiId) ?? 0) + 1);
    }
    return counts;
  }, [filteredRows]);

  const riskFindingBySourceFindingId = useMemo(() => {
    const map = new Map<string, NetworkDetailRiskFindingRow>();
    for (const finding of riskFindings) {
      if (finding.sourceFindingId) {
        map.set(finding.sourceFindingId, finding);
      }
      map.set(finding.id, finding);
      if (finding.id.startsWith("risk-")) {
        map.set(finding.id.slice(5), finding);
      }
    }
    return map;
  }, [riskFindings]);

  const filteredNetworkDiagramRiskFindings = useMemo(() => {
    const seenFindingIds = new Set<string>();
    const matchedFindings: NetworkDetailRiskFindingRow[] = [];
    for (const row of filteredRows) {
      const finding = riskFindingBySourceFindingId.get(row.findingId);
      if (!finding || seenFindingIds.has(finding.id)) {
        continue;
      }
      seenFindingIds.add(finding.id);
      matchedFindings.push(finding);
    }
    return matchedFindings;
  }, [filteredRows, riskFindingBySourceFindingId]);

  const selectedSpiRows = useMemo(
    () => (selectedSpiDrillThroughId ? filteredRows.filter((row) => row.spiId === selectedSpiDrillThroughId) : []),
    [filteredRows, selectedSpiDrillThroughId]
  );

  const selectedSpiFindings = useMemo(
    () =>
      selectedSpiDrillThroughId
        ? filteredNetworkDiagramRiskFindings.filter(
            (finding) => finding.workflowStatus === "open" && finding.spiId === selectedSpiDrillThroughId
          )
        : [],
    [filteredNetworkDiagramRiskFindings, selectedSpiDrillThroughId]
  );

  const selectedSpiTotalCount = selectedSpiRows.length;

  useEffect(() => {
    setSelectedNode(null);
  }, [networkDiagramSearch, selectedEnvironment, selectedFindingCriticality, selectedSecurityDomain]);

  const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
  const axisDefinitions = useMemo(
    () => [
      { key: "system", label: "ICT System", values: uniqueSorted(filteredRows.map((row) => row.systemName)) },
      {
        key: "environment",
        label: "Environment",
        values: Array.from(new Set(filteredRows.map((row) => row.environmentType ?? "Unassigned"))).sort(sortEnvironmentLabel)
      },
      { key: "server", label: "Server", values: uniqueSorted(filteredRows.map((row) => row.serverName)) },
      {
        key: "severity",
        label: "Finding Severity",
        values: impactSeverityOrder.filter((severity) => filteredRows.some((row) => row.severity === severity))
      },
      {
        key: "spi",
        label: "SPI",
        values: Array.from(new Set(filteredRows.map((row) => row.spiLabel))).sort(
          (left, right) => Number(left.replace("SPI ", "")) - Number(right.replace("SPI ", ""))
        )
      }
    ],
    [filteredRows]
  );
  const maxCategoryCount = Math.max(1, ...axisDefinitions.map((axis) => axis.values.length));
  const svgWidth = 1080;
  const chartHeight = Math.max(320, maxCategoryCount * 30 + 96);
  const top = 58;
  const bottom = 30;
  const left = 72;
  const right = 72;
  const innerHeight = chartHeight - top - bottom;
  const innerWidth = svgWidth - left - right;
  const xForAxis = (index: number) => left + (index * innerWidth) / Math.max(1, axisDefinitions.length - 1);
  const yForValue = (axisIndex: number, value: string) => {
    const values = axisDefinitions[axisIndex].values;
    const valueIndex = Math.max(0, values.indexOf(value));
    if (values.length <= 1) {
      return top + innerHeight / 2;
    }
    return top + (valueIndex * innerHeight) / (values.length - 1);
  };
  const labelForRowAxis = (row: CyberCopNetworkDiagramRow, axisKey: string) => {
    if (axisKey === "system") {
      return row.systemName;
    }
    if (axisKey === "environment") {
      return row.environmentType ?? "Unassigned";
    }
    if (axisKey === "server") {
      return row.serverName;
    }
    if (axisKey === "severity") {
      return row.severity;
    }
    return row.spiLabel;
  };
  const rowsMatchingSelectedNode = selectedNode
    ? filteredRows.filter((row) => labelForRowAxis(row, selectedNode.axisKey) === selectedNode.value)
    : [];
  const isNodeSelected = (axisKey: string, value: string) =>
    selectedNode?.axisKey === axisKey && selectedNode.value === value;
  const spiIdFromNodeValue = (value: string) => {
    const parsed = Number(value.replace("SPI ", ""));
    return Number.isInteger(parsed) ? parsed : null;
  };
  const nodeHoverTitle = (axisKey: string, value: string) => {
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
    const totalFindings = filteredRowCountBySpiId.get(spiId) ?? 0;
    return `${value}: ${name}\n${description}\nSuccess Measure: ${successMeasure}\nTotal Findings: ${totalFindings}`;
  };
  const truncateAxisLabel = (value: string) => (value.length > 22 ? `${value.slice(0, 21)}...` : value);
  const pointsForRow = (row: CyberCopNetworkDiagramRow) =>
    axisDefinitions
      .map((axis, axisIndex) => `${xForAxis(axisIndex)},${yForValue(axisIndex, labelForRowAxis(row, axis.key))}`)
      .join(" ");
  const displayedSeverities = impactSeverityOrder.filter((severity) =>
    filteredRows.some((row) => row.severity === severity)
  );
  const selectNetworkDiagramNode = (axisKey: string, value: string) => {
    if (axisKey === "spi") {
      const spiId = spiIdFromNodeValue(value);
      if (!spiId) {
        return;
      }
    }

    setSelectedNode((current) =>
      current?.axisKey === axisKey && current.value === value ? null : { axisKey, value }
    );
  };
  const openNetworkDiagramSpiDrillThrough = (value: string) => {
    const spiId = spiIdFromNodeValue(value);
    if (!spiId) {
      return;
    }
    setSelectedNode({ axisKey: "spi", value });
    setSelectedSpiDrillThroughId(spiId);
  };
  const closeNetworkDiagramSpiDrillThrough = () => {
    const closingSpiId = selectedSpiDrillThroughId;
    setSelectedSpiDrillThroughId(null);
    setSelectedNode((current) => {
      if (!current || current.axisKey !== "spi" || spiIdFromNodeValue(current.value) !== closingSpiId) {
        return current;
      }
      return null;
    });
  };

  if (!rows.length) {
    return (
      <section className={chartSurfaceClass(embedded)}>
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">ICT System Impact Analyser Diagram</h3>
        <p className="mt-1 text-xs text-slate-300/80">
          Parallel coordinates for open server findings by system, environment, server, severity, and SPI.
        </p>
        <p className="mt-3 text-sm text-slate-300/80">No open server findings in current scope.</p>
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
            title="One line per open server finding across ICT system, environment, server, severity, and SPI."
          >
            ICT System Impact Analyser Diagram
          </h3>
        </div>
        <div className="flex w-full min-w-0 flex-nowrap items-start justify-start gap-2 overflow-visible">
          <div className="relative flex h-8 shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
            <label htmlFor="network-diagram-search" className="whitespace-nowrap">
              Text Search
            </label>
            <div className="relative w-52 shrink-0">
              <input
                ref={networkDiagramSearchInputRef}
                id="network-diagram-search"
                type="search"
                value={networkDiagramSearch}
                onChange={(event) => {
                  setNetworkDiagramSearch(event.target.value);
                  setIsNetworkDiagramSearchFocused(true);
                }}
                onFocus={() => {
                  if (networkDiagramSearchBlurTimerRef.current) {
                    clearTimeout(networkDiagramSearchBlurTimerRef.current);
                    networkDiagramSearchBlurTimerRef.current = null;
                  }
                  setIsNetworkDiagramSearchFocused(true);
                }}
                onBlur={() => {
                  networkDiagramSearchBlurTimerRef.current = setTimeout(() => {
                    setIsNetworkDiagramSearchFocused(false);
                    setNetworkDiagramSearch((current) => current.trim());
                    networkDiagramSearchBlurTimerRef.current = null;
                  }, 120);
                }}
                placeholder="Search diagram"
                className="h-8 w-full rounded-md border border-sky-300/25 bg-slate-900/90 px-2 pr-14 text-xs normal-case tracking-normal text-slate-100 placeholder:text-slate-400/70"
              />
              {networkDiagramSearch ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearNetworkDiagramSearch}
                  className="absolute right-1 top-1/2 h-6 -translate-y-1/2 rounded border border-slate-500/45 bg-slate-950/90 px-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200 transition hover:border-sky-200/50 hover:text-sky-100"
                >
                  Clear
                </button>
              ) : null}
              {networkDiagramSearch.trim() && isNetworkDiagramSearchFocused ? (
                <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-40 max-h-56 overflow-auto rounded-md border border-sky-400/35 bg-slate-950/95 p-1 shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
                  {filteredNetworkDiagramSearchOptions.length ? (
                    <ul className="space-y-1">
                      {filteredNetworkDiagramSearchOptions.map((option) => (
                        <li key={`network-diagram-search-${option.id}`}>
                          <button
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              if (networkDiagramSearchBlurTimerRef.current) {
                                clearTimeout(networkDiagramSearchBlurTimerRef.current);
                                networkDiagramSearchBlurTimerRef.current = null;
                              }
                              selectNetworkDiagramSearchOption(option);
                              networkDiagramSearchInputRef.current?.blur();
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
              onChange={(event) => setSelectedEnvironment(event.target.value as ServerHeatmapEnvironmentOption | "all")}
              className="h-8 w-32 rounded-md border border-sky-300/25 bg-slate-900/90 px-2 text-xs normal-case tracking-normal text-slate-100"
            >
              <option value="all">All</option>
              {environmentOptions.map((environment) => (
                <option key={`network-diagram-environment-${environment}`} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-8 shrink-0 items-center gap-2 whitespace-nowrap text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
            <span>Findings Criticality</span>
            <select
              value={selectedFindingCriticality}
              onChange={(event) => setSelectedFindingCriticality(event.target.value as NetworkDiagramFindingCriticalityOption | "all")}
              className="h-8 w-36 rounded-md border border-sky-300/25 bg-slate-900/90 px-2 text-xs normal-case tracking-normal text-slate-100"
            >
              <option value="all">All</option>
              {impactSeverityOrder.map((severity) => (
                <option key={`network-diagram-finding-criticality-${severity}`} value={severity}>
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
                <option key={`network-diagram-security-domain-${domain}`} value={domain}>
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
            {filteredRows.length} of {rows.length} open server findings
            {selectedNode ? ` | ${rowsMatchingSelectedNode.length} highlighted via ${selectedNode.value}` : ""}
          </p>
          <div className="flex flex-wrap justify-end gap-2 text-[11px] text-slate-300/80">
            {displayedSeverities.map((severity) => (
              <span key={`network-diagram-legend-${severity}`} className="inline-flex items-center gap-1">
                <span className="h-2 w-4 rounded-full" style={{ backgroundColor: severityStrokeColor(severity) }} />
                {severity}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-md border border-sky-300/10 bg-slate-950/35">
          {filteredRows.length ? (
            <div className="min-w-0" style={{ height: chartHeight }}>
              <svg
                role="img"
                aria-label="Network Diagram parallel coordinates"
                className="h-full w-full"
                viewBox={`0 0 ${svgWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                onClick={() => setSelectedNode(null)}
              >
                <defs>
                  <filter id="network-diagram-glow" x="-25%" y="-25%" width="150%" height="150%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {axisDefinitions.map((axis, axisIndex) => {
                  const x = xForAxis(axisIndex);
                  return (
                    <g key={`network-diagram-axis-${axis.key}`}>
                      <line x1={x} y1={top} x2={x} y2={chartHeight - bottom} stroke="rgba(125, 211, 252, 0.34)" strokeWidth={1} />
                      <text x={x} y={24} textAnchor="middle" className="fill-slate-100 text-[12px] font-semibold uppercase tracking-[0.12em]">
                        {`${axis.label} (${axis.values.length})`}
                      </text>
                      {axis.values.map((value) => {
                        const y = yForValue(axisIndex, value);
                        const selected = isNodeSelected(axis.key, value);
                        return (
                          <g key={`network-diagram-axis-${axis.key}-${value}`}>
                            <g
                              role="button"
                              tabIndex={0}
                              className="cursor-pointer outline-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectNetworkDiagramNode(axis.key, value);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  selectNetworkDiagramNode(axis.key, value);
                                }
                              }}
                            >
                              <title>{nodeHoverTitle(axis.key, value)}</title>
                              <circle
                                cx={x}
                                cy={y}
                                r={selected ? 12 : 7}
                                fill={selected ? "#67e8f9" : "rgba(14, 165, 233, 0.72)"}
                                stroke={selected ? "#ecfeff" : "transparent"}
                                strokeWidth={selected ? 1.8 : 0}
                              />
                              <text
                                x={x}
                                y={y + 14}
                                textAnchor="middle"
                                className={selected ? "fill-cyan-100 text-[10px] font-semibold" : "fill-slate-300 text-[10px]"}
                              >
                                {truncateAxisLabel(value)}
                              </text>
                            </g>
                            {selected && axis.key === "spi" ? (
                              <g
                                role="button"
                                tabIndex={0}
                                aria-label={`Open findings for ${value}`}
                                className="cursor-pointer outline-none"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openNetworkDiagramSpiDrillThrough(value);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    openNetworkDiagramSpiDrillThrough(value);
                                  }
                                }}
                              >
                                <title>{`Open findings for ${value}`}</title>
                                <circle
                                  cx={x + 13}
                                  cy={y - 13}
                                  r={7}
                                  fill="#0f172a"
                                  stroke="#ecfeff"
                                  strokeWidth={1.4}
                                />
                                <line x1={x + 9.5} y1={y - 13} x2={x + 16.5} y2={y - 13} stroke="#ecfeff" strokeWidth={1.6} strokeLinecap="round" />
                                <line x1={x + 13} y1={y - 16.5} x2={x + 13} y2={y - 9.5} stroke="#ecfeff" strokeWidth={1.6} strokeLinecap="round" />
                              </g>
                            ) : null}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
                {filteredRows.map((row) => {
                  const points = pointsForRow(row);
                  return (
                    <polyline
                      key={`network-diagram-line-${row.findingId}`}
                      points={points}
                      fill="none"
                      stroke={severityStrokeColor(row.severity)}
                      strokeOpacity={selectedNode ? 0.12 : 0.38}
                      strokeWidth={1.45}
                    >
                      <title>{`${row.systemName} | ${row.environmentType ?? "Unassigned"} | ${row.serverName} | ${row.securityDomain} | ${row.severity} | ${row.spiLabel}`}</title>
                    </polyline>
                  );
                })}
                {rowsMatchingSelectedNode.map((row) => (
                  <polyline
                    key={`network-diagram-selected-glow-${row.findingId}`}
                    points={pointsForRow(row)}
                    fill="none"
                    stroke={severityStrokeColor(row.severity)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={0.9}
                    strokeWidth={3.4}
                    filter="url(#network-diagram-glow)"
                  >
                    <animate attributeName="stroke-opacity" values="0.35;1;0.35" dur="1.35s" repeatCount="indefinite" />
                    <animate attributeName="stroke-width" values="2.4;5.2;2.4" dur="1.35s" repeatCount="indefinite" />
                    <title>{`${row.systemName} | ${row.environmentType ?? "Unassigned"} | ${row.serverName} | ${row.securityDomain} | ${row.severity} | ${row.spiLabel}`}</title>
                  </polyline>
                ))}
              </svg>
            </div>
          ) : (
            <p className="m-3 rounded-md border border-sky-300/15 bg-slate-900/55 px-3 py-2 text-xs text-slate-300/80">
              No network diagram findings match the selected filters.
            </p>
          )}
        </div>
      </div>
    </section>

    {selectedSpiDrillThroughId ? (
      <RiskFindingsDrillThrough
        selection={{
          id: `network-diagram-spi-${selectedSpiDrillThroughId}`,
          label: `SPI ${selectedSpiDrillThroughId}`,
          findings: selectedSpiFindings,
          totalCount: selectedSpiTotalCount,
          lockedSpiId: selectedSpiDrillThroughId,
          emptyMessage: "No open findings were generated for the selected Network Diagram SPI.",
          exportSlug: `network-diagram-spi-${selectedSpiDrillThroughId}`
        }}
        allFindings={filteredNetworkDiagramRiskFindings}
        assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}
        asOfDate={asOfDate}
        onClose={closeNetworkDiagramSpiDrillThrough}
      />
    ) : null}
    </>
  );
}

function SpiDriverChart({
  rows,
  findings,
  allFindings,
  assetHighRiskCvesByAssetId = {},
  asOfDate,
  embedded = false
}: {
  rows: CyberCopImpactSpiDriver[];
  findings: NetworkDetailRiskFindingRow[];
  allFindings: NetworkDetailRiskFindingRow[];
  assetHighRiskCvesByAssetId?: Record<string, HighRiskCveDetail[]>;
  asOfDate?: string;
  embedded?: boolean;
}) {
  const [selectedSpiId, setSelectedSpiId] = useState<number | null>(null);
  if (!rows.length) {
    return (
      <section className={chartSurfaceClass(embedded)}>
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">SPI Driver (Critical + High)</h3>
        <p className="mt-1 text-xs text-slate-300/80">Control families driving severe open impact.</p>
        <p className="mt-3 text-sm text-slate-300/80">No severe SPI driver data in current scope.</p>
      </section>
    );
  }

  const topRows = rows.slice(0, 10);
  const chartData = topRows.map((row) => ({
    ...row,
    spiLabel: row.label
  }));
  const selectedSpiRow = selectedSpiId ? chartData.find((row) => row.spiId === selectedSpiId) ?? null : null;
  const selectedSpiFindings = selectedSpiId
    ? findings.filter((finding) => finding.workflowStatus === "open" && finding.spiId === selectedSpiId)
    : [];
  const selectedSpiTotalCount = selectedSpiRow?.count ?? selectedSpiFindings.length;

  const openSpiDrillThrough = (spiId: number) => {
    setSelectedSpiId(spiId);
  };

  return (
    <>
      <section className={chartSurfaceClass(embedded)}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">SPI Driver (Critical + High)</h3>
            <p className="mt-1 text-xs text-slate-300/80">Top SPI controls contributing to severe open findings.</p>
          </div>
          <p className="rounded-md border border-sky-300/20 bg-slate-950/50 px-2 py-1 text-[11px] text-sky-200/90">
            Select an SPI bar to open Findings.
          </p>
        </div>
        <div className="mt-2 min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 18, left: 12, bottom: 8 }}>
              <CartesianGrid stroke="rgba(120,180,210,0.14)" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
              <YAxis dataKey="spiLabel" type="category" width={68} tick={{ fill: "#d2e6f4", fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }
                  const row = payload[0].payload as CyberCopImpactSpiDriver;
                  return (
                    <div className="rounded-md border border-slate-500/60 bg-slate-950/95 px-3 py-2 text-xs text-slate-100 shadow-lg">
                      <p>{row.description}</p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#d1e3ef" }} />
              <Bar
                dataKey="criticalExposureCount"
                stackId="severity"
                name="Critical Exposure"
                fill="#ef4444"
                isAnimationActive={false}
              >
                {chartData.map((row) => {
                  const selected = selectedSpiId === row.spiId;
                  return (
                    <Cell
                      key={`spi-driver-critical-${row.spiId}`}
                      className="cursor-pointer"
                      fill="#ef4444"
                      fillOpacity={selectedSpiId && !selected ? 0.52 : 1}
                      stroke={selected ? "#e2e8f0" : "transparent"}
                      strokeWidth={selected ? 1.4 : 0}
                      onClick={() => openSpiDrillThrough(row.spiId)}
                    />
                  );
                })}
              </Bar>
              <Bar
                dataKey="highRiskCount"
                stackId="severity"
                name="High Risk"
                fill="#f97316"
                isAnimationActive={false}
              >
                {chartData.map((row) => {
                  const selected = selectedSpiId === row.spiId;
                  return (
                    <Cell
                      key={`spi-driver-high-${row.spiId}`}
                      className="cursor-pointer"
                      fill="#f97316"
                      fillOpacity={selectedSpiId && !selected ? 0.52 : 1}
                      stroke={selected ? "#e2e8f0" : "transparent"}
                      strokeWidth={selected ? 1.4 : 0}
                      onClick={() => openSpiDrillThrough(row.spiId)}
                    />
                  );
                })}
              </Bar>
              <Bar
                dataKey="otherCount"
                stackId="severity"
                name="Other"
                fill="#38bdf8"
                radius={[0, 6, 6, 0]}
                isAnimationActive={false}
              >
                <LabelList dataKey="count" position="right" fill="#e2e8f0" fontSize={11} />
                {chartData.map((row) => {
                  const selected = selectedSpiId === row.spiId;
                  return (
                    <Cell
                      key={`spi-driver-other-${row.spiId}`}
                      className="cursor-pointer"
                      fill="#38bdf8"
                      fillOpacity={selectedSpiId && !selected ? 0.52 : 1}
                      stroke={selected ? "#e2e8f0" : "transparent"}
                      strokeWidth={selected ? 1.4 : 0}
                      onClick={() => openSpiDrillThrough(row.spiId)}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {selectedSpiId ? (
        <RiskFindingsDrillThrough
          selection={{
            id: `cyber-cop-spi-driver-${selectedSpiId}`,
            label: `SPI ${selectedSpiId}`,
            findings: selectedSpiFindings,
            totalCount: selectedSpiTotalCount,
            lockedSpiId: selectedSpiId,
            emptyMessage: "No open findings were generated for the selected SPI bar.",
            exportSlug: `spi-${selectedSpiId}`
          }}
          allFindings={allFindings}
          assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}
          asOfDate={asOfDate}
          onClose={() => setSelectedSpiId(null)}
        />
      ) : null}
    </>
  );
}

function EnvironmentImpactSplitChart({
  rows,
  embedded = false
}: {
  rows: CyberCopImpactEnvironmentSplitRow[];
  embedded?: boolean;
}) {
  if (!rows.length) {
    return (
      <section className={chartSurfaceClass(embedded)}>
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Environment Impact Split</h3>
        <p className="mt-1 text-xs text-slate-300/80">Open finding impact by environment type.</p>
        <p className="mt-3 text-sm text-slate-300/80">No environment impact data in current scope.</p>
      </section>
    );
  }

  return (
    <section className={chartSurfaceClass(embedded)}>
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Environment Impact Split</h3>
      <p className="mt-1 text-xs text-slate-300/80">Open findings grouped by environment and severity band.</p>
      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 18, left: 6, bottom: 8 }}>
            <CartesianGrid stroke="rgba(120,180,210,0.14)" />
            <XAxis dataKey="environment" tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
              formatter={(value, key, item) => {
                const row = item.payload as CyberCopImpactEnvironmentSplitRow;
                if (key === "criticalExposureCount") {
                  return [value, "Critical Exposure"];
                }
                if (key === "highRiskCount") {
                  return [value, "High Risk"];
                }
                if (key === "otherCount") {
                  return [value, "Other"];
                }
                return [row.total, "Total"];
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#d1e3ef" }} />
            <Bar dataKey="criticalExposureCount" stackId="severity" name="Critical Exposure" fill="#ef4444" isAnimationActive={false} />
            <Bar dataKey="highRiskCount" stackId="severity" name="High Risk" fill="#f97316" isAnimationActive={false} />
            <Bar dataKey="otherCount" stackId="severity" name="Other" fill="#38bdf8" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function MissionBusinessBlastRadiusChart({
  missionRows,
  businessRows,
  embedded = false
}: {
  missionRows: CyberCopImpactItem[];
  businessRows: CyberCopImpactItem[];
  embedded?: boolean;
}) {
  type DomainPoint = {
    id: string;
    name: string;
    domain: "Mission Capability" | "Business Service";
    criticality: Criticality;
    impactedAssets: number;
    criticalExposureCount: number;
    highRiskCount: number;
    findings: number;
    bubbleSize: number;
  };

  const missionPoints = useMemo(
    () =>
      missionRows
        .filter((row) => row.criticalExposureCount > 0)
        .sort((a, b) => {
          if (b.criticalExposureCount !== a.criticalExposureCount) {
            return b.criticalExposureCount - a.criticalExposureCount;
          }
          if (b.impactedAssets !== a.impactedAssets) {
            return b.impactedAssets - a.impactedAssets;
          }
          return a.name.localeCompare(b.name);
        })
        .slice(0, 28)
        .map((row) => ({
          id: row.id,
          name: row.name,
          domain: "Mission Capability" as const,
          criticality: row.criticality,
          impactedAssets: row.impactedAssets,
          criticalExposureCount: row.criticalExposureCount,
          highRiskCount: row.highRiskCount,
          findings: row.findings,
          bubbleSize: Math.max(1, row.findings)
        })),
    [missionRows]
  );
  const businessPoints = useMemo(
    () =>
      businessRows
        .filter((row) => row.criticalExposureCount > 0)
        .sort((a, b) => {
          if (b.criticalExposureCount !== a.criticalExposureCount) {
            return b.criticalExposureCount - a.criticalExposureCount;
          }
          if (b.impactedAssets !== a.impactedAssets) {
            return b.impactedAssets - a.impactedAssets;
          }
          return a.name.localeCompare(b.name);
        })
        .slice(0, 28)
        .map((row) => ({
          id: row.id,
          name: row.name,
          domain: "Business Service" as const,
          criticality: row.criticality,
          impactedAssets: row.impactedAssets,
          criticalExposureCount: row.criticalExposureCount,
          highRiskCount: row.highRiskCount,
          findings: row.findings,
          bubbleSize: Math.max(1, row.findings)
        })),
    [businessRows]
  );
  const hasPoints = missionPoints.length > 0 || businessPoints.length > 0;

  if (!hasPoints) {
    return (
      <section className={chartSurfaceClass(embedded)}>
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">
          Critical Findings Blast Radius
        </h3>
        <p className="mt-1 text-xs text-slate-300/80">
          Mission capabilities and business services with open critical exposure findings.
        </p>
        <p className="mt-3 text-sm text-slate-300/80">No mission capability or business service critical exposure data in current scope.</p>
      </section>
    );
  }

  return (
    <section className={chartSurfaceClass(embedded)}>
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">
        Critical Findings Blast Radius
      </h3>
      <p className="mt-1 text-xs text-slate-300/80">
        X: impacted assets, Y: open critical exposure findings, bubble size: total open findings.
      </p>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-300/80">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-300" />
          Mission Capability
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-300" />
          Business Service
        </span>
      </div>
      <div className="mt-2 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="rgba(120,180,210,0.14)" />
            <XAxis
              type="number"
              dataKey="impactedAssets"
              name="Impacted Assets"
              allowDecimals={false}
              tick={{ fill: "#a8c6d8", fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="criticalExposureCount"
              name="Critical Exposure Findings"
              allowDecimals={false}
              tick={{ fill: "#a8c6d8", fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="bubbleSize" range={[80, 520]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) {
                  return null;
                }

                const point = payload[0].payload as DomainPoint;
                return (
                  <div className="rounded-md border border-sky-300/35 bg-slate-950/95 px-3 py-2 text-xs text-slate-100 shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
                    <p className="font-medium text-slate-100">{point.name}</p>
                    <p className="mt-0.5 text-slate-300/90">{point.domain}</p>
                    <p className="mt-1 text-slate-200">Critical Exposure: {point.criticalExposureCount}</p>
                    <p className="text-slate-200">High Risk: {point.highRiskCount}</p>
                    <p className="text-slate-200">Impacted Assets: {point.impactedAssets}</p>
                    <p className="text-slate-200">Open Findings: {point.findings}</p>
                  </div>
                );
              }}
            />
            <Scatter name="Mission Capability" data={missionPoints} fill="#fcd34d" isAnimationActive={false} />
            <Scatter name="Business Service" data={businessPoints} fill="#67e8f9" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ImpactChartTabs({
  spiRows,
  systemRows,
  assetTypeHeatmapBySystemId,
  networkDiagramRows,
  environmentRows,
  missionRows,
  businessRows,
  riskFindings,
  assetHighRiskCvesByAssetId,
  asOfDate
}: {
  spiRows: CyberCopImpactSpiDriver[];
  systemRows: CyberCopImpactItem[];
  assetTypeHeatmapBySystemId: Record<string, CyberCopAssetTypeHeatmapAsset[]>;
  networkDiagramRows: CyberCopNetworkDiagramRow[];
  environmentRows: CyberCopImpactEnvironmentSplitRow[];
  missionRows: CyberCopImpactItem[];
  businessRows: CyberCopImpactItem[];
  riskFindings: NetworkDetailRiskFindingRow[];
  assetHighRiskCvesByAssetId?: Record<string, HighRiskCveDetail[]>;
  asOfDate?: string;
}) {
  const [activeChartTab, setActiveChartTab] = useState<ImpactChartTabId>("spi");
  const visibleSystemIds = useMemo(() => new Set(systemRows.map((row) => row.id)), [systemRows]);
  const scopedNetworkDiagramRows = useMemo(() => {
    return networkDiagramRows.filter((row) => visibleSystemIds.has(row.systemId));
  }, [networkDiagramRows, visibleSystemIds]);
  const scopedRiskFindings = useMemo(() => {
    return riskFindings.filter((finding) => Boolean(finding.systemId) && visibleSystemIds.has(finding.systemId as string));
  }, [riskFindings, visibleSystemIds]);

  return (
    <section className="panel flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden p-2">
      <div
        role="tablist"
        aria-label="Cyber COP impact chart tabs"
        className="grid min-w-0 shrink-0 grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-5"
      >
        {impactChartTabs.map((tab) => {
          const isActive = activeChartTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`cyber-cop-impact-chart-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="cyber-cop-impact-chart-panel"
              onClick={() => setActiveChartTab(tab.id)}
              className={`min-w-0 rounded-md border px-3 py-2 text-left text-xs font-semibold uppercase leading-snug tracking-[0.12em] transition ${
                isActive
                  ? "border-cyan-300/55 bg-cyan-500/15 text-cyan-100"
                  : "border-sky-300/20 bg-slate-900/55 text-slate-300 hover:border-sky-300/40 hover:text-slate-100"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id="cyber-cop-impact-chart-panel"
        role="tabpanel"
        aria-labelledby={`cyber-cop-impact-chart-tab-${activeChartTab}`}
        className="mt-2 min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-sky-300/10 bg-slate-950/30 p-1"
      >
        <div className="h-full min-h-0 min-w-0 overflow-hidden">
          <div className="h-full min-h-0 w-full min-w-0 max-w-full overflow-hidden">
            {activeChartTab === "spi" ? (
              <SpiDriverChart
                rows={spiRows}
                findings={scopedRiskFindings}
                allFindings={scopedRiskFindings}
                assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}
                asOfDate={asOfDate}
                embedded
              />
            ) : null}
            {activeChartTab === "blast-radius" ? (
              <AssetTypeHeatmapChart
                items={systemRows}
                assetsBySystemId={assetTypeHeatmapBySystemId}
                embedded
              />
            ) : null}
            {activeChartTab === "network-diagram" ? (
              <NetworkDiagramChart
                rows={scopedNetworkDiagramRows}
                riskFindings={scopedRiskFindings}
                assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}
                asOfDate={asOfDate}
                embedded
              />
            ) : null}
            {activeChartTab === "environment" ? <EnvironmentImpactSplitChart rows={environmentRows} embedded /> : null}
            {activeChartTab === "mission-business" ? (
              <MissionBusinessBlastRadiusChart
                missionRows={missionRows}
                businessRows={businessRows}
                embedded
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function severityPillClass(severity: FindingSeverity): string {
  if (severity === "Critical Exposure") {
    return "border-red-400/35 text-red-100";
  }
  if (severity === "High Risk") {
    return "border-orange-400/35 text-orange-100";
  }
  if (severity === "Major") {
    return "border-amber-300/35 text-amber-100";
  }
  if (severity === "Moderate") {
    return "border-sky-300/35 text-sky-100";
  }
  return "border-slate-400/35 text-slate-200";
}

function OldestOpenFindingsTable({ rows }: { rows: CyberCopActionOldestFindingRow[] }) {
  if (!rows.length) {
    return (
      <section className="panel flex h-full min-h-0 flex-col p-4">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Oldest Open Findings</h3>
        <p className="mt-1 text-xs text-slate-300/80">Longest-running open Critical Exposure and High Risk findings requiring escalation or unblock.</p>
        <p className="mt-3 text-sm text-slate-300/80">No open Critical Exposure or High Risk findings in current scope.</p>
      </section>
    );
  }

  return (
    <section className="panel flex h-full min-h-0 flex-col p-3">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Oldest Open Findings</h3>
      <p className="mt-1 text-xs text-slate-300/80">Longest-running open Critical Exposure and High Risk findings requiring escalation or unblock.</p>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
            <tr>
              <th className="w-[11.5rem] min-w-[11.5rem] whitespace-nowrap px-3 py-2 text-left">Severity</th>
              <th className="px-3 py-2 text-right">Age (Days)</th>
              <th className="px-3 py-2 text-left">SPI</th>
              <th className="px-3 py-2 text-left">ICT System</th>
              <th className="px-3 py-2 text-left">Opened</th>
              <th className="px-3 py-2 text-left">Title</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.findingId} className="border-t border-sky-300/10">
                <td className="w-[11.5rem] min-w-[11.5rem] whitespace-nowrap px-3 py-2">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${severityPillClass(row.severity)}`}
                  >
                    {row.severity}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-slate-100">{row.ageDays}</td>
                <td className="px-3 py-2 text-slate-200">{row.spiLabel}</td>
                <td className="px-3 py-2 text-slate-200">{row.systemName}</td>
                <td className="px-3 py-2 text-slate-300">{row.openedDate}</td>
                <td className="px-3 py-2 text-slate-200">{row.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionQuickWinsTable({ rows }: { rows: CyberCopActionQuickWinRow[] }) {
  if (!rows.length) {
    return (
      <section className="panel flex h-full min-h-0 flex-col p-4">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Quick Wins by Recommended Action</h3>
        <p className="mt-1 text-xs text-slate-300/80">
          Repeated remediation actions that can reduce severe findings fastest.
        </p>
        <p className="mt-3 text-sm text-slate-300/80">No quick-win action clusters in current scope.</p>
      </section>
    );
  }

  return (
    <section className="panel flex h-full min-h-0 flex-col p-3">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Quick Wins by Recommended Action</h3>
      <p className="mt-1 text-xs text-slate-300/80">Repeated remediation actions that can reduce severe findings fastest.</p>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-auto rounded-lg border border-sky-300/15 bg-slate-950/45">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-900/95 text-xs uppercase tracking-[0.12em] text-slate-300/80">
            <tr>
              <th className="px-3 py-2 text-left">Recommended Action</th>
              <th className="px-3 py-2 text-right">Critical Exposure</th>
              <th className="px-3 py-2 text-right">High Risk</th>
              <th className="px-3 py-2 text-right">Other</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">ICT Systems</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.actionText} className="border-t border-sky-300/10">
                <td className="px-3 py-2 text-slate-100">{row.actionText}</td>
                <td className="px-3 py-2 text-right text-red-100">{row.criticalExposureCount}</td>
                <td className="px-3 py-2 text-right text-orange-100">{row.highRiskCount}</td>
                <td className="px-3 py-2 text-right text-sky-100">{row.otherCount}</td>
                <td className="px-3 py-2 text-right text-slate-200">{row.total}</td>
                <td className="px-3 py-2 text-right text-slate-200">{row.systemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CyberCopTabFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-sky-300/15 bg-slate-950/30">
      <div className="px-4 py-3 text-center text-xs text-slate-300/70">TSAAT | Cyber Operations Compliance Reporting.</div>
    </footer>
  );
}

export function CyberCopDashboard({
  snapshotDate,
  filtersSlot,
  networkSpiHeatmapFilterSlot,
  systemSpiHeatmapFilterSlot,
  networkSpiHeatmapModel,
  systemSpiHeatmapModel,
  selectedSpiId,
  initialMeasureSearch,
  complianceScoreCards,
  riskProfile,
  riskFindings,
  assetHighRiskCvesByAssetId = {},
  asOfDate,
  impact,
  impactLinks,
  impactAssetTypeHeatmapBySystemId,
  impactNetworkDiagramRows,
  impactSpiDrivers,
  impactSpiDriversBySystemId,
  impactEnvironmentSplit,
  impactEnvironmentSplitBySystemId,
  actionPlan,
  actionOldestOpenFindings,
  actionQuickWins,
  dailyHighRisk,
  dailyCriticalExposure
}: CyberCopDashboardProps) {
  const [activeTab, setActiveTab] = useState<CyberCopTabId>("overview");
  const [selectedBusinessServiceId, setSelectedBusinessServiceId] = useState<string | null>(null);
  const [selectedMissionCapabilityId, setSelectedMissionCapabilityId] = useState<string | null>(null);
  const [selectedIctSystemId, setSelectedIctSystemId] = useState<string | null>(null);
  const [businessSearchScope, setBusinessSearchScope] = useState<{ active: boolean; itemIds: string[] }>({
    active: false,
    itemIds: []
  });
  const [missionSearchScope, setMissionSearchScope] = useState<{ active: boolean; itemIds: string[] }>({
    active: false,
    itemIds: []
  });

  const scopedSystemImpact = useMemo(() => {
    if (selectedBusinessServiceId) {
      const allowedSystemIds = new Set(impactLinks.businessToSystems[selectedBusinessServiceId] ?? []);
      return impact.systems.filter((system) => allowedSystemIds.has(system.id));
    }

    if (selectedMissionCapabilityId) {
      const allowedSystemIds = new Set(impactLinks.missionToSystems[selectedMissionCapabilityId] ?? []);
      return impact.systems.filter((system) => allowedSystemIds.has(system.id));
    }

    if (businessSearchScope.active) {
      if (!businessSearchScope.itemIds.length) {
        return [];
      }
      const allowedSystemIds = new Set(
        businessSearchScope.itemIds.flatMap((businessId) => impactLinks.businessToSystems[businessId] ?? [])
      );
      return impact.systems.filter((system) => allowedSystemIds.has(system.id));
    }

    if (missionSearchScope.active) {
      if (!missionSearchScope.itemIds.length) {
        return [];
      }
      const allowedSystemIds = new Set(
        missionSearchScope.itemIds.flatMap((missionId) => impactLinks.missionToSystems[missionId] ?? [])
      );
      return impact.systems.filter((system) => allowedSystemIds.has(system.id));
    }

    return impact.systems;
  }, [
    impact.systems,
    impactLinks.businessToSystems,
    impactLinks.missionToSystems,
    selectedBusinessServiceId,
    selectedMissionCapabilityId,
    businessSearchScope,
    missionSearchScope
  ]);

  const selectedBusinessService = useMemo(
    () => impact.business.find((item) => item.id === selectedBusinessServiceId),
    [impact.business, selectedBusinessServiceId]
  );
  const selectedMissionCapability = useMemo(
    () => impact.mission.find((item) => item.id === selectedMissionCapabilityId),
    [impact.mission, selectedMissionCapabilityId]
  );
  const selectedIctSystem = useMemo(
    () => scopedSystemImpact.find((item) => item.id === selectedIctSystemId),
    [scopedSystemImpact, selectedIctSystemId]
  );
  useEffect(() => {
    if (selectedIctSystemId && !scopedSystemImpact.some((system) => system.id === selectedIctSystemId)) {
      setSelectedIctSystemId(null);
    }
  }, [scopedSystemImpact, selectedIctSystemId]);
  const chartFilteredSystemImpact = useMemo(() => {
    if (!selectedIctSystemId) {
      return scopedSystemImpact;
    }

    const selectedRows = scopedSystemImpact.filter((system) => system.id === selectedIctSystemId);
    return selectedRows.length ? selectedRows : scopedSystemImpact;
  }, [scopedSystemImpact, selectedIctSystemId]);
  const businessImpactForLeaderboard = useMemo(() => {
    if (!selectedIctSystemId) {
      return impact.business;
    }

    return impact.business.filter((item) => (impactLinks.businessToSystems[item.id] ?? []).includes(selectedIctSystemId));
  }, [impact.business, impactLinks.businessToSystems, selectedIctSystemId]);
  const missionImpactForLeaderboard = useMemo(() => {
    if (!selectedIctSystemId) {
      return impact.mission;
    }

    return impact.mission.filter((item) => (impactLinks.missionToSystems[item.id] ?? []).includes(selectedIctSystemId));
  }, [impact.mission, impactLinks.missionToSystems, selectedIctSystemId]);
  const filteredBusinessImpact = useMemo(() => {
    if (selectedBusinessServiceId) {
      return impact.business.filter((item) => item.id === selectedBusinessServiceId);
    }

    const activeSystemIds = new Set(chartFilteredSystemImpact.map((system) => system.id));
    const businessScopeIds = businessSearchScope.active ? new Set(businessSearchScope.itemIds) : null;

    return impact.business.filter((item) => {
      if (businessScopeIds && !businessScopeIds.has(item.id)) {
        return false;
      }
      const linkedSystemIds = impactLinks.businessToSystems[item.id] ?? [];
      return linkedSystemIds.some((systemId) => activeSystemIds.has(systemId));
    });
  }, [
    selectedBusinessServiceId,
    impact.business,
    chartFilteredSystemImpact,
    businessSearchScope,
    impactLinks.businessToSystems
  ]);
  const filteredMissionImpact = useMemo(() => {
    if (selectedMissionCapabilityId) {
      return impact.mission.filter((item) => item.id === selectedMissionCapabilityId);
    }

    const activeSystemIds = new Set(chartFilteredSystemImpact.map((system) => system.id));
    const missionScopeIds = missionSearchScope.active ? new Set(missionSearchScope.itemIds) : null;

    return impact.mission.filter((item) => {
      if (missionScopeIds && !missionScopeIds.has(item.id)) {
        return false;
      }
      const linkedSystemIds = impactLinks.missionToSystems[item.id] ?? [];
      return linkedSystemIds.some((systemId) => activeSystemIds.has(systemId));
    });
  }, [
    selectedMissionCapabilityId,
    impact.mission,
    chartFilteredSystemImpact,
    missionSearchScope,
    impactLinks.missionToSystems
  ]);
  const filteredImpactSpiDrivers = useMemo(() => {
    const aggregated = new Map<number, CyberCopImpactSpiDriver>();
    for (const system of chartFilteredSystemImpact) {
      const rows = impactSpiDriversBySystemId[system.id] ?? [];
      for (const row of rows) {
        const current = aggregated.get(row.spiId) ?? {
          spiId: row.spiId,
          label: row.label,
          description: row.description,
          criticalExposureCount: 0,
          highRiskCount: 0,
          otherCount: 0,
          count: 0
        };
        current.criticalExposureCount += row.criticalExposureCount;
        current.highRiskCount += row.highRiskCount;
        current.otherCount += row.otherCount;
        current.count += row.count;
        aggregated.set(row.spiId, current);
      }
    }

    return Array.from(aggregated.values()).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.spiId - b.spiId;
    });
  }, [
    chartFilteredSystemImpact,
    impactSpiDriversBySystemId
  ]);
  const filteredImpactEnvironmentSplit = useMemo(() => {
    const aggregated = new Map<string, CyberCopImpactEnvironmentSplitRow>();
    for (const system of chartFilteredSystemImpact) {
      const rows = impactEnvironmentSplitBySystemId[system.id] ?? [];
      for (const row of rows) {
        const current = aggregated.get(row.environment) ?? {
          environment: row.environment,
          criticalExposureCount: 0,
          highRiskCount: 0,
          otherCount: 0,
          total: 0
        };
        current.criticalExposureCount += row.criticalExposureCount;
        current.highRiskCount += row.highRiskCount;
        current.otherCount += row.otherCount;
        current.total += row.total;
        aggregated.set(row.environment, current);
      }
    }

    return impactEnvironmentOrder
      .map((environment) => aggregated.get(environment))
      .filter((row): row is CyberCopImpactEnvironmentSplitRow => Boolean(row))
      .filter((row) => row.total > 0);
  }, [
    chartFilteredSystemImpact,
    impactEnvironmentSplitBySystemId
  ]);
  const ictSystemsSelectedText = selectedIctSystem?.name ?? selectedBusinessService?.name ?? selectedMissionCapability?.name ?? null;

  const ictSystemsSubtitle =
    ictSystemsSelectedText
      ? `Systems filtered by ${ictSystemsSelectedText}.`
      : "Systems with highest open finding pressure.";
  const threatSurfaceActionRows: ActionPlanMatrixRow[] = [
    {
      action: "Immediate action (critical and High-risk findings)",
      detail: "Open Critical Exposure + High Risk findings",
      count: actionPlan.immediateAction,
      scope: "Open severe findings",
      statusLabel: "Immediate",
      tone: "critical",
      emphasized: true
    },
    {
      action: "Total Non-Compliant OS",
      detail: "Server and workstation OS controls",
      count: actionPlan.nonCompliantOs,
      total: actionPlan.nonCompliantOsTotal,
      scope: `${actionPlan.nonCompliantOsTotal} endpoints`,
      actionLabel: "Non-compliant",
      clearLabel: "Compliant",
      statusLabel: "OS posture",
      tone: "warning"
    },
    {
      action: "Assets out of Warranty/EOL",
      detail: "Scoped asset lifecycle posture",
      count: actionPlan.assetsOutOfWarrantyEol,
      total: actionPlan.scopedAssetsTotal,
      scope: `${actionPlan.scopedAssetsTotal} assets`,
      actionLabel: "Warranty/EOL",
      clearLabel: "Current",
      statusLabel: "Lifecycle",
      tone: "critical"
    },
    {
      action: "Servers with Critical findings",
      detail: "Unique server assets",
      count: actionPlan.serversWithCriticalFindings,
      total: actionPlan.scopedServersTotal,
      scope: `${actionPlan.scopedServersTotal} servers`,
      actionLabel: "Critical",
      clearLabel: "No critical",
      statusLabel: "Server risk",
      tone: "critical"
    }
  ];
  const discoveryActionRows: ActionPlanMatrixRow[] = [
    {
      action: "Networks without discovery enabled",
      detail: "Managed network discovery status",
      count: actionPlan.networksWithoutDiscoveryEnabled,
      total: actionPlan.scopedNetworksTotal,
      scope: `${actionPlan.scopedNetworksTotal} networks`,
      actionLabel: "Disabled",
      clearLabel: "Enabled",
      statusLabel: "Discovery status",
      tone: "warning"
    },
    {
      action: "Networks Discovery non-compliant",
      detail: "Discovery-enabled networks with gaps",
      count: actionPlan.networksDiscoveryNonCompliant,
      total: actionPlan.scopedNetworksTotal,
      scope: `${actionPlan.scopedNetworksTotal} networks`,
      actionLabel: "Non-compliant",
      clearLabel: "Compliant",
      statusLabel: "Coverage",
      tone: "warning"
    },
    {
      action: "Networks with no target state",
      detail: "Target state inventory coverage",
      count: actionPlan.networksWithNoTargetState,
      total: actionPlan.scopedNetworksTotal,
      scope: `${actionPlan.scopedNetworksTotal} networks`,
      actionLabel: "No target",
      clearLabel: "Target set",
      statusLabel: "Target state",
      tone: "warning"
    }
  ];
  const ictSystemModellingActionRows: ActionPlanMatrixRow[] = [
    {
      action: "DIIS ICT Systems defined",
      detail: "Total DIIS-defined ICT systems in scope",
      count: actionPlan.diisIctSystemsDefined,
      scope: "DIIS inventory",
      statusLabel: "Defined scope",
      tone: "watch",
      emphasized: true
    },
    {
      action: "ICT Systems not modelled",
      detail: "DIIS systems without TSAAT models",
      count: actionPlan.ictSystemsNotModelled,
      total: actionPlan.diisIctSystemsDefined,
      scope: `${actionPlan.diisIctSystemsDefined} DIIS systems`,
      actionLabel: "Not modelled",
      clearLabel: "Modelled",
      statusLabel: "Modelling",
      tone: "warning"
    },
    {
      action: "ICT System Modelled and Discovery non-compliant",
      detail: "Modelled systems with discovery gaps",
      count: actionPlan.ictSystemsModelledDiscoveryNonCompliant,
      total: actionPlan.ictSystemsModelled,
      scope: `${actionPlan.ictSystemsModelled} modelled systems`,
      actionLabel: "Non-compliant",
      clearLabel: "Compliant",
      statusLabel: "Discovery",
      tone: "critical"
    }
  ];

  const tabButtonClass = (isActive: boolean): string =>
    `rounded-lg border px-3 py-2.5 text-left text-xs uppercase tracking-[0.14em] transition ${
      isActive
        ? "border-cyan-300/50 bg-cyan-500/15 text-cyan-100"
        : "border-sky-300/20 bg-slate-900/55 text-slate-300 hover:border-sky-300/40 hover:text-slate-100"
    }`;
  const tabPanelClass = "h-[min(calc(100vh-19rem+100px),1228px)] overflow-hidden";

  return (
    <div className="space-y-2">
      <section className="panel p-2">
        <div role="tablist" aria-label="Cyber COP dashboard tabs" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {cyberCopTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`cyber-cop-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`cyber-cop-tabpanel-${tab.id}`}
                className={tabButtonClass(isActive)}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeTab === "overview" ? (
        <div
          id="cyber-cop-tabpanel-overview"
          role="tabpanel"
          aria-labelledby="cyber-cop-tab-overview"
          className={tabPanelClass}
        >
          <div className="flex h-full flex-col">
            <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)_minmax(0,1fr)] gap-2 overflow-hidden">
              <div className="min-h-0">{filtersSlot}</div>

              <section className="panel cop-reveal relative overflow-hidden p-2.5">
                <div className="grid items-center gap-2 xl:grid-cols-[minmax(16rem,0.62fr)_minmax(0,2.4fr)]">
                  <div className="min-w-0">
                    <h2 className="text-sm uppercase tracking-[0.14em] text-slate-100">Compliance Scores</h2>
                    <p className="mt-0.5 text-xs text-slate-300/80">
                      Snapshot baseline for Defence Cyber Terrain posture at {snapshotDate}.
                    </p>
                  </div>

                  <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-5">
                    {complianceScoreCards.map((card) => (
                      <OverviewScoreCardTile key={card.title} card={card} />
                    ))}
                  </div>
                </div>
              </section>

              <div className="cop-reveal cop-reveal-delay-1 min-h-0">
                <NetworkDetailRiskCharts
                  asOfDate={asOfDate}
                  scopeDescription="Open finding pressure by severity across the Defence Cyber Terrain."
                  riskProfile={riskProfile}
                  findings={riskFindings}
                  assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}
                  enableFindingsDrillThrough={false}
                />
              </div>
              <div className="cop-reveal cop-reveal-delay-3 grid min-h-0 gap-2 lg:grid-cols-2">
                <DailyTrendPanel
                  title="Open High Risk Findings"
                  subtitle="Daily open high-risk trajectory for the last 12 months. Right edge aligns to the selected date."
                  color="#f97316"
                  data={dailyHighRisk}
                  compact
                />
                <DailyTrendPanel
                  title="Open Critical Exposure Findings"
                  subtitle="Daily open critical-exposure trajectory for the last 12 months. Right edge aligns to the selected date."
                  color="#ef4444"
                  data={dailyCriticalExposure}
                  compact
                />
              </div>
            </div>
            <CyberCopTabFooter />
          </div>
        </div>
      ) : null}

      {activeTab === "impact" ? (
        <div
          id="cyber-cop-tabpanel-impact"
          role="tabpanel"
          aria-labelledby="cyber-cop-tab-impact"
          className={tabPanelClass}
        >
          <div className="flex h-full flex-col">
            <div className="grid min-h-0 min-w-0 flex-1 gap-2 overflow-y-auto overflow-x-hidden xl:grid-cols-[minmax(26rem,0.92fr)_minmax(0,1.42fr)] xl:overflow-hidden">
              <div className="cop-reveal cop-reveal-delay-2 grid min-h-0 min-w-0 auto-rows-[minmax(20rem,auto)] gap-2 xl:grid-rows-3 xl:auto-rows-auto xl:overflow-hidden">
                <div className="min-h-[20rem] xl:min-h-0">
                  <ImpactLeaderboard
                    title="Business Services Impact"
                    subtitle="Services carrying concentrated findings."
                    items={businessImpactForLeaderboard}
                    selectedItemId={selectedBusinessServiceId}
                    selectedText={selectedBusinessService?.name ?? null}
                    onSelectItem={(item) => {
                      setSelectedMissionCapabilityId(null);
                      setSelectedIctSystemId(null);
                      setSelectedBusinessServiceId((current) => (current === item.id ? null : item.id));
                    }}
                    onFilterScopeChange={({ active, itemIds }) =>
                      setBusinessSearchScope((current) => {
                        if (
                          current.active === active &&
                          current.itemIds.length === itemIds.length &&
                          current.itemIds.every((id, index) => id === itemIds[index])
                        ) {
                          return current;
                        }
                        return { active, itemIds };
                      })
                    }
                    showClearSelectionButton
                    clearSelectionDisabled={!selectedBusinessServiceId}
                    onClearSelection={() => setSelectedBusinessServiceId(null)}
                  />
                </div>
                <div className="min-h-[20rem] xl:min-h-0">
                  <ImpactLeaderboard
                    title="Mission Capabilities Impact"
                    subtitle="Capabilities affected by current findings."
                    items={missionImpactForLeaderboard}
                    selectedItemId={selectedMissionCapabilityId}
                    selectedText={selectedMissionCapability?.name ?? null}
                    onSelectItem={(item) => {
                      setSelectedBusinessServiceId(null);
                      setSelectedIctSystemId(null);
                      setSelectedMissionCapabilityId((current) => (current === item.id ? null : item.id));
                    }}
                    onFilterScopeChange={({ active, itemIds }) =>
                      setMissionSearchScope((current) => {
                        if (
                          current.active === active &&
                          current.itemIds.length === itemIds.length &&
                          current.itemIds.every((id, index) => id === itemIds[index])
                        ) {
                          return current;
                        }
                        return { active, itemIds };
                      })
                    }
                    showClearSelectionButton
                    clearSelectionDisabled={!selectedMissionCapabilityId}
                    onClearSelection={() => setSelectedMissionCapabilityId(null)}
                  />
                </div>
                <div className="min-h-[20rem] xl:min-h-0">
                  <ImpactLeaderboard
                    title="ICT Systems Impact"
                    subtitle={ictSystemsSubtitle}
                    items={scopedSystemImpact}
                    selectedItemId={selectedIctSystemId}
                    selectedText={ictSystemsSelectedText}
                    onSelectItem={(item) => {
                      setSelectedBusinessServiceId(null);
                      setSelectedMissionCapabilityId(null);
                      setSelectedIctSystemId((current) => (current === item.id ? null : item.id));
                    }}
                    showClearSelectionButton
                    clearSelectionDisabled={!selectedIctSystemId}
                    onClearSelection={() => setSelectedIctSystemId(null)}
                  />
                </div>
              </div>

              <div className="cop-reveal cop-reveal-delay-3 min-h-[34rem] min-w-0 max-w-full overflow-hidden xl:min-h-0">
                <ImpactChartTabs
                  spiRows={filteredImpactSpiDrivers}
                  systemRows={chartFilteredSystemImpact}
                  assetTypeHeatmapBySystemId={impactAssetTypeHeatmapBySystemId}
                  networkDiagramRows={impactNetworkDiagramRows}
                  environmentRows={filteredImpactEnvironmentSplit}
                  missionRows={filteredMissionImpact}
                  businessRows={filteredBusinessImpact}
                  riskFindings={riskFindings}
                  assetHighRiskCvesByAssetId={assetHighRiskCvesByAssetId}
                  asOfDate={asOfDate}
                />
              </div>
            </div>
            <CyberCopTabFooter />
          </div>
        </div>
      ) : null}

      {activeTab === "action" ? (
        <div
          id="cyber-cop-tabpanel-action"
          role="tabpanel"
          aria-labelledby="cyber-cop-tab-action"
          className={tabPanelClass}
        >
          <div className="flex h-full flex-col">
            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
              <section className="panel cyber-cop-pulse-border p-3">
                <h2 className="text-sm uppercase tracking-[0.14em] text-slate-100">Action Plan Summary</h2>
                <p className="mt-1 text-xs text-slate-300/80">Focused action groups for current threat surface, discovery, and modelling risk.</p>
                <div className="mt-2.5 grid gap-2 xl:grid-cols-2 min-[1900px]:grid-cols-[minmax(0,1fr)_minmax(40rem,0.95fr)_minmax(40rem,0.95fr)]">
                  <ActionPlanMatrix title="Threat Surface Area Action Plan" rows={threatSurfaceActionRows} />
                  <ActionPlanMatrix title="Discovery Action Plan" rows={discoveryActionRows} />
                  <ActionPlanMatrix title="ICT System Modelling Action Plan" rows={ictSystemModellingActionRows} />
                </div>
              </section>

              <div className="grid min-h-0 auto-rows-fr gap-2 lg:grid-cols-2 lg:grid-rows-1">
                <OldestOpenFindingsTable rows={actionOldestOpenFindings.slice(0, 8)} />
                <ActionQuickWinsTable rows={actionQuickWins.slice(0, 8)} />
              </div>
            </div>
            <CyberCopTabFooter />
          </div>
        </div>
      ) : null}

      {activeTab === "networks-spi-heatmap" ? (
        <div
          id="cyber-cop-tabpanel-networks-spi-heatmap"
          role="tabpanel"
          aria-labelledby="cyber-cop-tab-networks-spi-heatmap"
          className={tabPanelClass}
        >
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2">
            <div className="min-h-0">{networkSpiHeatmapFilterSlot}</div>
            <div className="min-h-0">
              <MeasuresSpiHeatmapSection
                model={networkSpiHeatmapModel}
                selectedSpiId={selectedSpiId}
                initialSearchValue={initialMeasureSearch}
                placeholder="Search security domain or network"
                localSpiFilter
              />
            </div>
            <CyberCopTabFooter />
          </div>
        </div>
      ) : null}

      {activeTab === "systems-spi-heatmap" ? (
        <div
          id="cyber-cop-tabpanel-systems-spi-heatmap"
          role="tabpanel"
          aria-labelledby="cyber-cop-tab-systems-spi-heatmap"
          className={tabPanelClass}
        >
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2">
            <div className="min-h-0">{systemSpiHeatmapFilterSlot}</div>
            <div className="min-h-0">
              <MeasuresSpiHeatmapSection
                model={systemSpiHeatmapModel}
                selectedSpiId={selectedSpiId}
                initialSearchValue={initialMeasureSearch}
                placeholder="Search security domain or ICT system"
                localSpiFilter
              />
            </div>
            <CyberCopTabFooter />
          </div>
        </div>
      ) : null}
    </div>
  );
}
