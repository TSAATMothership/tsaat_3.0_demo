"use client";

import { PersonaPopupButton } from "@/components/persona-popup-button";
import { usePersonaAccess } from "@/components/persona-provider";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { CoverageByToolRadar } from "@/components/coverage-by-tool-radar";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";
import { LoadingOverlay, nextLoadingProgressValue } from "@/components/loading-overlay";
import { DiscoveryCoverageValue } from "@/lib/discovery-coverage";
import { CoverageToolExplorer } from "@/components/coverage-tool-explorer";
import { type CoverageToolStat } from "@/lib/coverage-tool-explorer";
import { FilterHeader } from "@/components/inventory-explorer-controls";
import { TOOL_ASSET_COLUMNS, type ToolAssetColumn, type ToolAssetFilters, type ToolAssetFacets } from "@/lib/coverage-tool-assets";

const PANEL_TWEEN_MS = 260;
const TOOL_ROWS_PAGE_SIZE = 200;
const CSV_EXPORT_PAGE_SIZE = 5000;

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, "\"\"")}"`;
}

interface CoverageByToolAssetRow {
  assetId: string;
  hostname: string;
  ipAddress: string;
  assetType: string;
  network: string;
  ictSystem: string;
  environment: string;
  toolValue: DiscoveryCoverageValue;
  coverageCompliance: boolean;
}

interface ToolAssetResponse {
  rows: CoverageByToolAssetRow[];
  scopeTotal: number;
  selectedToolTotal: number;
  assetTypeOptions: string[];
  columnFacets?: ToolAssetFacets;
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
}

