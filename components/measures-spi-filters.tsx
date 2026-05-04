"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SPI_DESCRIPTIONS, SPI_IDS, SPI_NAMES } from "@/lib/spi-metadata";
import { type SpiId } from "@/lib/types";

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

export function MeasuresSpiFilters({
  selectedSpiId,
  searchValue,
  placeholder,
  dynamicSearch = false,
  onSearchValueChange
}: {
  selectedSpiId?: SpiId;
  searchValue: string;
  placeholder: string;
  dynamicSearch?: boolean;
  onSearchValueChange?: (value: string) => void;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [draftSearch, setDraftSearch] = useState(searchValue);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedSpiDetails = selectedSpiId
    ? {
        name: SPI_NAMES[selectedSpiId],
        description: SPI_DESCRIPTIONS[selectedSpiId]
      }
    : null;

  useEffect(() => {
    setDraftSearch(searchValue);
  }, [searchValue]);

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

  const startNavigation = (nextQuery: string) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }

    setIsLoading(true);
    setProgress(0);
    setPendingQuery(nextQuery);
    intervalRef.current = setInterval(() => {
      setProgress((current) => Math.min(96, nextProgressValue(current)));
    }, 85);
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const onSpiChange = (value: string) => {
    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    if (value) {
      params.set("spi", value);
    } else {
      params.delete("spi");
    }
    startNavigation(params.toString());
  };

  const onSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (dynamicSearch) {
      return;
    }
    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    const trimmedSearch = draftSearch.trim();
    if (trimmedSearch) {
      params.set("measureSearch", trimmedSearch);
    } else {
      params.delete("measureSearch");
    }
    startNavigation(params.toString());
  };

  const onSearchChange = (value: string) => {
    setDraftSearch(value);
    if (dynamicSearch) {
      onSearchValueChange?.(value);
    }
  };

  const onClearSearch = () => {
    setDraftSearch("");
    if (dynamicSearch) {
      onSearchValueChange?.("");
      return;
    }
    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    params.delete("measureSearch");
    startNavigation(params.toString());
  };

  return (
    <>
      <div className="panel no-print grid gap-2 px-3 py-2 md:grid-cols-[minmax(18rem,0.75fr)_minmax(22rem,1fr)] md:items-start">
        <label className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-300/80">
          SPI Filter
          <select
            value={selectedSpiId ? String(selectedSpiId) : ""}
            onChange={(event) => onSpiChange(event.target.value)}
            disabled={isLoading}
            className="mt-1 block h-9 w-full rounded-md border border-sky-400/25 bg-slate-950/80 px-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="">All SPIs</option>
            {SPI_IDS.map((spiId) => (
              <option key={spiId} value={spiId}>
                SPI {spiId} - {SPI_NAMES[spiId]}: {SPI_DESCRIPTIONS[spiId]}
              </option>
            ))}
          </select>
          <span className="mt-1 block min-h-4 truncate text-[11px] normal-case tracking-normal text-slate-300/75">
            {selectedSpiDetails
              ? `${selectedSpiDetails.name}: ${selectedSpiDetails.description}`
              : "All Security Posture Indicators"}
          </span>
        </label>

        <form
          onSubmit={onSearchSubmit}
          className={`grid min-w-0 gap-2 ${dynamicSearch ? "grid-cols-[minmax(0,1fr)_5rem]" : "grid-cols-[minmax(0,1fr)_5rem_5rem]"}`}
        >
          <label className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-300/80">
            Text Search
            <input
              type="search"
              value={draftSearch}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={placeholder}
              disabled={isLoading}
              className="mt-1 block h-9 w-full rounded-md border border-sky-400/25 bg-slate-950/80 px-3 text-sm normal-case tracking-normal text-slate-100 outline-none placeholder:text-slate-400/65 transition focus:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <span className="mt-1 block min-h-4 text-[11px] normal-case tracking-normal text-slate-300/65">
              {dynamicSearch ? "Filters rows as you type" : "Search applies to the SPI report index"}
            </span>
          </label>
          {!dynamicSearch ? (
            <button
              type="submit"
              disabled={isLoading}
              className="mt-[1.25rem] h-9 rounded-md border border-sky-300/40 bg-sky-500/15 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-100 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Search
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClearSearch}
            disabled={isLoading || !draftSearch.trim()}
            className="mt-[1.25rem] h-9 rounded-md border border-slate-500/40 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-200 transition hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear
          </button>
        </form>
      </div>

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
                  <span>Applying filters...</span>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
