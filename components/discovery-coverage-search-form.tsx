"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startRouteLoading } from "@/lib/route-loading";

export function DiscoveryCoverageSearchForm({
  searchParamKey,
  searchValue,
  placeholder
}: {
  searchParamKey: "gapSearch" | "matrixSearch";
  searchValue: string;
  placeholder: string;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [draftValue, setDraftValue] = useState(searchValue);

  useEffect(() => {
    setDraftValue(searchValue);
  }, [searchValue]);

  const startNavigation = (nextQuery: string) => {
    const href = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    startRouteLoading({ href, message: "Applying filters..." });
    router.replace(href, { scroll: false });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    const trimmed = draftValue.trim();
    if (trimmed) {
      params.set(searchParamKey, trimmed);
    } else {
      params.delete(searchParamKey);
    }
    startNavigation(params.toString());
  };

  const onClear = () => {
    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    params.delete(searchParamKey);
    setDraftValue("");
    startNavigation(params.toString());
  };

  return (
    <>
      <form onSubmit={onSubmit} className="flex w-full max-w-xl flex-wrap gap-2">
        <input
          type="search"
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          placeholder={placeholder}
          className="min-w-[240px] flex-1 rounded-md border border-sky-400/30 bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-400/70 focus:border-sky-300/70"
        />
        <button
          type="submit"
          className="rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Search
        </button>
        {searchValue ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-slate-500/40 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Clear
          </button>
        ) : null}
      </form>

    </>
  );
}
