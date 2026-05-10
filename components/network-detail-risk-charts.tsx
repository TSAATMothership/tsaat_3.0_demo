"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { SPI_DESCRIPTIONS, SPI_NAMES } from "@/lib/spi-metadata";
import { FindingSeverity, FindingWorkflowStatus, HighRiskCveDetail } from "@/lib/types";

const PANEL_TWEEN_MS = 260;

export interface NetworkDetailRiskSeveritySummary {
  severity: FindingSeverity;
  count: number;
}

export interface NetworkDetailWeeklyRiskPoint {
  weekLabel: string;
  highRiskCount: number | null;
  criticalExposureCount: number | null;
}

export interface NetworkDetailRiskFindingRow {
  id: string;
  sourceFindingId?: string | null;
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
  timestampLabel: string;
  title: string;
  priorityRank: number;
  severity: FindingSeverity;
  workflowStatus: FindingWorkflowStatus;
  scopeLabel: string;
  systemId?: string | null;
  networkId?: string | null;
  environmentType?: string | null;
  evidencePreview: string;
  recommendedAction: string;
}

type AssetHighRiskCveEntry = HighRiskCveDetail;

interface AffectedDeviceRow {
  assetId: string;
  assetName: string;
  assetIpAddress: string;
  assetType: string;
  assetChangeAssignmentGroup: string;
  assetIncidentAssignmentGroup: string;
  owner: string;
  totalOpenFindings: number;
  totalHighRiskCveVulnerabilities: number;
  highRiskCveVulnerabilities: AssetHighRiskCveEntry[];
}

interface FindingsAgingBucketRow {
  bucketLabel: string;
  criticalExposureCount: number;
  highRiskCount: number;
  majorCount: number;
  dataGapCount: number;
  otherCount: number;
  total: number;
}

export interface RiskFindingsDrillThroughSelection {
  id: string;
  label: string;
  findings: NetworkDetailRiskFindingRow[];
  totalCount?: number;
  lockedSpiId?: number;
  emptyMessage?: string;
  exportSlug?: string;
}

const severityColors: Record<FindingSeverity, string> = {
  "Critical Exposure": "#ef4444",
  "High Risk": "#f97316",
  Major: "#f59e0b",
  Moderate: "#38bdf8",
  "Data Gap": "#94a3b8"
};

function csvCell(value: string | number): string {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function formatCapturedTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return `${parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  })} UTC`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "export"
  );
}

