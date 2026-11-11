"use client";

import { ASSET_TYPE_LABELS } from "@/lib/asset-taxonomy";
import { MEASURES_ASSET_TYPES, type FindingPriorityDefinition, type MeasuresSettings, priorityMatrixKey, severityMatrixKey } from "@/lib/measures-settings";
import type { SeverityDefinition, SpiDefinition } from "@/lib/spi-definitions";

const matrixTabs = [
  { id: "spi-risk-matrix", matrix: "severity", label: "SPI Risk Matrix" },
  { id: "spi-priority-matrix", matrix: "priority", label: "SPI Priority Matrix" }
] as const;

export function MeasuresSettingsMatrix({ activeMatrix, initialSettings, spiDefinitions, severityDefinitions, priorityDefinitions }: {
  activeMatrix: "severity" | "priority" | null;
  initialSettings: MeasuresSettings;
  spiDefinitions: Pick<SpiDefinition, "spiId" | "description">[];
  severityDefinitions: SeverityDefinition[];
  priorityDefinitions: FindingPriorityDefinition[];
}) {
  return <>{matrixTabs.map(tab => <div key={tab.id} role="tabpanel" id={`settings-panel-${tab.id}`} aria-labelledby={`settings-tab-${tab.id}`} hidden={activeMatrix !== tab.matrix} className="h-full min-h-[360px]">
    <section className="panel flex h-full min-h-0 flex-col p-4">
      <h2 className="text-sm uppercase tracking-[0.14em] text-slate-200/85">{tab.label}</h2>
      <p className="mt-1 text-xs text-slate-300/80">Read-only saved mappings used by findings analytics and rollups.</p>
      <p className="mt-1 text-xs text-slate-300/65">Last saved: {new Date(initialSettings.updatedAt).toLocaleString()}</p>
      <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-sky-400/15" role="region" aria-label={`${tab.label} table`} tabIndex={0}>
        <table className="min-w-full text-sm">
          <caption className="sr-only">{tab.label} saved configuration</caption>
          <thead className="sticky top-0 z-[1] bg-slate-900/95 text-left text-xs uppercase tracking-[0.12em] text-slate-300/80"><tr>
            <th scope="col" className="min-w-[280px] px-3 py-2">SPI</th>
            {tab.matrix === "severity" ? MEASURES_ASSET_TYPES.map(assetType => <th scope="col" key={assetType} className="px-3 py-2">{ASSET_TYPE_LABELS[assetType]}</th>) : <><th scope="col" className="px-3 py-2">Priority</th><th scope="col" className="px-3 py-2">Priority State</th></>}
          </tr></thead>
          <tbody>{spiDefinitions.map(definition => {
            const rank = initialSettings.priorityMatrix[priorityMatrixKey(definition.spiId)];
            return <tr key={definition.spiId} className="border-t border-sky-400/10">
              <th scope="row" className="px-3 py-2 text-left font-normal"><p className="font-semibold text-slate-100">SPI {definition.spiId}</p><p className="mt-1 text-xs text-slate-300/80">{definition.description}</p></th>
              {tab.matrix === "severity" ? MEASURES_ASSET_TYPES.map(assetType => {
                const value = initialSettings.severityMatrix[severityMatrixKey(definition.spiId, assetType)];
                const label = severityDefinitions.find(option => option.severityKey === value)?.label ?? value ?? "Not configured";
                return <td key={assetType} className="min-w-[170px] px-3 py-2" data-spi-risk={`${definition.spiId}:${assetType}`}>{label}</td>;
              }) : <>
                <td className="min-w-[150px] px-3 py-2" data-spi-priority={definition.spiId}>{priorityDefinitions.find(option => option.priorityRank === rank)?.label ?? (rank === undefined ? "Not configured" : `P${rank}`)}</td>
                <td className="px-3 py-2 text-xs text-slate-300/80">{rank === undefined ? "No priority configured." : `Non-compliant SPI ${definition.spiId} findings map to P${rank}.`} Unknown/Data Gap findings remain P90.</td>
              </>}
            </tr>;
          })}
          {!spiDefinitions.length && <tr><td colSpan={tab.matrix === "severity" ? MEASURES_ASSET_TYPES.length + 1 : 3} className="p-6 text-center text-slate-400">No SPI definitions are available.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>)}</>;
}
