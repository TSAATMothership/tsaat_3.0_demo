"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DetailedTopologyView } from "@/components/detailed-topology-view";
import type { NetworkTopologyData } from "@/lib/network-topology";
import type { SpiDefinition } from "@/lib/spi-definitions";
import { startRouteLoading } from "@/lib/route-loading";

export type SystemDetailTabId = "system-details" | "compliance-overview" | "discovery-compliance";

const tabs: Array<{ id: SystemDetailTabId; label: string }> = [
  { id: "system-details", label: "Details" },
  { id: "compliance-overview", label: "Compliance Overview" },
  { id: "discovery-compliance", label: "Discovery Compliance" }
];

export function SystemDetailTabs({
  activeTab,
  topologyData,
  spiDefinitions
}: {
  activeTab: SystemDetailTabId;
  topologyData: NetworkTopologyData;
  spiDefinitions: SpiDefinition[];
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [isDetailedTopologyOpen, setIsDetailedTopologyOpen] = useState(false);

  const onSelectTab = (tab: SystemDetailTabId) => {
    if (tab === activeTab) {
      return;
    }

    const params = new URLSearchParams((searchParams?.toString() ?? ""));
    if (tab === "system-details") {
      params.delete("systemDetailTab");
    } else {
      params.set("systemDetailTab", tab);
    }
    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    const label = tabs.find((candidate) => candidate.id === tab)?.label ?? "selected tab";
    startRouteLoading({ href, message: `Opening ${label}...` });
    router.replace(href);
  };

  return (
    <>
      <section className="panel shrink-0 overflow-hidden">
        <div className="border-b border-sky-400/15 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.13em] transition ${
                    activeTab === tab.id
                      ? "border-sky-200/60 bg-sky-500/20 text-sky-100"
                      : "border-sky-400/20 bg-slate-900/40 text-slate-200 hover:border-sky-300/45 hover:bg-slate-800/70"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsDetailedTopologyOpen(true)}
              className="ml-auto rounded-md border border-cyan-300/45 bg-cyan-500/12 px-3 py-2 text-xs font-semibold uppercase tracking-[0.13em] text-cyan-100 transition hover:bg-cyan-500/22"
            >
              ICT System Impact Analyser
            </button>
          </div>
        </div>
      </section>

      <DetailedTopologyView
        isOpen={isDetailedTopologyOpen}
        onClose={() => setIsDetailedTopologyOpen(false)}
        data={topologyData}
        spiDefinitions={spiDefinitions}
      />
    </>
  );
}
