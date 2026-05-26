"use client";

import { type ComponentProps, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { FilterBar } from "@/components/filter-bar";
import { FindingsHistoryLineChart } from "@/components/findings-history-line-chart";
import { FindingsStatusTabs } from "@/components/findings-status-tabs";
import { FindingsTimelineFilter } from "@/components/findings-timeline-filter";
import { startRouteLoading } from "@/lib/route-loading";

type FilterOptionsProp = ComponentProps<typeof FilterBar>["options"];
type FiltersProp = ComponentProps<typeof FilterBar>["filters"];
type ExtraSelectField = NonNullable<ComponentProps<typeof FilterBar>["extraSelectFields"]>[number];

interface SpiHistoryPoint {
  date: string;
  [key: `spi${number}`]: number | string;
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}:${month}:${year}`;
}

const spiLineColors = [
  "#38bdf8",
  "#f97316",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#a78bfa",
  "#06b6d4",
  "#e879f9",
  "#14b8a6",
  "#fb7185"
];

export function FindingsHistoryDrillthrough({
  points,
  status,
  spiCatalog,
  spiHistoryPoints,
  selectedAsOf,
  minDate,
  maxDate,
  filterOptions,
  filters,
  extraSelectFields,
  variant = "default"
}: {
  points: Array<{ date: string; openFindings: number }>;
  status: "open" | "closed";
  spiCatalog: number[];
  spiHistoryPoints: SpiHistoryPoint[];
  selectedAsOf: string;
  minDate: string;
  maxDate: string;
  filterOptions: FilterOptionsProp;
  filters: FiltersProp;
  extraSelectFields: ExtraSelectField[];
  variant?: "default" | "compact";
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const isPanelRequested = searchParams?.get("historyDrillthrough") === "1";
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  useEffect(() => {
    if (isPanelRequested) {
      setIsPanelVisible(true);
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => setIsPanelOpen(true));
      } else {
        setIsPanelOpen(true);
      }
      return;
    }

    setIsPanelOpen(false);
    if (typeof window === "undefined") {
      setIsPanelVisible(false);
      return;
    }
    const timeout = window.setTimeout(() => setIsPanelVisible(false), 220);
    return () => window.clearTimeout(timeout);
  }, [isPanelRequested]);

  const openPanel = () => {
    if (isPanelRequested) {
      return;
    }
    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    params.set("historyDrillthrough", "1");
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startRouteLoading({ href, message: "Opening SPI Trend Drill-Through..." });
    router.replace(href, { scroll: false });
  };

  const closePanel = () => {
    if (!isPanelRequested) {
      return;
    }
    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    params.delete("historyDrillthrough");
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startRouteLoading({ href, message: "Closing SPI Trend Drill-Through..." });
    router.replace(href, { scroll: false });
  };

  return (
    <>
      <FindingsHistoryLineChart
        points={points}
        status={status}
        variant={variant}
        titleAction={{ label: "Open SPI Trend Drill-Through", onClick: openPanel }}
      />

      {isPanelVisible ? (
        <div className="fixed inset-0 z-[140]">
          <div
            className={`absolute inset-0 bg-slate-950/92 backdrop-blur-[1px] transition-opacity duration-200 ${
              isPanelOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={closePanel}
          />
          <aside
            className={`absolute right-0 top-0 h-full w-full border-l border-sky-300/35 bg-slate-950 p-4 shadow-[-22px_0_42px_rgba(0,0,0,0.55)] transition-all duration-[260ms] ease-out ${
              isPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="findings-history-drillthrough-title"
          >
            <button
              type="button"
              onClick={closePanel}
              className="absolute right-4 top-4 rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-200/60 hover:text-sky-100"
            >
              Close
            </button>

            <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_auto_minmax(0,1fr)] gap-2">
              <section className="panel p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-300/75">Findings History Drill-Through</p>
                <h3 id="findings-history-drillthrough-title" className="mt-1 pr-16 text-2xl font-semibold text-slate-100">
                  Findings History (2 Years) by Security Posture Indicator
                </h3>
                <p className="mt-1 text-sm text-slate-300/80">
                  Trend lines for each SPI using the current findings context and filters.
                </p>
              </section>

              <FindingsStatusTabs activeTab={status} />
              <FindingsTimelineFilter selectedAsOf={selectedAsOf} minDate={minDate} maxDate={maxDate} />
              <FilterBar
                options={filterOptions}
                filters={filters}
                hiddenFields={["systemCriticality"]}
                extraSelectFields={extraSelectFields}
                enableLoadingOverlay
              />

              <section className="panel min-h-0 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h4 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">SPI Trend Lines</h4>
                    <p className="mt-1 text-xs text-slate-300/80">
                      {status === "closed" ? "Closed" : "Open"} findings per SPI over two years.
                    </p>
                  </div>
                  <p className="text-xs text-slate-300/80">
                    SPI Lines: {spiCatalog.length} | As Of: {formatDisplayDate(selectedAsOf)}
                  </p>
                </div>
                <div className="mt-3 h-[calc(100%-2.5rem)] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={spiHistoryPoints} margin={{ top: 4, right: 14, left: 6, bottom: 4 }}>
                      <CartesianGrid stroke="rgba(120,180,210,0.15)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#a2c2d4", fontSize: 10 }}
                        minTickGap={50}
                        tickFormatter={formatDisplayDate}
                      />
                      <YAxis allowDecimals={false} tick={{ fill: "#a2c2d4", fontSize: 11 }} width={36} />
                      <Tooltip
                        formatter={(value, name) => [value ?? 0, String(name).replace(/^spi/, "SPI ")]}
                        labelFormatter={(label: unknown) => `Date: ${formatDisplayDate(String(label ?? ""))}`}
                      />
                      <Legend />
                      {spiCatalog.map((spiId, index) => (
                        <Line
                          key={spiId}
                          type="monotone"
                          dataKey={`spi${spiId}`}
                          name={`SPI ${spiId}`}
                          stroke={spiLineColors[index % spiLineColors.length]}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
