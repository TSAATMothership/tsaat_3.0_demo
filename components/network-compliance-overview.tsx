"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { workflowStatusAtAsOf } from "@/lib/finding-status";
import { ComplianceStatus, FindingSeverity } from "@/lib/types";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PANEL_TWEEN_MS = 260;
const FINDING_SEVERITY_FILTERS: FindingSeverity[] = [
  "Critical Exposure",
  "High Risk",
  "Major",
  "Moderate",
  "Data Gap"
];
const FINDING_SEVERITY_COLORS: Record<FindingSeverity, string> = {
  "Critical Exposure": "#f87171",
  "High Risk": "#fb923c",
  Major: "#fbbf24",
  Moderate: "#22d3ee",
  "Data Gap": "#94a3b8"
};

export interface ComplianceOverviewSummary {
  score: number;
  total: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
}

export interface ComplianceOverviewAssetTypeSummary {
  totalAssets: number;
  serverCount: number;
  workstationCount: number;
  networkDeviceCount: number;
}

function iconWrapper(icon: ReactNode) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-300/25 bg-sky-500/10 text-sky-100">
      {icon}
    </span>
  );
}

function TotalAssetsIcon() {
  return iconWrapper(
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M4 8.5 12 4l8 4.5-8 4.5L4 8.5Z" />
      <path d="M4 12.5 12 17l8-4.5" />
      <path d="M4 16.5 12 21l8-4.5" />
    </svg>
  );
}

function ServerIcon() {
  return iconWrapper(
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="14" width="16" height="6" rx="1.5" />
      <path d="M8 7h.01M8 17h.01M12 7h6M12 17h6" />
    </svg>
  );
}

function WorkstationIcon() {
  return iconWrapper(
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  );
}

function NetworkDeviceIcon() {
  return iconWrapper(
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M7 12h.01M11 12h.01M15 12h.01M19 12h.01M7 16v2M17 16v2" />
    </svg>
  );
}

export interface ComplianceOverviewMeasureRow {
  spiId: number;
  label: string;
  total: number;
  compliant: number;
  nonCompliant: number;
  unknown: number;
  score: number;
  impactedAssets: number;
  topReasons: string[];
}

export interface ComplianceOverviewFindingRow {
  id: string;
  assetId: string;
  assetName: string;
  assetType: string;
  assetIpAddress: string;
  assetChangeAssignmentGroup: string;
  assetIncidentAssignmentGroup: string;
  owner: string;
  spiId: number;
  timestamp: string;
  closedTimestamp: string | null;
  closedTimestampLabel: string | null;
  title: string;
  timestampLabel: string;
  measureLabel: string;
  priorityRank: number;
  severity: FindingSeverity;
  workflowStatus: "open" | "closed";
  complianceStatus: ComplianceStatus;
  evaluationStatus: ComplianceStatus;
  scopeLabel: string;
  evidencePreview: string;
  evidence: Array<{ key: string; value: string }>;
  recommendedAction: string;
}

type TimelineFindingEntry = { finding: ComplianceOverviewFindingRow; asOfStatus: "open" | "closed" };
type AssetDetailsRow = {
  assetId: string;
  assetName: string;
  assetIpAddress: string;
  assetType: string;
  criticalExposureFindings: number;
  highRiskFindings: number;
  totalFindings: number;
  assetChangeAssignmentGroup: string;
  assetIncidentAssignmentGroup: string;
  owner: string;
};

function percentage(part: number, whole: number): number {
  if (!whole) {
    return 0;
  }
  return Number(((part / whole) * 100).toFixed(1));
}

function statusBadgeClass(status: ComplianceStatus): string {
  if (status === "Compliant") {
    return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
  }
  if (status === "Non-compliant") {
    return "border-red-400/45 bg-red-500/15 text-red-100";
  }
  return "border-slate-400/40 bg-slate-500/10 text-slate-200";
}

