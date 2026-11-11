"use client";

import Link from "@/components/persona-link";
import { FindingsDataTable } from "@/components/findings-data-table";
import { RiskEntityDetailsPanel } from "@/components/risk-entity-details-panel";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { NetworkDetailsModel } from "@/lib/network-details";

type LinkedSystem = NetworkDetailsModel["linkedSystems"][number];
const systemColumns: ExplorerColumn<LinkedSystem>[] = [
  { key: "name", label: "ICT System", value: system => system.name },
  { key: "criticality", label: "Criticality", value: system => system.criticality },
  { key: "securityDomain", label: "Security Domain", value: entity => entity.securityDomain }
];

export function NetworkDetailsPanel({ network, snapshotDate, securityDomain, onClose }: {
  network: NetworkDetailsModel; snapshotDate: string; securityDomain?: string; onClose: () => void;
}) {
  return <RiskEntityDetailsPanel details={network} entityLabel="Network" snapshotDate={snapshotDate} onClose={onClose}>
    <section className="network-details-card network-details-wide"><h3>Linked ICT Systems <span>{network.linkedSystems.length.toLocaleString("en-AU")}</span></h3>
      <FindingsDataTable title="Linked ICT Systems" rows={network.linkedSystems} columns={systemColumns}
        className="network-details-systems" paginate={false} columnFilters={false} searchText={system => system.id}
        emptyMessage="No linked ICT systems in this scope."
        renderRow={system => <tr key={system.id}><td><Link prefetch={false}
          href={`/ict-system-risk-profile?${new URLSearchParams({ system: system.id, dataDate: snapshotDate, ...(securityDomain ? { securityDomain } : {}) })}`}
          target="_blank" rel="noopener noreferrer" aria-label={`Open ${system.name} in a new tab`}>
          {system.name} <span aria-hidden="true">↗</span></Link><small>{system.id}</small></td>
          <td>{system.criticality}</td><td>{system.securityDomain}</td></tr>} />
    </section>
  </RiskEntityDetailsPanel>;
}
