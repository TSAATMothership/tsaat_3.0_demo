"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/lib/asset-taxonomy";
import type {
  DiscoveryToolAssetSetting,
  DiscoveryToolSetting,
  DiscoveryToolsSettings
} from "@/lib/discovery-tools-settings";
import { AssetType } from "@/lib/types";

const PANEL_ASSET_TYPES: AssetType[] = [...ASSET_TYPES];

function twoDigit(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDiscoveryToolsTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || "Not available";
  }

  return [
    `${twoDigit(parsed.getUTCDate())}/${twoDigit(parsed.getUTCMonth() + 1)}/${parsed.getUTCFullYear()}`,
    `${twoDigit(parsed.getUTCHours())}:${twoDigit(parsed.getUTCMinutes())}:${twoDigit(parsed.getUTCSeconds())}`
  ].join(", ");
}

export function filterDiscoveryToolsByName(tools: DiscoveryToolSetting[], selectedToolId: string): DiscoveryToolSetting[] {
  if (!selectedToolId) {
    return tools;
  }
  return tools.filter((tool) => tool.id === selectedToolId);
}

export function scopeStatusPresentation(setting: DiscoveryToolAssetSetting): {
  symbol: "✓" | "✕";
  label: "Yes" | "No";
  className: string;
} {
  if (setting === "required") {
    return {
      symbol: "✓",
      label: "Yes",
      className: "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
    };
  }
  return {
    symbol: "✕",
    label: "No",
    className: "border-red-400/45 bg-red-500/15 text-red-100"
  };
}

interface ToolNameFilterOption {
  id: string;
  label: string;
}

function ToolNameFilterDropdown({
  value,
  options,
  onChange
}: {
  value: string;
  options: ToolNameFilterOption[];
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedOption = useMemo(() => options.find((option) => option.id === value), [options, value]);
  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, searchTerm]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        setSearchTerm("");
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setSearchTerm("");
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="relative w-full max-w-[460px]" ref={containerRef}>
      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Tool Name Filter</span>
      </label>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="mt-1 flex w-full items-center justify-between rounded-md border border-sky-400/20 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedOption?.label ?? "All tools"}</span>
        <span className="ml-3 text-xs text-slate-300/70">{isOpen ? "^" : "v"}</span>
      </button>
      {isOpen ? (
        <div className="absolute z-[160] mt-1 w-[min(460px,calc(100vw-6rem))] rounded-md border border-sky-400/20 bg-slate-950 p-2 shadow-2xl">
          <input
            ref={searchInputRef}
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search tool names"
            className="w-full rounded-md border border-sky-400/20 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400/60"
            aria-label="Search tool names"
          />
          <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-sky-400/20 bg-slate-950/40 p-1">
            <button
              type="button"
              onClick={() => selectValue("")}
              className={`w-full rounded px-2 py-1.5 text-left text-sm ${
                !value ? "bg-sky-500/20 text-sky-200" : "text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              All tools
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
              <p className="px-2 py-1.5 text-sm text-slate-400">No matching tool names</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DiscoveryToolsSettingsPanel({ initialSettings }: { initialSettings: DiscoveryToolsSettings }) {
  const [toolNameFilter, setToolNameFilter] = useState("");
  const filteredTools = useMemo(() => filterDiscoveryToolsByName(initialSettings.tools, toolNameFilter), [initialSettings.tools, toolNameFilter]);
  const toolNameFilterOptions = useMemo(() => initialSettings.tools.map(tool => ({ id: tool.id, label: tool.name })).sort((left, right) => left.label.localeCompare(right.label)), [initialSettings.tools]);
  return <section className="panel flex h-full min-h-0 flex-col overflow-hidden p-4" aria-labelledby="discovery-settings-title">
    <div className="shrink-0">
      <h2 id="discovery-settings-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-100">Discovery Tools Settings</h2>
      <p className="mt-2 text-sm text-slate-300">Read-only saved coverage mappings. Yes means the tool is expected to cover that CI type; No excludes it from the tool&apos;s coverage calculation.</p>
      <p className="mt-1 text-xs text-slate-400">Coverage is covered CIs divided by mapped CIs in the filtered data. Tools with no mapped CIs are hidden from the coverage table and radar chart.</p>
      <p className="mt-2 text-xs text-slate-400">Last saved: {formatDiscoveryToolsTimestamp(initialSettings.updatedAt)} UTC</p>
    </div>
    <div className="my-3 shrink-0">
      <ToolNameFilterDropdown value={toolNameFilter} options={toolNameFilterOptions} onChange={setToolNameFilter} />
      <p className="mt-1 text-xs text-slate-400">Showing {filteredTools.length} of {initialSettings.tools.length} tools.</p>
    </div>
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-sky-400/20" role="region" aria-label="Discovery tool coverage mappings" tabIndex={0}>
      <table className="w-full min-w-[1080px] text-sm">
        <caption className="sr-only">Discovery tools mapped to CI types</caption>
        <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wider text-slate-300"><tr>
          <th scope="col" className="sticky left-0 z-20 min-w-[190px] bg-slate-900 px-3 py-3 text-left">Tool / CI Type</th>
          {PANEL_ASSET_TYPES.map(assetType => <th scope="col" key={assetType} className="min-w-[120px] px-3 py-3 text-center">{ASSET_TYPE_LABELS[assetType]}</th>)}
        </tr></thead>
        <tbody>{filteredTools.map(tool => <tr key={tool.id} className="border-t border-sky-400/15">
          <th scope="row" className="sticky left-0 bg-slate-950 px-3 py-3 text-left font-semibold text-slate-100" title={tool.description}>{tool.name}</th>
          {PANEL_ASSET_TYPES.map(assetType => {
            const status = scopeStatusPresentation(tool.assetTypeScope[assetType]);
            return <td key={assetType} className="px-3 py-3 text-center"><span aria-label={ASSET_TYPE_LABELS[assetType] + " coverage for " + tool.name + ": " + status.label} className={"inline-block rounded-md border px-3 py-2 " + status.className}>{status.label}</span></td>;
          })}
        </tr>)}
        {!filteredTools.length && <tr><td colSpan={PANEL_ASSET_TYPES.length + 1} className="p-6 text-center text-slate-400">{initialSettings.tools.length ? "No tools match the current filter." : "No discovery tools are configured."}</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
