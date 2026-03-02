"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CoverageByToolRadar } from "@/components/coverage-by-tool-radar";

interface CoverageToolStat {
  label: string;
  covered: number;
  missing: number;
  coveragePercent: number;
}

export function DiscoveryCoverageByToolSection({ toolStats }: { toolStats: CoverageToolStat[] }) {
  const [isLoading, setIsLoading] = useState(true);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signature = useMemo(
    () => toolStats.map((tool) => `${tool.label}:${tool.covered}:${tool.missing}:${tool.coveragePercent}`).join("|"),
    [toolStats]
  );

  useEffect(() => {
    setIsLoading(true);

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }

    // Keep this short to avoid UI flicker while still showing feedback when chart rendering lags.
    closeTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      closeTimeoutRef.current = null;
    }, 220);

    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [signature]);

  return (
    <section className="panel relative overflow-hidden">
      <h2 className="border-b border-sky-400/15 px-4 py-3 text-sm uppercase tracking-[0.14em] text-slate-200/85">
        Coverage By Tool
      </h2>
      <div className="grid gap-4 p-4 xl:grid-cols-2">
        <div className="overflow-auto">
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
                <tr key={tool.label} className="border-t border-sky-400/10">
                  <td className="px-3 py-2 text-slate-100">{tool.label}</td>
                  <td className="px-3 py-2 text-emerald-200">{tool.covered}</td>
                  <td className="px-3 py-2 text-red-200">{tool.missing}</td>
                  <td className="px-3 py-2 text-slate-200">{tool.coveragePercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CoverageByToolRadar
          data={toolStats.map((tool) => ({
            label: tool.label,
            coveragePercent: tool.coveragePercent
          }))}
        />
      </div>

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
