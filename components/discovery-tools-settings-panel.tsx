"use client";

import { useMemo, useState } from "react";
import { ASSET_TYPES, ASSET_TYPE_LABELS, createAssetTypeRecord } from "@/lib/asset-taxonomy";
import type {
  DiscoveryToolAssetSetting,
  DiscoveryToolSetting,
  DiscoveryToolsSettings
} from "@/lib/discovery-tools-settings";
import { AssetType } from "@/lib/types";

const PANEL_ASSET_TYPES: AssetType[] = [...ASSET_TYPES];

interface ToolValidationIssue {
  rowNumber: number;
  missingFields: string[];
}

function scopesEqual(
  a: Record<AssetType, DiscoveryToolAssetSetting>,
  b: Record<AssetType, DiscoveryToolAssetSetting>
): boolean {
  return PANEL_ASSET_TYPES.every((assetType) => a[assetType] === b[assetType]);
}

function toolsEqual(a: DiscoveryToolSetting[], b: DiscoveryToolSetting[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) {
      return false;
    }
    if (
      left.id !== right.id ||
      left.name !== right.name ||
      left.description !== right.description ||
      left.el2Owner !== right.el2Owner ||
      left.el2OperationsManager !== right.el2OperationsManager ||
      !scopesEqual(left.assetTypeScope, right.assetTypeScope)
    ) {
      return false;
    }
  }

  return true;
}

function createNewTool(seed: number): DiscoveryToolSetting {
  return {
    id: `tool-${seed}`,
    name: "",
    description: "",
    el2Owner: "",
    el2OperationsManager: "",
    assetTypeScope: createAssetTypeRecord(() => "required")
  };
}

function missingRequiredFields(tool: DiscoveryToolSetting): string[] {
  const missing: string[] = [];
  if (!tool.name.trim()) {
    missing.push("Tool Name");
  }
  if (!tool.description.trim()) {
    missing.push("Tool Description");
  }
  if (!tool.el2Owner.trim()) {
    missing.push("Tool EL2 Owner");
  }
  if (!tool.el2OperationsManager.trim()) {
    missing.push("Tool EL2 Operations Manager");
  }
  return missing;
}

function requiredFieldClass(value: string): string {
  return value.trim() ? "border-sky-400/20" : "border-red-400/60";
}