function OneZeroPill({ value }: { value: DiscoveryCoverageValue }) {
  if (value === null) {
    return <span className="rounded-full border border-slate-500/50 bg-slate-700/45 px-2 py-0.5 text-xs text-slate-200">N/A</span>;
  }

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs ${
        value === 1
          ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
          : "border-red-400/45 bg-red-500/15 text-red-100"
      }`}
    >
      {value}
    </span>
  );
}

function responseErrorMessage(status: number): string {
  if (status >= 500) {
    return "Server error while loading tool asset details.";
  }
  if (status === 404) {
    return "Tool asset details endpoint not found.";
  }
  if (status === 400) {
    return "Invalid tool asset request parameters.";
  }
  return "Unable to load tool asset details.";
}

export function DiscoveryCoverageByToolSection({
  toolStats,
  slideoutScopeId,
  className,
  variant = "classic"
}: {
  toolStats: CoverageToolStat[];
  slideoutScopeId?: string;
  className?: string;
  variant?: "classic" | "explorer";
}) {
  const searchParams = useSearchParams();
  const { canOpenPopup } = usePersonaAccess();
  const toolDetailsAllowed = canOpenPopup("discovery-tool-details");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [isToolRowsLoading, setIsToolRowsLoading] = useState(false);
  const [toolRowsError, setToolRowsError] = useState<string | null>(null);
  const [selectedToolRows, setSelectedToolRows] = useState<CoverageByToolAssetRow[]>([]);
  const [selectedToolTotal, setSelectedToolTotal] = useState(0);
  const [scopeTotal, setScopeTotal] = useState(0);
  const [selectedToolAssetTypeOptions, setSelectedToolAssetTypeOptions] = useState<string[]>([]);
  const [selectedToolPage, setSelectedToolPage] = useState(1);
  const [selectedToolPagination, setSelectedToolPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    pageSize: TOOL_ROWS_PAGE_SIZE,
    totalItems: 0
  });
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [toolRowsPageSize, setToolRowsPageSize] = useState(variant === "explorer" ? 50 : TOOL_ROWS_PAGE_SIZE);
  const [panelProgress, setPanelProgress] = useState(0);
  const [pendingToolLabel, setPendingToolLabel] = useState<string | null>(null);
  const [selectedToolSearchTerm, setSelectedToolSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedToolAssetType, setSelectedToolAssetType] = useState("");
  const [columnFilters, setColumnFilters] = useState<ToolAssetFilters>({});
  const [columnFacets, setColumnFacets] = useState<ToolAssetFacets>({});
  const [openColumn, setOpenColumn] = useState<ToolAssetColumn | null>(null);
  const activeColumns = TOOL_ASSET_COLUMNS.filter(({ key }) => columnFilters[key]?.length);
  const changeColumn = (key: ToolAssetColumn, values: string[]) => {
    setColumnFilters((current) => ({ ...current, [key]: values }));
    setSelectedToolPage(1);
  };
  const clearAssetFilters = () => {
    setColumnFilters({}); setSelectedToolSearchTerm(""); setDebouncedSearchTerm(""); setSelectedToolAssetType(""); setSelectedToolPage(1);
  };
  const [slideoutScopeElement, setSlideoutScopeElement] = useState<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closePanelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelLoadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelLoadCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolRowsRequestSeqRef = useRef(0);
  const toolRowsAbortRef = useRef<AbortController | null>(null);
  const signature = useMemo(
    () => toolStats.map((tool) => `${tool.id}:${tool.covered}:${tool.missing}:${tool.coveragePercent}`).join("|"),
    [toolStats]
  );
  const selectedTool = useMemo(
    () => (selectedToolId ? toolStats.find((tool) => tool.id === selectedToolId) ?? null : null),
    [selectedToolId, toolStats]
  );

  useEffect(() => {
    setIsLoading(true);

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      closeTimeoutRef.current = null;
    }, 220);

    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
        closePanelTimeoutRef.current = null;
      }
      if (panelLoadIntervalRef.current) {
        clearInterval(panelLoadIntervalRef.current);
        panelLoadIntervalRef.current = null;
      }
      if (panelLoadCloseTimeoutRef.current) {
        clearTimeout(panelLoadCloseTimeoutRef.current);
        panelLoadCloseTimeoutRef.current = null;
      }
      if (toolRowsAbortRef.current) {
        toolRowsAbortRef.current.abort();
        toolRowsAbortRef.current = null;
      }
    };
  }, [signature]);

  useEffect(() => {
    if (!slideoutScopeId) {
      setSlideoutScopeElement(null);
      return;
    }
    setSlideoutScopeElement(document.getElementById(slideoutScopeId));
  }, [slideoutScopeId, signature]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(selectedToolSearchTerm.trim());
    }, 220);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [selectedToolSearchTerm]);

  useEffect(() => {
    setSelectedToolPage(1);
  }, [selectedToolId, debouncedSearchTerm, selectedToolAssetType]);

  useEffect(() => {
    if (!selectedToolId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !openColumn) {
        setIsPanelOpen(false);
        if (closePanelTimeoutRef.current) {
          clearTimeout(closePanelTimeoutRef.current);
        }
        closePanelTimeoutRef.current = setTimeout(() => {
          setSelectedToolId(null);
          closePanelTimeoutRef.current = null;
        }, PANEL_TWEEN_MS);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedToolId, openColumn]);

  const buildQueryParams = useCallback(
    (toolId: string, page: number, pageSize: number, search: string, toolAssetType: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("toolId", toolId);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      for (const { key } of TOOL_ASSET_COLUMNS) {
        params.delete(`toolColumn.${key}`);
        if (variant === "explorer") for (const value of columnFilters[key] ?? []) params.append(`toolColumn.${key}`, value);
      }
      params.delete("toolFacets");
      if (variant === "explorer" && pageSize !== CSV_EXPORT_PAGE_SIZE) params.set("toolFacets", "1");
      if (search) {
        params.set("toolSearch", search);
      } else {
        params.delete("toolSearch");
      }
      if (toolAssetType) {
        params.set("toolAssetType", toolAssetType);
      } else {
        params.delete("toolAssetType");
      }
      return params;
    },
    [searchParams, columnFilters, variant]
  );

  useEffect(() => {
    if (!selectedToolId) {
      return;
    }

    const abortController = new AbortController();
    toolRowsAbortRef.current = abortController;
    const requestSeq = ++toolRowsRequestSeqRef.current;
    const params = buildQueryParams(
      selectedToolId,
      selectedToolPage,
      toolRowsPageSize,
      debouncedSearchTerm,
      selectedToolAssetType
    );

    setIsToolRowsLoading(true);
    setToolRowsError(null);

    fetch(`/api/discovery-coverage/tool-assets?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      signal: abortController.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(responseErrorMessage(response.status));
        }
        const payload = (await response.json()) as ToolAssetResponse;
        if (toolRowsRequestSeqRef.current !== requestSeq) {
          return;
        }

        setSelectedToolRows(payload.rows);
        setScopeTotal(payload.scopeTotal);
        setSelectedToolTotal(payload.selectedToolTotal);
        setSelectedToolAssetTypeOptions(payload.assetTypeOptions);
        setColumnFacets(payload.columnFacets ?? {});
        setSelectedToolPagination(payload.pagination);
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted || toolRowsRequestSeqRef.current !== requestSeq) {
          return;
        }
        const message = error instanceof Error ? error.message : "Unable to load tool asset details.";
        setToolRowsError(message);
        setSelectedToolRows([]);
        setSelectedToolTotal(0);
        setScopeTotal(0);
        setSelectedToolAssetTypeOptions([]);
        setSelectedToolPagination({
          currentPage: 1,
          totalPages: 1,
          pageSize: TOOL_ROWS_PAGE_SIZE,
          totalItems: 0
        });
      })
      .finally(() => {
        if (toolRowsRequestSeqRef.current !== requestSeq) {
          return;
        }
        setIsToolRowsLoading(false);
      });

    return () => {
      abortController.abort();
      if (toolRowsAbortRef.current === abortController) {
        toolRowsAbortRef.current = null;
      }
    };
  }, [buildQueryParams, debouncedSearchTerm, selectedToolAssetType, selectedToolId, selectedToolPage, toolRowsPageSize]);

  useEffect(() => {
    if (!isPanelLoading || !selectedToolId || isToolRowsLoading) {
      return;
    }

    setPanelProgress(100);
    if (panelLoadIntervalRef.current) {
      clearInterval(panelLoadIntervalRef.current);
      panelLoadIntervalRef.current = null;
    }
    requestAnimationFrame(() => {
      setIsPanelOpen(true);
    });
    if (panelLoadCloseTimeoutRef.current) {
      clearTimeout(panelLoadCloseTimeoutRef.current);
    }
    panelLoadCloseTimeoutRef.current = setTimeout(() => {
      setIsPanelLoading(false);
      setPendingToolLabel(null);
      setPanelProgress(0);
      panelLoadCloseTimeoutRef.current = null;
    }, 140);
  }, [isPanelLoading, isToolRowsLoading, selectedToolId]);

  const openPanel = (toolId: string, toolLabel: string) => {
    if (!toolDetailsAllowed) return;
    if (closePanelTimeoutRef.current) {
      clearTimeout(closePanelTimeoutRef.current);
      closePanelTimeoutRef.current = null;
    }
    if (panelLoadIntervalRef.current) {
      clearInterval(panelLoadIntervalRef.current);
      panelLoadIntervalRef.current = null;
    }
    if (panelLoadCloseTimeoutRef.current) {
      clearTimeout(panelLoadCloseTimeoutRef.current);
      panelLoadCloseTimeoutRef.current = null;
    }
    if (toolRowsAbortRef.current) {
      toolRowsAbortRef.current.abort();
      toolRowsAbortRef.current = null;
    }

    setPendingToolLabel(toolLabel);
    setColumnFilters({});
    setColumnFacets({});
    setOpenColumn(null);
    setSelectedToolSearchTerm("");
    setDebouncedSearchTerm("");
    setSelectedToolAssetType("");
    setSelectedToolPage(1);
    setSelectedToolRows([]);
    setSelectedToolTotal(0);
    setScopeTotal(0);
    setSelectedToolAssetTypeOptions([]);
    setSelectedToolPagination({
      currentPage: 1,
      totalPages: 1,
      pageSize: TOOL_ROWS_PAGE_SIZE,
      totalItems: 0
    });
    setToolRowsError(null);
    setCsvError(null);
    setIsPanelLoading(true);
    setPanelProgress(0);
    setIsPanelOpen(false);
    setSelectedToolId(toolId);

    panelLoadIntervalRef.current = setInterval(() => {
      setPanelProgress((current) => Math.min(96, nextLoadingProgressValue(current)));
    }, 85);
  };

  const closePanel = () => {
    setOpenColumn(null);
    if (toolRowsAbortRef.current) {
      toolRowsAbortRef.current.abort();
      toolRowsAbortRef.current = null;
    }

    setIsPanelOpen(false);
    if (closePanelTimeoutRef.current) {
      clearTimeout(closePanelTimeoutRef.current);
    }
    closePanelTimeoutRef.current = setTimeout(() => {
      setSelectedToolId(null);
      setSelectedToolSearchTerm("");
      setDebouncedSearchTerm("");
      setSelectedToolAssetType("");
      closePanelTimeoutRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const downloadSelectedToolCsv = useCallback(async () => {
    if (!selectedTool || isExportingCsv) {
      return;
    }

    setIsExportingCsv(true);
    setCsvError(null);
    try {
      const allRows: CoverageByToolAssetRow[] = [];
      const firstPageParams = buildQueryParams(
        selectedTool.id,
        1,
        CSV_EXPORT_PAGE_SIZE,
        debouncedSearchTerm,
        selectedToolAssetType
      );
      const firstPageResponse = await fetch(`/api/discovery-coverage/tool-assets?${firstPageParams.toString()}`, {
        method: "GET",
        cache: "no-store"
      });
      if (!firstPageResponse.ok) {
        throw new Error(responseErrorMessage(firstPageResponse.status));
      }
      const firstPayload = (await firstPageResponse.json()) as ToolAssetResponse;
      allRows.push(...firstPayload.rows);

      for (let page = 2; page <= firstPayload.pagination.totalPages; page += 1) {
        const params = buildQueryParams(
          selectedTool.id,
          page,
          CSV_EXPORT_PAGE_SIZE,
          debouncedSearchTerm,
          selectedToolAssetType
        );
        const response = await fetch(`/api/discovery-coverage/tool-assets?${params.toString()}`, {
          method: "GET",
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(responseErrorMessage(response.status));
        }
        const payload = (await response.json()) as ToolAssetResponse;
        allRows.push(...payload.rows);
      }

      if (!allRows.length) {
        return;
      }

      const headers = [
        "Asset",
        "IP Address",
        "Type",
        "Network",
        "ICT System",
        "Environment",
        selectedTool.label,
        "Coverage Compliance"
      ];
      const rows = allRows.map((row) => [
        row.hostname,
        row.ipAddress,
        row.assetType,
        row.network,
        row.ictSystem,
        row.environment,
        row.toolValue === null ? "N/A" : row.toolValue,
        row.coverageCompliance ? "Yes" : "No"
      ]);
      const csvContent = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
      const safeToolLabel =
        selectedTool.label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80) || "tool";
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `coverage-by-tool-${safeToolLabel}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "Unable to export tool asset details.");
    } finally {
      setIsExportingCsv(false);
    }
  }, [buildQueryParams, debouncedSearchTerm, isExportingCsv, selectedTool, selectedToolAssetType]);

  const panel = selectedTool && toolDetailsAllowed ? (
    <div className={clsx("absolute inset-0 z-20 overflow-hidden", variant === "explorer" && "coverage-explorer-drawer")}>
      <div
        className={`absolute inset-0 bg-slate-950/92 backdrop-blur-[1px] transition-opacity duration-200 ${
          isPanelOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={closePanel}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full border-l border-sky-300/35 bg-slate-950 p-5 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out ${
          isPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coverage-by-tool-slideout-title"
      >
        <button
          type="button"
          onClick={closePanel}
          className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
        >
          Close
        </button>

        <div className="flex h-full min-h-0 flex-col pt-2">
          <div className="pr-16">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Coverage By Tool</p>
            <h3 id="coverage-by-tool-slideout-title" className="mt-2 text-2xl font-semibold text-slate-100">
              {selectedTool.label} Asset Coverage Gaps
            </h3>
            <p className="mt-2 text-sm text-slate-300/85">
              Assets missing {selectedTool.label} coverage in the current Discovery scope.
            </p>
          </div>

          {variant === "explorer" ? <div className="endpoint-toolbar coverage-assets-toolbar">
            <div><h2>Assets with coverage gaps <span>{selectedToolPagination.totalItems.toLocaleString("en-AU")}</span></h2>
              <p role="status">{selectedToolPagination.totalItems.toLocaleString("en-AU")} matching records · {selectedToolTotal.toLocaleString("en-AU")} missing coverage · {scopeTotal.toLocaleString("en-AU")} assets in scope</p></div>
            <div className="endpoint-toolbar-actions"><input type="search" maxLength={500} aria-label="Search all tool asset fields"
              placeholder="Search all asset fields..." value={selectedToolSearchTerm}
              onChange={(event) => { setSelectedToolSearchTerm(event.target.value); setSelectedToolPage(1); }} />
              <button type="button" className="endpoint-export" onClick={downloadSelectedToolCsv}
                disabled={!selectedToolPagination.totalItems || isExportingCsv || isToolRowsLoading || selectedToolSearchTerm.trim() !== debouncedSearchTerm}>
                {isExportingCsv ? "Exporting..." : "Export CSV"}</button>
            </div>
          </div> : <div className="mt-4 panel-alt border-sky-300/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-200">
                Non-compliant assets for {selectedTool.label}:{" "}
                <span className="font-semibold text-red-100">{selectedToolPagination.totalItems}</span> filtered of{" "}
                <span className="font-semibold text-red-100">{selectedToolTotal}</span> in tool scope,{" "}
                <span className="font-semibold text-slate-100">{scopeTotal}</span> in total Discovery scope
              </p>
              <button
                type="button"
                onClick={downloadSelectedToolCsv}
                disabled={!selectedToolPagination.totalItems || isExportingCsv}
                className="rounded-md border border-emerald-300/45 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-200/70 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:bg-slate-500/10 disabled:text-slate-400"
              >
                {isExportingCsv ? "Exporting..." : "Export to CSV"}
              </button>
            </div>
          </div>}

          {csvError && <p role="alert" className="endpoint-export-error">{csvError}</p>}
          {variant === "explorer" ? (selectedToolSearchTerm || activeColumns.length > 0) && <div className="endpoint-active-filters" aria-label="Active tool asset filters">
            <span>Filtered by</span>{selectedToolSearchTerm && <button type="button" onClick={() => { setSelectedToolSearchTerm(""); setDebouncedSearchTerm(""); setSelectedToolPage(1); }}>Search: {selectedToolSearchTerm} ×</button>}
            {activeColumns.map(({ key, label }) => <button type="button" key={key} aria-label={`Clear ${label} filter`} onClick={() => changeColumn(key, [])}>
              {key === "toolValue" ? selectedTool.label : label}: {columnFilters[key]!.length === 1 ? columnFilters[key]![0] : `${columnFilters[key]!.length} selected`} ×</button>)}
            <button type="button" className="endpoint-clear-all" onClick={clearAssetFilters}>Clear all filters</button>
          </div> : <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="coverage-by-tool-asset-type-filter" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                Asset Type
              </label>
              <select
                id="coverage-by-tool-asset-type-filter"
                value={selectedToolAssetType}
                onChange={(event) => setSelectedToolAssetType(event.target.value)}
                className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">All Asset Types</option>
                {selectedToolAssetTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="coverage-by-tool-search" className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">
                Text Search
              </label>
              <input
                id="coverage-by-tool-search"
                type="search"
                value={selectedToolSearchTerm}
                onChange={(event) => setSelectedToolSearchTerm(event.target.value)}
                placeholder="Search asset, IP, type, network, ICT system, environment..."
                className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/70"
              />
            </div>
          </div>}

          <div className={variant === "explorer" ? "endpoint-table-scroll coverage-assets-scroll" : "mt-4 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-400/15"} aria-busy={isToolRowsLoading}>
            <table className={variant === "explorer" ? "endpoint-table coverage-assets-table" : "min-w-full text-sm"}>
              <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                <tr>
                  {variant === "explorer" ? TOOL_ASSET_COLUMNS.map((column) => <th scope="col" key={column.key}>
                    <FilterHeader column={{ ...column, label: column.key === "toolValue" ? selectedTool.label : column.label }}
                      selected={columnFilters[column.key] ?? []} options={columnFacets[column.key] ?? []} open={openColumn === column.key}
                      onOpen={(open) => setOpenColumn(open ? column.key : null)} onChange={(values) => changeColumn(column.key, values)} />
                  </th>) : <><th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">IP Address</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Network</th>
                  <th className="px-3 py-2">ICT System</th>
                  <th className="px-3 py-2">Environment</th>
                  <th className="px-3 py-2">{selectedTool.label}</th>
                  <th className="px-3 py-2">Coverage Compliance</th></>}
                </tr>
              </thead>
              <tbody>
                {!isToolRowsLoading && !toolRowsError && selectedToolRows.map((row) => (
                  <tr key={`${selectedTool.id}:${row.assetId}`} className="border-t border-sky-400/10">
                    <td className={variant === "explorer" ? "endpoint-name" : "px-3 py-2 text-slate-100"}>
                      <CmdbDeviceName assetId={row.assetId} name={row.hostname} />
                      {variant === "explorer" && <small>{row.assetId}</small>}
                    </td>
                    <td className={variant === "explorer" ? "endpoint-address" : "px-3 py-2 text-slate-300"}>{row.ipAddress}</td>
                    <td className="px-3 py-2 text-slate-300">{variant === "explorer" ? <span className="endpoint-type-badge">{row.assetType}</span> : row.assetType}</td>
                    <td className="px-3 py-2 text-slate-300">{row.network}</td>
                    <td className="px-3 py-2 text-slate-300">{row.ictSystem}</td>
                    <td className="px-3 py-2 text-slate-300">{row.environment}</td>
                    <td className="px-3 py-2">
                      <OneZeroPill value={row.toolValue} />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          row.coverageCompliance
                            ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                            : "border-red-400/45 bg-red-500/15 text-red-100"
                        }`}
                      >
                        {row.coverageCompliance ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!isToolRowsLoading && !toolRowsError && selectedToolRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-300/80">
                      {debouncedSearchTerm || selectedToolAssetType || activeColumns.length
                        ? `No assets match this search for ${selectedTool.label}.`
                        : `No non-compliant assets for ${selectedTool.label} in the current scope.`}
                    </td>
                  </tr>
                ) : null}
                {isToolRowsLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-300/80">
                      Loading tool asset details...
                    </td>
                  </tr>
                ) : null}
                {!isToolRowsLoading && toolRowsError ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-red-100">
                      {toolRowsError}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {selectedToolPagination.totalPages > 1 || variant === "explorer" ? (
            <div className={variant === "explorer" ? "endpoint-pagination" : "mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300/85"}>
              <p>
                Showing {selectedToolPagination.totalItems ? (selectedToolPagination.currentPage - 1) * selectedToolPagination.pageSize + 1 : 0}-
                {Math.min(
                  selectedToolPagination.currentPage * selectedToolPagination.pageSize,
                  selectedToolPagination.totalItems
                )}{" "}
                of {selectedToolPagination.totalItems}
              </p>
              <div className="flex items-center gap-2">
                {variant === "explorer" && <label>Rows per page <select aria-label="Assets per page" value={toolRowsPageSize}
                  disabled={isToolRowsLoading} onChange={(event) => { setToolRowsPageSize(Number(event.target.value)); setSelectedToolPage(1); }}>
                  {[25, 50, 100, 250].map((size) => <option key={size}>{size}</option>)}
                </select></label>}
                <button
                  type="button"
                  disabled={selectedToolPagination.currentPage <= 1 || isToolRowsLoading}
                  onClick={() => setSelectedToolPage(Math.max(1, selectedToolPagination.currentPage - 1))}
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 transition hover:bg-slate-800/70 disabled:cursor-not-allowed disabled:border-slate-700/70 disabled:text-slate-500"
                >
                  Previous
                </button>
                <span>
                  Page {selectedToolPagination.currentPage} of {selectedToolPagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={selectedToolPagination.currentPage >= selectedToolPagination.totalPages || isToolRowsLoading}
                  onClick={() =>
                    setSelectedToolPage(
                      Math.min(selectedToolPagination.totalPages, selectedToolPagination.currentPage + 1)
                    )
                  }
                  className="rounded-md border border-sky-400/30 px-3 py-1 text-slate-100 transition hover:bg-slate-800/70 disabled:cursor-not-allowed disabled:border-slate-700/70 disabled:text-slate-500"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
          {variant === "explorer" && <p className="endpoint-export-note">CSV exports include every matching asset across all pages and respect the active search and column filters.</p>}
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <section className={clsx("relative flex h-full min-h-0 flex-col overflow-hidden", variant === "classic" && "panel", className)}>
      {variant === "explorer" ? <CoverageToolExplorer tools={toolStats} onOpenTool={openPanel} /> : <><h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
        Coverage By Tool
      </h2>
      <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-2">
        <div className="min-h-0 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="px-3 py-2">Tool</th>
                <th className="px-3 py-2">Covered Assets</th>
                <th className="px-3 py-2">Missing Coverage</th>
                <th className="px-3 py-2">Coverage %</th>
              </tr>
            </thead>
            <tbody>
              {toolStats.map((tool) => (
                <tr key={tool.id} className="border-t border-sky-400/10">
                  <td className="px-3 py-2">
                    <PersonaPopupButton popup="discovery-tool-details"
                      type="button"
                      onClick={() => openPanel(tool.id, tool.label)}
                      className="text-left text-sky-100 underline decoration-sky-300/40 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                    >
                      {tool.label}
                    </PersonaPopupButton>
                  </td>
                  <td className="px-3 py-2 text-emerald-200">{tool.covered}</td>
                  <td className="px-3 py-2 text-red-200">{tool.missing}</td>
                  <td className="px-3 py-2 text-slate-200">{tool.coveragePercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CoverageByToolRadar
          className="h-full min-h-0"
          chartHeightClassName="h-[18rem] xl:h-[calc(100%-1.75rem)]"
          data={toolStats.map((tool) => ({
            label: tool.label,
            coveragePercent: tool.coveragePercent
          }))}
        />
      </div></>}

      {panel ? (slideoutScopeElement ? createPortal(panel, slideoutScopeElement) : panel) : null}

      {isPanelLoading ? (
        <LoadingOverlay
          progress={panelProgress}
          message={`Opening ${pendingToolLabel ?? "tool"} details...`}
          className="absolute inset-0 z-30"
        />
      ) : null}

      {isLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/55 backdrop-blur-[1px]">
          <div className="rounded-xl border border-sky-300/35 bg-slate-900/85 px-4 py-3 text-center shadow-[0_14px_38px_rgba(0,0,0,0.55)]">
            <div className="flex items-center gap-3 text-xs text-slate-200">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-cyan-100" />
              <span>Loading Coverage By Tool...</span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
