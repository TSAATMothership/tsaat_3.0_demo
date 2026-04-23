"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ASSET_TYPES, assetTypeLabel } from "@/lib/asset-taxonomy";
import { DATA_DATE_PARAM, normalizeDataDate, withDataDate } from "@/lib/data-date";
import {
  describeNetworkTargetStateCellPresentation,
  type NetworkTargetStateCellSummary
} from "@/lib/network-target-state";
import type { ResolvedNetworkDetailFields } from "@/lib/network-detail-fields";
import type { AssetType } from "@/lib/types";

const PANEL_TWEEN_MS = 260;
const NETWORK_COLUMN_WIDTH_CLASS = "w-[18rem]";
const DRILL_DOWN_COLUMN_WIDTH_CLASS = "w-[9rem]";
const STATUS_COLUMN_WIDTH_CLASS = "w-[12rem]";
const ASSET_COLUMN_WIDTH_CLASS = "w-[11rem]";
const ASSET_CELL_HEIGHT_CLASS = "h-[156px]";

export interface NetworkDiscoverySummaryTableRow extends ResolvedNetworkDetailFields {
  id: string;
  name: string;
  discoveryEnabled: "Enabled" | "Not Enabled";
  targetStateProvided: "Yes" | "No";
  targetStateByAssetType: Record<AssetType, NetworkTargetStateCellSummary>;
}

