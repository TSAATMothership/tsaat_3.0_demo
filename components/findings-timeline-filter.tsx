"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

function normalizeQuery(query: string): string {
  const params = new URLSearchParams(query);
  return Array.from(params.entries())
    .sort(([aKey, aValue], [bKey, bValue]) => {
      if (aKey === bKey) {
        return aValue.localeCompare(bValue);
      }
      return aKey.localeCompare(bKey);
    })
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
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
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    };
  }, []);

  useEffect(() => {
    if (!isLoading || pendingQuery === null) {
      return;
    }

    if (normalizeQuery((searchParams?.toString() ?? "")) !== normalizeQuery(pendingQuery)) {
      return;
    }

    setProgress(100);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setPendingQuery(null);
      setProgress(0);
    }, 140);
  }, [isLoading, pendingQuery, searchParams]);

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

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }

    setIsLoading(true);
    setProgress(0);
    setPendingQuery(query);
    intervalRef.current = setInterval(() => {
      setProgress((current) => Math.min(96, nextProgressValue(current)));
    }, 85);

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
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
            disabled={!hasPendingChanges || isLoading}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
              hasPendingChanges
                ? "border-sky-300/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25"
                : "pointer-events-none border-slate-600/25 bg-slate-900/20 text-slate-500 opacity-0"
            }`}
            aria-hidden={!hasPendingChanges}
            tabIndex={hasPendingChanges ? 0 : -1}
          >
            {isLoading ? "Applying..." : "Apply"}
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
                  <span>Applying timeline...</span>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
