"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ASSET_TYPES, assetTypeLabel } from "@/lib/asset-taxonomy";
import { AssetType, EnvironmentType, Filters } from "@/lib/types";

interface Option {
  id: string;
  label: string;
}

interface FilterOptions {
  networks: Option[];
  systems: Option[];
  systemCriticalities: Option[];
  securityDomains: Option[];
  missionCapabilities: Option[];
  businessServices: Option[];
}

interface ExtraSelectField {
  key: string;
  label: string;
  value?: string;
  options: Option[];
}

interface DropdownPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

type FilterField =
  | "managedNetwork"
  | "ictSystem"
  | "systemCriticality"
  | "securityDomain"
  | "environment"
  | "assetType";

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

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string | undefined;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);

  const selectedOption = useMemo(() => options.find((option) => option.id === value), [options, value]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [options, searchTerm]);

  useEffect(() => {
    if (!isOpen) {
      setDropdownPosition(null);
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    const updateDropdownPosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const viewportMargin = 12;
      const top = rect.bottom + 4;
      setDropdownPosition({
        left: Math.max(viewportMargin, Math.min(rect.left, window.innerWidth - rect.width - viewportMargin)),
        top,
        width: rect.width,
        maxHeight: Math.max(180, window.innerHeight - top - viewportMargin)
      });
    };

    updateDropdownPosition();
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && dropdownPosition) {
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [dropdownPosition, isOpen]);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setSearchTerm("");
    setIsOpen(false);
  };

  return (
    <div className="flex min-w-[160px] flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">{label}</span>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-md border border-sky-400/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="truncate">{selectedOption?.label ?? "All"}</span>
          <span className="ml-3 text-xs text-slate-300/70">{isOpen ? "▲" : "▼"}</span>
        </button>
      </div>
      {isOpen && dropdownPosition
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[10000] rounded-md border border-sky-400/20 bg-slate-950 p-2 shadow-2xl"
              style={{
                left: dropdownPosition.left,
                top: dropdownPosition.top,
                width: dropdownPosition.width
              }}
            >
              <input
                ref={searchInputRef}
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                className="w-full rounded-md border border-sky-400/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/60"
                aria-label={`Search ${label} options`}
              />
              <div
                className="mt-2 overflow-y-auto rounded-md border border-sky-400/20 bg-slate-950/40 p-1"
                style={{ maxHeight: Math.min(224, dropdownPosition.maxHeight) }}
              >
                <button
                  type="button"
                  onClick={() => selectValue("")}
                  className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                    !value ? "bg-sky-500/20 text-sky-200" : "text-slate-200 hover:bg-slate-800/80"
                  }`}
                >
                  All
                </button>
                {filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectValue(option.id)}
                    className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                      value === option.id ? "bg-sky-500/20 text-sky-200" : "text-slate-200 hover:bg-slate-800/80"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                {filteredOptions.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-slate-400">No matches</p>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function FilterBar({
  options,
  filters,
  hiddenFields = [],
  extraSelectFields = [],
  enableLoadingOverlay = false,
  actions,
  className = "panel no-print mt-4 flex flex-wrap gap-3 p-4"
}: {
  options: FilterOptions;
  filters: Filters;
  hiddenFields?: FilterField[];
  extraSelectFields?: ExtraSelectField[];
  enableLoadingOverlay?: boolean;
  actions?: ReactNode;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const hidden = useMemo(() => new Set(hiddenFields), [hiddenFields]);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const params = useMemo(() => new URLSearchParams((searchParams?.toString() ?? "")), [searchParams]);

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

  const updateParam = (key: string, value: string) => {
    const updated = new URLSearchParams(params.toString());
    if (!value) {
      updated.delete(key);
    } else {
      updated.set(key, value);
    }
    const nextQuery = updated.toString();

    if (!enableLoadingOverlay) {
      router.push(`${pathname}?${nextQuery}`, { scroll: false });
      return;
    }

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

  return (
    <>
      <div className={className}>
        {!hidden.has("managedNetwork") ? (
          <SelectField
            label="Network"
            value={filters.managedNetwork}
            options={options.networks}
            onChange={(value) => updateParam("network", value)}
          />
        ) : null}
        {!hidden.has("ictSystem") ? (
          <SelectField
            label="ICT System"
            value={filters.ictSystem}
            options={options.systems}
            onChange={(value) => updateParam("system", value)}
          />
        ) : null}
        {!hidden.has("systemCriticality") ? (
          <SelectField
            label="Criticality"
            value={filters.systemCriticality}
            options={options.systemCriticalities}
            onChange={(value) => updateParam("criticality", value)}
          />
        ) : null}
        {!hidden.has("securityDomain") ? (
          <SelectField
            label="Security Domain"
            value={filters.securityDomain}
            options={options.securityDomains}
            onChange={(value) => updateParam("securityDomain", value)}
          />
        ) : null}
        {!hidden.has("environment") ? (
          <SelectField
            label="Environment"
            value={filters.environment}
            options={(["Production", "Development", "UAT", "Test"] as EnvironmentType[]).map((type) => ({
              id: type,
              label: type
            }))}
            onChange={(value) => updateParam("environment", value)}
          />
        ) : null}
        {!hidden.has("assetType") ? (
          <SelectField
            label="Asset Type"
            value={filters.assetType}
            options={Array.from(ASSET_TYPES).map((type: AssetType) => ({
              id: type,
              label: assetTypeLabel(type)
            }))}
            onChange={(value) => updateParam("assetType", value)}
          />
        ) : null}
        {extraSelectFields.map((field) => (
          <SelectField
            key={field.key}
            label={field.label}
            value={field.value}
            options={field.options}
            onChange={(value) => updateParam(field.key, value)}
          />
        ))}
        {actions ? <div className="w-full sm:ml-auto sm:w-auto">{actions}</div> : null}
      </div>

      {isMounted && isLoading && enableLoadingOverlay
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
