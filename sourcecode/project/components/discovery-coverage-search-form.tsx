"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const pathname = usePathname();
  const router = useRouter();
  const [draftValue, setDraftValue] = useState(searchValue);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraftValue(searchValue);
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

    if (normalizeQuery(searchParams.toString()) !== normalizeQuery(pendingQuery)) {
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

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = draftValue.trim();
    if (trimmed) {
      params.set(searchParamKey, trimmed);
    } else {
      params.delete(searchParamKey);
    }
    startNavigation(params.toString());
  };

  const onClear = () => {
    const params = new URLSearchParams(searchParams.toString());
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
          disabled={isLoading}
          className="rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Search
        </button>
        {searchValue ? (
          <button
            type="button"
            onClick={onClear}
            disabled={isLoading}
            className="rounded-md border border-slate-500/40 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Clear
          </button>
        ) : null}
      </form>

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
