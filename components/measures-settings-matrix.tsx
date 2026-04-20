"use client";

import { useMemo, useState } from "react";
import { ASSET_TYPE_LABELS } from "@/lib/asset-taxonomy";
import { SPI_DESCRIPTIONS } from "@/lib/constants";
import {
  MEASURES_ASSET_TYPES,
  MEASURES_SEVERITY_OPTIONS,
  MEASURES_SPI_IDS,
  MeasuresSettings,
  severityMatrixKey
} from "@/lib/measures-settings";
import { AssetType, FindingSeverity, SpiId } from "@/lib/types";

function matrixEqual(a: Record<string, FindingSeverity>, b: Record<string, FindingSeverity>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

export function MeasuresSettingsMatrix({ initialSettings }: { initialSettings: MeasuresSettings }) {
  const [savedSettings, setSavedSettings] = useState<MeasuresSettings>(initialSettings);
  const [draftMatrix, setDraftMatrix] = useState<Record<string, FindingSeverity>>(initialSettings.severityMatrix);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const isDirty = useMemo(
    () => !matrixEqual(draftMatrix, savedSettings.severityMatrix),
    [draftMatrix, savedSettings.severityMatrix]
  );

  const setSeverity = (spiId: SpiId, assetType: AssetType, severity: FindingSeverity) => {
    const key = severityMatrixKey(spiId, assetType);
    setDraftMatrix((current) => ({
      ...current,
      [key]: severity
    }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const onReset = () => {
    setDraftMatrix(savedSettings.severityMatrix);
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
          severityMatrix: draftMatrix
        })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to save settings.");
      }

      const payload = (await response.json()) as { settings: MeasuresSettings };
      setSavedSettings(payload.settings);
      setDraftMatrix(payload.settings.severityMatrix);
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
          <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">SPI Severity Matrix Settings</h2>
          <p className="mt-1 text-xs text-slate-300/80">
            Configure severity per SPI and asset type. Changes are applied globally to findings analytics and rollups.
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

      {saveError ? (
        <p className="mt-3 rounded-md border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">{saveError}</p>
      ) : null}
      {saveSuccess ? (
        <p className="mt-3 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {saveSuccess}
        </p>
      ) : null}

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
            {MEASURES_SPI_IDS.map((spiId) => (
              <tr key={spiId} className="border-t border-sky-400/10">
                <td className="px-3 py-2">
                  <p className="font-semibold text-slate-100">SPI {spiId}</p>
                  <p className="mt-1 text-xs text-slate-300/80">{SPI_DESCRIPTIONS[spiId]}</p>
                </td>
                {MEASURES_ASSET_TYPES.map((assetType) => {
                  const key = severityMatrixKey(spiId, assetType);
                  const selectedValue = draftMatrix[key] ?? "Moderate";

                  return (
                    <td key={key} className="px-3 py-2">
                      <select
                        value={selectedValue}
                        onChange={(event) => setSeverity(spiId, assetType, event.target.value as FindingSeverity)}
                        className="w-full min-w-[170px] rounded-md border border-sky-400/20 bg-slate-950/70 px-2 py-1.5 text-sm text-slate-100"
                      >
                        {MEASURES_SEVERITY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
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
    </section>
  );
}
