"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { NetworkP12TrendSeries } from "@/lib/trends";

const palette = ["#46c0de", "#ff5a40", "#f2ae2e", "#9ad77b", "#a78bfa", "#fb7185"];

export function NetworkP12TrendCharts({
  series,
  lookbackWeeks = 12
}: {
  series: NetworkP12TrendSeries[];
  lookbackWeeks?: number;
}) {
  const displayedWeeks = series[0]?.points.length ?? 0;

  return (
    <section className="panel p-4">
      <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">
        P1-P2 Findings Trend by Network
      </h2>
      <p className="mt-2 text-xs text-slate-300/75">
        Showing {displayedWeeks} of {lookbackWeeks} week(s) from available snapshots.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {series.map((networkSeries, index) => {
          const color = palette[index % palette.length];
          const delta = networkSeries.deltaFromPrevious;
          return (
            <div key={networkSeries.networkId} className="panel-alt p-3">
              <p className="text-sm font-semibold text-slate-100">{networkSeries.networkName}</p>
              <p className="mt-1 text-xs text-slate-300/75">
                Latest P1-P2 Findings: {networkSeries.latestCount}
                <span className={delta > 0 ? "text-red-300" : "text-emerald-200"}>
                  {" "}
                  ({delta > 0 ? `+${delta}` : delta} vs previous)
                </span>
              </p>
              <div className="mt-2 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={networkSeries.points}>
                    <CartesianGrid stroke="rgba(120,180,210,0.12)" />
                    <XAxis dataKey="weekLabel" tick={{ fill: "#a2c2d4", fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "#a2c2d4", fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