function downloadBlob(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function findingGroupKey(finding: Pick<NetworkDetailRiskFindingRow, "spiId" | "title">): string {
  return `${finding.spiId}::${finding.title}`;
}

function agingBucketLabelForAgeDays(ageDays: number): string {
  if (ageDays <= 30) {
    return "0-30";
  }
  if (ageDays <= 60) {
    return "31-60";
  }
  if (ageDays <= 90) {
    return "61-90";
  }
  if (ageDays <= 180) {
    return "91-180";
  }
  return "181+";
}

function assetTypeBucket(assetType: string): "server" | "workstation" | "network-device" | "other" {
  const normalized = assetType.trim().toLowerCase();
  if (normalized === "server") {
    return "server";
  }
  if (normalized === "workstation") {
    return "workstation";
  }
  if (normalized === "network device" || normalized === "network-device") {
    return "network-device";
  }
  return "other";
}

function buildAffectedDeviceRowsForFinding(
  scopedFindings: NetworkDetailRiskFindingRow[],
  openCountByAsset: Map<string, number>,
  selectedFinding: Pick<NetworkDetailRiskFindingRow, "spiId" | "title">,
  assetHighRiskCvesByAssetId: Record<string, AssetHighRiskCveEntry[]>
): AffectedDeviceRow[] {
  const latestByAsset = new Map<string, NetworkDetailRiskFindingRow>();

  for (const finding of scopedFindings) {
    if (finding.spiId !== selectedFinding.spiId || finding.title !== selectedFinding.title) {
      continue;
    }

    const current = latestByAsset.get(finding.assetId);
    if (!current) {
      latestByAsset.set(finding.assetId, finding);
      continue;
    }

    const currentTime = new Date(current.timestamp).getTime();
    const candidateTime = new Date(finding.timestamp).getTime();
    if (candidateTime > currentTime) {
      latestByAsset.set(finding.assetId, finding);
    }
  }

  return Array.from(latestByAsset.values())
    .map((finding) => ({
      assetId: finding.assetId,
      assetName: finding.assetName,
      assetIpAddress: finding.assetIpAddress,
      assetType: finding.assetType,
      assetChangeAssignmentGroup: finding.assetChangeAssignmentGroup,
      assetIncidentAssignmentGroup: finding.assetIncidentAssignmentGroup,
      owner: finding.owner,
      totalOpenFindings: openCountByAsset.get(finding.assetId) ?? 0,
      totalHighRiskCveVulnerabilities: (assetHighRiskCvesByAssetId[finding.assetId] ?? []).length,
      highRiskCveVulnerabilities: assetHighRiskCvesByAssetId[finding.assetId] ?? []
    }))
    .sort((a, b) => {
      if (b.totalHighRiskCveVulnerabilities !== a.totalHighRiskCveVulnerabilities) {
        return b.totalHighRiskCveVulnerabilities - a.totalHighRiskCveVulnerabilities;
      }
      if (b.totalOpenFindings !== a.totalOpenFindings) {
        return b.totalOpenFindings - a.totalOpenFindings;
      }
      return a.assetName.localeCompare(b.assetName);
    });
}

function buildWorkbookXml({
  findingsSheetHeaders,
  findingsSheetRows,
  affectedSheetHeaders,
  affectedSheetRows
}: {
  findingsSheetHeaders: string[];
  findingsSheetRows: Array<Array<string | number>>;
  affectedSheetHeaders: string[];
  affectedSheetRows: Array<Array<string | number>>;
}) {
  const toRowXml = (row: Array<string | number>) =>
    `<Row>${row
      .map((value) => `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`)
      .join("")}</Row>`;

  const findingsRowsXml = [findingsSheetHeaders, ...findingsSheetRows].map((row) => toRowXml(row)).join("");
  const affectedRowsXml = [affectedSheetHeaders, ...affectedSheetRows].map((row) => toRowXml(row)).join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Findings">
  <Table>${findingsRowsXml}</Table>
 </Worksheet>
 <Worksheet ss:Name="Affected CIs">
  <Table>${affectedRowsXml}</Table>
 </Worksheet>
</Workbook>`;
}

export function RiskFindingsDrillThrough({
  selection,
  allFindings,
  assetHighRiskCvesByAssetId = {},
  asOfDate = new Date().toISOString().slice(0, 10),
  onClose
}: {
  selection: RiskFindingsDrillThroughSelection;
  allFindings?: NetworkDetailRiskFindingRow[];
  assetHighRiskCvesByAssetId?: Record<string, AssetHighRiskCveEntry[]>;
  asOfDate?: string;
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [spiFilter, setSpiFilter] = useState<string>(selection.lockedSpiId ? String(selection.lockedSpiId) : "all");
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>("all");
  const [selectedAgingBucketFilter, setSelectedAgingBucketFilter] = useState<string | null>(null);
  const [isFindingsPanelOpen, setIsFindingsPanelOpen] = useState(false);
  const [selectedFindingForAssets, setSelectedFindingForAssets] = useState<NetworkDetailRiskFindingRow | null>(null);
  const [isAssetDetailsPanelVisible, setIsAssetDetailsPanelVisible] = useState(false);
  const [isAssetDetailsPanelOpen, setIsAssetDetailsPanelOpen] = useState(false);
  const [selectedAssetForCveDetails, setSelectedAssetForCveDetails] = useState<AffectedDeviceRow | null>(null);
  const [isCveDetailsModalVisible, setIsCveDetailsModalVisible] = useState(false);
  const [isCveDetailsModalOpen, setIsCveDetailsModalOpen] = useState(false);
  const [cveSearchTerm, setCveSearchTerm] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetDetailsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cveDetailsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedSpiId = selection.lockedSpiId;
  const sourceFindings = allFindings ?? selection.findings;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setSearchTerm("");
    setSpiFilter(lockedSpiId ? String(lockedSpiId) : "all");
    setAssetTypeFilter("all");
    setSelectedAgingBucketFilter(null);
    setSelectedFindingForAssets(null);
    setIsAssetDetailsPanelVisible(false);
    setIsAssetDetailsPanelOpen(false);
    setSelectedAssetForCveDetails(null);
    setIsCveDetailsModalVisible(false);
    setIsCveDetailsModalOpen(false);
    setCveSearchTerm("");
    requestAnimationFrame(() => {
      setIsFindingsPanelOpen(true);
    });
  }, [lockedSpiId, selection.id]);

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
      if (cveDetailsCloseTimerRef.current) {
        clearTimeout(cveDetailsCloseTimerRef.current);
        cveDetailsCloseTimerRef.current = null;
      }
    };
  }, []);

  function closeFindingsPanel() {
    setIsFindingsPanelOpen(false);
    setIsAssetDetailsPanelOpen(false);
    setIsAssetDetailsPanelVisible(false);
    setIsCveDetailsModalOpen(false);
    setIsCveDetailsModalVisible(false);
    setSelectedFindingForAssets(null);
    setSelectedAssetForCveDetails(null);
    setCveSearchTerm("");
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, PANEL_TWEEN_MS);
  }

  function openAssetDetailsPanel(finding: NetworkDetailRiskFindingRow) {
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    setSelectedFindingForAssets(finding);
    setSelectedAssetForCveDetails(null);
    setIsCveDetailsModalVisible(false);
    setIsCveDetailsModalOpen(false);
    setCveSearchTerm("");
    setIsAssetDetailsPanelVisible(true);
    requestAnimationFrame(() => {
      setIsAssetDetailsPanelOpen(true);
    });
  }

  function closeAssetDetailsPanel() {
    setIsAssetDetailsPanelOpen(false);
    setIsCveDetailsModalOpen(false);
    setIsCveDetailsModalVisible(false);
    setSelectedAssetForCveDetails(null);
    setCveSearchTerm("");
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
    }
    assetDetailsCloseTimerRef.current = setTimeout(() => {
      setIsAssetDetailsPanelVisible(false);
      setSelectedFindingForAssets(null);
      assetDetailsCloseTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  }

  function openCveDetailsModal(device: AffectedDeviceRow) {
    if (!device.totalHighRiskCveVulnerabilities) {
      return;
    }
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    setSelectedAssetForCveDetails(device);
    setCveSearchTerm("");
    setIsCveDetailsModalVisible(true);
    requestAnimationFrame(() => {
      setIsCveDetailsModalOpen(true);
    });
  }

  function closeCveDetailsModal() {
    setIsCveDetailsModalOpen(false);
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
    }
    cveDetailsCloseTimerRef.current = setTimeout(() => {
      setIsCveDetailsModalVisible(false);
      setSelectedAssetForCveDetails(null);
      setCveSearchTerm("");
      cveDetailsCloseTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (isCveDetailsModalVisible) {
        closeCveDetailsModal();
        return;
      }
      if (isAssetDetailsPanelVisible) {
        closeAssetDetailsPanel();
        return;
      }
      closeFindingsPanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
    // Close handlers intentionally read the current nested-panel state for the active slide-out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAssetDetailsPanelVisible, isCveDetailsModalVisible]);

  const selectedAsOfDate = useMemo(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      return asOfDate;
    }
    return new Date().toISOString().slice(0, 10);
  }, [asOfDate]);

  const selectedOpenFindings = useMemo(() => {
    return selection.findings
      .filter((finding) => finding.workflowStatus === "open")
      .sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) {
          return a.priorityRank - b.priorityRank;
        }
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return bTime - aTime;
      });
  }, [selection.findings]);

  const selectedTotalCount = selection.totalCount ?? selectedOpenFindings.length;

  const spiFilterOptions = useMemo(() => {
    if (lockedSpiId) {
      return [lockedSpiId];
    }
    return Array.from(new Set(selectedOpenFindings.map((finding) => finding.spiId))).sort((a, b) => a - b);
  }, [lockedSpiId, selectedOpenFindings]);

  const assetTypeFilterOptions = useMemo(() => {
    return Array.from(
      new Set(selectedOpenFindings.map((finding) => finding.assetType).filter((assetType) => Boolean(assetType)))
    ).sort((a, b) => a.localeCompare(b));
  }, [selectedOpenFindings]);

  const spiScopedFindings = useMemo(() => {
    return selectedOpenFindings.filter((finding) => {
      if (lockedSpiId && finding.spiId !== lockedSpiId) {
        return false;
      }
      if (!lockedSpiId && spiFilter !== "all" && String(finding.spiId) !== spiFilter) {
        return false;
      }
      return true;
    });
  }, [lockedSpiId, selectedOpenFindings, spiFilter]);

  const facetFilteredFindings = useMemo(() => {
    return spiScopedFindings.filter((finding) => {
      if (assetTypeFilter !== "all" && finding.assetType !== assetTypeFilter) {
        return false;
      }
      return true;
    });
  }, [assetTypeFilter, spiScopedFindings]);

  const searchFilteredFindings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return facetFilteredFindings.filter((finding) => {
      if (!normalizedSearch) {
        return true;
      }
      const haystack = [
        finding.id,
        finding.timestampLabel,
        finding.title,
        finding.scopeLabel,
        finding.evidencePreview,
        finding.recommendedAction,
        finding.assetId,
        finding.assetName,
        finding.assetType,
        `SPI ${finding.spiId}`,
        `P${finding.priorityRank}`,
        finding.severity
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [facetFilteredFindings, searchTerm]);

  const filteredFindings = useMemo(() => {
    if (!selectedAgingBucketFilter) {
      return searchFilteredFindings;
    }
    const asOfMs = new Date(`${selectedAsOfDate}T00:00:00.000Z`).getTime();
    return searchFilteredFindings.filter((finding) => {
      const openedAtMs = new Date(finding.timestamp).getTime();
      if (Number.isNaN(openedAtMs)) {
        return false;
      }
      const ageDays = Math.max(0, Math.floor((asOfMs - openedAtMs) / 86_400_000));
      return agingBucketLabelForAgeDays(ageDays) === selectedAgingBucketFilter;
    });
  }, [searchFilteredFindings, selectedAgingBucketFilter, selectedAsOfDate]);

  const displayedFindings = useMemo(() => filteredFindings.slice(0, 250), [filteredFindings]);

  const openFindingsAgingBuckets = useMemo<FindingsAgingBucketRow[]>(() => {
    const template: FindingsAgingBucketRow[] = [
      { bucketLabel: "0-30", criticalExposureCount: 0, highRiskCount: 0, majorCount: 0, dataGapCount: 0, otherCount: 0, total: 0 },
      { bucketLabel: "31-60", criticalExposureCount: 0, highRiskCount: 0, majorCount: 0, dataGapCount: 0, otherCount: 0, total: 0 },
      { bucketLabel: "61-90", criticalExposureCount: 0, highRiskCount: 0, majorCount: 0, dataGapCount: 0, otherCount: 0, total: 0 },
      { bucketLabel: "91-180", criticalExposureCount: 0, highRiskCount: 0, majorCount: 0, dataGapCount: 0, otherCount: 0, total: 0 },
      { bucketLabel: "181+", criticalExposureCount: 0, highRiskCount: 0, majorCount: 0, dataGapCount: 0, otherCount: 0, total: 0 }
    ];

    const asOfMs = new Date(`${selectedAsOfDate}T00:00:00.000Z`).getTime();

    for (const finding of searchFilteredFindings) {
      const openedAtMs = new Date(finding.timestamp).getTime();
      if (Number.isNaN(openedAtMs)) {
        continue;
      }
      const ageDays = Math.max(0, Math.floor((asOfMs - openedAtMs) / 86_400_000));
      const bucketLabel = agingBucketLabelForAgeDays(ageDays);
      const bucket = template.find((row) => row.bucketLabel === bucketLabel);
      if (!bucket) {
        continue;
      }
      bucket.total += 1;
      if (finding.severity === "Critical Exposure") {
        bucket.criticalExposureCount += 1;
      } else if (finding.severity === "High Risk") {
        bucket.highRiskCount += 1;
      } else if (finding.severity === "Major") {
        bucket.majorCount += 1;
      } else if (finding.severity === "Data Gap") {
        bucket.dataGapCount += 1;
      } else {
        bucket.otherCount += 1;
      }
    }

    return template;
  }, [searchFilteredFindings, selectedAsOfDate]);

  const affectedAssetsByTypeRows = useMemo(() => {
    const buckets = {
      server: new Set<string>(),
      workstation: new Set<string>(),
      networkDevice: new Set<string>(),
      other: new Set<string>()
    };

    for (const finding of filteredFindings) {
      const assetKey = finding.assetId || `${finding.assetName}-${finding.assetType}`;
      const bucket = assetTypeBucket(finding.assetType);
      if (bucket === "server") {
        buckets.server.add(assetKey);
      } else if (bucket === "workstation") {
        buckets.workstation.add(assetKey);
      } else if (bucket === "network-device") {
        buckets.networkDevice.add(assetKey);
      } else {
        buckets.other.add(assetKey);
      }
    }

    return [
      { key: "server", label: "Server", count: buckets.server.size, fill: "#38bdf8" },
      { key: "workstation", label: "Workstation", count: buckets.workstation.size, fill: "#22c55e" },
      { key: "network-device", label: "Network Device", count: buckets.networkDevice.size, fill: "#a78bfa" },
      { key: "other", label: "Other", count: buckets.other.size, fill: "#94a3b8" }
    ];
  }, [filteredFindings]);
  const affectedAssetsByTypeTotal = affectedAssetsByTypeRows.reduce((total, row) => total + row.count, 0);
  const affectedAssetsByTypeMax = Math.max(1, ...affectedAssetsByTypeRows.map((row) => row.count));

  const affectedAssetTypeTotalsByFinding = useMemo(() => {
    const grouped = new Map<
      string,
      { server: Set<string>; workstation: Set<string>; networkDevice: Set<string> }
    >();

    for (const finding of spiScopedFindings) {
      const key = findingGroupKey(finding);
      const current = grouped.get(key) ?? {
        server: new Set<string>(),
        workstation: new Set<string>(),
        networkDevice: new Set<string>()
      };

      const bucket = assetTypeBucket(finding.assetType);
      if (bucket === "server") {
        current.server.add(finding.assetId);
      } else if (bucket === "workstation") {
        current.workstation.add(finding.assetId);
      } else if (bucket === "network-device") {
        current.networkDevice.add(finding.assetId);
      }

      grouped.set(key, current);
    }

    const totals = new Map<string, { server: number; workstation: number; networkDevice: number }>();
    for (const [key, value] of grouped.entries()) {
      totals.set(key, {
        server: value.server.size,
        workstation: value.workstation.size,
        networkDevice: value.networkDevice.size
      });
    }

    return totals;
  }, [spiScopedFindings]);

  const openFindingsCountByAsset = useMemo(() => {
    const counts = new Map<string, number>();
    for (const finding of sourceFindings) {
      if (finding.workflowStatus !== "open") {
        continue;
      }
      counts.set(finding.assetId, (counts.get(finding.assetId) ?? 0) + 1);
    }
    return counts;
  }, [sourceFindings]);

  const affectedDeviceRows = useMemo<AffectedDeviceRow[]>(() => {
    if (!selectedFindingForAssets) {
      return [];
    }
    return buildAffectedDeviceRowsForFinding(
      selectedOpenFindings,
      openFindingsCountByAsset,
      selectedFindingForAssets,
      assetHighRiskCvesByAssetId
    );
  }, [
    assetHighRiskCvesByAssetId,
    openFindingsCountByAsset,
    selectedFindingForAssets,
    selectedOpenFindings
  ]);

  const findingGroupMetaByKey = useMemo(() => {
    const map = new Map<string, { extract: string; spiId: number; title: string }>();
    let nextIndex = 1;

    for (const finding of filteredFindings) {
      const key = findingGroupKey(finding);
      if (map.has(key)) {
        continue;
      }
      map.set(key, {
        extract: `EXT-${String(nextIndex).padStart(4, "0")}`,
        spiId: finding.spiId,
        title: finding.title
      });
      nextIndex += 1;
    }

    return map;
  }, [filteredFindings]);

  const findingsForExport = useMemo(() => {
    return filteredFindings.map((finding) => ({
      extract: findingGroupMetaByKey.get(findingGroupKey(finding))?.extract ?? "",
      finding
    }));
  }, [filteredFindings, findingGroupMetaByKey]);

  const affectedCisForExport = useMemo(() => {
    const rows: Array<{
      extract: string;
      spiId: number;
      findingTitle: string;
      ci: AffectedDeviceRow;
    }> = [];

    for (const meta of findingGroupMetaByKey.values()) {
      const linkedCis = buildAffectedDeviceRowsForFinding(
        selectedOpenFindings,
        openFindingsCountByAsset,
        {
          spiId: meta.spiId,
          title: meta.title
        },
        assetHighRiskCvesByAssetId
      );
      for (const ci of linkedCis) {
        rows.push({
          extract: meta.extract,
          spiId: meta.spiId,
          findingTitle: meta.title,
          ci
        });
      }
    }

    return rows;
  }, [assetHighRiskCvesByAssetId, findingGroupMetaByKey, openFindingsCountByAsset, selectedOpenFindings]);

  const selectedAssetHighRiskCves = useMemo(() => {
    if (!selectedAssetForCveDetails) {
      return [];
    }
    return selectedAssetForCveDetails.highRiskCveVulnerabilities;
  }, [selectedAssetForCveDetails]);

  const filteredAssetHighRiskCves = useMemo(() => {
    const normalizedSearch = cveSearchTerm.trim().toLowerCase();
    return selectedAssetHighRiskCves.filter((entry) => {
      if (!normalizedSearch) {
        return true;
      }
      const searchText = [
        entry.cve,
        entry.description,
        entry.remediationGuidance,
        entry.criticality,
        entry.exploitability,
        entry.capturedAt
      ]
        .join(" ")
        .toLowerCase();
      return searchText.includes(normalizedSearch);
    });
  }, [cveSearchTerm, selectedAssetHighRiskCves]);

  function toggleAgingBucketFilter(bucketLabel: string) {
    setSelectedAgingBucketFilter((current) => (current === bucketLabel ? null : bucketLabel));
  }

  function downloadAffectedCisCsv() {
    if (!selectedFindingForAssets || !affectedDeviceRows.length) {
      return;
    }

    const extract = findingGroupMetaByKey.get(findingGroupKey(selectedFindingForAssets))?.extract ?? "EXT-0000";
    const headers = [
      "Extract",
      "SPI",
      "Finding Title",
      "CI Name",
      "Asset ID",
      "Asset IP Address",
      "Asset Type",
      "Total Open Findings",
      "Total High Risk CVE Vulnerabilities",
      "Asset Change Assignment Group",
      "Asset Incident Assignment Group",
      "Owner"
    ];
    const rows = affectedDeviceRows.map((device) => [
      extract,
      selectedFindingForAssets.spiId,
      selectedFindingForAssets.title,
      device.assetName,
      device.assetId,
      device.assetIpAddress,
      device.assetType,
      device.totalOpenFindings,
      device.totalHighRiskCveVulnerabilities,
      device.assetChangeAssignmentGroup,
      device.assetIncidentAssignmentGroup,
      device.owner
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    downloadBlob(
      csv,
      `affected-cis-${safeSlug(selectedFindingForAssets.title)}.csv`,
      "text/csv;charset=utf-8;"
    );
  }

  function downloadFindingsCsvPackage() {
    if (!findingsForExport.length) {
      return;
    }

    const findingsHeaders = [
      "Extract",
      "Finding ID",
      "Timestamp",
      "SPI",
      "Priority",
      "Severity",
      "Title",
      "Asset ID",
      "Asset Name",
      "Asset Type",
      "Server Assets Affected",
      "Workstation Assets Affected",
      "Network Device Assets Affected",
      "Asset IP Address",
      "Recommended Action"
    ];
    const findingsRows = findingsForExport.map((row) => {
      const totals = affectedAssetTypeTotalsByFinding.get(findingGroupKey(row.finding)) ?? {
        server: 0,
        workstation: 0,
        networkDevice: 0
      };

      return [
        row.extract,
        row.finding.id,
        row.finding.timestampLabel,
        row.finding.spiId,
        row.finding.priorityRank,
        row.finding.severity,
        row.finding.title,
        row.finding.assetId,
        row.finding.assetName,
        row.finding.assetType,
        totals.server,
        totals.workstation,
        totals.networkDevice,
        row.finding.assetIpAddress,
        row.finding.recommendedAction
      ];
    });

    const affectedHeaders = [
      "Extract",
      "SPI",
      "Finding Title",
      "CI Name",
      "Asset ID",
      "Asset IP Address",
      "Asset Type",
      "Total Open Findings",
      "Total High Risk CVE Vulnerabilities",
      "Asset Change Assignment Group",
      "Asset Incident Assignment Group",
      "Owner"
    ];
    const affectedRows = affectedCisForExport.map((row) => [
      row.extract,
      row.spiId,
      row.findingTitle,
      row.ci.assetName,
      row.ci.assetId,
      row.ci.assetIpAddress,
      row.ci.assetType,
      row.ci.totalOpenFindings,
      row.ci.totalHighRiskCveVulnerabilities,
      row.ci.assetChangeAssignmentGroup,
      row.ci.assetIncidentAssignmentGroup,
      row.ci.owner
    ]);

    const workbookXml = buildWorkbookXml({
      findingsSheetHeaders: findingsHeaders,
      findingsSheetRows: findingsRows,
      affectedSheetHeaders: affectedHeaders,
      affectedSheetRows: affectedRows
    });
    downloadBlob(
      workbookXml,
      `risk-findings-${safeSlug(selection.exportSlug ?? selection.label)}.xls`,
      "application/vnd.ms-excel;charset=utf-8;"
    );
  }

  function downloadHighRiskCvesCsv() {
    if (!selectedAssetForCveDetails || !filteredAssetHighRiskCves.length) {
      return;
    }

    const headers = ["Asset Name", "Asset ID", "CVE", "Description", "Remediation Guidance", "Criticality", "Timestamp"];
    const rows = filteredAssetHighRiskCves.map((entry) => [
      selectedAssetForCveDetails.assetName,
      selectedAssetForCveDetails.assetId,
      entry.cve,
      entry.description,
      entry.remediationGuidance,
      entry.criticality,
      formatCapturedTimestamp(entry.capturedAt)
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

    const safeAssetLabel =
      selectedAssetForCveDetails.assetName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "asset-cves";
    downloadBlob(
      csvContent,
      `high-risk-cves-${safeAssetLabel}.csv`,
      "text/csv;charset=utf-8;"
    );
  }

  const cveDetailsModal =
    isMounted && isCveDetailsModalVisible && selectedAssetForCveDetails
      ? createPortal(
          <div
            className={`fixed inset-0 z-[10010] ${
              isCveDetailsModalOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            <div
              className={`absolute inset-0 bg-slate-950/88 backdrop-blur-[1px] transition-opacity duration-200 ${
                isCveDetailsModalOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeCveDetailsModal}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
              <section
                className={`relative flex h-[min(88vh,760px)] w-[min(1380px,95vw)] flex-col rounded-2xl border border-sky-300/35 bg-slate-950 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] transition-all duration-[260ms] ease-out ${
                  isCveDetailsModalOpen ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
                }`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="risk-asset-cve-details-modal-title"
              >
                <button
                  type="button"
                  onClick={closeCveDetailsModal}
                  className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
                >
                  Close
                </button>

                <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">CVE Details</p>
                <h6 id="risk-asset-cve-details-modal-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
                  High Risk CVE Vulnerabilities
                </h6>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-300/80">Asset: {selectedAssetForCveDetails.assetName}</p>
                    <p className="mt-1 text-xs text-slate-300/80">CVEs in scope: {filteredAssetHighRiskCves.length}</p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadHighRiskCvesCsv}
                    disabled={!filteredAssetHighRiskCves.length}
                    className="rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:text-slate-400"
                  >
                    Export CSV
                  </button>
                </div>

                <div className="mt-3">
                  <label
                    htmlFor="risk-asset-cve-search"
                    className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75"
                  >
                    Text Search
                  </label>
                  <input
                    id="risk-asset-cve-search"
                    type="search"
                    value={cveSearchTerm}
                    onChange={(event) => setCveSearchTerm(event.target.value)}
                    placeholder="Search CVE, description, remediation, criticality, timestamp..."
                    className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
                  />
                </div>

                <div className="mt-3 min-h-0 flex-1 overflow-x-auto overflow-y-scroll rounded-xl border border-sky-400/15">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                      <tr>
                        <th className="px-3 py-2">CVE Code</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Remediation Guidance</th>
                        <th className="px-3 py-2">Criticality</th>
                        <th className="px-3 py-2">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssetHighRiskCves.map((entry, index) => (
                        <tr
                          key={`${selectedAssetForCveDetails.assetId}-${entry.cve}-${entry.capturedAt}-${index}`}
                          className="border-t border-sky-400/10 align-top"
                        >
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-sky-100">{entry.cve}</td>
                          <td className="px-3 py-2 text-slate-300/85">{entry.description}</td>
                          <td className="px-3 py-2 text-slate-300/85">{entry.remediationGuidance}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-red-100">{entry.criticality}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">
                            {formatCapturedTimestamp(entry.capturedAt)}
                          </td>
                        </tr>
                      ))}
                      {filteredAssetHighRiskCves.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                            {selectedAssetHighRiskCves.length === 0
                              ? "No high-risk CVE vulnerabilities for this asset."
                              : "No CVE records match the active search."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
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
          aria-labelledby="risk-findings-slideout-title"
        >
          {!isAssetDetailsPanelVisible ? (
            <button
              type="button"
              onClick={closeFindingsPanel}
              className="absolute right-4 top-4 z-[6] rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
            >
              Close
            </button>
          ) : null}

          <div className="relative flex h-full min-h-0 flex-col">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Risk Detail</p>
            <h4 id="risk-findings-slideout-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
              Findings
            </h4>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-slate-300/80">Selected Bar: {selection.label}</p>
                <p className="mt-1 text-xs text-slate-300/80">Open findings in scope: {selectedTotalCount}</p>
              </div>
              <button
                type="button"
                onClick={downloadFindingsCsvPackage}
                disabled={!findingsForExport.length}
                className="rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:text-slate-400"
              >
                Export CSV
              </button>
            </div>

            <section className="panel-alt mt-3 p-3">
              <div className="grid gap-3 xl:grid-cols-2">
                <div className="rounded-xl border border-sky-300/20 bg-slate-950/45 p-3">
                  <h5 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Open Findings Aging Buckets</h5>
                  <p className="mt-1 text-xs text-slate-300/80">Open findings shown in this view at {selectedAsOfDate}.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-300/80">
                    <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" />Critical Exposure</span>
                    <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-orange-500" />High Risk</span>
                    <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" />Major</span>
                    <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-slate-400" />Data Gap</span>
                    <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-sky-500" />Other</span>
                  </div>
                  <div className="mt-3 h-52 w-full">
                    {isMounted ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                        <BarChart data={openFindingsAgingBuckets} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
                          <CartesianGrid stroke="rgba(120,180,210,0.14)" />
                          <XAxis dataKey="bucketLabel" tick={{ fill: "#a8c6d8", fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
                            formatter={(value, key) => {
                              if (key === "criticalExposureCount") {
                                return [value, "Critical Exposure"];
                              }
                              if (key === "highRiskCount") {
                                return [value, "High Risk"];
                              }
                              if (key === "majorCount") {
                                return [value, "Major"];
                              }
                              if (key === "dataGapCount") {
                                return [value, "Data Gap"];
                              }
                              return [value, "Other"];
                            }}
                          />
                          <Bar dataKey="criticalExposureCount" stackId="severity" name="Critical Exposure" fill="#ef4444" isAnimationActive={false}>
                            {openFindingsAgingBuckets.map((row) => (
                              <Cell key={`age-critical-${row.bucketLabel}`} className="cursor-pointer" fillOpacity={selectedAgingBucketFilter && selectedAgingBucketFilter !== row.bucketLabel ? 0.35 : 1} onClick={() => toggleAgingBucketFilter(row.bucketLabel)} />
                            ))}
                          </Bar>
                          <Bar dataKey="highRiskCount" stackId="severity" name="High Risk" fill="#f97316" isAnimationActive={false}>
                            {openFindingsAgingBuckets.map((row) => (
                              <Cell key={`age-high-${row.bucketLabel}`} className="cursor-pointer" fillOpacity={selectedAgingBucketFilter && selectedAgingBucketFilter !== row.bucketLabel ? 0.35 : 1} onClick={() => toggleAgingBucketFilter(row.bucketLabel)} />
                            ))}
                          </Bar>
                          <Bar dataKey="majorCount" stackId="severity" name="Major" fill="#f59e0b" isAnimationActive={false}>
                            {openFindingsAgingBuckets.map((row) => (
                              <Cell key={`age-major-${row.bucketLabel}`} className="cursor-pointer" fillOpacity={selectedAgingBucketFilter && selectedAgingBucketFilter !== row.bucketLabel ? 0.35 : 1} onClick={() => toggleAgingBucketFilter(row.bucketLabel)} />
                            ))}
                          </Bar>
                          <Bar dataKey="dataGapCount" stackId="severity" name="Data Gap" fill="#94a3b8" isAnimationActive={false}>
                            {openFindingsAgingBuckets.map((row) => (
                              <Cell key={`age-data-gap-${row.bucketLabel}`} className="cursor-pointer" fillOpacity={selectedAgingBucketFilter && selectedAgingBucketFilter !== row.bucketLabel ? 0.35 : 1} onClick={() => toggleAgingBucketFilter(row.bucketLabel)} />
                            ))}
                          </Bar>
                          <Bar dataKey="otherCount" stackId="severity" name="Other" fill="#38bdf8" isAnimationActive={false}>
                            {openFindingsAgingBuckets.map((row) => (
                              <Cell key={`age-other-${row.bucketLabel}`} className="cursor-pointer" fillOpacity={selectedAgingBucketFilter && selectedAgingBucketFilter !== row.bucketLabel ? 0.35 : 1} onClick={() => toggleAgingBucketFilter(row.bucketLabel)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : null}
                  </div>
                  {selectedAgingBucketFilter ? (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-amber-100/90">Active aging bucket filter: {selectedAgingBucketFilter} days</p>
                      <button
                        type="button"
                        onClick={() => setSelectedAgingBucketFilter(null)}
                        className="rounded-md border border-sky-300/35 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-300/75">Select any aging bucket bar to filter findings results.</p>
                  )}
                </div>

                <div className="rounded-xl border border-sky-300/20 bg-slate-950/45 p-3">
                  <h5 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Affected Assets by Type</h5>
                  <p className="mt-1 text-xs text-slate-300/80">
                    Unique affected assets after the active findings filters.
                  </p>
                  <p className="mt-2 text-xs text-cyan-100/90">Total affected assets: {affectedAssetsByTypeTotal}</p>
                  <div className="mt-3 space-y-3">
                    {affectedAssetsByTypeRows.map((row) => {
                      const widthPercent = row.count > 0 ? Math.max(6, Math.round((row.count / affectedAssetsByTypeMax) * 100)) : 0;
                      return (
                        <div key={`risk-affected-asset-type-${row.key}`} className="rounded-lg border border-sky-300/10 bg-slate-950/45 p-2">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-medium text-slate-200">{row.label}</span>
                            <span className="tabular-nums text-cyan-100">{row.count}</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-slate-800/90">
                            <div
                              className="h-full rounded-full transition-[width] duration-300"
                              style={{ width: `${widthPercent}%`, backgroundColor: row.fill }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="risk-findings-spi-filter" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">SPI</label>
                <select
                  id="risk-findings-spi-filter"
                  value={spiFilter}
                  onChange={(event) => setSpiFilter(event.target.value)}
                  disabled={Boolean(lockedSpiId)}
                  className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {!lockedSpiId ? <option value="all">All SPI</option> : null}
                  {spiFilterOptions.map((spiId) => (
                    <option key={spiId} value={String(spiId)}>
                      {`SPI ${spiId} - ${SPI_NAMES[spiId as keyof typeof SPI_NAMES] ?? "Unmapped SPI"}`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="risk-findings-asset-type-filter" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Asset Type</label>
                <select
                  id="risk-findings-asset-type-filter"
                  value={assetTypeFilter}
                  onChange={(event) => setAssetTypeFilter(event.target.value)}
                  className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="all">All Asset Types</option>
                  {assetTypeFilterOptions.map((assetType) => (
                    <option key={assetType} value={assetType}>{assetType}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="risk-findings-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Text Search</label>
              <input
                id="risk-findings-search"
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
                      <th className="px-3 py-2">SPI</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Server Assets Affected</th>
                      <th className="px-3 py-2">Workstation Assets Affected</th>
                      <th className="px-3 py-2">Network Device Assets Affected</th>
                      <th className="px-3 py-2">Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedFindings.map((finding) => {
                      const totals = affectedAssetTypeTotalsByFinding.get(findingGroupKey(finding)) ?? {
                        server: 0,
                        workstation: 0,
                        networkDevice: 0
                      };

                      return (
                        <tr key={finding.id} className="border-t border-sky-400/10 align-top">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-200">{finding.timestampLabel}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-200">SPI {finding.spiId}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-200">P{finding.priorityRank}</td>
                          <td className="px-3 py-2 text-slate-100">
                            <button
                              type="button"
                              onClick={() => openAssetDetailsPanel(finding)}
                              className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                            >
                              {finding.title}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-200">{totals.server}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-200">{totals.workstation}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-200">{totals.networkDevice}</td>
                          <td className="px-3 py-2 text-xs text-slate-300/85">{finding.recommendedAction}</td>
                        </tr>
                      );
                    })}
                    {displayedFindings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                          {selectedTotalCount === 0
                            ? selection.emptyMessage ?? "No open findings were generated for the selected risk bar."
                            : "No findings match the active filters."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {isAssetDetailsPanelVisible && selectedFindingForAssets ? (
              <div className={`absolute inset-0 z-[3] ${isAssetDetailsPanelOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
                <div className={`absolute inset-0 bg-slate-950/92 backdrop-blur-[1px] transition-opacity duration-200 ${isAssetDetailsPanelOpen ? "opacity-100" : "opacity-0"}`} onClick={closeAssetDetailsPanel} />
                <aside
                  className={`absolute right-0 top-0 h-full w-full border-l border-sky-300/35 bg-slate-950 p-4 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out ${
                    isAssetDetailsPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
                  }`}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="risk-affected-devices-slideout-title"
                >
                  <button
                    type="button"
                    onClick={closeAssetDetailsPanel}
                    className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
                  >
                    Close
                  </button>

                  <div className="flex h-full min-h-0 flex-col">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Drill Through</p>
                    <h5 id="risk-affected-devices-slideout-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
                      Affected CIs
                    </h5>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-300/80">Selected Finding: {selectedFindingForAssets.title}</p>
                        <p className="mt-1 text-xs text-slate-300/80">Affected CIs: {affectedDeviceRows.length}</p>
                      </div>
                      <button
                        type="button"
                        onClick={downloadAffectedCisCsv}
                        disabled={!affectedDeviceRows.length}
                        className="rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:text-slate-400"
                      >
                        Export CSV
                      </button>
                    </div>

                    <div className="mt-3 min-h-0 flex-1 overflow-x-auto overflow-y-scroll rounded-xl border border-sky-400/15">
                      <table className="min-w-[134rem] table-fixed text-sm">
                        <colgroup>
                          <col className="w-[18rem]" />
                          <col className="w-[13rem]" />
                          <col className="w-[11rem]" />
                          <col className="w-[10rem]" />
                          <col className="w-[12rem]" />
                          <col className="w-[18rem]" />
                          <col className="w-[18rem]" />
                          <col className="w-[18rem]" />
                          <col className="w-[16rem]" />
                        </colgroup>
                        <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                          <tr>
                            <th className="whitespace-nowrap px-3 py-2">Device</th>
                            <th className="whitespace-nowrap px-3 py-2">Asset ID</th>
                            <th className="whitespace-nowrap px-3 py-2">Asset IP address</th>
                            <th className="whitespace-nowrap px-3 py-2">Asset Type</th>
                            <th className="whitespace-nowrap px-3 py-2">Total Open Findings</th>
                            <th className="whitespace-nowrap px-3 py-2">Total High Risk CVE Vulnerabilities</th>
                            <th className="whitespace-nowrap px-3 py-2">Asset Change Assignment Group</th>
                            <th className="whitespace-nowrap px-3 py-2">Asset Incident Assignment Group</th>
                            <th className="whitespace-nowrap px-3 py-2">Owner</th>
                          </tr>
                        </thead>
                        <tbody>
                          {affectedDeviceRows.map((device) => (
                            <tr key={device.assetId} className="border-t border-sky-400/10 align-top">
                              <td className="whitespace-nowrap px-3 py-2 text-slate-100">{device.assetName}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.assetId}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.assetIpAddress}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.assetType}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-200">{device.totalOpenFindings}</td>
                              <td className="whitespace-nowrap px-3 py-2">
                                {device.totalHighRiskCveVulnerabilities > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => openCveDetailsModal(device)}
                                    className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                                  >
                                    {device.totalHighRiskCveVulnerabilities}
                                  </button>
                                ) : (
                                  <span className="text-slate-400/90">0</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.assetChangeAssignmentGroup}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.assetIncidentAssignmentGroup}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.owner}</td>
                            </tr>
                          ))}
                          {affectedDeviceRows.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                                No affected devices found for this finding.
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
        </aside>
      </div>
      {cveDetailsModal}
    </>
  );
}

