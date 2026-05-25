"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SpiDefinition } from "@/lib/spi-definitions";

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

export function FindingsSpiTiles({
  spiCatalog,
  spiDefinitions = [],
  selectedSpi,
  selectedStatus,
  findingsBySpi
}: {
  spiCatalog: number[];
  spiDefinitions?: SpiDefinition[];
  selectedSpi?: number;
  selectedStatus: "open" | "closed";
  findingsBySpi: Record<number, number>;
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
  const spiDefinitionById = useMemo(
    () => new Map(spiDefinitions.map((definition) => [definition.spiId, definition])),
    [spiDefinitions]
  );

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

  const baseParams = useMemo(() => {
    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    params.delete("kpiFilter");
    params.delete("status");
    return params;
  }, [searchParams]);

  const applySpiFilter = (spiId: number, isActive: boolean) => {
    const params = new URLSearchParams(baseParams.toString());
    if (isActive) {
      params.delete("spi");
    } else {
      params.set("spi", String(spiId));
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

  return (
    <>
      <section className="panel p-4">
        <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Security Posture Indicators</h2>
        <p className="mt-1 text-xs text-slate-300/80">
          {selectedStatus === "closed" ? "Closed findings" : "Open findings"} by SPI. Select a tile to filter findings to
          that SPI.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {spiCatalog.map((spiId) => {
            const isActive = selectedSpi === spiId;

            return (
              <button
                key={spiId}
                type="button"
                onClick={() => applySpiFilter(spiId, isActive)}
                className={`panel-alt border border-sky-400/20 p-3 text-left transition hover:bg-slate-900/70 ${
                  isActive ? "ring-2 ring-sky-300/65" : ""
                }`}
              >
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">SPI {spiId}</p>
                <p className="mt-1 text-sm text-slate-100">
                  {spiDefinitionById.get(spiId)?.description ?? "Unmapped SPI"}
                </p>
                <p className="mt-3 text-2xl font-semibold text-sky-100">{findingsBySpi[spiId] ?? 0}</p>
                <p className="text-[11px] text-slate-300/75">
                  {selectedStatus === "closed" ? "Closed findings" : "Open findings"}
                </p>
              </button>
            );
          })}
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
                  <span>Applying SPI filter...</span>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
