"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/lib/asset-taxonomy";
import type {
  DiscoveryToolAssetSetting,
  DiscoveryToolSetting,
  DiscoveryToolsSettings
} from "@/lib/discovery-tools-settings";
import { AssetType } from "@/lib/types";

const PANEL_ASSET_TYPES: AssetType[] = [...ASSET_TYPES];

function scopesEqual(
  a: Record<AssetType, DiscoveryToolAssetSetting>,
  b: Record<AssetType, DiscoveryToolAssetSetting>
): boolean {
  return PANEL_ASSET_TYPES.every((assetType) => a[assetType] === b[assetType]);
}

function cloneScope(
  scope: Record<AssetType, DiscoveryToolAssetSetting>
): Record<AssetType, DiscoveryToolAssetSetting> {
  return { ...scope };
}

function cloneTool(tool: DiscoveryToolSetting): DiscoveryToolSetting {
  return {
    ...tool,
    assetTypeScope: cloneScope(tool.assetTypeScope)
  };
}

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

export function buildDiscoveryToolsSavePayload(tools: DiscoveryToolSetting[]) {
  return {
    tools: tools.map((tool) => ({
      id: tool.id,
      assetTypeScope: cloneScope(tool.assetTypeScope)
    }))
  };
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
        setIsOpen(false);
        setSearchTerm("");
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
  };

  return (
    <div className="relative w-full max-w-[460px]" ref={containerRef}>
      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-300/75">Tool Name Filter</span>
      </label>
      <button
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
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [draftTools, setDraftTools] = useState(() => initialSettings.tools.map(cloneTool));
  const [toolNameFilter, setToolNameFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const filteredTools = useMemo(() => filterDiscoveryToolsByName(draftTools, toolNameFilter), [draftTools, toolNameFilter]);
  const toolNameFilterOptions = useMemo(() => settings.tools
    .map((tool) => ({ id: tool.id, label: tool.name }))
    .sort((left, right) => left.label.localeCompare(right.label)), [settings.tools]);
  const hasChanges = draftTools.some((tool, index) => !scopesEqual(tool.assetTypeScope, settings.tools[index].assetTypeScope));

  const updateScope = (toolId: string, assetType: AssetType, value: DiscoveryToolAssetSetting) => {
    setDraftTools((current) => current.map((tool) => tool.id === toolId
      ? { ...tool, assetTypeScope: { ...tool.assetTypeScope, [assetType]: value } }
      : tool));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const cancelChanges = () => {
    setDraftTools(settings.tools.map(cloneTool));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const saveChanges = async () => {
    if (isSaving || !hasChanges) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const response = await fetch("/api/discovery-tools/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDiscoveryToolsSavePayload(draftTools))
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Unable to save discovery tools settings. Please try again.");
      }
      const { settings: saved } = await response.json() as { settings: DiscoveryToolsSettings };
      setSettings(saved);
      setDraftTools(saved.tools.map(cloneTool));
      setSaveSuccess("Discovery tool mappings saved.");
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save discovery tools settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden p-4" aria-labelledby="discovery-settings-title" aria-busy={isSaving}>
      <div className="shrink-0">
        <h2 id="discovery-settings-title" className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-100">Discovery Tools Settings</h2>
        <p className="mt-2 text-sm text-slate-300">
          Choose Yes for each CI type a tool should cover. Choose No to exclude that CI type from the tool&apos;s coverage calculation.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Coverage is covered CIs divided by mapped CIs in the filtered data. Tools with no mapped CIs are hidden from the coverage table and radar chart.
        </p>
        <p className="mt-2 text-xs text-slate-400">Last saved: {formatDiscoveryToolsTimestamp(settings.updatedAt)} UTC</p>
      </div>
      {saveError && <p role="alert" className="mt-3 rounded-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">{saveError}</p>}
      {saveSuccess && <p role="status" className="mt-3 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{saveSuccess}</p>}
      <div className="my-3 shrink-0">
        <ToolNameFilterDropdown value={toolNameFilter} options={toolNameFilterOptions} onChange={setToolNameFilter} />
        <p className="mt-1 text-xs text-slate-400">Showing {filteredTools.length} of {draftTools.length} tools. Save applies all changes, including filtered tools.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-sky-400/20">
        <table className="w-full min-w-[1080px] text-sm">
          <caption className="sr-only">Discovery tools mapped to CI types</caption>
          <thead className="sticky top-0 z-10 bg-slate-900 text-xs uppercase tracking-wider text-slate-300">
            <tr>
              <th scope="col" className="sticky left-0 z-20 min-w-[190px] bg-slate-900 px-3 py-3 text-left">Tool / CI Type</th>
              {PANEL_ASSET_TYPES.map((assetType) => <th scope="col" key={assetType} className="min-w-[120px] px-3 py-3 text-center">{ASSET_TYPE_LABELS[assetType]}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredTools.map((tool) => <tr key={tool.id} className="border-t border-sky-400/15">
              <th scope="row" className="sticky left-0 bg-slate-950 px-3 py-3 text-left font-semibold text-slate-100" title={tool.description}>{tool.name}</th>
              {PANEL_ASSET_TYPES.map((assetType) => <td key={assetType} className="px-3 py-3 text-center">
                <select
                  aria-label={`${ASSET_TYPE_LABELS[assetType]} coverage for ${tool.name}`}
                  value={tool.assetTypeScope[assetType]}
                  onChange={(event) => updateScope(tool.id, assetType, event.target.value as DiscoveryToolAssetSetting)}
                  disabled={isSaving}
                  className={`w-full rounded-md border px-3 py-2 text-sm disabled:opacity-60 ${scopeStatusPresentation(tool.assetTypeScope[assetType]).className}`}
                >
                  <option value="required" className="bg-slate-950 text-slate-100">Yes</option>
                  <option value="na" className="bg-slate-950 text-slate-100">No</option>
                </select>
              </td>)}
            </tr>)}
            {!filteredTools.length && <tr><td colSpan={PANEL_ASSET_TYPES.length + 1} className="p-6 text-center text-slate-400">No tools match the current filter.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t border-sky-400/15 pt-3">
        <p className="text-xs text-slate-400" role="status">{hasChanges ? "Unsaved changes" : "All changes saved"}</p>
        <div className="flex gap-2">
          <button type="button" onClick={cancelChanges} disabled={isSaving || !hasChanges}
            className="rounded-md border border-slate-500/40 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/70 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
          <button type="button" onClick={saveChanges} disabled={isSaving || !hasChanges}
            className="rounded-md border border-sky-300/40 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </section>
  );
}