export function NetworkDetailRiskCharts({
  riskProfile,
  findings = [],
  assetHighRiskCvesByAssetId = {},
  asOfDate = new Date().toISOString().slice(0, 10),
  scopeDescription = "Open findings by severity in current network detail scope.",
  layout = "side-by-side",
  enableFindingsDrillThrough = true
}: {
  riskProfile: {
    openFindings: number;
    p1p2Count: number;
    highRiskOpenCount: number;
    criticalExposureOpenCount: number;
    severitySummary: NetworkDetailRiskSeveritySummary[];
    weeklyTrend: NetworkDetailWeeklyRiskPoint[];
  };
  findings?: NetworkDetailRiskFindingRow[];
  assetHighRiskCvesByAssetId?: Record<string, AssetHighRiskCveEntry[]>;
  asOfDate?: string;
  scopeDescription?: string;
  layout?: "side-by-side" | "stacked";
  enableFindingsDrillThrough?: boolean;
}) {
  const [selectedSeverity, setSelectedSeverity] = useState<FindingSeverity | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [spiFilter, setSpiFilter] = useState<string>("all");
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>("all");
  const [selectedAgingBucketFilter, setSelectedAgingBucketFilter] = useState<string | null>(null);
  const [isFindingsPanelVisible, setIsFindingsPanelVisible] = useState(false);
  const [isFindingsPanelOpen, setIsFindingsPanelOpen] = useState(false);
  const [selectedFindingForAssets, setSelectedFindingForAssets] = useState<NetworkDetailRiskFindingRow | null>(null);
  const [isAssetDetailsPanelVisible, setIsAssetDetailsPanelVisible] = useState(false);
  const [isAssetDetailsPanelOpen, setIsAssetDetailsPanelOpen] = useState(false);
  const [selectedAssetForCveDetails, setSelectedAssetForCveDetails] = useState<AffectedDeviceRow | null>(null);
  const [isCveDetailsModalVisible, setIsCveDetailsModalVisible] = useState(false);
  const [isCveDetailsModalOpen, setIsCveDetailsModalOpen] = useState(false);
  const [cveSearchTerm, setCveSearchTerm] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assetDetailsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cveDetailsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      if (cveDetailsCloseTimerRef.current) {
        clearTimeout(cveDetailsCloseTimerRef.current);
        cveDetailsCloseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isFindingsPanelVisible) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isCveDetailsModalVisible) {
          closeCveDetailsModal();
          return;
        }
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
  }, [isAssetDetailsPanelVisible, isCveDetailsModalVisible, isFindingsPanelVisible]);

  const openFindingsPanel = (severity: FindingSeverity) => {
    if (!enableFindingsDrillThrough) {
      return;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }

    setSelectedSeverity(severity);
    setSearchTerm("");
    setSpiFilter("all");
    setAssetTypeFilter("all");
    setSelectedAgingBucketFilter(null);
    setSelectedFindingForAssets(null);
    setIsAssetDetailsPanelVisible(false);
    setIsAssetDetailsPanelOpen(false);
    setSelectedAssetForCveDetails(null);
    setIsCveDetailsModalVisible(false);
    setIsCveDetailsModalOpen(false);
    setCveSearchTerm("");
    setIsFindingsPanelVisible(true);
    requestAnimationFrame(() => {
      setIsFindingsPanelOpen(true);
    });
  };

  const closeFindingsPanel = () => {
    setIsFindingsPanelOpen(false);
    setIsAssetDetailsPanelOpen(false);
    setIsAssetDetailsPanelVisible(false);
    setIsCveDetailsModalOpen(false);
    setIsCveDetailsModalVisible(false);
    setSelectedFindingForAssets(null);
    setSelectedAssetForCveDetails(null);
    setCveSearchTerm("");
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setIsFindingsPanelVisible(false);
      setSelectedSeverity(null);
      closeTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const openAssetDetailsPanel = (finding: NetworkDetailRiskFindingRow) => {
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
      assetDetailsCloseTimerRef.current = null;
    }
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    setSelectedFindingForAssets(finding);
    setSelectedAssetForCveDetails(null);
    setIsCveDetailsModalVisible(false);
    setIsCveDetailsModalOpen(false);
    setCveSearchTerm("");
    setIsAssetDetailsPanelVisible(true);
    requestAnimationFrame(() => {
      setIsAssetDetailsPanelOpen(true);
    });
  };

  const closeAssetDetailsPanel = () => {
    setIsAssetDetailsPanelOpen(false);
    setIsCveDetailsModalOpen(false);
    setIsCveDetailsModalVisible(false);
    setSelectedAssetForCveDetails(null);
    setCveSearchTerm("");
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    if (assetDetailsCloseTimerRef.current) {
      clearTimeout(assetDetailsCloseTimerRef.current);
    }
    assetDetailsCloseTimerRef.current = setTimeout(() => {
      setIsAssetDetailsPanelVisible(false);
      setSelectedFindingForAssets(null);
      assetDetailsCloseTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const openCveDetailsModal = (device: AffectedDeviceRow) => {
    if (!device.totalHighRiskCveVulnerabilities) {
      return;
    }
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
      cveDetailsCloseTimerRef.current = null;
    }
    setSelectedAssetForCveDetails(device);
    setCveSearchTerm("");
    setIsCveDetailsModalVisible(true);
    requestAnimationFrame(() => {
      setIsCveDetailsModalOpen(true);
    });
  };

  const closeCveDetailsModal = () => {
    setIsCveDetailsModalOpen(false);
    if (cveDetailsCloseTimerRef.current) {
      clearTimeout(cveDetailsCloseTimerRef.current);
    }
    cveDetailsCloseTimerRef.current = setTimeout(() => {
      setIsCveDetailsModalVisible(false);
      setSelectedAssetForCveDetails(null);
      setCveSearchTerm("");
      cveDetailsCloseTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const selectedAsOfDate = useMemo(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      return asOfDate;
    }
    return new Date().toISOString().slice(0, 10);
  }, [asOfDate]);

  const selectedSeverityFindings = useMemo(() => {
    if (!selectedSeverity) {
      return [];
    }
    return findings
      .filter((finding) => finding.workflowStatus === "open" && finding.severity === selectedSeverity)
      .sort((a, b) => {
        if (a.priorityRank !== b.priorityRank) {
          return a.priorityRank - b.priorityRank;
        }
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return bTime - aTime;
      });
  }, [findings, selectedSeverity]);

  const selectedSeverityTotalCount = useMemo(() => {
    if (!selectedSeverity) {
      return 0;
    }
    const chartCount = riskProfile.severitySummary.find((entry) => entry.severity === selectedSeverity)?.count;
    return chartCount ?? selectedSeverityFindings.length;
  }, [riskProfile.severitySummary, selectedSeverity, selectedSeverityFindings.length]);

  const spiFilterOptions = useMemo(() => {
    return Array.from(new Set(selectedSeverityFindings.map((finding) => finding.spiId))).sort((a, b) => a - b);
  }, [selectedSeverityFindings]);

  const assetTypeFilterOptions = useMemo(() => {
    return Array.from(
      new Set(selectedSeverityFindings.map((finding) => finding.assetType).filter((assetType) => Boolean(assetType)))
    ).sort((a, b) => a.localeCompare(b));
  }, [selectedSeverityFindings]);

  const spiScopedFindings = useMemo(() => {
    return selectedSeverityFindings.filter((finding) => {
      if (spiFilter !== "all" && String(finding.spiId) !== spiFilter) {
        return false;
      }
      return true;
    });
  }, [selectedSeverityFindings, spiFilter]);

  const facetFilteredFindings = useMemo(() => {
    return spiScopedFindings.filter((finding) => {
      if (assetTypeFilter !== "all" && finding.assetType !== assetTypeFilter) {
        return false;
      }
      return true;
    });
  }, [assetTypeFilter, spiScopedFindings]);

  const searchFilteredFindings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return facetFilteredFindings.filter((finding) => {
      if (!normalizedSearch) {
        return true;
      }
      const haystack = [
        finding.id,
        finding.timestampLabel,
        finding.title,
        finding.scopeLabel,
        finding.evidencePreview,
        finding.recommendedAction,
        finding.assetId,
        finding.assetName,
        finding.assetType,
        `SPI ${finding.spiId}`,
        `P${finding.priorityRank}`,
        finding.severity
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [facetFilteredFindings, searchTerm]);

  const filteredFindings = useMemo(() => {
    if (!selectedAgingBucketFilter) {
      return searchFilteredFindings;
    }
    const asOfMs = new Date(`${selectedAsOfDate}T00:00:00.000Z`).getTime();
    return searchFilteredFindings.filter((finding) => {
      const openedAtMs = new Date(finding.timestamp).getTime();
      if (Number.isNaN(openedAtMs)) {
        return false;
      }
      const ageDays = Math.max(0, Math.floor((asOfMs - openedAtMs) / 86_400_000));
      return agingBucketLabelForAgeDays(ageDays) === selectedAgingBucketFilter;
    });
  }, [searchFilteredFindings, selectedAgingBucketFilter, selectedAsOfDate]);

  const displayedFindings = useMemo(() => filteredFindings.slice(0, 250), [filteredFindings]);

  const openFindingsAgingBuckets = useMemo<FindingsAgingBucketRow[]>(() => {
    const template: FindingsAgingBucketRow[] = [
      {
        bucketLabel: "0-30",
        criticalExposureCount: 0,
        highRiskCount: 0,
        majorCount: 0,
        dataGapCount: 0,
        otherCount: 0,
        total: 0
      },
      {
        bucketLabel: "31-60",
        criticalExposureCount: 0,
        highRiskCount: 0,
        majorCount: 0,
        dataGapCount: 0,
        otherCount: 0,
        total: 0
      },
      {
        bucketLabel: "61-90",
        criticalExposureCount: 0,
        highRiskCount: 0,
        majorCount: 0,
        dataGapCount: 0,
        otherCount: 0,
        total: 0
      },
      {
        bucketLabel: "91-180",
        criticalExposureCount: 0,
        highRiskCount: 0,
        majorCount: 0,
        dataGapCount: 0,
        otherCount: 0,
        total: 0
      },
      {
        bucketLabel: "181+",
        criticalExposureCount: 0,
        highRiskCount: 0,
        majorCount: 0,
        dataGapCount: 0,
        otherCount: 0,
        total: 0
      }
    ];

    const asOfMs = new Date(`${selectedAsOfDate}T00:00:00.000Z`).getTime();

    for (const finding of searchFilteredFindings) {
      const openedAtMs = new Date(finding.timestamp).getTime();
      if (Number.isNaN(openedAtMs)) {
        continue;
      }
      const ageDays = Math.max(0, Math.floor((asOfMs - openedAtMs) / 86_400_000));
      const bucketLabel = agingBucketLabelForAgeDays(ageDays);
      const bucket = template.find((row) => row.bucketLabel === bucketLabel);
      if (!bucket) {
        continue;
      }
      bucket.total += 1;
      if (finding.severity === "Critical Exposure") {
        bucket.criticalExposureCount += 1;
      } else if (finding.severity === "High Risk") {
        bucket.highRiskCount += 1;
      } else if (finding.severity === "Major") {
        bucket.majorCount += 1;
      } else if (finding.severity === "Data Gap") {
        bucket.dataGapCount += 1;
      } else {
        bucket.otherCount += 1;
      }
    }

    return template;
  }, [searchFilteredFindings, selectedAsOfDate]);

  const closedFindingsBySpi = useMemo(() => {
    const spiIds = Object.keys(SPI_NAMES)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value))
      .sort((a, b) => a - b);

    return spiIds.map((spiId) => {
      const count = findings.filter((finding) => {
        if (finding.spiId !== spiId) {
          return false;
        }
        if (!finding.closedTimestamp) {
          return false;
        }
        return finding.closedTimestamp.slice(0, 10) <= selectedAsOfDate;
      }).length;
      return {
        spiId,
        count
      };
    });
  }, [findings, selectedAsOfDate]);

  const closedFindingsBySpiChartRows = useMemo(
    () => closedFindingsBySpi.map((row) => ({ ...row, spiLabel: `SPI ${row.spiId}` })),
    [closedFindingsBySpi]
  );

  const toggleAgingBucketFilter = (bucketLabel: string) => {
    setSelectedAgingBucketFilter((current) => (current === bucketLabel ? null : bucketLabel));
  };

  const affectedAssetTypeTotalsByFinding = useMemo(() => {
    const grouped = new Map<
      string,
      { server: Set<string>; workstation: Set<string>; networkDevice: Set<string> }
    >();

    for (const finding of spiScopedFindings) {
      const key = findingGroupKey(finding);
      const current = grouped.get(key) ?? {
        server: new Set<string>(),
        workstation: new Set<string>(),
        networkDevice: new Set<string>()
      };

      const bucket = assetTypeBucket(finding.assetType);
      if (bucket === "server") {
        current.server.add(finding.assetId);
      } else if (bucket === "workstation") {
        current.workstation.add(finding.assetId);
      } else if (bucket === "network-device") {
        current.networkDevice.add(finding.assetId);
      }

      grouped.set(key, current);
    }

    const totals = new Map<string, { server: number; workstation: number; networkDevice: number }>();
    for (const [key, value] of grouped.entries()) {
      totals.set(key, {
        server: value.server.size,
        workstation: value.workstation.size,
        networkDevice: value.networkDevice.size
      });
    }

    return totals;
  }, [spiScopedFindings]);

  const openFindingsCountByAsset = useMemo(() => {
    const counts = new Map<string, number>();
    for (const finding of findings) {
      if (finding.workflowStatus !== "open") {
        continue;
      }
      counts.set(finding.assetId, (counts.get(finding.assetId) ?? 0) + 1);
    }
    return counts;
  }, [findings]);

  const affectedDeviceRows = useMemo<AffectedDeviceRow[]>(() => {
    if (!selectedFindingForAssets) {
      return [];
    }
    return buildAffectedDeviceRowsForFinding(
      selectedSeverityFindings,
      openFindingsCountByAsset,
      selectedFindingForAssets,
      assetHighRiskCvesByAssetId
    );
  }, [
    assetHighRiskCvesByAssetId,
    openFindingsCountByAsset,
    selectedFindingForAssets,
    selectedSeverityFindings
  ]);

  const findingGroupMetaByKey = useMemo(() => {
    const map = new Map<string, { extract: string; spiId: number; title: string }>();
    let nextIndex = 1;

    for (const finding of filteredFindings) {
      const key = findingGroupKey(finding);
      if (map.has(key)) {
        continue;
      }
      map.set(key, {
        extract: `EXT-${String(nextIndex).padStart(4, "0")}`,
        spiId: finding.spiId,
        title: finding.title
      });
      nextIndex += 1;
    }

    return map;
  }, [filteredFindings]);

  const findingsForExport = useMemo(() => {
    return filteredFindings.map((finding) => ({
      extract: findingGroupMetaByKey.get(findingGroupKey(finding))?.extract ?? "",
      finding
    }));
  }, [filteredFindings, findingGroupMetaByKey]);

  const affectedCisForExport = useMemo(() => {
    const rows: Array<{
      extract: string;
      spiId: number;
      findingTitle: string;
      ci: AffectedDeviceRow;
    }> = [];

    for (const meta of findingGroupMetaByKey.values()) {
      const linkedCis = buildAffectedDeviceRowsForFinding(
        selectedSeverityFindings,
        openFindingsCountByAsset,
        {
          spiId: meta.spiId,
          title: meta.title
        },
        assetHighRiskCvesByAssetId
      );
      for (const ci of linkedCis) {
        rows.push({
          extract: meta.extract,
          spiId: meta.spiId,
          findingTitle: meta.title,
          ci
        });
      }
    }

    return rows;
  }, [assetHighRiskCvesByAssetId, findingGroupMetaByKey, openFindingsCountByAsset, selectedSeverityFindings]);

  const downloadAffectedCisCsv = () => {
    if (!selectedFindingForAssets || !affectedDeviceRows.length) {
      return;
    }

    const extract = findingGroupMetaByKey.get(findingGroupKey(selectedFindingForAssets))?.extract ?? "EXT-0000";
    const headers = [
      "Extract",
      "SPI",
      "Finding Title",
      "CI Name",
      "Asset ID",
      "Asset IP Address",
      "Asset Type",
      "Total Open Findings",
      "Total High Risk CVE Vulnerabilities",
      "Asset Change Assignment Group",
      "Asset Incident Assignment Group",
      "Owner"
    ];
    const rows = affectedDeviceRows.map((device) => [
      extract,
      selectedFindingForAssets.spiId,
      selectedFindingForAssets.title,
      device.assetName,
      device.assetId,
      device.assetIpAddress,
      device.assetType,
      device.totalOpenFindings,
      device.totalHighRiskCveVulnerabilities,
      device.assetChangeAssignmentGroup,
      device.assetIncidentAssignmentGroup,
      device.owner
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    downloadBlob(
      csv,
      `affected-cis-${safeSlug(selectedFindingForAssets.title)}.csv`,
      "text/csv;charset=utf-8;"
    );
  };

  const downloadFindingsCsvPackage = () => {
    if (!findingsForExport.length) {
      return;
    }

    const findingsHeaders = [
      "Extract",
      "Finding ID",
      "Timestamp",
      "SPI",
      "Priority",
      "Severity",
      "Title",
      "Asset ID",
      "Asset Name",
      "Asset Type",
      "Server Assets Affected",
      "Workstation Assets Affected",
      "Network Device Assets Affected",
      "Asset IP Address",
      "Recommended Action"
    ];
    const findingsRows = findingsForExport.map((row) => {
      const totals = affectedAssetTypeTotalsByFinding.get(findingGroupKey(row.finding)) ?? {
        server: 0,
        workstation: 0,
        networkDevice: 0
      };

      return [
        row.extract,
        row.finding.id,
        row.finding.timestampLabel,
        row.finding.spiId,
        row.finding.priorityRank,
        row.finding.severity,
        row.finding.title,
        row.finding.assetId,
        row.finding.assetName,
        row.finding.assetType,
        totals.server,
        totals.workstation,
        totals.networkDevice,
        row.finding.assetIpAddress,
        row.finding.recommendedAction
      ];
    });

    const affectedHeaders = [
      "Extract",
      "SPI",
      "Finding Title",
      "CI Name",
      "Asset ID",
      "Asset IP Address",
      "Asset Type",
      "Total Open Findings",
      "Total High Risk CVE Vulnerabilities",
      "Asset Change Assignment Group",
      "Asset Incident Assignment Group",
      "Owner"
    ];
    const affectedRows = affectedCisForExport.map((row) => [
      row.extract,
      row.spiId,
      row.findingTitle,
      row.ci.assetName,
      row.ci.assetId,
      row.ci.assetIpAddress,
      row.ci.assetType,
      row.ci.totalOpenFindings,
      row.ci.totalHighRiskCveVulnerabilities,
      row.ci.assetChangeAssignmentGroup,
      row.ci.assetIncidentAssignmentGroup,
      row.ci.owner
    ]);

    const workbookXml = buildWorkbookXml({
      findingsSheetHeaders: findingsHeaders,
      findingsSheetRows: findingsRows,
      affectedSheetHeaders: affectedHeaders,
      affectedSheetRows: affectedRows
    });
    downloadBlob(
      workbookXml,
      `risk-findings-${selectedSeverity ? safeSlug(selectedSeverity) : "selection"}.xls`,
      "application/vnd.ms-excel;charset=utf-8;"
    );
  };

  const selectedAssetHighRiskCves = useMemo(() => {
    if (!selectedAssetForCveDetails) {
      return [];
    }
    return selectedAssetForCveDetails.highRiskCveVulnerabilities;
  }, [selectedAssetForCveDetails]);

  const filteredAssetHighRiskCves = useMemo(() => {
    const normalizedSearch = cveSearchTerm.trim().toLowerCase();
    return selectedAssetHighRiskCves.filter((entry) => {
      if (!normalizedSearch) {
        return true;
      }
      const searchText = [
        entry.cve,
        entry.description,
        entry.remediationGuidance,
        entry.criticality,
        entry.exploitability,
        entry.capturedAt
      ]
        .join(" ")
        .toLowerCase();
      return searchText.includes(normalizedSearch);
    });
  }, [cveSearchTerm, selectedAssetHighRiskCves]);

  const downloadHighRiskCvesCsv = () => {
    if (!selectedAssetForCveDetails || !filteredAssetHighRiskCves.length) {
      return;
    }

    const headers = ["Asset Name", "Asset ID", "CVE", "Description", "Remediation Guidance", "Criticality", "Timestamp"];
    const rows = filteredAssetHighRiskCves.map((entry) => [
      selectedAssetForCveDetails.assetName,
      selectedAssetForCveDetails.assetId,
      entry.cve,
      entry.description,
      entry.remediationGuidance,
      entry.criticality,
      formatCapturedTimestamp(entry.capturedAt)
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

    const safeAssetLabel =
      selectedAssetForCveDetails.assetName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "asset-cves";
    downloadBlob(
      csvContent,
      `high-risk-cves-${safeAssetLabel}.csv`,
      "text/csv;charset=utf-8;"
    );
  };
  const cveDetailsModal =
    isMounted && isCveDetailsModalVisible && selectedAssetForCveDetails
      ? createPortal(
          <div
            className={`fixed inset-0 z-[10010] ${
              isCveDetailsModalOpen ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            <div
              className={`absolute inset-0 bg-slate-950/88 backdrop-blur-[1px] transition-opacity duration-200 ${
                isCveDetailsModalOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={closeCveDetailsModal}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
              <section
                className={`relative flex h-[min(88vh,760px)] w-[min(1380px,95vw)] flex-col rounded-2xl border border-sky-300/35 bg-slate-950 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] transition-all duration-[260ms] ease-out ${
                  isCveDetailsModalOpen ? "scale-100 opacity-100" : "scale-[0.98] opacity-0"
                }`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="risk-asset-cve-details-modal-title"
              >
                <button
                  type="button"
                  onClick={closeCveDetailsModal}
                  className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
                >
                  Close
                </button>

                <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">CVE Details</p>
                <h6 id="risk-asset-cve-details-modal-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
                  High Risk CVE Vulnerabilities
                </h6>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-300/80">Asset: {selectedAssetForCveDetails.assetName}</p>
                    <p className="mt-1 text-xs text-slate-300/80">CVEs in scope: {filteredAssetHighRiskCves.length}</p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadHighRiskCvesCsv}
                    disabled={!filteredAssetHighRiskCves.length}
                    className="rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:text-slate-400"
                  >
                    Export CSV
                  </button>
                </div>

                <div className="mt-3">
                  <label
                    htmlFor="risk-asset-cve-search"
                    className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75"
                  >
                    Text Search
                  </label>
                  <input
                    id="risk-asset-cve-search"
                    type="search"
                    value={cveSearchTerm}
                    onChange={(event) => setCveSearchTerm(event.target.value)}
                    placeholder="Search CVE, description, remediation, criticality, timestamp..."
                    className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
                  />
                </div>

                <div className="mt-3 min-h-0 flex-1 overflow-x-auto overflow-y-scroll rounded-xl border border-sky-400/15">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                      <tr>
                        <th className="px-3 py-2">CVE Code</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Remediation Guidance</th>
                        <th className="px-3 py-2">Criticality</th>
                        <th className="px-3 py-2">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssetHighRiskCves.map((entry, index) => (
                        <tr
                          key={`${selectedAssetForCveDetails.assetId}-${entry.cve}-${entry.capturedAt}-${index}`}
                          className="border-t border-sky-400/10 align-top"
                        >
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-sky-100">{entry.cve}</td>
                          <td className="px-3 py-2 text-slate-300/85">{entry.description}</td>
                          <td className="px-3 py-2 text-slate-300/85">{entry.remediationGuidance}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-red-100">{entry.criticality}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">
                            {formatCapturedTimestamp(entry.capturedAt)}
                          </td>
                        </tr>
                      ))}
                      {filteredAssetHighRiskCves.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                            {selectedAssetHighRiskCves.length === 0
                              ? "No high-risk CVE vulnerabilities for this asset."
                              : "No CVE records match the active search."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>,
          document.body
        )
      : null;

  const containerClass =
    layout === "stacked"
      ? "grid h-full min-h-0 gap-2.5 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]"
      : "grid h-full min-h-[285px] gap-3 lg:grid-cols-2";
  const riskPanelClass =
    layout === "stacked"
      ? "panel-alt flex min-h-0 flex-col overflow-hidden p-2.5"
      : "panel-alt flex min-h-[285px] flex-col overflow-hidden p-2.5";
  const chartBodyClass = layout === "stacked" ? "mt-1.5 min-h-0 flex-1" : "mt-1.5 min-h-[170px] flex-1";
  const chartMinHeight = layout === "stacked" ? 1 : 170;

  return (
    <>
      <div className="h-full min-h-0 overflow-hidden">
      <div className={containerClass}>
        <section className={riskPanelClass}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-[220px] flex-1">
              <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Risk Profile</h3>
              <p className="mt-1 text-xs leading-4 text-slate-300/80">{scopeDescription}</p>
            </div>
            {enableFindingsDrillThrough ? (
              <p className="rounded-md border border-sky-300/20 bg-slate-950/50 px-2 py-1 text-[11px] text-sky-200/90">
                Select a severity bar to open Findings.
              </p>
            ) : null}
          </div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-sky-300/25 bg-slate-950/50 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-300/80">Open</p>
              <p className="mt-0.5 text-lg font-semibold leading-none text-slate-100">{riskProfile.openFindings}</p>
            </div>
            <div className="rounded-md border border-sky-300/25 bg-slate-950/50 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-300/80">P1-P2</p>
              <p className="mt-0.5 text-lg font-semibold leading-none text-slate-100">{riskProfile.p1p2Count}</p>
            </div>
            <div className="rounded-md border border-red-400/25 bg-red-500/10 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-300/80">Critical</p>
              <p className="mt-0.5 text-lg font-semibold leading-none text-red-100">
                {riskProfile.criticalExposureOpenCount}
              </p>
            </div>
            <div className="rounded-md border border-orange-400/25 bg-orange-500/10 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-300/80">High</p>
              <p className="mt-0.5 text-lg font-semibold leading-none text-orange-100">
                {riskProfile.highRiskOpenCount}
              </p>
            </div>
          </div>
          <div className={chartBodyClass}>
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={chartMinHeight}>
                <BarChart data={riskProfile.severitySummary} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(120,180,210,0.14)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
                  <YAxis dataKey="severity" type="category" width={112} tick={{ fill: "#d2e6f4", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
                    formatter={(value) => [value, "Open Findings"]}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 6, 6, 0]}
                    isAnimationActive={false}
                  >
                    <LabelList dataKey="count" position="right" fill="#e2e8f0" fontSize={11} />
                    {riskProfile.severitySummary.map((entry) => (
                      <Cell
                        key={entry.severity}
                        fill={severityColors[entry.severity]}
                        opacity={selectedSeverity && selectedSeverity !== entry.severity ? 0.58 : 1}
                        stroke={selectedSeverity === entry.severity ? "#e2e8f0" : "transparent"}
                        strokeWidth={selectedSeverity === entry.severity ? 1.4 : 0}
                        className={enableFindingsDrillThrough ? "cursor-pointer" : undefined}
                        onClick={enableFindingsDrillThrough ? () => openFindingsPanel(entry.severity) : undefined}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </section>

        <section className={riskPanelClass}>
          <h3 className="text-sm uppercase tracking-[0.14em] text-slate-100">Risk Trend (3 Months)</h3>
          <p className="mt-1 text-xs text-slate-300/80">
            Weekly open finding counts for Critical Exposure and High Risk.
          </p>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-300/80">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-orange-400" />
              High Risk
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
              Critical Exposure
            </span>
          </div>
          <div className={chartBodyClass}>
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={chartMinHeight}>
                <LineChart data={riskProfile.weeklyTrend} margin={{ top: 2, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(120,180,210,0.14)" />
                  <XAxis dataKey="weekLabel" minTickGap={14} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} width={30} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
                    formatter={(value, name) => [
                      value ?? "-",
                      name === "highRiskCount" ? "High Risk" : "Critical Exposure"
                    ]}
                  />
                  <Line type="monotone" dataKey="highRiskCount" stroke="#f97316" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                  <Line
                    type="monotone"
                    dataKey="criticalExposureCount"
                    stroke="#ef4444"
                    strokeWidth={2.2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </section>
      </div>
      </div>

      {enableFindingsDrillThrough && isFindingsPanelVisible && selectedSeverity ? (
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
            aria-labelledby="risk-findings-slideout-title"
          >
            {!isAssetDetailsPanelVisible ? (
              <button
                type="button"
                onClick={closeFindingsPanel}
                className="absolute right-4 top-4 z-[6] rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
              >
                Close
              </button>
            ) : null}

            <div className="relative flex h-full min-h-0 flex-col">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Risk Detail</p>
              <h4 id="risk-findings-slideout-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
                Findings
              </h4>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-300/80">Selected Bar: {selectedSeverity}</p>
                  <p className="mt-1 text-xs text-slate-300/80">Open findings in scope: {selectedSeverityTotalCount}</p>
                </div>
                <button
                  type="button"
                  onClick={downloadFindingsCsvPackage}
                  disabled={!findingsForExport.length}
                  className="rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:text-slate-400"
                >
                  Export CSV
                </button>
              </div>

              <section className="panel-alt mt-3 p-3">
                <div className="grid gap-3 xl:grid-cols-2">
                  <div className="rounded-xl border border-sky-300/20 bg-slate-950/45 p-3">
                    <h5 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Open Findings Aging Buckets</h5>
                    <p className="mt-1 text-xs text-slate-300/80">Open findings shown in this view at {selectedAsOfDate}.</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-300/80">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                        Critical Exposure
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
                        High Risk
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                        Major
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                        Data Gap
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                        Other
                      </span>
                    </div>
                    <div className="mt-3 h-52 w-full">
                      {isMounted ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <BarChart data={openFindingsAgingBuckets} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
                          <CartesianGrid stroke="rgba(120,180,210,0.14)" />
                          <XAxis dataKey="bucketLabel" tick={{ fill: "#a8c6d8", fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.5)" }}
                            formatter={(value, key) => {
                              if (key === "criticalExposureCount") {
                                return [value, "Critical Exposure"];
                              }
                              if (key === "highRiskCount") {
                                return [value, "High Risk"];
                              }
                              if (key === "majorCount") {
                                return [value, "Major"];
                              }
                              if (key === "dataGapCount") {
                                return [value, "Data Gap"];
                              }
                              return [value, "Other"];
                            }}
                          />
                          <Bar
                            dataKey="criticalExposureCount"
                            stackId="severity"
                            name="Critical Exposure"
                            fill="#ef4444"
                            isAnimationActive={false}
                          >
                            {openFindingsAgingBuckets.map((row) => (
                              <Cell
                                key={`age-critical-${row.bucketLabel}`}
                                className="cursor-pointer"
                                fillOpacity={selectedAgingBucketFilter && selectedAgingBucketFilter !== row.bucketLabel ? 0.35 : 1}
                                onClick={() => toggleAgingBucketFilter(row.bucketLabel)}
                              />
                            ))}
                          </Bar>
                          <Bar
                            dataKey="highRiskCount"
                            stackId="severity"
                            name="High Risk"
                            fill="#f97316"
                            isAnimationActive={false}
                          >
                            {openFindingsAgingBuckets.map((row) => (
                              <Cell
                                key={`age-high-${row.bucketLabel}`}
                                className="cursor-pointer"
                                fillOpacity={selectedAgingBucketFilter && selectedAgingBucketFilter !== row.bucketLabel ? 0.35 : 1}
                                onClick={() => toggleAgingBucketFilter(row.bucketLabel)}
                              />
                            ))}
                          </Bar>
                          <Bar
                            dataKey="majorCount"
                            stackId="severity"
                            name="Major"
                            fill="#f59e0b"
                            isAnimationActive={false}
                          >
                            {openFindingsAgingBuckets.map((row) => (
                              <Cell
                                key={`age-major-${row.bucketLabel}`}
                                className="cursor-pointer"
                                fillOpacity={selectedAgingBucketFilter && selectedAgingBucketFilter !== row.bucketLabel ? 0.35 : 1}
                                onClick={() => toggleAgingBucketFilter(row.bucketLabel)}
                              />
                            ))}
                          </Bar>
                          <Bar
                            dataKey="dataGapCount"
                            stackId="severity"
                            name="Data Gap"
                            fill="#94a3b8"
                            isAnimationActive={false}
                          >
                            {openFindingsAgingBuckets.map((row) => (
                              <Cell
                                key={`age-data-gap-${row.bucketLabel}`}
                                className="cursor-pointer"
                                fillOpacity={selectedAgingBucketFilter && selectedAgingBucketFilter !== row.bucketLabel ? 0.35 : 1}
                                onClick={() => toggleAgingBucketFilter(row.bucketLabel)}
                              />
                            ))}
                          </Bar>
                            <Bar
                              dataKey="otherCount"
                              stackId="severity"
                              name="Other"
                              fill="#38bdf8"
                              isAnimationActive={false}
                            >
                              {openFindingsAgingBuckets.map((row) => (
                                <Cell
                                  key={`age-other-${row.bucketLabel}`}
                                  className="cursor-pointer"
                                  fillOpacity={selectedAgingBucketFilter && selectedAgingBucketFilter !== row.bucketLabel ? 0.35 : 1}
                                  onClick={() => toggleAgingBucketFilter(row.bucketLabel)}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : null}
                    </div>
                    {selectedAgingBucketFilter ? (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-amber-100/90">
                          Active aging bucket filter: {selectedAgingBucketFilter} days
                        </p>
                        <button
                          type="button"
                          onClick={() => setSelectedAgingBucketFilter(null)}
                          className="rounded-md border border-sky-300/35 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-300/75">Select any aging bucket bar to filter findings results.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-sky-300/20 bg-slate-950/45 p-3">
                    <h5 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Closed Findings by SPI</h5>
                    <p className="mt-1 text-xs text-slate-300/80">
                      All closed findings up to {selectedAsOfDate} in this risk scope.
                    </p>
                    <div className="mt-3 h-52 w-full">
                      {isMounted ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <BarChart data={closedFindingsBySpiChartRows} margin={{ top: 6, right: 8, left: 0, bottom: 2 }}>
                          <CartesianGrid stroke="rgba(120,180,210,0.14)" />
                          <XAxis dataKey="spiLabel" tick={{ fill: "#a8c6d8", fontSize: 11 }} interval={0} />
                          <YAxis allowDecimals={false} tick={{ fill: "#a8c6d8", fontSize: 11 }} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || payload.length === 0) {
                                return null;
                              }
                              const row = payload[0]?.payload as { spiId?: number; count?: number } | undefined;
                              if (!row?.spiId) {
                                return null;
                              }
                              const name = SPI_NAMES[row.spiId as keyof typeof SPI_NAMES] ?? "Unmapped SPI";
                              const description = SPI_DESCRIPTIONS[row.spiId as keyof typeof SPI_DESCRIPTIONS] ?? "";
                              return (
                                <div className="rounded-md border border-slate-500/55 bg-slate-950/95 p-2 text-xs text-slate-100 shadow-lg">
                                  <p className="font-semibold">{`SPI ${row.spiId} - ${name}`}</p>
                                  <p className="mt-1 text-slate-300/90">{description}</p>
                                  <p className="mt-1 text-cyan-200">{`Closed Findings: ${row.count ?? 0}`}</p>
                                </div>
                              );
                            }}
                          />
                            <Bar dataKey="count" fill="#22d3ee" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="risk-findings-spi-filter"
                    className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75"
                  >
                    SPI
                  </label>
                  <select
                    id="risk-findings-spi-filter"
                    value={spiFilter}
                    onChange={(event) => setSpiFilter(event.target.value)}
                    className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="all">All SPI</option>
                    {spiFilterOptions.map((spiId) => (
                      <option key={spiId} value={String(spiId)}>
                        {`SPI ${spiId} - ${SPI_NAMES[spiId as keyof typeof SPI_NAMES] ?? "Unmapped SPI"}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="risk-findings-asset-type-filter"
                    className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75"
                  >
                    Asset Type
                  </label>
                  <select
                    id="risk-findings-asset-type-filter"
                    value={assetTypeFilter}
                    onChange={(event) => setAssetTypeFilter(event.target.value)}
                    className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="all">All Asset Types</option>
                    {assetTypeFilterOptions.map((assetType) => (
                      <option key={assetType} value={assetType}>
                        {assetType}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label htmlFor="risk-findings-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                  Text Search
                </label>
                <input
                  id="risk-findings-search"
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
                        <th className="px-3 py-2">SPI</th>
                        <th className="px-3 py-2">Priority</th>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Server Assets Affected</th>
                        <th className="px-3 py-2">Workstation Assets Affected</th>
                        <th className="px-3 py-2">Network Device Assets Affected</th>
                        <th className="px-3 py-2">Recommended Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedFindings.map((finding) => {
                        const totals = affectedAssetTypeTotalsByFinding.get(findingGroupKey(finding)) ?? {
                          server: 0,
                          workstation: 0,
                          networkDevice: 0
                        };

                        return (
                          <tr key={finding.id} className="border-t border-sky-400/10 align-top">
                            <td className="whitespace-nowrap px-3 py-2 text-slate-200">{finding.timestampLabel}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-200">SPI {finding.spiId}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-200">P{finding.priorityRank}</td>
                            <td className="px-3 py-2 text-slate-100">
                              <button
                                type="button"
                                onClick={() => openAssetDetailsPanel(finding)}
                                className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                              >
                                {finding.title}
                              </button>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-200">{totals.server}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-200">{totals.workstation}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-200">{totals.networkDevice}</td>
                            <td className="px-3 py-2 text-xs text-slate-300/85">{finding.recommendedAction}</td>
                          </tr>
                        );
                      })}
                      {displayedFindings.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                            {selectedSeverityTotalCount === 0
                              ? "No open findings were generated for the selected risk bar."
                              : "No findings match the active filters."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {isAssetDetailsPanelVisible && selectedFindingForAssets ? (
                <div
                  className={`absolute inset-0 z-[3] ${
                    isAssetDetailsPanelOpen ? "pointer-events-auto" : "pointer-events-none"
                  }`}
                >
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
                    aria-labelledby="risk-affected-devices-slideout-title"
                  >
                    <button
                      type="button"
                      onClick={closeAssetDetailsPanel}
                      className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
                    >
                      Close
                    </button>

                    <div className="flex h-full min-h-0 flex-col">
                      <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Drill Through</p>
                      <h5 id="risk-affected-devices-slideout-title" className="mt-2 pr-16 text-xl font-semibold text-slate-100">
                        Affected CIs
                      </h5>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs text-slate-300/80">Selected Finding: {selectedFindingForAssets.title}</p>
                          <p className="mt-1 text-xs text-slate-300/80">Affected CIs: {affectedDeviceRows.length}</p>
                        </div>
                        <button
                          type="button"
                          onClick={downloadAffectedCisCsv}
                          disabled={!affectedDeviceRows.length}
                          className="rounded-md border border-sky-300/35 px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:text-slate-400"
                        >
                          Export CSV
                        </button>
                      </div>

                      <div className="mt-3 min-h-0 flex-1 overflow-x-auto overflow-y-scroll rounded-xl border border-sky-400/15">
                        <table className="min-w-[134rem] table-fixed text-sm">
                          <colgroup>
                            <col className="w-[18rem]" />
                            <col className="w-[13rem]" />
                            <col className="w-[11rem]" />
                            <col className="w-[10rem]" />
                            <col className="w-[12rem]" />
                            <col className="w-[18rem]" />
                            <col className="w-[18rem]" />
                            <col className="w-[18rem]" />
                            <col className="w-[16rem]" />
                          </colgroup>
                          <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                            <tr>
                              <th className="whitespace-nowrap px-3 py-2">Device</th>
                              <th className="whitespace-nowrap px-3 py-2">Asset ID</th>
                              <th className="whitespace-nowrap px-3 py-2">Asset IP address</th>
                              <th className="whitespace-nowrap px-3 py-2">Asset Type</th>
                              <th className="whitespace-nowrap px-3 py-2">Total Open Findings</th>
                              <th className="whitespace-nowrap px-3 py-2">Total High Risk CVE Vulnerabilities</th>
                              <th className="whitespace-nowrap px-3 py-2">Asset Change Assignment Group</th>
                              <th className="whitespace-nowrap px-3 py-2">Asset Incident Assignment Group</th>
                              <th className="whitespace-nowrap px-3 py-2">Owner</th>
                            </tr>
                          </thead>
                          <tbody>
                            {affectedDeviceRows.map((device) => (
                              <tr key={device.assetId} className="border-t border-sky-400/10 align-top">
                                <td className="whitespace-nowrap px-3 py-2 text-slate-100">{device.assetName}</td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.assetId}</td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.assetIpAddress}</td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.assetType}</td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-200">{device.totalOpenFindings}</td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  {device.totalHighRiskCveVulnerabilities > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => openCveDetailsModal(device)}
                                      className="text-left text-sky-100 underline decoration-sky-300/45 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                                    >
                                      {device.totalHighRiskCveVulnerabilities}
                                    </button>
                                  ) : (
                                    <span className="text-slate-400/90">0</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.assetChangeAssignmentGroup}</td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.assetIncidentAssignmentGroup}</td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-300/85">{device.owner}</td>
                              </tr>
                            ))}
                            {affectedDeviceRows.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-3 py-6 text-center text-sm text-emerald-200/90">
                                  No affected devices found for this finding.
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
          </aside>
        </div>
      ) : null}
      {cveDetailsModal}
    </>
  );
}