function isExternalLink(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function missingStateClass(state: NetworkTargetStateCellSummary["state"], compact: boolean): string {
  if (state === "target-and-discovery-missing") {
    return "border-violet-300/45 bg-violet-500/15 text-violet-100";
  }
  if (state === "target-missing") {
    return compact ? "border-amber-300/45 bg-amber-500/12 text-amber-100" : "border-amber-300/40 bg-amber-500/10 text-amber-100";
  }
  return compact ? "border-red-300/45 bg-red-500/12 text-red-100" : "border-red-300/40 bg-red-500/10 text-red-100";
}

function TargetStateSummaryCell({ summary }: { summary: NetworkTargetStateCellSummary }) {
  const presentation = describeNetworkTargetStateCellPresentation(summary);
  const chartData = [
    { label: "Target", value: presentation.displayTargetTotal, fill: "#38bdf8" },
    { label: "Discovered", value: presentation.displayDiscoveredTotal, fill: "#34d399" }
  ];
  const coverageLabel = `${formatPercent(clampPercent(summary.coveragePercent))}%`;
  return (
    <div
      className={`flex w-full flex-col gap-2 rounded-md border border-slate-700/60 bg-slate-900/55 p-2 ${ASSET_CELL_HEIGHT_CLASS}`}
    >
      <div className="flex shrink-0 items-center justify-between text-[11px] text-slate-200/90">
        <span>
          Target: <span className="font-semibold text-slate-100">{presentation.displayTargetTotal}</span>
        </span>
        <span>
          Discovered: <span className="font-semibold text-slate-100">{presentation.displayDiscoveredTotal}</span>
        </span>
      </div>
      {!presentation.showChart ? (
        <div className="flex min-h-0 flex-1 items-center">
          <div
            className={`flex w-full items-center justify-center rounded-sm border px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.08em] ${missingStateClass(
              summary.state,
              false
            )}`}
          >
            {presentation.missingMessage}
          </div>
        </div>
      ) : (
        <>
          <div className="h-[56px] w-full shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 2, right: 4, bottom: 2, left: 4 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.20)" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: "#cbd5e1", fontSize: 9 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(15, 23, 42, 0.45)" }}
                  contentStyle={{
                    backgroundColor: "#020617",
                    borderColor: "rgba(125,211,252,0.4)",
                    borderRadius: 8,
                    color: "#ffffff"
                  }}
                  itemStyle={{ color: "#ffffff" }}
                  labelStyle={{ color: "#ffffff" }}
                  labelFormatter={() => "Assets"}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={14}>
                  {chartData.map((entry) => (
                    <Cell key={`target-state-bar-${entry.label}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {presentation.missingMessage && presentation.missingMessagePlacement === "below-chart" ? (
            <div className="min-h-[1.1rem] shrink-0 w-full">
              <div
                className={`flex w-full items-center justify-center rounded-sm border px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-[0.08em] ${missingStateClass(
                  summary.state,
                  true
                )}`}
              >
                {presentation.missingMessage}
              </div>
            </div>
          ) : null}
          <p className="shrink-0 text-[11px] text-slate-300/90">
            Coverage: <span className="font-semibold text-slate-100">{coverageLabel}</span>
          </p>
        </>
      )}
    </div>
  );
}

export function NetworkDiscoverySummaryTableClient({ rows }: { rows: NetworkDiscoverySummaryTableRow[] }) {
  const searchParams = useSearchParams();
  const scopedDataDate = normalizeDataDate(searchParams?.get(DATA_DATE_PARAM));
  const [selectedRow, setSelectedRow] = useState<NetworkDiscoverySummaryTableRow | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPanelOpen(false);
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
        }
        closeTimerRef.current = setTimeout(() => {
          setSelectedRow(null);
          closeTimerRef.current = null;
        }, PANEL_TWEEN_MS);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedRow]);

  const openPanel = (row: NetworkDiscoverySummaryTableRow) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setSelectedRow(row);
    requestAnimationFrame(() => {
      setIsPanelOpen(true);
    });
  };

  const closePanel = () => {
    setIsPanelOpen(false);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setSelectedRow(null);
      closeTimerRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="min-h-0 h-full overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className={NETWORK_COLUMN_WIDTH_CLASS} />
            <col className={DRILL_DOWN_COLUMN_WIDTH_CLASS} />
            <col className={STATUS_COLUMN_WIDTH_CLASS} />
            {ASSET_TYPES.map((assetType) => (
              <col key={`col-${assetType}`} className={ASSET_COLUMN_WIDTH_CLASS} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
            <tr>
              <th className="px-3 py-2">Network</th>
              <th className="px-3 py-2">Drill Down</th>
              <th className="px-3 py-2">Discovery Enabled</th>
              {ASSET_TYPES.map((assetType) => (
                <th key={`header-${assetType}`} className="px-3 py-2">
                  {assetTypeLabel(assetType)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const drillDownHref = withDataDate(`/networks/${row.id}`, scopedDataDate);
              return (
                <tr key={row.id} className="border-t border-sky-400/10">
                  <td className="px-3 py-2 text-slate-100">
                    <button
                      type="button"
                      onClick={() => openPanel(row)}
                      className="text-left text-sky-100 underline decoration-sky-300/40 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={drillDownHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-sm text-sky-100 underline decoration-sky-300/60 underline-offset-2 transition hover:text-cyan-100 hover:decoration-cyan-300/80"
                    >
                      Drill Down
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        row.discoveryEnabled === "Enabled"
                          ? "border-emerald-300/45 bg-emerald-500/15 text-emerald-100"
                          : "border-amber-300/45 bg-amber-500/15 text-amber-100"
                      }`}
                    >
                      {row.discoveryEnabled}
                    </span>
                  </td>
                  {ASSET_TYPES.map((assetType) => (
                    <td key={`${row.id}:${assetType}`} className="px-3 py-2 text-slate-200 align-top">
                      <TargetStateSummaryCell summary={row.targetStateByAssetType[assetType]} />
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={ASSET_TYPES.length + 3} className="px-3 py-6 text-center text-sm text-slate-300/80">
                  No networks match the active discovery filters.
                </td>
              </tr>
            ) : null}
          </tbody>
          </table>
        </div>
      </div>

      {selectedRow ? (
        <div className="fixed inset-0 z-[130]">
          <div
            className={`absolute inset-0 bg-slate-950/92 backdrop-blur-[1px] transition-opacity duration-200 ${
              isPanelOpen ? "opacity-100" : "opacity-0"
            }`}
          />

          <aside
            className={`absolute right-0 top-0 h-full w-[min(560px,94vw)] border-l border-sky-300/35 bg-slate-950 p-5 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out ${
              isPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="network-discovery-summary-slideout-title"
          >
            <button
              type="button"
              onClick={closePanel}
              className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
            >
              Close
            </button>

            <div className="pt-2">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Network Details</p>
              <h3
                id="network-discovery-summary-slideout-title"
                className="mt-2 pr-16 text-2xl font-semibold text-slate-100"
              >
                {selectedRow.name}
              </h3>
            </div>

            <dl className="mt-5 space-y-4">
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Description</dt>
                <dd className="mt-1 text-sm text-slate-100">{selectedRow.description}</dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Owner</dt>
                <dd className="mt-1 text-sm text-slate-100">{selectedRow.owner}</dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Support Mailbox</dt>
                <dd className="mt-1 text-sm text-sky-100">
                  <a className="underline decoration-sky-300/60 underline-offset-2" href={`mailto:${selectedRow.supportEmail}`}>
                    {selectedRow.supportEmail}
                  </a>
                </dd>
              </div>
              <div className="panel-alt p-3">
                <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Service Catalogue Item</dt>
                <dd className="mt-1 text-sm text-sky-100">
                  <Link
                    href={selectedRow.serviceCatalogueUrl}
                    className="underline decoration-sky-300/60 underline-offset-2"
                    target={isExternalLink(selectedRow.serviceCatalogueUrl) ? "_blank" : undefined}
                    rel={isExternalLink(selectedRow.serviceCatalogueUrl) ? "noreferrer" : undefined}
                  >
                    Open Service Catalogue Item
                  </Link>
                </dd>
              </div>
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
                        <td className="px-2 py-2 font-semibold text-sky-50">{selectedRow.atoNumber}</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-3 text-sky-100">
                            <Link
                              href={selectedRow.diisUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(selectedRow.diisUrl) ? "_blank" : undefined}
                              rel={isExternalLink(selectedRow.diisUrl) ? "noreferrer" : undefined}
                            >
                              View in DIIS
                            </Link>
                            <Link
                              href={selectedRow.grcUrl}
                              className="underline decoration-sky-300/70 underline-offset-2"
                              target={isExternalLink(selectedRow.grcUrl) ? "_blank" : undefined}
                              rel={isExternalLink(selectedRow.grcUrl) ? "noreferrer" : undefined}
                            >
                              View in Cyber GRC Portal
                            </Link>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      ) : null}
    </>
  );
}
