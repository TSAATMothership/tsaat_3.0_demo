"use client";

import { useEffect, useMemo, useState } from "react";
import { ASSET_TYPES, assetTypeLabel } from "@/lib/asset-taxonomy";
import { AssetType } from "@/lib/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export interface TargetStateNetworkSummary {
  id: string;
  name: string;
  isNewNetwork: boolean;
  discoveryStatus: "Discovery Enabled" | "Discovery Non Enabled";
  totals: Record<AssetType, { actual: number; target: number }>;
}

function percentFound(actual: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Number(((actual / target) * 100).toFixed(1));
}

function chartDataFor(network: TargetStateNetworkSummary) {
  return ASSET_TYPES.map((assetType) => ({
    assetType: assetTypeLabel(assetType),
    target: network.totals[assetType].target,
    actual: network.totals[assetType].actual
  }));
}

export function DiscoveryCoverageTargetStateSection({
  targetStateNetworks,
  lastRefreshedAt
}: {
  targetStateNetworks: TargetStateNetworkSummary[];
  lastRefreshedAt: string;
}) {
  const [discoveryStatusFilter, setDiscoveryStatusFilter] = useState<
    "All" | "Discovery Enabled" | "Discovery Non Enabled"
  >("All");

  useEffect(() => {
    setDiscoveryStatusFilter("All");
  }, [targetStateNetworks]);

  const filteredTargetStateNetworks = useMemo(() => {
    if (discoveryStatusFilter === "All") {
      return targetStateNetworks;
    }
    return targetStateNetworks.filter((network) => network.discoveryStatus === discoveryStatusFilter);
  }, [discoveryStatusFilter, targetStateNetworks]);

  const exportChartCsv = (network: TargetStateNetworkSummary) => {
    const headers = [
      "Network",
      "Discovery Status",
      "Asset Type",
      "Target State Endpoints",
      "Actual State Endpoints",
      "Last Refreshed Date"
    ];
    const csvRows = ASSET_TYPES.map((assetType) => [
      network.name,
      network.discoveryStatus,
      assetTypeLabel(assetType),
      String(network.totals[assetType].target),
      String(network.totals[assetType].actual),
      lastRefreshedAt
    ]);

    const escapeCell = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csv = [headers, ...csvRows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const networkSuffix = network.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    link.href = url;
    link.download = `target-state-network-discovery-${networkSuffix || network.id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Target State Network Discovery</h2>
          <p className="mt-1 text-xs text-slate-300/80">
            Charts compare current discovered assets against target-state counts by asset type for networks in scope.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-slate-300/85">
          <span className="uppercase tracking-[0.12em] text-slate-300/75">Discovery Status</span>
          <select
            value={discoveryStatusFilter}
            onChange={(event) =>
              setDiscoveryStatusFilter(
                event.target.value as "All" | "Discovery Enabled" | "Discovery Non Enabled"
              )
            }
            className="rounded-md border border-sky-300/35 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-300/55 transition focus:ring-2"
          >
            <option value="All">All</option>
            <option value="Discovery Enabled">Discovery Enabled</option>
            <option value="Discovery Non Enabled">Discovery Non Enabled</option>
          </select>
        </label>
      </div>

      {filteredTargetStateNetworks.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {filteredTargetStateNetworks.map((network) => (
            <article key={network.id} className="panel-alt border border-sky-400/20 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-100">{network.name}</h3>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      network.discoveryStatus === "Discovery Enabled"
                        ? "border-emerald-300/45 bg-emerald-500/15 text-emerald-100"
                        : "border-amber-300/45 bg-amber-500/15 text-amber-100"
                    }`}
                  >
                    {network.discoveryStatus}
                  </span>
                  <button
                    type="button"
                    onClick={() => exportChartCsv(network)}
                    className="rounded-md border border-cyan-300/45 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {ASSET_TYPES.map((assetType) => (
                  <div key={`totals-${network.id}-${assetType}`} className="rounded-md border border-sky-300/20 bg-slate-900/55 p-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">{assetTypeLabel(assetType)}</p>
                    <p className="mt-1 text-lg font-semibold text-sky-100">
                      {network.totals[assetType].actual} / {network.totals[assetType].target}
                    </p>
                    <p className="text-[11px] text-slate-300/75">
                      {percentFound(network.totals[assetType].actual, network.totals[assetType].target)}% found
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataFor(network)} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis dataKey="assetType" tick={{ fill: "#a2c2d4", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#a2c2d4", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #94a3b8", color: "#000000" }}
                      labelStyle={{ color: "#000000" }}
                    />
                    <Legend />
                    <Bar dataKey="target" name="Target State" fill="#f2ae2e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actual" name="Actual State" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel-alt border border-sky-400/20 p-4 text-sm text-slate-300/85">
          No managed networks match the selected Discovery Status filter.
        </div>
      )}
    </section>
  );
}
