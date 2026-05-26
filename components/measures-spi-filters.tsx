"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SpiDefinition } from "@/lib/spi-definitions";
import { type SpiId } from "@/lib/types";
import { startRouteLoading } from "@/lib/route-loading";

export function MeasuresSpiFilters({
  selectedSpiId,
  spiDefinitions,
  searchValue,
  placeholder,
  dynamicSearch = false,
  localSpiFilter = false,
  onSearchValueChange,
  onSelectedSpiIdChange
}: {
  selectedSpiId?: SpiId;
  spiDefinitions: SpiDefinition[];
  searchValue: string;
  placeholder: string;
  dynamicSearch?: boolean;
  localSpiFilter?: boolean;
  onSearchValueChange?: (value: string) => void;
  onSelectedSpiIdChange?: (value: SpiId | undefined) => void;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [draftSearch, setDraftSearch] = useState(searchValue);
  const selectedSpiDetails = selectedSpiId
    ? spiDefinitions.find((definition) => definition.spiId === selectedSpiId) ?? null
    : null;

  useEffect(() => {
    setDraftSearch(searchValue);
  }, [searchValue]);

  const startNavigation = (nextQuery: string) => {
    const href = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    startRouteLoading({ href, message: "Applying filters..." });
    router.replace(href, { scroll: false });
  };

  const onSpiChange = (value: string) => {
    if (localSpiFilter) {
      const numericValue = Number(value);
      onSelectedSpiIdChange?.(
        spiDefinitions.some((definition) => definition.spiId === numericValue) ? numericValue : undefined
      );
      return;
    }
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
            className="mt-1 block h-9 w-full rounded-md border border-sky-400/25 bg-slate-950/80 px-2 text-sm normal-case tracking-normal text-slate-100 outline-none transition focus:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="">All SPIs</option>
            {spiDefinitions.map((definition) => (
              <option key={definition.spiId} value={definition.spiId}>
                SPI {definition.spiId} - {definition.name}: {definition.description}
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
              className="mt-1 block h-9 w-full rounded-md border border-sky-400/25 bg-slate-950/80 px-3 text-sm normal-case tracking-normal text-slate-100 outline-none placeholder:text-slate-400/65 transition focus:border-sky-300/70 disabled:cursor-not-allowed disabled:opacity-70"
            />
            <span className="mt-1 block min-h-4 text-[11px] normal-case tracking-normal text-slate-300/65">
              {dynamicSearch ? "Filters rows as you type" : "Search applies to the SPI report index"}
            </span>
          </label>
          {!dynamicSearch ? (
            <button
              type="submit"
              className="mt-[1.25rem] h-9 rounded-md border border-sky-300/40 bg-sky-500/15 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-sky-100 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Search
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClearSearch}
            disabled={!draftSearch.trim()}
            className="mt-[1.25rem] h-9 rounded-md border border-slate-500/40 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-200 transition hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Clear
          </button>
        </form>
      </div>
    </>
  );
}
