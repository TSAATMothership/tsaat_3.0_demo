"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startRouteLoading } from "@/lib/route-loading";

function dateToEpochDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, (month ?? 1) - 1, day ?? 1) / 86400000);
}

function epochDayToDate(value: number): string {
  const date = new Date(value * 86400000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}:${month}:${year}`;
}

function clampDate(value: string, minDate: string, maxDate: string): string {
  if (value < minDate) {
    return minDate;
  }
  if (value > maxDate) {
    return maxDate;
  }
  return value;
}

export function FindingsTimelineFilter({
  selectedAsOf,
  minDate,
  maxDate,
  variant = "panel"
}: {
  selectedAsOf?: string;
  minDate: string;
  maxDate: string;
  variant?: "panel" | "embedded";
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const activeDate = useMemo(() => {
    if (selectedAsOf && /^\d{4}-\d{2}-\d{2}$/.test(selectedAsOf)) {
      return clampDate(selectedAsOf, minDate, maxDate);
    }
    return maxDate;
  }, [maxDate, minDate, selectedAsOf]);
  const minDay = dateToEpochDay(minDate);
  const maxDay = dateToEpochDay(maxDate);
  const [pendingDate, setPendingDate] = useState(activeDate);

  useEffect(() => {
    setPendingDate(activeDate);
  }, [activeDate]);

  const pendingDay = dateToEpochDay(pendingDate);
  const hasPendingChanges = pendingDate !== activeDate;

  const applyAsOf = () => {
    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    const nextAsOf = clampDate(pendingDate, minDate, maxDate);

    if (nextAsOf === maxDate) {
      params.delete("asOf");
    } else {
      params.set("asOf", nextAsOf);
    }
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startRouteLoading({ href, message: "Applying timeline..." });
    router.replace(href, { scroll: false });
  };

  const timelineControl = (
    <div className={variant === "embedded" ? "w-full" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Findings Timeline</p>
        <div className="flex min-h-[1.875rem] items-center gap-2">
          <p className="text-xs text-slate-300/80">As Of: {displayDate(hasPendingChanges ? pendingDate : activeDate)}</p>
          <button
            type="button"
            onClick={applyAsOf}
            disabled={!hasPendingChanges}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
              hasPendingChanges
                ? "border-sky-300/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25"
                : "pointer-events-none border-slate-600/25 bg-slate-900/20 text-slate-500 opacity-0"
            }`}
            aria-hidden={!hasPendingChanges}
            tabIndex={hasPendingChanges ? 0 : -1}
          >
            Apply
          </button>
        </div>
      </div>
      <div className="mt-3">
        <input
          type="range"
          min={minDay}
          max={maxDay}
          value={Math.min(maxDay, Math.max(minDay, pendingDay))}
          onChange={(event) => setPendingDate(epochDayToDate(Number(event.target.value)))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-sky-300"
          aria-label="Findings as-of timeline"
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300/70">
        <span>{displayDate(minDate)}</span>
        <span>{displayDate(maxDate)}</span>
      </div>
    </div>
  );

  return (
    <>
      {variant === "embedded" ? timelineControl : <section className="panel p-4">{timelineControl}</section>}
    </>
  );
}