function workflowBadgeClass(status: "open" | "closed"): string {
  return status === "open"
    ? "border-amber-400/45 bg-amber-500/15 text-amber-100"
    : "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export function NetworkComplianceOverview({
  networkName,
  asOfDate,
  summary,
  assetTypeSummary,
  measures,
  findings
}: {
  networkName: string;
  asOfDate: string;
  summary: ComplianceOverviewSummary;
  assetTypeSummary: ComplianceOverviewAssetTypeSummary;
  measures: ComplianceOverviewMeasureRow[];
  findings: ComplianceOverviewFindingRow[];
}) {
  const [selectedMeasure, setSelectedMeasure] = useState<ComplianceOverviewMeasureRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<"all" | "open" | "closed">("open");
  const [severityFilter, setSeverityFilter] = useState<"all" | FindingSeverity>("all");
  const [isFindingsPanelVisible, setIsFindingsPanelVisible] = useState(false);
  const [isFindingsPanelOpen, setIsFindingsPanelOpen] = useState(false);
  const [selectedFindingForAssets, setSelectedFindingForAssets] = useState<TimelineFindingEntry | null>(null);
  const [isAssetDetailsPanelVisible, setIsAssetDetailsPanelVisible] = useState(false);
  const [isAssetDetailsPanelOpen, setIsAssetDetailsPanelOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetDetailsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timelineMaxDate = useMemo(() => asOfDate, [asOfDate]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (assetDetailsCloseTimerRef.current) {
        clearTimeout(assetDetailsCloseTimerRef.current);
        assetDetailsCloseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isFindingsPanelVisible) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isAssetDetailsPanelVisible) {
          closeAssetDetailsPanel();
          return;
        }
        closeFindingsPanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isAssetDetailsPanelVisible, isFindingsPanelVisible]);

  const openFindingsPanel = (measure: ComplianceOverviewMeasureRow) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    setSelectedMeasure(measure);
    setSearchTerm("");
    setWorkflowFilter("open");
    setSeverityFilter("all");
    setSelectedFindingForAssets(null);
    setIsAssetDetailsPanelVisible(false);
    setIsAssetDetailsPanelOpen(false);
    setIsFindingsPanelVisible(true);
    requestAnimationFrame(() => {
      setIsFindingsPanelOpen(true);
    });
  };

  const closeFindingsPanel = () => {
    setIsFindingsPanelOpen(false);
    setIsAssetDetailsPanelOpen(false);
    setIsAssetDetailsPanelVisible(false);
    setSelectedFindingForAssets(null);
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setIsFindingsPanelVisible(false);
      setSelectedMeasure(null);
      closeTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const openAssetDetailsPanel = (entry: TimelineFindingEntry) => {
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    setSelectedFindingForAssets(entry);
    setIsAssetDetailsPanelVisible(true);
    requestAnimationFrame(() => {
      setIsAssetDetailsPanelOpen(true);
    });
  };

  const closeAssetDetailsPanel = () => {
    setIsAssetDetailsPanelOpen(false);
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
    }
    assetDetailsCloseTimerRef.current = setTimeout(() => {
      setIsAssetDetailsPanelVisible(false);
      setSelectedFindingForAssets(null);
      assetDetailsCloseTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const sortedMeasures = useMemo(() => {
    return [...measures].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.spiId - b.spiId;
    });
  }, [measures]);

  const selectedMeasureFindings = useMemo(() => {
    if (!selectedMeasure) {
      return [];
    }
    return findings.filter((finding) => finding.spiId === selectedMeasure.spiId);
  }, [findings, selectedMeasure]);

  const timelineScopedFindings = useMemo(() => {
    if (!selectedMeasure) {
      return [];
    }
    const asOf = timelineMaxDate;
    return selectedMeasureFindings
      .map((finding) => ({
        finding,
        asOfStatus: workflowStatusAtAsOf(
          {
            timestamp: finding.timestamp,
            closedTimestamp: finding.closedTimestamp
          },
          asOf
        )
      }))
      .filter(
        (entry): entry is TimelineFindingEntry => entry.asOfStatus !== null
      );
  }, [selectedMeasure, selectedMeasureFindings, timelineMaxDate]);

  const filteredTimelineFindings = useMemo(() => {
    if (!selectedMeasure) {
      return [];
    }
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return timelineScopedFindings
      .filter((entry) => {
        const finding = entry.finding;
        if (workflowFilter !== "all" && entry.asOfStatus !== workflowFilter) {
          return false;
        }
        if (severityFilter !== "all" && finding.severity !== severityFilter) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }
        const haystack = [
          finding.id,
          finding.title,
          finding.measureLabel,
          entry.asOfStatus,
          finding.severity,
          finding.complianceStatus,
          finding.evaluationStatus,
          finding.scopeLabel,
          finding.evidencePreview,
          finding.recommendedAction
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
  }, [searchTerm, selectedMeasure, severityFilter, timelineScopedFindings, workflowFilter]);

  const filteredFindings = useMemo(() => filteredTimelineFindings.slice(0, 200), [filteredTimelineFindings]);

  const findingCountsByAsset = useMemo(() => {
    const counts = new Map<string, { criticalExposureFindings: number; highRiskFindings: number; totalFindings: number }>();
    for (const finding of findings) {
      const current = counts.get(finding.assetId) ?? {
        criticalExposureFindings: 0,
        highRiskFindings: 0,
        totalFindings: 0
      };
      current.totalFindings += 1;
      if (finding.severity === "Critical Exposure") {
        current.criticalExposureFindings += 1;
      }
      if (finding.severity === "High Risk") {
        current.highRiskFindings += 1;
      }
      counts.set(finding.assetId, current);
    }
    return counts;
  }, [findings]);

  const assetDetailsRows = useMemo<AssetDetailsRow[]>(() => {
    if (!selectedFindingForAssets) {
      return [];
    }

    const linkedAssetFindings = filteredTimelineFindings.filter(
      (entry) =>
        entry.finding.spiId === selectedFindingForAssets.finding.spiId &&
        entry.finding.title === selectedFindingForAssets.finding.title
    );
    const latestFindingByAsset = new Map<string, ComplianceOverviewFindingRow>();
    for (const entry of linkedAssetFindings) {
      if (!latestFindingByAsset.has(entry.finding.assetId)) {
        latestFindingByAsset.set(entry.finding.assetId, entry.finding);
      }
    }

    return Array.from(latestFindingByAsset.values())
      .map((finding) => {
        const counts = findingCountsByAsset.get(finding.assetId) ?? {
          criticalExposureFindings: 0,
          highRiskFindings: 0,
          totalFindings: 0
        };
        return {
          assetId: finding.assetId,
          assetName: finding.assetName,
          assetIpAddress: finding.assetIpAddress,
          assetType: finding.assetType,
          criticalExposureFindings: counts.criticalExposureFindings,
          highRiskFindings: counts.highRiskFindings,
          totalFindings: counts.totalFindings,
          assetChangeAssignmentGroup: finding.assetChangeAssignmentGroup,
          assetIncidentAssignmentGroup: finding.assetIncidentAssignmentGroup,
          owner: finding.owner
        };
      })
      .sort((a, b) => {
        if (b.criticalExposureFindings !== a.criticalExposureFindings) {
          return b.criticalExposureFindings - a.criticalExposureFindings;
        }
        if (b.highRiskFindings !== a.highRiskFindings) {
          return b.highRiskFindings - a.highRiskFindings;
        }
        if (b.totalFindings !== a.totalFindings) {
          return b.totalFindings - a.totalFindings;
        }
        return a.assetName.localeCompare(b.assetName);
      });
  }, [filteredTimelineFindings, findingCountsByAsset, selectedFindingForAssets]);

  const downloadAssetDetailsCsv = () => {
    if (!assetDetailsRows.length) {
      return;
    }

    const headers = [
      "Asset Name",
      "Asset IP address",
      "Asset Type",
      "Total Critical Exposure Findings",
      "Total High Risk Findings",
      "Total Findings",
      "Asset Change Assignment Group",
      "Asset Incident Assignment Group",
      "Owner"
    ];
    const rows = assetDetailsRows.map((assetRow) => [
      assetRow.assetName,
      assetRow.assetIpAddress,
      assetRow.assetType,
      assetRow.criticalExposureFindings,
      assetRow.highRiskFindings,
      assetRow.totalFindings,
      assetRow.assetChangeAssignmentGroup,
      assetRow.assetIncidentAssignmentGroup,
      assetRow.owner
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

    const findingLabel = selectedFindingForAssets?.finding.title ?? "asset-details";
    const safeFindingLabel =
      findingLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "asset-details";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `asset-details-${safeFindingLabel}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const findingsHistoryPoints = useMemo(() => {
    if (!selectedMeasure) {
      return [];
    }

    const maxDate = new Date(`${timelineMaxDate}T00:00:00.000Z`);
    const endMonth = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth(), 1));

    return Array.from({ length: 24 }, (_, index) => {
      const monthOffset = 23 - index;
      const monthStart = new Date(Date.UTC(endMonth.getUTCFullYear(), endMonth.getUTCMonth() - monthOffset, 1));
      const nextMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
      const monthEndMs = nextMonthStart.getTime() - 1;

      let openFindings = 0;
      for (const entry of filteredTimelineFindings) {
        const finding = entry.finding;
        const openedAt = new Date(finding.timestamp).getTime();
        if (Number.isNaN(openedAt) || openedAt > monthEndMs) {
          continue;
        }
        const closedAt = finding.closedTimestamp ? new Date(finding.closedTimestamp).getTime() : null;
        if (closedAt !== null && !Number.isNaN(closedAt) && closedAt <= monthEndMs) {
          continue;
        }
        openFindings += 1;
      }

      return {
        label: monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
        openFindings
      };
    });
  }, [filteredTimelineFindings, selectedMeasure, timelineMaxDate]);

  const findingsBySeverityPoints = useMemo(() => {
    const counts: Record<FindingSeverity, number> = {
      "Critical Exposure": 0,
      "High Risk": 0,
      Major: 0,
      Moderate: 0,
      "Data Gap": 0
    };
    for (const entry of filteredTimelineFindings) {
      counts[entry.finding.severity] += 1;
    }
    return FINDING_SEVERITY_FILTERS.map((severity) => ({
      severity,
      count: counts[severity]
    }));
  }, [filteredTimelineFindings]);

  const compliantPercent = percentage(summary.compliant, summary.total);
  const nonCompliantPercent = percentage(summary.nonCompliant, summary.total);
  const unknownPercent = percentage(summary.unknown, summary.total);
  const typePercent = (count: number) => percentage(count, assetTypeSummary.totalAssets);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <section className="panel relative overflow-hidden p-4">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-8 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative">
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Compliance Overview</h2>
          <p className="mt-1 text-sm text-slate-300/80">
            Visual score composition for {networkName} using evaluation statuses only. Formula: compliant evaluations /
            total evaluations x 100.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="panel-alt border-emerald-400/30 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Compliant</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-100">{summary.compliant}</p>
              <p className="text-xs text-emerald-100/85">{compliantPercent}% of total</p>
            </article>
            <article className="panel-alt border-red-400/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Non-compliant</p>
              <p className="mt-1 text-2xl font-semibold text-red-100">{summary.nonCompliant}</p>
              <p className="text-xs text-red-100/85">{nonCompliantPercent}% of total</p>
            </article>
            <article className="panel-alt border-slate-400/35 p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Unknown</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">{summary.unknown}</p>
              <p className="text-xs text-slate-200/85">{unknownPercent}% of total</p>
            </article>
          </div>
          <div className="mt-3 panel-alt border-sky-300/25 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/80">Total Assets By Asset Type</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <div className="rounded-lg border border-sky-300/20 bg-slate-950/50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300/75">Total</p>
                  <TotalAssetsIcon />
                </div>
                <p className="mt-1 text-xl font-semibold text-slate-100">{assetTypeSummary.totalAssets}</p>
                <p className="text-[11px] text-slate-300/75">100% of scoped assets</p>
              </div>
              <div className="rounded-lg border border-sky-300/20 bg-slate-950/50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300/75">Servers</p>
                  <ServerIcon />
                </div>
                <p className="mt-1 text-xl font-semibold text-sky-100">{assetTypeSummary.serverCount}</p>
                <p className="text-[11px] text-slate-300/75">{typePercent(assetTypeSummary.serverCount)}%</p>
              </div>
              <div className="rounded-lg border border-sky-300/20 bg-slate-950/50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300/75">Workstations</p>
                  <WorkstationIcon />
                </div>
                <p className="mt-1 text-xl font-semibold text-sky-100">{assetTypeSummary.workstationCount}</p>
                <p className="text-[11px] text-slate-300/75">{typePercent(assetTypeSummary.workstationCount)}%</p>
              </div>
              <div className="rounded-lg border border-sky-300/20 bg-slate-950/50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-slate-300/75">Network Devices</p>
                  <NetworkDeviceIcon />
                </div>
                <p className="mt-1 text-xl font-semibold text-sky-100">{assetTypeSummary.networkDeviceCount}</p>
                <p className="text-[11px] text-slate-300/75">{typePercent(assetTypeSummary.networkDeviceCount)}%</p>
              </div>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-full border border-sky-300/20 bg-slate-950/60">
            <div className="flex h-3 w-full">
              <div className="bg-emerald-400/80" style={{ width: `${compliantPercent}%` }} />
              <div className="bg-red-400/80" style={{ width: `${nonCompliantPercent}%` }} />
              <div className="bg-slate-400/70" style={{ width: `${unknownPercent}%` }} />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-300/75">
            Total evaluations: {summary.total}. Select a measure below to open filtered findings and evidence.
          </p>
        </div>
      </section>

      <section className="panel flex min-h-0 flex-col overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
          <h3 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Measure Breakdown</h3>
          <p className="mt-1 text-xs text-slate-300/75">
            Measure-level contribution to the score with non-compliance reasons.
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2">Measure</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Status Mix</th>
                <th className="px-3 py-2">Impacted Assets</th>
                <th className="px-3 py-2">Top Non-Compliance Reason</th>
              </tr>
            </thead>
            <tbody>
              {sortedMeasures.map((measure) => {
                const measureCompliantPercent = percentage(measure.compliant, measure.total);
                const measureNonCompliantPercent = percentage(measure.nonCompliant, measure.total);
                const measureUnknownPercent = percentage(measure.unknown, measure.total);
                return (
                  <tr key={measure.spiId} className="border-t border-sky-400/10">
                    <td className="px-3 py-2 text-slate-100">
                      <button
                        type="button"
                        onClick={() => openFindingsPanel(measure)}
                        className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                      >
                        {measure.label}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-100">{measure.score}%</td>
                    <td className="px-3 py-2">
                      <div className="w-[220px] max-w-full">
                        <div className="overflow-hidden rounded-full border border-sky-300/20 bg-slate-950/60">
                          <div className="flex h-2.5 w-full">
                            <div className="bg-emerald-400/80" style={{ width: `${measureCompliantPercent}%` }} />
                            <div className="bg-red-400/80" style={{ width: `${measureNonCompliantPercent}%` }} />
                            <div className="bg-slate-400/70" style={{ width: `${measureUnknownPercent}%` }} />
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-300/75">
                          C {measure.compliant} | NC {measure.nonCompliant} | U {measure.unknown}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-200">{measure.impactedAssets}</td>
                    <td className="px-3 py-2 text-xs text-slate-300/85">{measure.topReasons[0] ?? "-"}</td>
                  </tr>
                );
              })}
              {sortedMeasures.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-300/80">
                    No measure data in this scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isFindingsPanelVisible && selectedMeasure ? (
        <div className="fixed inset-0 z-[140]">
          <div
            className={`absolute inset-0 bg-slate-950/92 backdrop-blur-[1px] transition-opacity duration-200 ${
              isFindingsPanelOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeFindingsPanel}
          />
          <aside
            className={`absolute right-0 top-0 h-full w-full border-l border-sky-300/35 bg-slate-950 p-4 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out ${
              isFindingsPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="findings-slideout-title"
          >
            <button
              type="button"
              onClick={closeFindingsPanel}
              className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
            >
              Close
            </button>

            <div className="flex h-full min-h-0 flex-col">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Compliance Detail</p>
              <h4 id="findings-slideout-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
                Findings and Evidence
              </h4>
              <p className="mt-1 text-xs text-slate-300/80">Selected Measure: {selectedMeasure.label}</p>

              <section className="panel-alt mt-3 p-3">
                <div className="grid gap-3 xl:grid-cols-2">
                  <div className="rounded-xl border border-sky-300/20 bg-slate-950/45 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Findings History (2 Years)</h5>
                        <p className="mt-1 text-xs text-slate-300/80">
                          Open findings over time for the selected measure.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Current Open Findings</p>
                        <p className="mt-1 text-xl font-semibold text-slate-100">
                          {findingsHistoryPoints[findingsHistoryPoints.length - 1]?.openFindings ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={findingsHistoryPoints}>
                          <CartesianGrid stroke="rgba(120,180,210,0.15)" />
                          <XAxis dataKey="label" tick={{ fill: "#a2c2d4", fontSize: 10 }} minTickGap={24} />
                          <YAxis allowDecimals={false} tick={{ fill: "#a2c2d4", fontSize: 11 }} width={30} />
                          <Tooltip formatter={(value) => [value ?? 0, "Open Findings"]} />
                          <Line
                            type="monotone"
                            dataKey="openFindings"
                            stroke="#46c0de"
                            strokeWidth={2.4}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky-300/20 bg-slate-950/45 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Findings by Severity</h5>
                        <p className="mt-1 text-xs text-slate-300/80">
                          All findings in scope at the selected date, grouped by severity.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Findings In Scope</p>
                        <p className="mt-1 text-xl font-semibold text-slate-100">{filteredTimelineFindings.length}</p>
                      </div>
                    </div>
                    <div className="mt-3 h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={findingsBySeverityPoints}>
                          <CartesianGrid stroke="rgba(120,180,210,0.15)" vertical={false} />
                          <XAxis
                            dataKey="severity"
                            tick={{ fill: "#a2c2d4", fontSize: 10 }}
                            interval={0}
                            angle={-18}
                            textAnchor="end"
                            height={52}
                          />
                          <YAxis allowDecimals={false} tick={{ fill: "#a2c2d4", fontSize: 11 }} width={30} />
                          <Tooltip formatter={(value) => [value ?? 0, "Findings"]} />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                            {findingsBySeverityPoints.map((entry) => (
                              <Cell key={entry.severity} fill={FINDING_SEVERITY_COLORS[entry.severity]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </section>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="measure-findings-workflow-filter"
                    className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75"
                  >
                    Workflow Status
                  </label>
                  <select
                    id="measure-findings-workflow-filter"
                    value={workflowFilter}
                    onChange={(event) => setWorkflowFilter(event.target.value as "all" | "open" | "closed")}
                    className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="all">All</option>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="measure-findings-severity-filter"
                    className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75"
                  >
                    Severity
                  </label>
                  <select
                    id="measure-findings-severity-filter"
                    value={severityFilter}
                    onChange={(event) => setSeverityFilter(event.target.value as "all" | FindingSeverity)}
                    className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="all">All</option>
                    {FINDING_SEVERITY_FILTERS.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label htmlFor="measure-findings-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                  Text Search
                </label>
                <input
                  id="measure-findings-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search title, scope, evidence, action..."
                  className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
                />
              </div>

              <div className="relative mt-4 min-h-0 flex-1 overflow-hidden rounded-xl border border-sky-400/15">
                <div className="h-full overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                      <tr>
                        <th className="px-3 py-2">Timestamp</th>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Scope</th>
                        <th className="px-3 py-2">Evidence</th>
                        <th className="px-3 py-2">Recommended Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFindings.map((entry) => (
                        <tr key={entry.finding.id} className="border-t border-sky-400/10 align-top">
                          <td className="px-3 py-2 text-slate-200">{entry.finding.timestampLabel}</td>
                          <td className="px-3 py-2 text-slate-100">
                            <button
                              type="button"
                              onClick={() => openAssetDetailsPanel(entry)}
                              className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                            >
                              {entry.finding.title}
                            </button>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] ${workflowBadgeClass(entry.asOfStatus)}`}
                              >
                                {entry.asOfStatus}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] ${statusBadgeClass(entry.finding.complianceStatus)}`}
                              >
                                Finding {entry.finding.complianceStatus}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] ${statusBadgeClass(entry.finding.evaluationStatus)}`}
                              >
                                Eval {entry.finding.evaluationStatus}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-300/85">{entry.finding.scopeLabel}</td>
                          <td className="px-3 py-2 text-xs text-slate-300/85">{entry.finding.evidencePreview}</td>
                          <td className="px-3 py-2 text-xs text-slate-300/85">{entry.finding.recommendedAction}</td>
                        </tr>
                      ))}
                      {filteredFindings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                            No findings match this measure and active filters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                {isAssetDetailsPanelVisible && selectedFindingForAssets ? (
                  <div className="absolute inset-0 z-[3]">
                    <div
                      className={`absolute inset-0 bg-slate-950/92 backdrop-blur-[1px] transition-opacity duration-200 ${
                        isAssetDetailsPanelOpen ? "opacity-100" : "opacity-0"
                      }`}
                      onClick={closeAssetDetailsPanel}
                    />
                    <aside
                      className={`absolute right-0 top-0 h-full w-full border-l border-sky-300/35 bg-slate-950 p-4 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out ${
                        isAssetDetailsPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
                      }`}
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="asset-details-slideout-title"
                    >
                      <button
                        type="button"
                        onClick={closeAssetDetailsPanel}
                        className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
                      >
                        Close
                      </button>

                      <div className="flex h-full min-h-0 flex-col">
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Asset Details</p>
                        <h5 id="asset-details-slideout-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
                          Asset Details
                        </h5>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs text-slate-300/80">Selected Finding: {selectedFindingForAssets.finding.title}</p>
                            <p className="mt-1 text-xs text-slate-300/80">Linked Assets: {assetDetailsRows.length}</p>
                          </div>
                          <button
                            type="button"
                            onClick={downloadAssetDetailsCsv}
                            disabled={!assetDetailsRows.length}
                            className="rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:text-slate-400"
                          >
                            Export to CSV
                          </button>
                        </div>

                        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-xl border border-sky-400/15">
                          <table className="min-w-full text-sm">
                            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                              <tr>
                                <th className="px-3 py-2">Asset Name</th>
                                <th className="px-3 py-2">Asset IP address</th>
                                <th className="px-3 py-2">Asset Type</th>
                                <th className="px-3 py-2">Total Critical Exposure Findings</th>
                                <th className="px-3 py-2">Total High Risk Findings</th>
                                <th className="px-3 py-2">Total Findings</th>
                                <th className="px-3 py-2">Asset Change Assignment Group</th>
                                <th className="px-3 py-2">Asset Incident Assignment Group</th>
                                <th className="px-3 py-2">Owner</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assetDetailsRows.map((assetRow) => (
                                <tr key={assetRow.assetId} className="border-t border-sky-400/10 align-top">
                                  <td className="px-3 py-2 text-slate-100">{assetRow.assetName}</td>
                                  <td className="px-3 py-2 text-slate-300/85">{assetRow.assetIpAddress}</td>
                                  <td className="px-3 py-2 text-slate-300/85">{assetRow.assetType}</td>
                                  <td className="px-3 py-2 text-red-100">{assetRow.criticalExposureFindings}</td>
                                  <td className="px-3 py-2 text-orange-100">{assetRow.highRiskFindings}</td>
                                  <td className="px-3 py-2 text-slate-200">{assetRow.totalFindings}</td>
                                  <td className="px-3 py-2 text-slate-300/85">{assetRow.assetChangeAssignmentGroup}</td>
                                  <td className="px-3 py-2 text-slate-300/85">{assetRow.assetIncidentAssignmentGroup}</td>
                                  <td className="px-3 py-2 text-slate-300/85">{assetRow.owner}</td>
                                </tr>
                              ))}
                              {assetDetailsRows.length === 0 ? (
                                <tr>
                                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                                    No linked assets found for this finding.
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </aside>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
