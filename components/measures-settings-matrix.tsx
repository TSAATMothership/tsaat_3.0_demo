"use client";

import { useMemo, useState } from "react";
import { ASSET_TYPE_LABELS } from "@/lib/asset-taxonomy";
import {
  MEASURES_ASSET_TYPES,
  MEASURES_PRIORITY_OPTIONS,
  MeasuresPriorityRank,
  MeasuresSettings,
  priorityMatrixKey,
  selectableSeverityDefinitions,
  severityMatrixKey
} from "@/lib/measures-settings";
import { SeverityDefinition, SpiDefinition } from "@/lib/spi-definitions";
import { AssetType, FindingSeverity, SpiId } from "@/lib/types";

type SettingsMatrixTab = "severity" | "priority";

function matrixEqual<T extends string | number>(a: Record<string, T>, b: Record<string, T>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

export function MeasuresSettingsMatrix({
  initialSettings,
  spiDefinitions,
  severityDefinitions
}: {
  initialSettings: MeasuresSettings;
  spiDefinitions: SpiDefinition[];
  severityDefinitions: SeverityDefinition[];
}) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsMatrixTab>("severity");
  const [savedSettings, setSavedSettings] = useState<MeasuresSettings>(initialSettings);
  const [draftMatrix, setDraftMatrix] = useState<Record<string, FindingSeverity>>(initialSettings.severityMatrix);
  const [draftPriorityMatrix, setDraftPriorityMatrix] = useState<Record<string, MeasuresPriorityRank>>(
    initialSettings.priorityMatrix
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const isSeverityDirty = useMemo(
    () => !matrixEqual(draftMatrix, savedSettings.severityMatrix),
    [draftMatrix, savedSettings.severityMatrix]
  );
  const isPriorityDirty = useMemo(
    () => !matrixEqual(draftPriorityMatrix, savedSettings.priorityMatrix),
    [draftPriorityMatrix, savedSettings.priorityMatrix]
  );
  const isDirty = isSeverityDirty || isPriorityDirty;
  const selectableSeverities = selectableSeverityDefinitions(severityDefinitions);

  const setSeverity = (spiId: SpiId, assetType: AssetType, severity: FindingSeverity) => {
    const key = severityMatrixKey(spiId, assetType);
    setDraftMatrix((current) => ({
      ...current,
      [key]: severity
    }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const setPriority = (spiId: SpiId, priorityRank: MeasuresPriorityRank) => {
    const key = priorityMatrixKey(spiId);
    setDraftPriorityMatrix((current) => ({
      ...current,
      [key]: priorityRank
    }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const onReset = () => {
    setDraftMatrix(savedSettings.severityMatrix);
    setDraftPriorityMatrix(savedSettings.priorityMatrix);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const onSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const response = await fetch("/api/measures/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          severityMatrix: draftMatrix,
          priorityMatrix: draftPriorityMatrix
        })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to save settings.");
      }

      const payload = (await response.json()) as { settings: MeasuresSettings };
      setSavedSettings(payload.settings);
      setDraftMatrix(payload.settings.severityMatrix);
      setDraftPriorityMatrix(payload.settings.priorityMatrix);
      setSaveSuccess(`Saved at ${new Date(payload.settings.updatedAt).toLocaleString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="panel flex h-full min-h-0 flex-col p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">SPI Settings</h2>
          <p className="mt-1 text-xs text-slate-300/80">
            Configure SPI severity and priority mappings. Changes are applied globally to findings analytics and rollups.
          </p>
          <p className="mt-1 text-xs text-slate-300/65">
            Last saved: {new Date(savedSettings.updatedAt).toLocaleString()}
          </p>
        </div>
        {isDirty ? (
          <div className="flex items-center gap-2">
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
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-sky-400/15 pb-3">
        {[
          { id: "severity" as const, label: "SPI Severity Matrix Settings" },
          { id: "priority" as const, label: "SPI Priority Matrix Settings" }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveSettingsTab(tab.id);
              setSaveError(null);
              setSaveSuccess(null);
            }}
            className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              activeSettingsTab === tab.id
                ? "border-sky-200/60 bg-sky-500/20 text-sky-100"
                : "border-sky-400/20 bg-slate-900/40 text-slate-200 hover:border-sky-300/45 hover:bg-slate-800/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {saveError ? (
        <p className="mt-3 rounded-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">{saveError}</p>
      ) : null}
      {saveSuccess ? (
        <p className="mt-3 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {saveSuccess}
        </p>
      ) : null}

      {activeSettingsTab === "severity" ? (
        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-400/15">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="w-[360px] min-w-[360px] px-3 py-2">SPI</th>
                {MEASURES_ASSET_TYPES.map((assetType) => (
                  <th key={assetType} className="px-3 py-2">
                    {ASSET_TYPE_LABELS[assetType]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spiDefinitions.map((definition) => (
                <tr key={definition.spiId} className="border-t border-sky-400/10">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-slate-100">SPI {definition.spiId}</p>
                    <p className="mt-1 text-xs text-slate-300/80">{definition.description}</p>
                  </td>
                  {MEASURES_ASSET_TYPES.map((assetType) => {
                    const key = severityMatrixKey(definition.spiId, assetType);
                    const selectedValue =
                      draftMatrix[key] === "Data Gap" ? "Moderate" : (draftMatrix[key] ?? "Moderate");

                    return (
                      <td key={key} className="px-3 py-2">
                        <select
                          value={selectedValue}
                          onChange={(event) => setSeverity(definition.spiId, assetType, event.target.value as FindingSeverity)}
                          className="w-full min-w-[170px] rounded-md border border-sky-400/20 bg-slate-950/70 px-2 py-1.5 text-sm text-slate-100"
                        >
                          {selectableSeverities.map((option) => (
                            <option key={option.severityKey} value={option.severityKey}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-400/15">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80">
              <tr>
                <th className="w-[520px] min-w-[520px] px-3 py-2">SPI</th>
                <th className="w-[220px] min-w-[220px] px-3 py-2">Priority</th>
                <th className="px-3 py-2">Priority State</th>
              </tr>
            </thead>
            <tbody>
              {spiDefinitions.map((definition) => {
                const key = priorityMatrixKey(definition.spiId);
                const selectedValue = draftPriorityMatrix[key] ?? 7;

                return (
                  <tr key={definition.spiId} className="border-t border-sky-400/10">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-100">SPI {definition.spiId}</p>
                      <p className="mt-1 text-xs text-slate-300/80">{definition.description}</p>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={selectedValue}
                        onChange={(event) => setPriority(definition.spiId, Number(event.target.value) as MeasuresPriorityRank)}
                        className="w-full min-w-[150px] rounded-md border border-sky-400/20 bg-slate-950/70 px-2 py-1.5 text-sm text-slate-100"
                      >
                        {MEASURES_PRIORITY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            P{option}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300/80">
                      Non-compliant SPI {definition.spiId} findings map to P{selectedValue}. Unknown/Data Gap findings remain P90.
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
