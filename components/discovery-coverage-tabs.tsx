"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  totals: {
    server: { actual: number; target: number };
    workstation: { actual: number; target: number };
    networkDevice: { actual: number; target: number };
  };
}

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

function percentFound(actual: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Number(((actual / target) * 100).toFixed(1));
}

function chartDataFor(network: TargetStateNetworkSummary) {
  return [
    {
      assetType: "Server",
      target: network.totals.server.target,
      actual: network.totals.server.actual
    },
    {
      assetType: "Workstation",
      target: network.totals.workstation.target,
      actual: network.totals.workstation.actual
    },
    {
      assetType: "Network Device",
      target: network.totals.networkDevice.target,
      actual: network.totals.networkDevice.actual
    }
  ];
}

export function DiscoveryCoverageTabs({
  children,
  targetStateNetworks
}: {
  children: ReactNode;
  targetStateNetworks: TargetStateNetworkSummary[];
}) {
  const [discoveryStatusFilter, setDiscoveryStatusFilter] = useState<
    "All" | "Discovery Enabled" | "Discovery Non Enabled"
  >("All");
  const tabs = useMemo(
    () => [
      { id: "discovery-coverage", label: "Discovery Coverage" },
      { id: "target-state-asset-discovery", label: "Target State Network Discovery" }
    ],
    []
  );
  const filteredTargetStateNetworks = useMemo(() => {
    if (discoveryStatusFilter === "All") {
      return targetStateNetworks;
    }
    return targetStateNetworks.filter((network) => network.discoveryStatus === discoveryStatusFilter);
  }, [discoveryStatusFilter, targetStateNetworks]);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("discovery-coverage");
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingTab, setPendingTab] = useState<(typeof tabs)[number]["id"] | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabSwitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      if (tabSwitchTimeoutRef.current) {
        clearTimeout(tabSwitchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading || !pendingTab) {
      return;
    }
    if (activeTab !== pendingTab) {
      return;
    }

    setProgress(100);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setPendingTab(null);
      setProgress(0);
    }, 140);
  }, [activeTab, isLoading, pendingTab]);

  const onSelectTab = (tab: (typeof tabs)[number]["id"]) => {
    if (tab === activeTab) {
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    if (tabSwitchTimeoutRef.current) {
      clearTimeout(tabSwitchTimeoutRef.current);
    }

    setIsLoading(true);
    setProgress(0);
    setPendingTab(tab);
    intervalRef.current = setInterval(() => {
      setProgress((current) => Math.min(96, nextProgressValue(current)));
    }, 85);

    // Keep parity with Findings tabs by showing loading first, then applying the tab.
    tabSwitchTimeoutRef.current = setTimeout(() => {
      setActiveTab(tab);
      tabSwitchTimeoutRef.current = null;
    }, 240);
  };

  const pendingTabLabel =
    pendingTab === "target-state-asset-discovery" ? "Target State Network Discovery" : "Discovery Coverage";

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.13em] transition ${
                  activeTab === tab.id
                    ? "border-sky-200/60 bg-sky-500/20 text-sky-100"
                    : "border-sky-400/20 bg-slate-900/40 text-slate-200 hover:border-sky-300/45 hover:bg-slate-800/70"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {activeTab === "discovery-coverage" ? (
            <div className="space-y-4">{children}</div>
          ) : (
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
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            network.discoveryStatus === "Discovery Enabled"
                              ? "border-emerald-300/45 bg-emerald-500/15 text-emerald-100"
                              : "border-amber-300/45 bg-amber-500/15 text-amber-100"
                          }`}
                        >
                          {network.discoveryStatus}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-md border border-sky-300/20 bg-slate-900/55 p-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Servers</p>
                          <p className="mt-1 text-lg font-semibold text-sky-100">
                            {network.totals.server.actual} / {network.totals.server.target}
                          </p>
                          <p className="text-[11px] text-slate-300/75">
                            {percentFound(network.totals.server.actual, network.totals.server.target)}% found
                          </p>
                        </div>
                        <div className="rounded-md border border-sky-300/20 bg-slate-900/55 p-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Workstations</p>
                          <p className="mt-1 text-lg font-semibold text-sky-100">
                            {network.totals.workstation.actual} / {network.totals.workstation.target}
                          </p>
                          <p className="text-[11px] text-slate-300/75">
                            {percentFound(network.totals.workstation.actual, network.totals.workstation.target)}% found
                          </p>
                        </div>
                        <div className="rounded-md border border-sky-300/20 bg-slate-900/55 p-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Network Devices</p>
                          <p className="mt-1 text-lg font-semibold text-sky-100">
                            {network.totals.networkDevice.actual} / {network.totals.networkDevice.target}
                          </p>
                          <p className="text-[11px] text-slate-300/75">
                            {percentFound(network.totals.networkDevice.actual, network.totals.networkDevice.target)}% found
                          </p>
                        </div>
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
          )}
        </div>
      </section>

      {isMounted && isLoading
        ? createPortal(
            <div className="fixed inset-0 z-[9999] cursor-wait bg-slate-950/60">
              <div className="absolute left-1/2 top-1/2 w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-sky-300/35 bg-slate-900 p-6 shadow-[0_22px_60px_rgba(0,0,0,0.7)]">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-200">Loading</p>
                  <p className="mt-1 text-2xl font-semibold text-sky-100">{progress}%</p>
                </div>
                <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-sky-300 transition-[width] duration-75 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-5 flex items-center justify-center gap-3 text-xs text-slate-200">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300 border-t-cyan-100" />
                  <span>Opening {pendingTabLabel}...</span>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
