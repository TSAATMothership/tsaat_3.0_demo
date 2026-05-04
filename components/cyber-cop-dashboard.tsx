"use client";

import { ReactNode, useEffect, useId, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { NetworkDetailRiskCharts, NetworkDetailRiskFindingRow } from "@/components/network-detail-risk-charts";
import { AssetType, Criticality, FindingSeverity, HighRiskCveDetail } from "@/lib/types";

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

export interface CyberCopActionThroughputPoint {
  weekLabel: string;
  openedCount: number;
  closedCount: number;
  netChange: number;
}

export interface CyberCopActionAgeBucketRow {
  bucketLabel: string;
  criticalExposureCount: number;
  highRiskCount: number;
  otherCount: number;
  total: number;
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
  criticalExposureCount: number;
  highRiskCount: number;
  severeFindingCount: number;
  riskScore: number;
}

export interface CyberCopDashboardProps {
  snapshotDate: string;
  filtersSlot?: ReactNode;
  complianceScores: {
    overall: number;
    dse: number;
    dpe: number;
    ictSystems: number;
    networks: number;
  };
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
  impactSpiDrivers: CyberCopImpactSpiDriver[];
  impactSpiDriversBySystemId: Record<string, CyberCopImpactSpiDriver[]>;
  impactEnvironmentSplit: CyberCopImpactEnvironmentSplitRow[];
  impactEnvironmentSplitBySystemId: Record<string, CyberCopImpactEnvironmentSplitRow[]>;
  impactEntityTrends: CyberCopImpactEntityTrend[];
  modellingSummary: {
    diisDefinedCount: number;
    modelledCount: number;
    modelledDiscoveryNonCompliantCount: number;
  };
  actionPlan: {
    immediateAction: number;
    plannedRemediation: number;
    nonCompliantOs: number;
    outOfWarranty: number;
    discoveryCoverageGaps: number;
    networkNotDiscovered: number;
    unmodelledIctSystems: number;
  };
  actionThroughput: CyberCopActionThroughputPoint[];
  actionAgeBuckets: CyberCopActionAgeBucketRow[];
  actionOldestOpenFindings: CyberCopActionOldestFindingRow[];
  actionQuickWins: CyberCopActionQuickWinRow[];
  dailyHighRisk: CyberCopDailyTrendPoint[];
  dailyCriticalExposure: CyberCopDailyTrendPoint[];
}

type CyberCopTabId = "overview" | "impact" | "action";
type ImpactChartTabId = "spi" | "blast-radius" | "environment" | "mission-business";

const cyberCopTabs: Array<{ id: CyberCopTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "impact", label: "Impact" },
  { id: "action", label: "Action" }
];

const impactChartTabs: Array<{ id: ImpactChartTabId; label: string }> = [
  { id: "spi", label: "SPI Driver" },
  { id: "blast-radius", label: "Server Risk Heatmap" },
  { id: "environment", label: "Environment Split" },
  { id: "mission-business", label: "Critical Findings Blast Radius" }
];

const impactEnvironmentOrder = ["Production", "Development", "UAT", "Test", "Unassigned"] as const;

