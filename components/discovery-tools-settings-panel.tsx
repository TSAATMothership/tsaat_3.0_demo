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
const PANEL_TWEEN_MS = 240;

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

function toolMetadataRows(tool: DiscoveryToolSetting | null): Array<{ label: string; value: string }> {
  if (!tool) {
    return [];
  }
  return [
    { label: "Tool ID", value: tool.id },
    { label: "Description", value: tool.description || "Not provided" },
    { label: "EL2 Owner", value: tool.el2Owner || "Not provided" },
    { label: "EL2 Operations Manager", value: tool.el2OperationsManager || "Not provided" }
  ];
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
  label: "Required" | "N/A";
  className: string;
} {
  if (setting === "required") {
    return {
      symbol: "✓",
      label: "Required",
      className: "border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
    };
  }
  return {
    symbol: "✕",
    label: "N/A",
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
    <div className="relative max-w-[460px]" ref={containerRef}>
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
  const [settings, setSettings] = useState<DiscoveryToolsSettings>(initialSettings);
  const [toolNameFilter, setToolNameFilter] = useState("");
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<DiscoveryToolSetting | null>(null);
  const [isSlideoutOpen, setIsSlideoutOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const closePanelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedToolFromSettings = useMemo(
    () => (selectedToolId ? settings.tools.find((tool) => tool.id === selectedToolId) ?? null : null),
    [selectedToolId, settings.tools]
  );
  const filteredTools = useMemo(() => {
    return filterDiscoveryToolsByName(settings.tools, toolNameFilter);
  }, [settings.tools, toolNameFilter]);
  const toolNameFilterOptions = useMemo(
    () =>
      settings.tools
        .map((tool) => ({ id: tool.id, label: tool.name }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [settings.tools]
  );
  const hasEditorChanges = useMemo(() => {
    if (!editorDraft || !selectedToolFromSettings) {
      return false;
    }
    return !scopesEqual(editorDraft.assetTypeScope, selectedToolFromSettings.assetTypeScope);
  }, [editorDraft, selectedToolFromSettings]);

  useEffect(() => {
    if (toolNameFilter && !settings.tools.some((tool) => tool.id === toolNameFilter)) {
      setToolNameFilter("");
    }
  }, [settings.tools, toolNameFilter]);

  useEffect(() => {
    return () => {
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
      }
    };
  }, []);

  const closeEditor = () => {
    setIsSlideoutOpen(false);
    if (closePanelTimeoutRef.current) {
      clearTimeout(closePanelTimeoutRef.current);
    }
    closePanelTimeoutRef.current = setTimeout(() => {
      setSelectedToolId(null);
      setEditorDraft(null);
      closePanelTimeoutRef.current = null;
    }, PANEL_TWEEN_MS);
  };

  const openEditor = (tool: DiscoveryToolSetting) => {
    if (closePanelTimeoutRef.current) {
      clearTimeout(closePanelTimeoutRef.current);
      closePanelTimeoutRef.current = null;
    }
    setSelectedToolId(tool.id);
    setEditorDraft(cloneTool(tool));
    setIsSlideoutOpen(true);
    setSaveError(null);
  };

  const updateEditorScope = (assetType: AssetType, scopeSetting: DiscoveryToolAssetSetting) => {
    setEditorDraft((current) =>
      current
        ? {
            ...current,
            assetTypeScope: {
              ...current.assetTypeScope,
              [assetType]: scopeSetting
            }
          }
        : current
    );
    setSaveSuccess(null);
    setSaveError(null);
  };

  const onResetEditor = () => {
    if (!selectedToolFromSettings) {
      return;
    }
    setEditorDraft(cloneTool(selectedToolFromSettings));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const onSaveEditor = async () => {
    if (!editorDraft) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const nextTools = settings.tools.map((tool) =>
        tool.id === editorDraft.id
          ? {
              ...tool,
              assetTypeScope: cloneScope(editorDraft.assetTypeScope)
            }
          : tool
      );

      const saveResponse = await fetch("/api/discovery-tools/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDiscoveryToolsSavePayload(nextTools))
      });

      if (!saveResponse.ok) {
        const message = await saveResponse.text();
        throw new Error(message || "Failed to save discovery tools settings.");
      }
      const savePayload = (await saveResponse.json()) as { settings: DiscoveryToolsSettings };
      let refreshedSettings = savePayload.settings;

      const refreshResponse = await fetch("/api/discovery-tools/settings", {
        method: "GET",
        cache: "no-store"
      });
      if (refreshResponse.ok) {
        const refreshPayload = (await refreshResponse.json()) as { settings: DiscoveryToolsSettings };
        refreshedSettings = refreshPayload.settings;
      }

      setSettings(refreshedSettings);
      setSaveSuccess(`Saved at ${new Date(refreshedSettings.updatedAt).toLocaleString()}`);
      closeEditor();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save discovery tools settings.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel relative flex h-full min-h-0 flex-col p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Discovery Tools Setting</h2>
          <p className="mt-1 text-xs text-slate-300/80">
            Discovery tools are database-driven. Select a tool to edit its asset-type scope in a slideout panel.
          </p>
          <p className="mt-1 text-xs text-slate-300/65">
            Last saved: {new Date(settings.updatedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {saveError ? (
        <p className="mt-3 rounded-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {saveError}
        </p>
      ) : null}
      {saveSuccess ? (
        <p className="mt-3 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {saveSuccess}
        </p>
      ) : null}

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        <section className="panel-alt mb-3 border border-sky-400/20 p-3">
          <ToolNameFilterDropdown
            value={toolNameFilter}
            options={toolNameFilterOptions}
            onChange={setToolNameFilter}
          />
          <p className="mt-1 text-xs text-slate-300/65">
            Showing {filteredTools.length} of {settings.tools.length} tools
          </p>
        </section>

        <div className="min-h-0 overflow-auto rounded-lg border border-sky-400/20">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-sm">
              <thead className="sticky top-0 z-[2] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
                <tr>
                  <th className="sticky left-0 z-[3] w-[220px] border-b border-sky-400/15 bg-slate-900/95 px-3 py-2">
                    Tool Name
                  </th>
                  <th className="sticky left-[220px] z-[3] w-[340px] border-b border-sky-400/15 bg-slate-900/95 px-3 py-2">
                    Description
                  </th>
                  <th className="sticky left-[560px] z-[3] w-[220px] border-b border-sky-400/15 bg-slate-900/95 px-3 py-2">
                    EL2 Owner
                  </th>
                  <th className="sticky left-[780px] z-[3] w-[230px] border-b border-sky-400/15 bg-slate-900/95 px-3 py-2">
                    EL2 Operations Manager
                  </th>
                  {PANEL_ASSET_TYPES.map((assetType) => (
                    <th key={`status-header-${assetType}`} className="w-[140px] border-b border-sky-400/15 px-3 py-2 text-center">
                      {ASSET_TYPE_LABELS[assetType]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTools.map((tool) => (
                  <tr key={tool.id} className="border-b border-sky-400/10">
                    <td className="sticky left-0 z-[1] w-[220px] bg-slate-950 px-3 py-2 text-slate-100">
                      <button
                        type="button"
                        onClick={() => openEditor(tool)}
                        className="text-left text-sky-100 underline decoration-sky-300/60 underline-offset-2 hover:text-cyan-100 hover:decoration-cyan-300/80"
                      >
                        {tool.name}
                      </button>
                    </td>
                    <td className="sticky left-[220px] z-[1] w-[340px] bg-slate-950 px-3 py-2 text-slate-300">
                      {tool.description || "Not provided"}
                    </td>
                    <td className="sticky left-[560px] z-[1] w-[220px] bg-slate-950 px-3 py-2 text-slate-300">
                      {tool.el2Owner || "Not provided"}
                    </td>
                    <td className="sticky left-[780px] z-[1] w-[230px] bg-slate-950 px-3 py-2 text-slate-300">
                      {tool.el2OperationsManager || "Not provided"}
                    </td>
                    {PANEL_ASSET_TYPES.map((assetType) => {
                      const status = scopeStatusPresentation(tool.assetTypeScope[assetType]);
                      return (
                        <td key={`${tool.id}:${assetType}`} className="w-[140px] px-3 py-2 text-center">
                          <span className={`inline-flex min-w-[38px] items-center justify-center rounded-md border px-2 py-1 text-sm font-semibold ${status.className}`}>
                            {status.symbol}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {settings.tools.length === 0 ? (
            <section className="p-4 text-sm text-slate-300/85">
              No discovery tools are configured in the current settings version.
            </section>
          ) : filteredTools.length === 0 ? (
            <section className="p-4 text-sm text-slate-300/85">
              No tools match the current filter.
            </section>
          ) : null}
        </div>
      </div>

      {selectedToolId && editorDraft ? (
        <div className="absolute inset-0 z-20 overflow-hidden">
          <div
            className={`absolute inset-0 bg-slate-950/75 transition-opacity duration-200 ${
              isSlideoutOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeEditor}
          />
          <aside
            className={`absolute right-0 top-0 h-full w-full max-w-[640px] border-l border-sky-300/35 bg-slate-950 p-4 shadow-[-16px_0_40px_rgba(0,0,0,0.55)] transition-all duration-[240ms] ease-out ${
              isSlideoutOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
            }`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discovery-tool-editor-title"
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-300/70">Discovery Tools Setting</p>
                  <h3 id="discovery-tool-editor-title" className="mt-1 text-xl font-semibold text-slate-100">
                    {editorDraft.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-300/75">Edit asset-type scope and save this tool.</p>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-md border border-sky-300/35 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 hover:border-sky-200/70 hover:text-sky-100"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {toolMetadataRows(selectedToolFromSettings).map((item) => (
                  <div key={`${selectedToolId}:${item.label}`} className="rounded-md border border-sky-400/15 bg-slate-950/45 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-100">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="rounded-lg border border-sky-400/15 p-3">
                  <h4 className="text-xs uppercase tracking-[0.14em] text-slate-200/85">Asset Type Scope</h4>
                  <p className="mt-1 text-xs text-slate-300/75">
                    Set each asset type to `Required` or `N/A` for this tool.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {PANEL_ASSET_TYPES.map((assetType) => (
                      <label
                        key={`${editorDraft.id}:${assetType}`}
                        className="rounded-md border border-sky-400/15 bg-slate-950/55 px-3 py-2"
                      >
                        <span className="text-[11px] uppercase tracking-[0.14em] text-slate-300/70">
                          {ASSET_TYPE_LABELS[assetType]}
                        </span>
                        <select
                          value={editorDraft.assetTypeScope[assetType]}
                          onChange={(event) =>
                            updateEditorScope(assetType, event.target.value as DiscoveryToolAssetSetting)
                          }
                          className="mt-1 w-full rounded-md border border-sky-400/20 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100"
                          aria-label={`${ASSET_TYPE_LABELS[assetType]} scope for ${editorDraft.name}`}
                        >
                          <option value="required">Required</option>
                          <option value="na">N/A</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2 border-t border-sky-400/15 pt-3">
                <button
                  type="button"
                  onClick={onResetEditor}
                  className="rounded-md border border-slate-500/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800/70 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving || !hasEditorChanges}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={onSaveEditor}
                  className="rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSaving || !hasEditorChanges}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