export function DiscoveryToolsSettingsPanel({ initialSettings }: { initialSettings: DiscoveryToolsSettings }) {
  const [savedSettings, setSavedSettings] = useState<DiscoveryToolsSettings>(initialSettings);
  const [draftTools, setDraftTools] = useState<DiscoveryToolSetting[]>(initialSettings.tools);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const isDirty = useMemo(() => !toolsEqual(draftTools, savedSettings.tools), [draftTools, savedSettings.tools]);
  const validationIssues = useMemo<ToolValidationIssue[]>(
    () =>
      draftTools
        .map((tool, index) => ({
          rowNumber: index + 1,
          missingFields: missingRequiredFields(tool)
        }))
        .filter((issue) => issue.missingFields.length > 0),
    [draftTools]
  );
  const hasValidationErrors = validationIssues.length > 0;
  const validationMessage = useMemo(() => {
    if (!hasValidationErrors) {
      return null;
    }
    return validationIssues.map((issue) => `Row ${issue.rowNumber}: ${issue.missingFields.join(", ")}`).join(" | ");
  }, [hasValidationErrors, validationIssues]);

  const updateTool = (index: number, updater: (current: DiscoveryToolSetting) => DiscoveryToolSetting) => {
    setDraftTools((current) => current.map((tool, toolIndex) => (toolIndex === index ? updater(tool) : tool)));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const addTool = () => {
    setDraftTools((current) => [...current, createNewTool(Date.now())]);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const removeTool = (index: number) => {
    setDraftTools((current) => current.filter((_, toolIndex) => toolIndex !== index));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const onReset = () => {
    setDraftTools(savedSettings.tools);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const onSave = async () => {
    if (hasValidationErrors) {
      setSaveError(`Cannot save empty discovery tool records. ${validationMessage ?? ""}`.trim());
      setSaveSuccess(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const response = await fetch("/api/discovery-tools/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: draftTools })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to save discovery tools settings.");
      }

      const payload = (await response.json()) as { settings: DiscoveryToolsSettings };
      setSavedSettings(payload.settings);
      setDraftTools(payload.settings.tools);
      setSaveSuccess(`Saved at ${new Date(payload.settings.updatedAt).toLocaleString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save discovery tools settings.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel flex h-full min-h-0 flex-col p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">Discovery Tools Setting</h2>
          <p className="mt-1 text-xs text-slate-300/80">
            Manage discovery tools and map required asset types. `N/A` excludes that asset type from coverage checks.
          </p>
          <p className="mt-1 text-xs text-slate-300/65">
            Last saved: {new Date(savedSettings.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addTool}
            className="rounded-md border border-cyan-300/45 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
          >
            Add Tool
          </button>
          {isDirty ? (
            <>
              <button
                type="button"
                onClick={onReset}
                className="rounded-md border border-slate-500/40 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800/70"
                disabled={isSaving}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onSave}
                className="rounded-md border border-sky-300/40 bg-sky-500/15 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving || hasValidationErrors}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {saveError ? (
        <p className="mt-3 rounded-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">{saveError}</p>
      ) : null}
      {!saveError && validationMessage ? (
        <p className="mt-3 rounded-md border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Complete required fields before saving. {validationMessage}
        </p>
      ) : null}
      {saveSuccess ? (
        <p className="mt-3 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {saveSuccess}
        </p>
      ) : null}

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-sky-400/15">
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
            <tr>
              <th className="w-[14%] whitespace-normal px-3 py-2 leading-tight">Tool Name</th>
              <th className="w-[22%] whitespace-normal px-3 py-2 leading-tight">Tool Description</th>
              <th className="w-[14%] whitespace-normal px-3 py-2 leading-tight">Tool EL2 Owner</th>
              <th className="w-[16%] whitespace-normal px-3 py-2 leading-tight">Tool EL2 Operations Manager</th>
              {PANEL_ASSET_TYPES.map((assetType) => (
                <th key={`asset-type-header-${assetType}`} className="min-w-[140px] whitespace-normal px-3 py-2 leading-tight">
                  {ASSET_TYPE_LABELS[assetType]}
                </th>
              ))}
              <th className="min-w-[96px] whitespace-normal px-3 py-2 leading-tight">Action</th>
            </tr>
          </thead>
          <tbody>
            {draftTools.map((tool, index) => (
              <tr key={`${tool.id}:${index}`} className="border-t border-sky-400/10">
                <td className="px-3 py-2">
                  <input
                    value={tool.name}
                    onChange={(event) =>
                      updateTool(index, (current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                    placeholder="Tool Name"
                    className={`min-w-0 w-full rounded-md border bg-slate-950/70 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-400/70 ${requiredFieldClass(tool.name)}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={tool.description}
                    onChange={(event) =>
                      updateTool(index, (current) => ({
                        ...current,
                        description: event.target.value
                      }))
                    }
                    placeholder="Tool Description"
                    className={`min-w-0 w-full rounded-md border bg-slate-950/70 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-400/70 ${requiredFieldClass(tool.description)}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={tool.el2Owner}
                    onChange={(event) =>
                      updateTool(index, (current) => ({
                        ...current,
                        el2Owner: event.target.value
                      }))
                    }
                    placeholder="EL2 Owner"
                    className={`min-w-0 w-full rounded-md border bg-slate-950/70 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-400/70 ${requiredFieldClass(tool.el2Owner)}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={tool.el2OperationsManager}
                    onChange={(event) =>
                      updateTool(index, (current) => ({
                        ...current,
                        el2OperationsManager: event.target.value
                      }))
                    }
                    placeholder="EL2 Operations Manager"
                    className={`min-w-0 w-full rounded-md border bg-slate-950/70 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-400/70 ${requiredFieldClass(tool.el2OperationsManager)}`}
                  />
                </td>
                {PANEL_ASSET_TYPES.map((assetType) => (
                  <td key={`${tool.id}:${assetType}`} className="px-3 py-2">
                    <select
                      value={tool.assetTypeScope[assetType]}
                      onChange={(event) =>
                        updateTool(index, (current) => ({
                          ...current,
                          assetTypeScope: {
                            ...current.assetTypeScope,
                            [assetType]: event.target.value as DiscoveryToolAssetSetting
                          }
                        }))
                      }
                      className="min-w-0 w-full rounded-md border border-sky-400/20 bg-slate-950/70 px-2 py-1.5 text-sm text-slate-100"
                      aria-label={`${ASSET_TYPE_LABELS[assetType]} mapping for ${tool.name || "tool"}`}
                    >
                      <option value="required">Required</option>
                      <option value="na">N/A</option>
                    </select>
                  </td>
                ))}
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeTool(index)}
                    className="w-full rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {draftTools.length === 0 ? (
              <tr>
                <td colSpan={PANEL_ASSET_TYPES.length + 5} className="px-3 py-6 text-center text-sm text-slate-300/80">
                  No tools configured. Add at least one discovery tool.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
