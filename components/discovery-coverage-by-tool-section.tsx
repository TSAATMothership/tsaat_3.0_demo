"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CoverageByToolRadar } from "@/components/coverage-by-tool-radar";
import { DiscoveryCoverageValue } from "@/lib/discovery-coverage";

const PANEL_TWEEN_MS = 260;

function nextProgressValue(current: number): number {
  if (current >= 92) {
    return current + 1;
  }
  if (current >= 78) {
    return current + 2;
  }
  if (current >= 55) {
    return current + 3;
  }
  return current + 5;
}

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, "\"\"")}"`;
}

interface CoverageToolStat {
  id: string;
  label: string;
  covered: number;
  missing: number;
  applicable: number;
  coveragePercent: number;
}

interface CoverageByToolAssetRow {
  assetId: string;
  hostname: string;
  ipAddress: string;
  assetType: string;
  network: string;
  ictSystem: string;
  environment: string;
  coverage: {
    toolValues: Record<string, DiscoveryCoverageValue>;
    coverageCompliance: boolean;
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

export function DiscoveryCoverageByToolSection({
  toolStats,
  assetRows,
  slideoutScopeId,
  className
}: {
  toolStats: CoverageToolStat[];
  assetRows: CoverageByToolAssetRow[];
  slideoutScopeId?: string;
  className?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [panelProgress, setPanelProgress] = useState(0);
  const [pendingToolLabel, setPendingToolLabel] = useState<string | null>(null);
  const [selectedToolSearchTerm, setSelectedToolSearchTerm] = useState("");
  const [selectedToolAssetType, setSelectedToolAssetType] = useState("");
  const [slideoutScopeElement, setSlideoutScopeElement] = useState<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closePanelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelLoadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelLoadOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelLoadCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signature = useMemo(
    () => toolStats.map((tool) => `${tool.id}:${tool.covered}:${tool.missing}:${tool.coveragePercent}`).join("|"),
    [toolStats]
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
      if (panelLoadOpenTimeoutRef.current) {
        clearTimeout(panelLoadOpenTimeoutRef.current);
        panelLoadOpenTimeoutRef.current = null;
      }
      if (panelLoadCloseTimeoutRef.current) {
        clearTimeout(panelLoadCloseTimeoutRef.current);
        panelLoadCloseTimeoutRef.current = null;
      }
    };
  }, [signature]);

  useEffect(() => {
    if (!slideoutScopeId) {
      setSlideoutScopeElement(null);
      return;
    }
    setSlideoutScopeElement(document.getElementById(slideoutScopeId));
  }, [slideoutScopeId, signature, assetRows]);

  useEffect(() => {
    if (!selectedToolId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
  }, [selectedToolId]);

  const openPanel = (toolId: string, toolLabel: string) => {
    if (closePanelTimeoutRef.current) {
      clearTimeout(closePanelTimeoutRef.current);
      closePanelTimeoutRef.current = null;
    }
    if (panelLoadIntervalRef.current) {
      clearInterval(panelLoadIntervalRef.current);
      panelLoadIntervalRef.current = null;
    }
    if (panelLoadOpenTimeoutRef.current) {
      clearTimeout(panelLoadOpenTimeoutRef.current);
      panelLoadOpenTimeoutRef.current = null;
    }
    if (panelLoadCloseTimeoutRef.current) {
      clearTimeout(panelLoadCloseTimeoutRef.current);
      panelLoadCloseTimeoutRef.current = null;
    }

    setPendingToolLabel(toolLabel);
    setSelectedToolSearchTerm("");
    setSelectedToolAssetType("");
    setIsPanelLoading(true);
    setPanelProgress(0);
    setIsPanelOpen(false);
    setSelectedToolId(null);

    panelLoadIntervalRef.current = setInterval(() => {
      setPanelProgress((current) => Math.min(96, nextProgressValue(current)));
    }, 85);
    panelLoadOpenTimeoutRef.current = setTimeout(() => {
      setPanelProgress(100);
      if (panelLoadIntervalRef.current) {
        clearInterval(panelLoadIntervalRef.current);
        panelLoadIntervalRef.current = null;
      }
      setSelectedToolId(toolId);
      requestAnimationFrame(() => {
        setIsPanelOpen(true);
      });
      panelLoadCloseTimeoutRef.current = setTimeout(() => {
        setIsPanelLoading(false);
        setPendingToolLabel(null);
        setPanelProgress(0);
        panelLoadCloseTimeoutRef.current = null;
      }, 140);
      panelLoadOpenTimeoutRef.current = null;
    }, 260);
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    if (closePanelTimeoutRef.current) {
      clearTimeout(closePanelTimeoutRef.current);
    }
    closePanelTimeoutRef.current = setTimeout(() => {
      setSelectedToolId(null);
      setSelectedToolSearchTerm("");
      setSelectedToolAssetType("");
      closePanelTimeoutRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const selectedTool = useMemo(
    () => (selectedToolId ? toolStats.find((tool) => tool.id === selectedToolId) ?? null : null),
    [selectedToolId, toolStats]
  );

  const selectedToolRows = useMemo(() => {
    if (!selectedToolId) {
      return [];
    }
    return assetRows.filter((row) => row.coverage.toolValues[selectedToolId] === 0);
  }, [assetRows, selectedToolId]);

  const selectedToolAssetTypeOptions = useMemo(
    () => Array.from(new Set(selectedToolRows.map((row) => row.assetType))).sort((a, b) => a.localeCompare(b)),
    [selectedToolRows]
  );

  const filteredSelectedToolRows = useMemo(() => {
    const normalizedSearchTerm = selectedToolSearchTerm.trim().toLowerCase();
    return selectedToolRows.filter((row) => {
      if (selectedToolAssetType && row.assetType !== selectedToolAssetType) {
        return false;
      }
      if (!normalizedSearchTerm) {
        return true;
      }
      const haystack = [row.hostname, row.assetId, row.ipAddress, row.assetType, row.network, row.ictSystem, row.environment]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearchTerm);
    });
  }, [selectedToolAssetType, selectedToolRows, selectedToolSearchTerm]);

  const downloadSelectedToolCsv = () => {
    if (!selectedTool || !filteredSelectedToolRows.length) {
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
    const rows = filteredSelectedToolRows.map((row) => [
      row.hostname,
      row.ipAddress,
      row.assetType,
      row.network,
      row.ictSystem,
      row.environment,
      row.coverage.toolValues[selectedTool.id] === null ? "N/A" : row.coverage.toolValues[selectedTool.id],
      row.coverage.coverageCompliance ? "Yes" : "No"
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
  };

  const panel = selectedTool ? (
    <div className="absolute inset-0 z-20 overflow-hidden">
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

          <div className="mt-4 panel-alt border-sky-300/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-200">
                Non-compliant assets for {selectedTool.label}:{" "}
                <span className="font-semibold text-red-100">{filteredSelectedToolRows.length}</span> of{" "}
                <span className="font-semibold text-red-100">{selectedToolRows.length}</span> shown in tool scope,{" "}
                <span className="font-semibold text-slate-100">{assetRows.length}</span>
              </p>
              <button
                type="button"
                onClick={downloadSelectedToolCsv}
                disabled={!filteredSelectedToolRows.length}
                className="rounded-md border border-emerald-300/45 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-200/70 disabled:cursor-not-allowed disabled:border-slate-500/35 disabled:bg-slate-500/10 disabled:text-slate-400"
              >
                Export to CSV
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-400/15">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">IP Address</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Network</th>
                  <th className="px-3 py-2">ICT System</th>
                  <th className="px-3 py-2">Environment</th>
                  <th className="px-3 py-2">{selectedTool.label}</th>
                  <th className="px-3 py-2">Coverage Compliance</th>
                </tr>
              </thead>
              <tbody>
                {filteredSelectedToolRows.map((row) => (
                  <tr key={`${selectedTool.id}:${row.assetId}`} className="border-t border-sky-400/10">
                    <td className="px-3 py-2 text-slate-100">{row.hostname}</td>
                    <td className="px-3 py-2 text-slate-300">{row.ipAddress}</td>
                    <td className="px-3 py-2 text-slate-300">{row.assetType}</td>
                    <td className="px-3 py-2 text-slate-300">{row.network}</td>
                    <td className="px-3 py-2 text-slate-300">{row.ictSystem}</td>
                    <td className="px-3 py-2 text-slate-300">{row.environment}</td>
                    <td className="px-3 py-2">
                      <OneZeroPill value={row.coverage.toolValues[selectedTool.id] ?? null} />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          row.coverage.coverageCompliance
                            ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                            : "border-red-400/45 bg-red-500/15 text-red-100"
                        }`}
                      >
                        {row.coverage.coverageCompliance ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredSelectedToolRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-300/80">
                      {selectedToolSearchTerm || selectedToolAssetType
                        ? `No assets match this search for ${selectedTool.label}.`
                        : `No non-compliant assets for ${selectedTool.label} in the current scope.`}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <section className={clsx("panel relative flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
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
                    <button
                      type="button"
                      onClick={() => openPanel(tool.id, tool.label)}
                      className="text-left text-sky-100 underline decoration-sky-300/40 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                    >
                      {tool.label}
                    </button>
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
      </div>

      {panel ? (slideoutScopeElement ? createPortal(panel, slideoutScopeElement) : panel) : null}

      {isPanelLoading ? (
        <div className="absolute inset-0 z-30 cursor-wait bg-slate-950/60">
          <div className="absolute left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-sky-300/35 bg-slate-900 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.7)]">
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-200">Loading</p>
              <p className="mt-1 text-2xl font-semibold text-sky-100">{panelProgress}%</p>
            </div>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-sky-300 transition-[width] duration-75 ease-linear"
                style={{ width: `${panelProgress}%` }}
              />
            </div>
            <div className="mt-5 flex items-center justify-center gap-3 text-xs text-slate-200">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-cyan-100" />
              <span>Opening {pendingToolLabel ?? "tool"} details...</span>
            </div>
          </div>
        </div>
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

