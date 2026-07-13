"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SpiDefinition } from "@/lib/spi-definitions";
import { startRouteLoading } from "@/lib/route-loading";

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
  const spiDefinitionById = useMemo(
    () => new Map(spiDefinitions.map((definition) => [definition.spiId, definition])),
    [spiDefinitions]
  );

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
    const href = query ? `${pathname}?${query}` : pathname;
    startRouteLoading({ href, message: "Applying SPI filter..." });
    router.replace(href, { scroll: false });
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
    </>
  );
}