function chartSurfaceClass(embedded?: boolean): string {
  return embedded
    ? "flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-lg border border-sky-300/15 bg-slate-950/45 p-4"
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

function complianceTone(value: number): { borderClass: string; textClass: string; meterClass: string } {
  if (value >= 90) {
    return {
      borderClass: "border-emerald-300/35",
      textClass: "text-emerald-100",
      meterClass: "bg-emerald-400"
    };
  }
  if (value >= 75) {
    return {
      borderClass: "border-cyan-300/35",
      textClass: "text-cyan-100",
      meterClass: "bg-cyan-400"
    };
  }
  return {
    borderClass: "border-amber-300/35",
    textClass: "text-amber-100",
    meterClass: "bg-amber-400"
  };
}

function criticalityClass(criticality: Criticality): string {
  if (criticality === "Critical") {
    return "border-red-400/40 text-red-100";
  }
  return "border-sky-300/35 text-sky-100";
}

function ComplianceTile({ title, score }: { title: string; score: number }) {
  const tone = complianceTone(score);
  return (
    <article className={`panel-alt ${tone.borderClass} p-3`}>
      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-300/80">{title}</p>
      <p className={`mt-1.5 text-2xl font-semibold ${tone.textClass}`}>{score}%</p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800/90">
        <div className={`h-full rounded-full ${tone.meterClass}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </article>
  );
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

function ActionTile({
  title,
  value,
  subtitle,
  tone
}: {
  title: string;
  value: number;
  subtitle: string;
  tone: "critical" | "warning" | "watch";
}) {
  const toneClass =
    tone === "critical"
      ? "border-red-400/35 text-red-100"
      : tone === "warning"
        ? "border-amber-300/35 text-amber-100"
        : "border-sky-300/35 text-sky-100";

  return (
    <article className={`panel-alt ${toneClass} p-3`}>
      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-300/75">{title}</p>
      <p className="mt-1.5 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-300/80">{subtitle}</p>
    </article>
  );
}

function IctSystemsModelledBulletTile({
  modelledCount,
  totalCount
}: {
  modelledCount: number;
  totalCount: number;
}) {
  const safeTotal = Math.max(0, totalCount);
  const boundedModelledCount = Math.min(Math.max(0, modelledCount), safeTotal);
  const notModelledCount = Math.max(0, safeTotal - boundedModelledCount);
  const modelledPercent = safeTotal ? Number(((boundedModelledCount / safeTotal) * 100).toFixed(1)) : 0;
  const notModelledPercent = safeTotal ? Number((100 - modelledPercent).toFixed(1)) : 0;

  return (
    <article className="panel-alt border-emerald-300/35 bg-emerald-500/10 p-3 text-emerald-100">
      <p className="text-[11px] uppercase tracking-[0.15em] text-slate-200/90">ICT Systems Modelled</p>
      <p className="mt-1.5 text-2xl font-semibold">{modelledPercent}%</p>
      <p className="mt-0.5 text-xs text-slate-300/90">
        {boundedModelledCount} of {safeTotal} ICT systems
      </p>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full border border-sky-300/25 bg-slate-900/80">
        <div className="flex h-full w-full">
          <div className="h-full bg-emerald-400/90" style={{ width: `${modelledPercent}%` }} />
          <div className="h-full bg-amber-300/95" style={{ width: `${notModelledPercent}%` }} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-200/90">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Modelled: {modelledPercent}% ({boundedModelledCount})
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-300" />
          Not Modelled: {notModelledPercent}% ({notModelledCount})
        </span>
      </div>
    </article>
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
  const serverAssets = useMemo(() => {
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

  const maxRiskScore = serverAssets.reduce((maxScore, asset) => Math.max(maxScore, asset.riskScore), 0);
  const serverCriticalExposureCount = serverAssets.reduce(
    (total, asset) => total + asset.criticalExposureCount,
    0
  );
  const serverHighRiskCount = serverAssets.reduce((total, asset) => total + asset.highRiskCount, 0);

  if (!serverAssets.length) {
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
        <div className="flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-slate-300/80">
          <span>Low</span>
          <span className="h-2 w-24 max-w-[36vw] rounded-full bg-[linear-gradient(90deg,#22c55e,#facc15,#ef4444)]" />
          <span>High</span>
        </div>
      </div>
      <div className="mt-2.5 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-sky-300/15 bg-slate-950/45 p-3">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="break-words text-xs font-semibold uppercase tracking-[0.14em] text-slate-100">Servers</h4>
            <p className="mt-0.5 text-[11px] text-slate-300/75">{serverAssets.length} servers</p>
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
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
          <div className="flex w-full flex-wrap content-start gap-1">
            {serverAssets.map((asset) => (
              <span
                key={`asset-heatmap-cell-${asset.id}`}
                aria-label={`${asset.name}, Server, ${asset.criticalExposureCount} critical, ${asset.highRiskCount} high`}
                className="h-4 w-4 shrink-0 rounded-[4px] border border-white/15 shadow-[0_0_10px_rgba(15,23,42,0.35)]"
                role="img"
                style={{ backgroundColor: assetHeatmapColor(asset.riskScore, maxRiskScore) }}
                title={`${asset.name}\n${asset.systemName}\nServer\nCritical Exposure: ${asset.criticalExposureCount}\nHigh Risk: ${asset.highRiskCount}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SpiDriverChart({ rows, embedded = false }: { rows: CyberCopImpactSpiDriver[]; embedded?: boolean }) {
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

  return (
    <section className={chartSurfaceClass(embedded)}>
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">SPI Driver (Critical + High)</h3>
      <p className="mt-1 text-xs text-slate-300/80">Top SPI controls contributing to severe open findings.</p>
      <div className="mt-2.5 min-h-0 flex-1">
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
            />
            <Bar
              dataKey="highRiskCount"
              stackId="severity"
              name="High Risk"
              fill="#f97316"
              isAnimationActive={false}
            />
            <Bar
              dataKey="otherCount"
              stackId="severity"
              name="Other"
              fill="#38bdf8"
              radius={[0, 6, 6, 0]}
              isAnimationActive={false}
            >
              <LabelList dataKey="count" position="right" fill="#e2e8f0" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
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
      <div className="mt-2.5 min-h-0 flex-1">
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
      <div className="mt-2.5 min-h-0 flex-1">
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
  environmentRows,
  missionRows,
  businessRows
}: {
  spiRows: CyberCopImpactSpiDriver[];
  systemRows: CyberCopImpactItem[];
  assetTypeHeatmapBySystemId: Record<string, CyberCopAssetTypeHeatmapAsset[]>;
  environmentRows: CyberCopImpactEnvironmentSplitRow[];
  missionRows: CyberCopImpactItem[];
  businessRows: CyberCopImpactItem[];
}) {
  const [activeChartTab, setActiveChartTab] = useState<ImpactChartTabId>("spi");

  return (
    <section className="panel flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden p-3">
      <div
        role="tablist"
        aria-label="Cyber COP impact chart tabs"
        className="grid min-w-0 shrink-0 grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4"
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
        className="mt-3 min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-sky-300/10 bg-slate-950/30 p-3 sm:p-4"
      >
        <div className="flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
          <div className="h-full min-h-[22rem] max-h-[42rem] min-w-0 max-w-full w-full">
            {activeChartTab === "spi" ? <SpiDriverChart rows={spiRows} embedded /> : null}
            {activeChartTab === "blast-radius" ? (
              <AssetTypeHeatmapChart
                items={systemRows}
                assetsBySystemId={assetTypeHeatmapBySystemId}
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

function RemediationThroughputChart({ rows }: { rows: CyberCopActionThroughputPoint[] }) {
  if (!rows.length) {
    return (
      <section className="panel flex h-full min-h-0 flex-col p-4">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Remediation Throughput (Weekly)</h3>
        <p className="mt-1 text-xs text-slate-300/80">Opened vs closed findings over the last 13 weeks.</p>
        <p className="mt-3 text-sm text-slate-300/80">No throughput data in current scope.</p>
      </section>
    );
  }

  const totalOpened = rows.reduce((accumulator, row) => accumulator + row.openedCount, 0);
  const totalClosed = rows.reduce((accumulator, row) => accumulator + row.closedCount, 0);

  return (
    <section className="panel flex h-full min-h-0 flex-col p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Remediation Throughput (Weekly)</h3>
          <p className="mt-1 text-xs text-slate-300/80">Opened vs closed findings over the last 13 weeks.</p>
        </div>
        <p className="rounded-full border border-sky-300/30 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200">
          Opened: {totalOpened} | Closed: {totalClosed}
        </p>
      </div>
      <div className="mt-2.5 min-h-[10rem] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="rgba(120,180,210,0.14)" />
            <XAxis dataKey="weekLabel" tick={{ fill: "#a8c6d8", fontSize: 11 }} minTickGap={20} />
            <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
              formatter={(value, name) => {
                if (name === "openedCount") {
                  return [value, "Opened"];
                }
                if (name === "closedCount") {
                  return [value, "Closed"];
                }
                return [value, "Net"];
              }}
            />
            <Legend
              formatter={(value) => {
                if (value === "openedCount") {
                  return "Opened";
                }
                if (value === "closedCount") {
                  return "Closed";
                }
                return "Net";
              }}
              wrapperStyle={{ fontSize: "12px", color: "#d1e3ef" }}
            />
            <Bar dataKey="openedCount" name="openedCount" fill="#f59e0b" radius={[6, 6, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="closedCount" name="closedCount" fill="#22c55e" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function FindingAgingBucketsChart({ rows }: { rows: CyberCopActionAgeBucketRow[] }) {
  if (!rows.length) {
    return (
      <section className="panel flex h-full min-h-0 flex-col p-4">
        <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Open Findings Aging Buckets</h3>
        <p className="mt-1 text-xs text-slate-300/80">Current open findings grouped by age and severity mix.</p>
        <p className="mt-3 text-sm text-slate-300/80">No open findings in current scope.</p>
      </section>
    );
  }

  return (
    <section className="panel flex h-full min-h-0 flex-col p-4">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Open Findings Aging Buckets</h3>
      <p className="mt-1 text-xs text-slate-300/80">Current open findings grouped by age and severity mix.</p>
      <div className="mt-2.5 min-h-[10rem] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 18, left: 6, bottom: 8 }}>
            <CartesianGrid stroke="rgba(120,180,210,0.14)" />
            <XAxis dataKey="bucketLabel" tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
              formatter={(value, key, item) => {
                const row = item.payload as CyberCopActionAgeBucketRow;
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
        <p className="mt-1 text-xs text-slate-300/80">Longest-running open findings requiring escalation or unblock.</p>
        <p className="mt-3 text-sm text-slate-300/80">No open findings in current scope.</p>
      </section>
    );
  }

  return (
    <section className="panel flex h-full min-h-0 flex-col p-3">
      <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Oldest Open Findings</h3>
      <p className="mt-1 text-xs text-slate-300/80">Longest-running open findings requiring escalation or unblock.</p>
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
  complianceScores,
  riskProfile,
  riskFindings,
  assetHighRiskCvesByAssetId = {},
  asOfDate,
  impact,
  impactLinks,
  impactAssetTypeHeatmapBySystemId,
  impactSpiDrivers,
  impactSpiDriversBySystemId,
  impactEnvironmentSplit,
  impactEnvironmentSplitBySystemId,
  modellingSummary,
  actionPlan,
  actionThroughput,
  actionAgeBuckets,
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
        <div role="tablist" aria-label="Cyber COP dashboard tabs" className="grid gap-2 sm:grid-cols-3">
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

              <section className="panel cop-reveal relative overflow-hidden p-3">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.22),transparent_44%),radial-gradient(circle_at_88%_16%,rgba(239,68,68,0.16),transparent_38%)]" />
                <div className="relative">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <h2 className="text-sm uppercase tracking-[0.16em] text-slate-100">Compliance Scores</h2>
                      <p className="mt-1 text-xs text-slate-300/80">
                        Snapshot baseline for Defence Cyber Terrain posture at {snapshotDate}.
                      </p>
                    </div>
                    <span className="rounded-full border border-sky-300/30 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200">
                      Senior Cyber Operations Briefing
                    </span>
                  </div>
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    <ComplianceTile title="Overall Compliance" score={complianceScores.overall} />
                    <ComplianceTile title="DSE Compliance" score={complianceScores.dse} />
                    <ComplianceTile title="DPE Compliance" score={complianceScores.dpe} />
                    <ComplianceTile title="Critical ICT Systems Compliance" score={complianceScores.ictSystems} />
                    <ComplianceTile title="Networks Compliance" score={complianceScores.networks} />
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
                  environmentRows={filteredImpactEnvironmentSplit}
                  missionRows={filteredMissionImpact}
                  businessRows={filteredBusinessImpact}
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
            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-2 overflow-hidden">
              <section className="panel cyber-cop-pulse-border p-3">
                <h2 className="text-sm uppercase tracking-[0.14em] text-slate-100">Action Plan Summary</h2>
                <p className="mt-1 text-xs text-slate-300/80">Focus of effort for immediate response and planned remediation.</p>
                <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-7">
                  <ActionTile
                    title="Immediate Action"
                    value={actionPlan.immediateAction}
                    subtitle="Critical Exposure + High Risk findings"
                    tone="critical"
                  />
                  <ActionTile
                    title="Planned Remediation"
                    value={actionPlan.plannedRemediation}
                    subtitle="P3+ findings backlog"
                    tone="warning"
                  />
                  <ActionTile
                    title="Total Non-Compliant OS"
                    value={actionPlan.nonCompliantOs}
                    subtitle="Assets failing OS SPI controls"
                    tone="warning"
                  />
                  <ActionTile
                    title="Assets Out of Warranty"
                    value={actionPlan.outOfWarranty}
                    subtitle="Physical assets beyond support coverage"
                    tone="critical"
                  />
                  <ActionTile
                    title="Discovery Coverage Gaps"
                    value={actionPlan.discoveryCoverageGaps}
                    subtitle="Assets not meeting discovery compliance"
                    tone="watch"
                  />
                  <ActionTile
                    title="Network Not Discovered"
                    value={actionPlan.networkNotDiscovered}
                    subtitle="Managed networks with Discovery Non Enabled status"
                    tone="warning"
                  />
                  <ActionTile
                    title="ICT Systems Not Modelled"
                    value={actionPlan.unmodelledIctSystems}
                    subtitle="DIIS-defined systems without TSAAT models"
                    tone="warning"
                  />
                </div>

                <div className="mt-3 border-t border-sky-300/20 pt-2.5">
                  <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">ICT System Modelling Summary</h3>
                  <p className="mt-1 text-xs text-slate-300/80">
                    DIIS ICT system inventory coverage versus modelling completeness and discovery readiness.
                  </p>
                  <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                    <ActionTile
                      title="DIIS ICT Systems Defined"
                      value={modellingSummary.diisDefinedCount}
                      subtitle="Total ICT systems defined in DIIS scope"
                      tone="watch"
                    />
                    <IctSystemsModelledBulletTile
                      modelledCount={modellingSummary.modelledCount}
                      totalCount={modellingSummary.diisDefinedCount}
                    />
                    <ActionTile
                      title="ICT Systems Modelled with Discovery Non-Compliant"
                      value={modellingSummary.modelledDiscoveryNonCompliantCount}
                      subtitle="Modelled systems with discovery coverage gaps"
                      tone="critical"
                    />
                  </div>
                </div>
              </section>

              <div className="grid min-h-0 gap-2 lg:grid-cols-2">
                <RemediationThroughputChart rows={actionThroughput} />
                <FindingAgingBucketsChart rows={actionAgeBuckets} />
              </div>

              <div className="grid min-h-0 auto-rows-fr gap-2 lg:grid-cols-2 lg:grid-rows-1">
                <OldestOpenFindingsTable rows={actionOldestOpenFindings.slice(0, 8)} />
                <ActionQuickWinsTable rows={actionQuickWins.slice(0, 8)} />
              </div>
            </div>
            <CyberCopTabFooter />
          </div>
        </div>
      ) : null}
    </div>
  );
}
