"use client";

import Link from "next/link";
import { FindingsDataTable } from "@/components/findings-data-table";
import { RiskEntityDetailsPanel } from "@/components/risk-entity-details-panel";
import type { ExplorerColumn } from "@/lib/explorer-table";
import type { IctSystemDetailsModel } from "@/lib/ict-system-details";

type LinkedNetwork = IctSystemDetailsModel["linkedNetworks"][number];
const columns: ExplorerColumn<LinkedNetwork>[] = [
  { key: "name", label: "Network", value: network => network.name },
  { key: "criticality", label: "Criticality", value: network => network.criticality }
];

export function IctSystemDetailsPanel({ system, snapshotDate, onClose }: {
  system: IctSystemDetailsModel; snapshotDate: string; onClose: () => void;
}) {
  return <RiskEntityDetailsPanel details={system} entityLabel="ICT System" snapshotDate={snapshotDate} onClose={onClose} appId={system.apmNumber}>
    <section className="network-details-card network-details-wide"><h3>Linked Networks <span>{system.linkedNetworks.length.toLocaleString("en-AU")}</span></h3>
      <FindingsDataTable title="Linked Networks" rows={system.linkedNetworks} columns={columns}
        className="network-details-systems" paginate={false} columnFilters={false} searchText={network => network.id}
        emptyMessage="No linked managed networks in this scope."
        renderRow={network => <tr key={network.id}><td><Link prefetch={false}
          href={`/network-risk-profile?${new URLSearchParams({ network: network.id, dataDate: snapshotDate })}`}
          target="_blank" rel="noopener noreferrer" aria-label={`Open ${network.name} in a new tab`}>
          {network.name} <span aria-hidden="true">↗</span></Link><small>{network.id}</small></td>
          <td>{network.criticality}</td></tr>} />
    </section>
  </RiskEntityDetailsPanel>;
}
