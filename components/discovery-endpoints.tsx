"use client";

import { useMemo, useState } from "react";
import { CmdbDeviceName } from "@/components/cmdb-drill-through";

export interface DiscoveryEndpoint {
  assetId: string; hostname: string; ipAddress: string; assetType: string; network: string; system: string;
  environment: string; compliant: boolean; missingTools: string[];
}

export function DiscoveryEndpoints({ rows, compliance = false }: { rows: DiscoveryEndpoint[]; compliance?: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => rows.filter((row) => {
    if (status === "compliant" && !row.compliant || status === "gaps" && row.compliant) return false;
    return [row.hostname, row.ipAddress, row.assetType, row.network, row.system, ...row.missingTools].join(" ").toLowerCase().includes(search.trim().toLowerCase());
  }), [rows, search, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / 100));
  const current = Math.min(page, pages);
  return <section className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="flex flex-wrap items-center gap-3 border-b border-sky-400/15 p-3">
      <input type="search" className="min-w-0 flex-1 rounded border border-sky-300/30 bg-slate-950 px-3 py-2 text-sm" aria-label="Search endpoints" placeholder="Search name, IP, network, system or missing tool" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      <select aria-label="Discovery compliance" className="rounded border border-sky-300/30 bg-slate-950 px-3 py-2 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
        <option value="all">All endpoints</option><option value="compliant">Compliant</option><option value="gaps">Coverage gaps</option>
      </select>
      <span className="text-xs text-slate-300" role="status">{filtered.length.toLocaleString()} endpoints</span>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-slate-900 text-xs text-slate-300"><tr>{["Endpoint", "IP address", "Asset type", "Managed network", "ICT system", "Environment", "Compliance", ...(compliance ? ["Missing tools"] : [])].map((label) => <th className="whitespace-nowrap px-3 py-3" key={label}>{label}</th>)}</tr></thead>
        <tbody>{filtered.slice((current - 1) * 100, current * 100).map((row) => <tr key={row.assetId} className="border-t border-sky-400/10">
          <td className="px-3 py-3"><CmdbDeviceName assetId={row.assetId} name={row.hostname} /></td>
          {[row.ipAddress, row.assetType, row.network, row.system, row.environment].map((value, index) => <td key={index} className="px-3 py-3">{value}</td>)}
          <td className={`whitespace-nowrap px-3 py-3 ${row.compliant ? "text-emerald-200" : "text-amber-200"}`}>{row.compliant ? "Compliant" : "Coverage gaps"}</td>
          {compliance && <td className="px-3 py-3">{row.missingTools.join(", ") || "—"}</td>}
        </tr>)}
        {filtered.length === 0 && <tr><td colSpan={compliance ? 8 : 7} className="p-8 text-center text-slate-400">No endpoints match this scope and date.</td></tr>}</tbody>
      </table>
    </div>
    <div className="flex items-center justify-end gap-4 border-t border-sky-400/15 p-3 text-xs">
      <button type="button" disabled={current === 1} className="disabled:opacity-40" onClick={() => setPage(current - 1)}>Previous</button>
      <span>Page {current} of {pages}</span>
      <button type="button" disabled={current === pages} className="disabled:opacity-40" onClick={() => setPage(current + 1)}>Next</button>
    </div>
  </section>;
}
